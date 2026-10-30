const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const validDecisions = new Set(["want", "pass"]);
const validSurfaces = new Set(["home", "fresh", "local", "category", "trending", "profile", "detail"]);

const getSwipeResult = async (userId, desireId) => {
  const result = await db.query(
    `SELECT
       s.id AS swipe_id, s.decision::text AS decision, s.surface::text AS surface,
       s.created_at, s.updated_at,
       ds.want_count, ds.pass_count, ds.impression_count, ds.share_count,
       owner.id AS creator_user_id, owner.username AS creator_username,
       owner_stats.total_wants_generated,
       d.title
     FROM wants.swipes s
     JOIN wants.desires d ON d.id=s.desire_id
     JOIN wants.desire_stats ds ON ds.desire_id=d.id
     JOIN wants.users owner ON owner.id=d.user_id
     JOIN wants.user_stats owner_stats ON owner_stats.user_id=owner.id
     WHERE s.user_id=$1 AND s.desire_id=$2
     LIMIT 1`,
    [userId, desireId]
  );
  const row = result.rows[0];
  if (!row) throw new AppError("Swipe result was not found.", 404, "SWIPE_NOT_FOUND");

  const total = Number(row.want_count || 0) + Number(row.pass_count || 0);
  return {
    swipe: {
      id: row.swipe_id,
      desireId,
      decision: row.decision,
      surface: row.surface,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    },
    desire: {
      id: desireId,
      title: row.title,
      stats: {
        wants: Number(row.want_count || 0),
        passes: Number(row.pass_count || 0),
        impressions: Number(row.impression_count || 0),
        shares: Number(row.share_count || 0),
        wantRate: total ? Number((Number(row.want_count || 0) / total).toFixed(4)) : 0
      }
    },
    creator: {
      userId: row.creator_user_id,
      username: row.creator_username,
      totalWantsGenerated: Number(row.total_wants_generated || 0)
    }
  };
};

const swipe = async (userId, { desireId, decision, surface = "home", sessionKey = null }) => {
  const normalizedDecision = String(decision || "").trim().toLowerCase();
  const normalizedSurface = validSurfaces.has(surface) ? surface : "home";

  if (!validDecisions.has(normalizedDecision)) {
    throw new AppError("decision must be want or pass.", 400, "INVALID_SWIPE_DECISION");
  }

  return db.withTransaction(async (client) => {
    const desireResult = await client.query(
      `SELECT id, user_id, status::text AS status
       FROM wants.desires
       WHERE id=$1 AND deleted_at IS NULL
       FOR SHARE`,
      [desireId]
    );
    const desire = desireResult.rows[0];
    if (!desire || desire.status !== "published") {
      throw new AppError("Desire was not found.", 404, "DESIRE_NOT_FOUND");
    }
    if (desire.user_id === userId) {
      throw new AppError("You cannot swipe on your own desire.", 409, "OWN_DESIRE_SWIPE_NOT_ALLOWED");
    }

    await client.query(
      `INSERT INTO wants.swipes
        (user_id, desire_id, decision, surface, session_key)
       VALUES ($1,$2,$3::wants.swipe_decision,$4::wants.feed_surface,$5)
       ON CONFLICT (user_id, desire_id)
       DO UPDATE SET
         decision=EXCLUDED.decision,
         surface=EXCLUDED.surface,
         session_key=COALESCE(EXCLUDED.session_key, wants.swipes.session_key),
         updated_at=now()`,
      [userId, desireId, normalizedDecision, normalizedSurface, sessionKey]
    );

    await client.query(`SELECT wants.award_threshold_badges($1)`, [desire.user_id]);
    return true;
  }).then(() => getSwipeResult(userId, desireId));
};

const getHistory = async (userId, { limit = 50, decision = null } = {}) => {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
  const normalizedDecision = decision ? String(decision).trim().toLowerCase() : null;
  if (normalizedDecision && !validDecisions.has(normalizedDecision)) {
    throw new AppError("decision must be want or pass.", 400, "INVALID_SWIPE_DECISION");
  }

  const result = await db.query(
    `SELECT
       s.desire_id, s.decision::text AS decision, s.surface::text AS surface,
       s.created_at, s.updated_at,
       d.title, d.category_slug, d.category_name, d.username,
       d.want_count, d.pass_count, dm.url AS image_url, dm.thumbnail_url
     FROM wants.swipes s
     JOIN wants.v_published_desires d ON d.id=s.desire_id
     LEFT JOIN LATERAL (
       SELECT url, thumbnail_url FROM wants.desire_media m
       WHERE m.desire_id=s.desire_id ORDER BY m.sort_order ASC LIMIT 1
     ) dm ON true
     WHERE s.user_id=$1
       AND ($2::text IS NULL OR s.decision::text=$2)
     ORDER BY s.updated_at DESC
     LIMIT $3`,
    [userId, normalizedDecision, safeLimit]
  );
  return result.rows.map((row) => ({
    desireId: row.desire_id,
    decision: row.decision,
    surface: row.surface,
    title: row.title,
    category: { slug: row.category_slug, name: row.category_name },
    creatorUsername: row.username,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    wants: Number(row.want_count || 0),
    passes: Number(row.pass_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const getMyWants = (userId, options = {}) => getHistory(userId, { ...options, decision: "want" });

module.exports = { swipe, getHistory, getMyWants };
