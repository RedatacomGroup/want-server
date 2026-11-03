const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeLimit = (value, fallback = 20, max = 50) =>
  Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

const normalizeOffset = (value) =>
  Math.max(Number.parseInt(value, 10) || 0, 0);

const assertUserId = (value) => {
  const id = String(value || "").trim();
  if (!UUID_PATTERN.test(id)) {
    throw new AppError("Select a valid user.", 400, "INVALID_USER_ID");
  }
  return id;
};

const mapPerson = (row) => ({
  userId: row.user_id,
  username: row.username,
  displayName: row.display_name,
  bio: row.bio,
  profileImageUrl: row.profile_image_url,
  countryCode: row.country_code,
  totalWantsGenerated: Number(row.total_wants_generated || 0),
  desiresPosted: Number(row.desires_posted || 0),
  equippedBadge: row.equipped_badge_code
    ? {
        code: row.equipped_badge_code,
        name: row.equipped_badge_name,
        iconKey: row.equipped_badge_icon_key,
      }
    : null,
  isPinned: Boolean(row.is_pinned),
  pinnedAt: row.pinned_at || null,
});

const ensurePinnableUser = async (viewerUserId, targetUserId, executor = db) => {
  if (viewerUserId === targetUserId) {
    throw new AppError("You cannot pin yourself.", 409, "SELF_PIN_NOT_ALLOWED");
  }

  const result = await executor.query(
    `SELECT p.user_id
     FROM wants.v_public_profiles p
     WHERE p.user_id=$1
       AND NOT EXISTS (
         SELECT 1
         FROM wants.blocked_users b
         WHERE (b.blocker_user_id=$2 AND b.blocked_user_id=$1)
            OR (b.blocker_user_id=$1 AND b.blocked_user_id=$2)
       )
     LIMIT 1`,
    [targetUserId, viewerUserId],
  );

  if (!result.rows[0]) {
    throw new AppError(
      "This public profile is unavailable.",
      404,
      "PIN_TARGET_NOT_FOUND",
    );
  }
};

const searchUsers = async (viewerUserId, { q, limit = 20, offset = 0 } = {}) => {
  const query = String(q || "").trim();
  if (query.length < 2) {
    throw new AppError(
      "Search must contain at least two characters.",
      400,
      "SEARCH_QUERY_TOO_SHORT",
    );
  }

  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const searchTerm = `%${query.replace(/[\\%_]/g, "\\$&")}%`;

  const result = await db.query(
    `SELECT
       p.user_id,
       p.username,
       p.display_name,
       p.bio,
       p.profile_image_url,
       p.country_code,
       p.total_wants_generated,
       p.desires_posted,
       p.equipped_badge_code,
       p.equipped_badge_name,
       p.equipped_badge_icon_key,
       (pins.pinned_user_id IS NOT NULL) AS is_pinned,
       pins.created_at AS pinned_at
     FROM wants.v_public_profiles p
     LEFT JOIN wants.user_pins pins
       ON pins.user_id=$1
      AND pins.pinned_user_id=p.user_id
     WHERE p.user_id<>$1
       AND (
         lower(p.username) LIKE lower($2) ESCAPE '\\'
         OR lower(COALESCE(p.display_name, '')) LIKE lower($2) ESCAPE '\\'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM wants.blocked_users b
         WHERE (b.blocker_user_id=$1 AND b.blocked_user_id=p.user_id)
            OR (b.blocker_user_id=p.user_id AND b.blocked_user_id=$1)
       )
     ORDER BY
       CASE WHEN lower(p.username)=lower($3) THEN 0 ELSE 1 END,
       is_pinned DESC,
       p.total_wants_generated DESC,
       p.username ASC
     LIMIT $4 OFFSET $5`,
    [viewerUserId, searchTerm, query, safeLimit, safeOffset],
  );

  return result.rows.map(mapPerson);
};

const listPins = async (viewerUserId, { limit = 50, offset = 0 } = {}) => {
  const safeLimit = normalizeLimit(limit, 50, 50);
  const safeOffset = normalizeOffset(offset);

  const result = await db.query(
    `SELECT
       p.user_id,
       p.username,
       p.display_name,
       p.bio,
       p.profile_image_url,
       p.country_code,
       p.total_wants_generated,
       p.desires_posted,
       p.equipped_badge_code,
       p.equipped_badge_name,
       p.equipped_badge_icon_key,
       true AS is_pinned,
       pins.created_at AS pinned_at
     FROM wants.user_pins pins
     JOIN wants.v_public_profiles p ON p.user_id=pins.pinned_user_id
     WHERE pins.user_id=$1
       AND NOT EXISTS (
         SELECT 1
         FROM wants.blocked_users b
         WHERE (b.blocker_user_id=$1 AND b.blocked_user_id=p.user_id)
            OR (b.blocker_user_id=p.user_id AND b.blocked_user_id=$1)
       )
     ORDER BY pins.created_at DESC
     LIMIT $2 OFFSET $3`,
    [viewerUserId, safeLimit, safeOffset],
  );

  return result.rows.map(mapPerson);
};

const getPinStatus = async (viewerUserId, rawTargetUserId) => {
  const targetUserId = assertUserId(rawTargetUserId);
  if (viewerUserId === targetUserId) return { isPinned: false };

  const result = await db.query(
    `SELECT created_at
     FROM wants.user_pins
     WHERE user_id=$1 AND pinned_user_id=$2
     LIMIT 1`,
    [viewerUserId, targetUserId],
  );

  return {
    isPinned: Boolean(result.rows[0]),
    pinnedAt: result.rows[0]?.created_at || null,
  };
};

const pinUser = async (viewerUserId, rawTargetUserId) => {
  const targetUserId = assertUserId(rawTargetUserId);

  return db.withTransaction(async (client) => {
    await ensurePinnableUser(viewerUserId, targetUserId, client);

    const result = await client.query(
      `INSERT INTO wants.user_pins (user_id, pinned_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, pinned_user_id)
       DO UPDATE SET created_at=wants.user_pins.created_at
       RETURNING pinned_user_id, created_at`,
      [viewerUserId, targetUserId],
    );

    return {
      pinnedUserId: result.rows[0].pinned_user_id,
      isPinned: true,
      pinnedAt: result.rows[0].created_at,
    };
  });
};

const unpinUser = async (viewerUserId, rawTargetUserId) => {
  const targetUserId = assertUserId(rawTargetUserId);

  await db.query(
    `DELETE FROM wants.user_pins
     WHERE user_id=$1 AND pinned_user_id=$2`,
    [viewerUserId, targetUserId],
  );

  return { pinnedUserId: targetUserId, isPinned: false };
};

module.exports = {
  searchUsers,
  listPins,
  getPinStatus,
  pinUser,
  unpinUser,
};
