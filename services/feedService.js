const crypto = require("crypto");
const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const normalizeLimit = (value, fallback = 20, max = 50) =>
  Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

const normalizeSurface = (value, fallback = "home") => {
  const allowed = new Set(["home", "fresh", "local", "category", "trending", "profile", "detail"]);
  return allowed.has(value) ? value : fallback;
};

const mapFeedRow = (row) => ({
  id: row.id,
  creator: {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    profileImageUrl: row.profile_image_url,
    totalWantsGenerated: Number(row.creator_wants_generated || 0),
    equippedBadge: row.equipped_badge_code
      ? { code: row.equipped_badge_code, name: row.equipped_badge_name, iconKey: row.equipped_badge_icon_key }
      : null
  },
  category: { id: row.category_id, slug: row.category_slug, name: row.category_name },
  title: row.title,
  caption: row.caption,
  brandName: row.brand_name,
  productName: row.product_name,
  sourceUrl: row.source_url,
  countryCode: row.country_code,
  image: row.image_url
    ? {
        url: row.image_url,
        thumbnailUrl: row.thumbnail_url,
        mimeType: row.mime_type,
        altText: row.alt_text
      }
    : null,
  stats: {
    wants: Number(row.want_count || 0),
    passes: Number(row.pass_count || 0),
    impressions: Number(row.impression_count || 0),
    shares: Number(row.share_count || 0),
    wantRate: Number(row.want_rate || 0)
  },
  viewerDecision: row.viewer_decision || null,
  publishedAt: row.published_at
});

const getFeed = async (userId, { limit, category, surface = "home" } = {}) => {
  const safeLimit = normalizeLimit(limit);
  const safeSurface = normalizeSurface(surface);
  const sessionKey = crypto.randomUUID();

  const result = await db.query(
    `WITH viewer AS (
       SELECT p.country_code
       FROM wants.user_profiles p
       WHERE p.user_id=$1
     ), candidates AS (
       SELECT
         d.id, d.user_id, d.category_id, d.category_slug, d.category_name,
         d.username, up.display_name, up.profile_image_url,
         d.title, d.caption, d.brand_name, d.product_name, d.source_url,
         d.country_code, d.published_at, d.want_count, d.pass_count,
         d.impression_count, d.share_count, d.want_rate,
         us.total_wants_generated AS creator_wants_generated,
         b.code AS equipped_badge_code, b.name AS equipped_badge_name,
         b.icon_key AS equipped_badge_icon_key,
         dm.url AS image_url, dm.thumbnail_url, dm.mime_type, dm.alt_text,
         s.decision::text AS viewer_decision,
         CASE WHEN ui.interest_id IS NOT NULL THEN 1 ELSE 0 END AS interest_match,
         CASE WHEN d.country_code IS NOT NULL AND d.country_code=(SELECT country_code FROM viewer) THEN 1 ELSE 0 END AS country_match
       FROM wants.v_published_desires d
       JOIN wants.user_profiles up ON up.user_id=d.user_id
       JOIN wants.user_stats us ON us.user_id=d.user_id
       LEFT JOIN wants.swipes s ON s.user_id=$1 AND s.desire_id=d.id
       LEFT JOIN wants.user_interests ui ON ui.user_id=$1 AND ui.interest_id=d.category_id
       LEFT JOIN wants.user_equipped_badges eb ON eb.user_id=d.user_id
       LEFT JOIN wants.user_badges ub ON ub.id=eb.user_badge_id AND ub.revoked_at IS NULL
       LEFT JOIN wants.badges b ON b.id=ub.badge_id
       LEFT JOIN LATERAL (
         SELECT url, thumbnail_url, mime_type, alt_text
         FROM wants.desire_media x
         WHERE x.desire_id=d.id
         ORDER BY x.sort_order ASC LIMIT 1
       ) dm ON true
       WHERE d.user_id<>$1
         AND s.id IS NULL
         AND ($2::text IS NULL OR d.category_slug=$2)
       ORDER BY
         interest_match DESC,
         country_match DESC,
         d.trending_score DESC,
         d.published_at DESC NULLS LAST,
         random()
       LIMIT $3
     )
     SELECT * FROM candidates`,
    [userId, category ? String(category).trim().toLowerCase() : null, safeLimit]
  );

  if (result.rows.length) {
    const desireIds = result.rows.map((row) => row.id);
    await db.query(
      `INSERT INTO wants.feed_impressions (user_id, desire_id, surface, session_key, position)
       SELECT $1, x.desire_id, $2::wants.feed_surface, $3,
              row_number() OVER () - 1
       FROM unnest($4::uuid[]) AS x(desire_id)`,
      [userId, safeSurface, sessionKey, desireIds]
    );
  }

  return {
    sessionKey,
    surface: safeSurface,
    items: result.rows.map(mapFeedRow),
    hasMore: result.rows.length === safeLimit
  };
};

const getFreshFeed = async (userId, { limit = 20 } = {}) => {
  return getFeed(userId, { limit, surface: "fresh" });
};

const getLocalFeed = async (userId, { limit = 20 } = {}) => {
  const country = await db.query(`SELECT country_code FROM wants.user_profiles WHERE user_id=$1`, [userId]);
  const countryCode = country.rows[0]?.country_code;
  if (!countryCode) throw new AppError("Set your country before using the local feed.", 400, "COUNTRY_REQUIRED");

  const safeLimit = normalizeLimit(limit);
  const sessionKey = crypto.randomUUID();
  const result = await db.query(
    `SELECT
       d.id, d.user_id, d.category_id, d.category_slug, d.category_name,
       d.username, up.display_name, up.profile_image_url,
       d.title, d.caption, d.brand_name, d.product_name, d.source_url,
       d.country_code, d.published_at, d.want_count, d.pass_count,
       d.impression_count, d.share_count, d.want_rate,
       us.total_wants_generated AS creator_wants_generated,
       b.code AS equipped_badge_code, b.name AS equipped_badge_name,
       b.icon_key AS equipped_badge_icon_key,
       dm.url AS image_url, dm.thumbnail_url, dm.mime_type, dm.alt_text,
       NULL::text AS viewer_decision
     FROM wants.v_published_desires d
     JOIN wants.user_profiles up ON up.user_id=d.user_id
     JOIN wants.user_stats us ON us.user_id=d.user_id
     LEFT JOIN wants.swipes s ON s.user_id=$1 AND s.desire_id=d.id
     LEFT JOIN wants.user_equipped_badges eb ON eb.user_id=d.user_id
     LEFT JOIN wants.user_badges ub ON ub.id=eb.user_badge_id AND ub.revoked_at IS NULL
     LEFT JOIN wants.badges b ON b.id=ub.badge_id
     LEFT JOIN LATERAL (
       SELECT url, thumbnail_url, mime_type, alt_text FROM wants.desire_media x
       WHERE x.desire_id=d.id ORDER BY x.sort_order ASC LIMIT 1
     ) dm ON true
     WHERE d.user_id<>$1 AND s.id IS NULL AND d.country_code=$2
     ORDER BY d.trending_score DESC, d.published_at DESC NULLS LAST, random()
     LIMIT $3`,
    [userId, countryCode, safeLimit]
  );

  if (result.rows.length) {
    await db.query(
      `INSERT INTO wants.feed_impressions (user_id, desire_id, surface, session_key, position)
       SELECT $1, x.desire_id, 'local'::wants.feed_surface, $2,
              row_number() OVER () - 1
       FROM unnest($3::uuid[]) AS x(desire_id)`,
      [userId, sessionKey, result.rows.map((row) => row.id)]
    );
  }

  return { sessionKey, surface: "local", countryCode, items: result.rows.map(mapFeedRow), hasMore: result.rows.length === safeLimit };
};

module.exports = { getFeed, getFreshFeed, getLocalFeed };
