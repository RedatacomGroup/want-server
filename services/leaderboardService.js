const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const normalizeLimit = (value, fallback = 50, max = 100) =>
  Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

const mapUser = (row, rankField) => ({
  rank: Number(row[rankField]),
  userId: row.user_id,
  username: row.username,
  displayName: row.display_name,
  profileImageUrl: row.profile_image_url,
  countryCode: row.country_code,
  totalWantsGenerated: Number(row.total_wants_generated || row.category_wants_generated || 0),
  desiresPosted: Number(row.desires_posted || row.category_desires || 0),
  equippedBadge: row.equipped_badge_code ? {
    code: row.equipped_badge_code,
    name: row.equipped_badge_name,
    iconKey: row.equipped_badge_icon_key
  } : null
});

const globalLeaderboard = async ({ limit = 50 } = {}) => {
  const safeLimit = normalizeLimit(limit);
  const result = await db.query(
    `SELECT g.*, p.equipped_badge_code, p.equipped_badge_name, p.equipped_badge_icon_key
     FROM wants.v_global_tastemakers g
     JOIN wants.v_public_profiles p ON p.user_id=g.user_id
     ORDER BY g.global_rank ASC, g.total_wants_generated DESC, g.username ASC
     LIMIT $1`, [safeLimit]
  );
  return result.rows.map((row) => mapUser(row, "global_rank"));
};

const countryLeaderboard = async (countryCode, { limit = 50 } = {}) => {
  const code = String(countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new AppError("Country code must contain two letters.", 400, "INVALID_COUNTRY_CODE");
  const safeLimit = normalizeLimit(limit);
  const result = await db.query(
    `SELECT c.*, p.equipped_badge_code, p.equipped_badge_name, p.equipped_badge_icon_key
     FROM wants.v_country_tastemakers c
     JOIN wants.v_public_profiles p ON p.user_id=c.user_id
     WHERE c.country_code=$1
     ORDER BY c.country_rank ASC, c.total_wants_generated DESC, c.username ASC
     LIMIT $2`, [code, safeLimit]
  );
  return { countryCode: code, items: result.rows.map((row) => mapUser(row, "country_rank")) };
};

const categoryLeaderboard = async (categorySlug, { limit = 50 } = {}) => {
  const slug = String(categorySlug || "").trim().toLowerCase();
  const category = await db.query(`SELECT slug,name FROM wants.categories WHERE slug=$1 AND is_active=true LIMIT 1`, [slug]);
  if (!category.rows[0]) throw new AppError("Category was not found.", 404, "CATEGORY_NOT_FOUND");
  const safeLimit = normalizeLimit(limit);
  const result = await db.query(
    `SELECT c.*, p.display_name,p.profile_image_url,p.country_code,
            p.equipped_badge_code,p.equipped_badge_name,p.equipped_badge_icon_key
     FROM wants.v_category_tastemakers c
     JOIN wants.v_public_profiles p ON p.user_id=c.user_id
     WHERE c.category_slug=$1
     ORDER BY c.category_rank ASC, c.category_wants_generated DESC, c.username ASC
     LIMIT $2`, [slug, safeLimit]
  );
  return { category: category.rows[0], items: result.rows.map((row) => mapUser(row, "category_rank")) };
};

const hotNowLeaderboard = async ({ limit = 50, days = 7 } = {}) => {
  const safeLimit = normalizeLimit(limit);
  const safeDays = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 30);
  const result = await db.query(
    `WITH scores AS (
       SELECT
         p.user_id,p.username,p.display_name,p.profile_image_url,p.country_code,
         p.desires_posted,p.total_wants_generated,
         p.equipped_badge_code,p.equipped_badge_name,p.equipped_badge_icon_key,
         COALESCE(SUM(m.wants_generated),0)::bigint AS recent_wants_generated
       FROM wants.v_public_profiles p
       LEFT JOIN wants.user_daily_metrics m ON m.user_id=p.user_id
        AND m.metric_date >= CURRENT_DATE - ($1::integer - 1)
       GROUP BY p.user_id,p.username,p.display_name,p.profile_image_url,p.country_code,
                p.desires_posted,p.total_wants_generated,p.equipped_badge_code,
                p.equipped_badge_name,p.equipped_badge_icon_key
     ), ranked AS (
       SELECT *, dense_rank() OVER (ORDER BY recent_wants_generated DESC, total_wants_generated DESC) AS hot_rank
       FROM scores
     )
     SELECT * FROM ranked ORDER BY hot_rank ASC, username ASC LIMIT $2`, [safeDays, safeLimit]
  );
  return {
    days: safeDays,
    items: result.rows.map((row) => ({ ...mapUser(row, "hot_rank"), recentWantsGenerated: Number(row.recent_wants_generated || 0) }))
  };
};

module.exports = { globalLeaderboard, countryLeaderboard, categoryLeaderboard, hotNowLeaderboard };
