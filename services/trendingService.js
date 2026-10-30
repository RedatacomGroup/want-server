const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const normalizeLimit = (value, fallback = 20, max = 100) =>
  Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

const normalizeWindowHours = (value, fallback = 24) => {
  const allowed = new Set([1, 6, 12, 24, 72, 168, 720]);
  const parsed = Number.parseInt(value, 10) || fallback;
  return allowed.has(parsed) ? parsed : fallback;
};

const mapDesire = (row) => ({
  rank: Number(row.rank),
  id: row.id,
  creator: {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    profileImageUrl: row.profile_image_url,
    totalWantsGenerated: Number(row.creator_wants_generated || 0)
  },
  category: { slug: row.category_slug, name: row.category_name },
  title: row.title,
  caption: row.caption,
  countryCode: row.country_code,
  image: row.image_url ? { url: row.image_url, thumbnailUrl: row.thumbnail_url } : null,
  stats: {
    wants: Number(row.want_count || 0),
    passes: Number(row.pass_count || 0),
    lifetimeImpressions: Number(row.impression_count || 0),
    recentWants: Number(row.recent_wants || 0),
    recentPasses: Number(row.recent_passes || 0),
    recentImpressions: Number(row.recent_impressions || 0),
    recentShares: Number(row.recent_shares || 0),
    recentWantRate: Number(row.recent_want_rate || 0),
    score: Number(row.score || 0)
  },
  publishedAt: row.published_at
});

const buildTrendingQuery = ({ filterSql = "", filterParams = [] } = {}) => async ({ limit = 20, hours = 24 } = {}) => {
  const safeLimit = normalizeLimit(limit);
  const safeHours = normalizeWindowHours(hours);
  const result = await db.query(
    `WITH recent AS (
       SELECT
         d.id, d.user_id, d.username, up.display_name, up.profile_image_url,
         d.category_slug, d.category_name, d.title, d.caption, d.country_code,
         d.published_at, d.want_count, d.pass_count, d.impression_count,
         us.total_wants_generated AS creator_wants_generated,
         COALESCE(SUM(m.wants),0)::bigint AS recent_wants,
         COALESCE(SUM(m.passes),0)::bigint AS recent_passes,
         COALESCE(SUM(m.impressions),0)::bigint AS recent_impressions,
         COALESCE(SUM(m.shares),0)::bigint AS recent_shares,
         dm.url AS image_url, dm.thumbnail_url
       FROM wants.v_published_desires d
       JOIN wants.user_profiles up ON up.user_id=d.user_id
       JOIN wants.user_stats us ON us.user_id=d.user_id
       LEFT JOIN wants.desire_daily_metrics m
         ON m.desire_id=d.id
        AND m.metric_date >= ((now() - ($1::integer * interval '1 hour')) AT TIME ZONE 'UTC')::date
       LEFT JOIN LATERAL (
         SELECT url, thumbnail_url FROM wants.desire_media x
         WHERE x.desire_id=d.id ORDER BY x.sort_order ASC LIMIT 1
       ) dm ON true
       WHERE 1=1 ${filterSql}
       GROUP BY d.id,d.user_id,d.username,up.display_name,up.profile_image_url,
                d.category_slug,d.category_name,d.title,d.caption,d.country_code,
                d.published_at,d.want_count,d.pass_count,d.impression_count,
                us.total_wants_generated,dm.url,dm.thumbnail_url
     ), scored AS (
       SELECT *,
         CASE WHEN (recent_wants+recent_passes)=0 THEN 0
              ELSE round(recent_wants::numeric/(recent_wants+recent_passes),4) END AS recent_want_rate,
         round(
           (recent_wants * 5.0) +
           (recent_shares * 3.0) +
           (recent_impressions * 0.10) +
           (CASE WHEN recent_wants+recent_passes=0 THEN 0
                 ELSE (recent_wants::numeric/(recent_wants+recent_passes))*10 END)
         ,6) AS score
       FROM recent
     ), ranked AS (
       SELECT *, dense_rank() OVER (ORDER BY score DESC, recent_wants DESC, want_count DESC, published_at DESC) AS rank
       FROM scored
     )
     SELECT * FROM ranked ORDER BY rank ASC, published_at DESC LIMIT $${2 + filterParams.length}`,
    [safeHours, ...filterParams, safeLimit]
  );
  return { windowHours: safeHours, items: result.rows.map(mapDesire) };
};

const globalTrending = buildTrendingQuery();
const countryTrending = (countryCode, options) => {
  const code = String(countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new AppError("Country code must contain two letters.", 400, "INVALID_COUNTRY_CODE");
  return buildTrendingQuery({ filterSql: "AND d.country_code=$2", filterParams: [code] })(options).then((data) => ({ countryCode: code, ...data }));
};
const categoryTrending = async (categorySlug, options) => {
  const slug = String(categorySlug || "").trim().toLowerCase();
  const category = await db.query(`SELECT slug,name FROM wants.categories WHERE slug=$1 AND is_active=true LIMIT 1`, [slug]);
  if (!category.rows[0]) throw new AppError("Category was not found.", 404, "CATEGORY_NOT_FOUND");
  const data = await buildTrendingQuery({ filterSql: "AND d.category_slug=$2", filterParams: [slug] })(options);
  return { category: category.rows[0], ...data };
};

module.exports = { globalTrending, countryTrending, categoryTrending };
