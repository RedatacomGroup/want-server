const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const VALID_TYPES = new Set([
  "badge_unlocked",
  "desire_milestone",
  "desire_trending",
  "rank_changed",
  "moderation",
  "system",
]);

const PREFERENCE_FIELDS = new Set([
  "badgeUnlocked",
  "desireMilestone",
  "desireTrending",
  "rankChanged",
  "system",
]);

const PREFERENCE_COLUMNS = {
  badgeUnlocked: "badge_unlocked",
  desireMilestone: "desire_milestone",
  desireTrending: "desire_trending",
  rankChanged: "rank_changed",
  system: "system",
};

const normalizeLimit = (value, fallback = 30, max = 100) =>
  Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

const normalizeOffset = (value) =>
  Math.max(Number.parseInt(value, 10) || 0, 0);

const parseBooleanQuery = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new AppError(`${field} must be true or false.`, 400, "INVALID_NOTIFICATION_FILTER");
};

const mapNotification = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  data: row.data || {},
  read: Boolean(row.read_at),
  readAt: row.read_at || null,
  createdAt: row.created_at,
});

const mapPreferences = (row) => ({
  badgeUnlocked: Boolean(row.badge_unlocked),
  desireMilestone: Boolean(row.desire_milestone),
  desireTrending: Boolean(row.desire_trending),
  rankChanged: Boolean(row.rank_changed),
  system: Boolean(row.system),
  updatedAt: row.updated_at,
});

const preferenceAllows = async (userId, type, executor = db) => {
  // Moderation is deliberately treated as account-critical and is not suppressible
  // by the current notification_preferences schema.
  if (type === "moderation") return true;

  const columnByType = {
    badge_unlocked: "badge_unlocked",
    desire_milestone: "desire_milestone",
    desire_trending: "desire_trending",
    rank_changed: "rank_changed",
    system: "system",
  };

  const column = columnByType[type];
  if (!column) return true;

  const result = await executor.query(
    `SELECT ${column} AS enabled
     FROM wants.notification_preferences
     WHERE user_id=$1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.enabled !== false;
};

const createNotification = async (
  { userId, type, title, body, data = {}, respectPreferences = true },
  executor = db
) => {
  if (!userId) {
    throw new AppError("userId is required.", 400, "NOTIFICATION_USER_REQUIRED");
  }
  if (!VALID_TYPES.has(type)) {
    throw new AppError("Notification type is invalid.", 400, "INVALID_NOTIFICATION_TYPE");
  }

  const cleanTitle = String(title || "").trim();
  const cleanBody = String(body || "").trim();
  if (!cleanTitle || cleanTitle.length > 120) {
    throw new AppError("Notification title must be 1-120 characters.", 400, "INVALID_NOTIFICATION_TITLE");
  }
  if (!cleanBody || cleanBody.length > 500) {
    throw new AppError("Notification body must be 1-500 characters.", 400, "INVALID_NOTIFICATION_BODY");
  }

  if (respectPreferences && !(await preferenceAllows(userId, type, executor))) {
    return { created: false, suppressed: true, notification: null };
  }

  const result = await executor.query(
    `INSERT INTO wants.notifications (user_id,type,title,body,data)
     VALUES ($1,$2::wants.notification_type,$3,$4,$5::jsonb)
     RETURNING id,type::text AS type,title,body,data,read_at,created_at`,
    [userId, type, cleanTitle, cleanBody, JSON.stringify(data || {})]
  );

  return {
    created: true,
    suppressed: false,
    notification: mapNotification(result.rows[0]),
  };
};

const listNotifications = async (
  userId,
  { limit = 30, offset = 0, unread = null, type = null } = {}
) => {
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const unreadOnly = parseBooleanQuery(unread, "unread");
  const normalizedType = type ? String(type).trim().toLowerCase() : null;

  if (normalizedType && !VALID_TYPES.has(normalizedType)) {
    throw new AppError("Notification type is invalid.", 400, "INVALID_NOTIFICATION_TYPE");
  }

  const result = await db.query(
    `SELECT id,type::text AS type,title,body,data,read_at,created_at
     FROM wants.notifications
     WHERE user_id=$1
       AND ($2::boolean IS NULL OR ($2=true AND read_at IS NULL) OR ($2=false AND read_at IS NOT NULL))
       AND ($3::text IS NULL OR type::text=$3)
     ORDER BY created_at DESC,id DESC
     LIMIT $4 OFFSET $5`,
    [userId, unreadOnly, normalizedType, safeLimit, safeOffset]
  );

  return {
    items: result.rows.map(mapNotification),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: result.rowCount,
      hasMore: result.rowCount === safeLimit,
    },
  };
};

const getUnreadCount = async (userId) => {
  const result = await db.query(
    `SELECT count(*)::integer AS unread_count
     FROM wants.notifications
     WHERE user_id=$1 AND read_at IS NULL`,
    [userId]
  );
  return Number(result.rows[0]?.unread_count || 0);
};

const markRead = async (userId, notificationId) => {
  const result = await db.query(
    `UPDATE wants.notifications
     SET read_at=COALESCE(read_at,now())
     WHERE id=$1 AND user_id=$2
     RETURNING id,type::text AS type,title,body,data,read_at,created_at`,
    [notificationId, userId]
  );

  if (!result.rows[0]) {
    throw new AppError("Notification was not found.", 404, "NOTIFICATION_NOT_FOUND");
  }
  return mapNotification(result.rows[0]);
};

const markUnread = async (userId, notificationId) => {
  const result = await db.query(
    `UPDATE wants.notifications
     SET read_at=NULL
     WHERE id=$1 AND user_id=$2
     RETURNING id,type::text AS type,title,body,data,read_at,created_at`,
    [notificationId, userId]
  );
  if (!result.rows[0]) {
    throw new AppError("Notification was not found.", 404, "NOTIFICATION_NOT_FOUND");
  }
  return mapNotification(result.rows[0]);
};

const markAllRead = async (userId) => {
  const result = await db.query(
    `UPDATE wants.notifications
     SET read_at=now()
     WHERE user_id=$1 AND read_at IS NULL
     RETURNING id`,
    [userId]
  );
  return { updated: result.rowCount };
};

const deleteNotification = async (userId, notificationId) => {
  const result = await db.query(
    `DELETE FROM wants.notifications
     WHERE id=$1 AND user_id=$2
     RETURNING id`,
    [notificationId, userId]
  );
  if (!result.rows[0]) {
    throw new AppError("Notification was not found.", 404, "NOTIFICATION_NOT_FOUND");
  }
  return { id: result.rows[0].id, deleted: true };
};

const getPreferences = async (userId) => {
  const result = await db.query(
    `SELECT badge_unlocked,desire_milestone,desire_trending,rank_changed,system,updated_at
     FROM wants.notification_preferences
     WHERE user_id=$1
     LIMIT 1`,
    [userId]
  );
  if (!result.rows[0]) {
    throw new AppError("Notification preferences were not found.", 404, "NOTIFICATION_PREFERENCES_NOT_FOUND");
  }
  return mapPreferences(result.rows[0]);
};

const updatePreferences = async (userId, body) => {
  const supplied = Object.keys(body || {});
  const unsupported = supplied.filter((key) => !PREFERENCE_FIELDS.has(key));
  if (unsupported.length) {
    throw new AppError(
      `Unsupported notification preference fields: ${unsupported.join(", ")}`,
      400,
      "UNSUPPORTED_NOTIFICATION_PREFERENCES"
    );
  }
  if (!supplied.length) return getPreferences(userId);

  const assignments = [];
  const values = [userId];
  for (const key of supplied) {
    if (typeof body[key] !== "boolean") {
      throw new AppError(`${key} must be boolean.`, 400, "INVALID_NOTIFICATION_PREFERENCE");
    }
    values.push(body[key]);
    assignments.push(`${PREFERENCE_COLUMNS[key]}=$${values.length}`);
  }

  const result = await db.query(
    `UPDATE wants.notification_preferences
     SET ${assignments.join(", ")},updated_at=now()
     WHERE user_id=$1
     RETURNING badge_unlocked,desire_milestone,desire_trending,rank_changed,system,updated_at`,
    values
  );
  if (!result.rows[0]) {
    throw new AppError("Notification preferences were not found.", 404, "NOTIFICATION_PREFERENCES_NOT_FOUND");
  }
  return mapPreferences(result.rows[0]);
};

module.exports = {
  createNotification,
  listNotifications,
  getUnreadCount,
  markRead,
  markUnread,
  markAllRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
};
