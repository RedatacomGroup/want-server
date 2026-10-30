const db = require("../config/db");
const storageConfig = require("../config/storage");
const storageService = require("./storageService");
const { AppError } = require("../middleware/errorMiddleware");

const DESIRE_SELECT = `
  SELECT
    d.id, d.user_id, d.category_id, c.slug AS category_slug,
    c.name AS category_name, d.title, d.caption, d.brand_name,
    d.product_name, d.source_url, d.country_code, d.status,
    d.published_at, d.created_at, d.updated_at,
    u.username, p.display_name, p.profile_image_url,
    ds.want_count, ds.pass_count, ds.impression_count,
    ds.unique_viewers, ds.share_count, ds.trending_score,
    ds.breakout_score,
    m.id AS media_id, m.storage_key, m.url AS image_url,
    m.thumbnail_url, m.mime_type, m.width, m.height, m.bytes,
    m.alt_text
  FROM wants.desires d
  JOIN wants.users u ON u.id=d.user_id
  JOIN wants.user_profiles p ON p.user_id=d.user_id
  JOIN wants.categories c ON c.id=d.category_id
  JOIN wants.desire_stats ds ON ds.desire_id=d.id
  LEFT JOIN LATERAL (
    SELECT * FROM wants.desire_media dm
    WHERE dm.desire_id=d.id
    ORDER BY dm.sort_order ASC LIMIT 1
  ) m ON true
`;

const serializeDesire = (row) => ({
  id: row.id,
  creator: {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    profileImageUrl: row.profile_image_url
  },
  category: {
    id: row.category_id,
    slug: row.category_slug,
    name: row.category_name
  },
  title: row.title,
  caption: row.caption,
  brandName: row.brand_name,
  productName: row.product_name,
  sourceUrl: row.source_url,
  countryCode: row.country_code,
  status: row.status,
  image: row.media_id ? {
    id: row.media_id,
    url: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    bytes: row.bytes ? Number(row.bytes) : null,
    altText: row.alt_text
  } : null,
  stats: {
    wants: Number(row.want_count || 0),
    passes: Number(row.pass_count || 0),
    impressions: Number(row.impression_count || 0),
    uniqueViewers: Number(row.unique_viewers || 0),
    shares: Number(row.share_count || 0),
    trendingScore: Number(row.trending_score || 0),
    breakoutScore: Number(row.breakout_score || 0)
  },
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const cleanNullable = (value, maxLength, label) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const cleaned = String(value).trim();
  if (cleaned.length > maxLength) {
    throw new AppError(`${label} must not exceed ${maxLength} characters.`, 400, "INVALID_DESIRE_FIELD");
  }
  return cleaned;
};

const validateSourceUrl = (value) => {
  const cleaned = cleanNullable(value, 2000, "Source URL");
  if (!cleaned) return cleaned;
  try {
    const parsed = new URL(cleaned);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch (_) {
    throw new AppError("Source URL must be a valid HTTP or HTTPS URL.", 400, "INVALID_SOURCE_URL");
  }
};

const parseTags = (value) => {
  if (value === undefined || value === null || value === "") return [];
  let tags = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try { tags = JSON.parse(trimmed); } catch (_) { tags = trimmed.split(","); }
    } else {
      tags = trimmed.split(",");
    }
  }
  if (!Array.isArray(tags)) throw new AppError("Tags must be an array or comma-separated string.", 400, "INVALID_TAGS");
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))]
    .filter((tag) => /^[a-z0-9][a-z0-9-]{0,59}$/.test(tag))
    .slice(0, 12);
};

const getCategory = async (categorySlug, executor = db) => {
  const result = await executor.query(
    `SELECT id, slug, name FROM wants.categories WHERE slug=lower($1) AND is_active=true LIMIT 1`,
    [String(categorySlug || "").trim()]
  );
  if (!result.rows[0]) throw new AppError("Select a valid desire category.", 400, "INVALID_CATEGORY");
  return result.rows[0];
};

const getDesireById = async (desireId, { includeUnpublishedForUserId = null } = {}) => {
  const params = [desireId];
  let visibility = "d.status='published' AND d.deleted_at IS NULL";
  if (includeUnpublishedForUserId) {
    params.push(includeUnpublishedForUserId);
    visibility = "d.deleted_at IS NULL AND (d.status='published' OR d.user_id=$2)";
  }
  const result = await db.query(`${DESIRE_SELECT} WHERE d.id=$1 AND ${visibility} LIMIT 1`, params);
  if (!result.rows[0]) throw new AppError("Desire was not found.", 404, "DESIRE_NOT_FOUND");
  return serializeDesire(result.rows[0]);
};

const createDesire = async (userId, body, file) => {
  if (!file) throw new AppError("A desire image is required.", 400, "DESIRE_IMAGE_REQUIRED");

  const title = cleanNullable(body.title, 120, "Title");
  if (!title || title.length < 2) throw new AppError("Title must contain at least two characters.", 400, "INVALID_TITLE");

  const caption = cleanNullable(body.caption, 500, "Caption");
  const brandName = cleanNullable(body.brandName, 120, "Brand name");
  const productName = cleanNullable(body.productName, 160, "Product name");
  const sourceUrl = validateSourceUrl(body.sourceUrl);
  const altText = cleanNullable(body.altText, 240, "Alt text") || title;
  const tags = parseTags(body.tags);
  const category = await getCategory(body.categorySlug);

  const countryResult = await db.query(`SELECT country_code FROM wants.user_profiles WHERE user_id=$1`, [userId]);
  const countryCode = countryResult.rows[0]?.country_code || null;
  const stored = await storageService.uploadDesireImage(file, userId);

  try {
    const desireId = await db.withTransaction(async (client) => {
      const status = storageConfig.autoPublish ? "published" : "pending";
      const insert = await client.query( `INSERT INTO wants.desires ( user_id, category_id, title, caption, brand_name, product_name, source_url, country_code, status, published_at ) VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9::wants.desire_status, CASE WHEN $9::wants.desire_status = 'published'::wants.desire_status THEN now() ELSE NULL END ) RETURNING id`, [ userId, category.id, title, caption, brandName, productName, sourceUrl, countryCode, status, ] );
      const id = insert.rows[0].id;

      await client.query(
        `INSERT INTO wants.desire_media
          (desire_id, kind, storage_key, url, thumbnail_url, mime_type,
           width, height, bytes, alt_text, sort_order)
         VALUES ($1,'image',$2,$3,$4,$5,$6,$7,$8,$9,0)`,
        [id, stored.storageKey, stored.url, stored.thumbnailUrl, stored.mimeType,
          stored.width, stored.height, stored.bytes, altText]
      );

      if (tags.length) {
        await client.query(
          `INSERT INTO wants.desire_tags (desire_id, tag, source)
           SELECT $1, unnest($2::text[]), 'user'
           ON CONFLICT (desire_id, tag) DO NOTHING`,
          [id, tags]
        );
      }

      await client.query(`SELECT wants.award_threshold_badges($1)`, [userId]);
      return id;
    });

    return getDesireById(desireId, { includeUnpublishedForUserId: userId });
  } catch (error) {
    await storageService.deleteStoredAsset(stored).catch(() => {});
    throw error;
  }
};

const updateDesire = async (userId, desireId, body) => db.withTransaction(async (client) => {
  const owner = await client.query(
    `SELECT id FROM wants.desires WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`,
    [desireId, userId]
  );
  if (!owner.rows[0]) throw new AppError("Desire was not found or is not yours.", 404, "DESIRE_NOT_FOUND");

  const assignments = [];
  const values = [desireId, userId];
  const add = (column, value) => { values.push(value); assignments.push(`${column}=$${values.length}`); };

  if (body.title !== undefined) {
    const title = cleanNullable(body.title, 120, "Title");
    if (!title || title.length < 2) throw new AppError("Title must contain at least two characters.", 400, "INVALID_TITLE");
    add("title", title);
  }
  if (body.caption !== undefined) add("caption", cleanNullable(body.caption, 500, "Caption"));
  if (body.brandName !== undefined) add("brand_name", cleanNullable(body.brandName, 120, "Brand name"));
  if (body.productName !== undefined) add("product_name", cleanNullable(body.productName, 160, "Product name"));
  if (body.sourceUrl !== undefined) add("source_url", validateSourceUrl(body.sourceUrl));
  if (body.categorySlug !== undefined) add("category_id", (await getCategory(body.categorySlug, client)).id);

  if (assignments.length) {
    await client.query(
      `UPDATE wants.desires SET ${assignments.join(", ")}, updated_at=now() WHERE id=$1 AND user_id=$2`,
      values
    );
  }

  if (body.tags !== undefined) {
    const tags = parseTags(body.tags);
    await client.query(`DELETE FROM wants.desire_tags WHERE desire_id=$1 AND source='user'`, [desireId]);
    if (tags.length) {
      await client.query(
        `INSERT INTO wants.desire_tags (desire_id, tag, source)
         SELECT $1, unnest($2::text[]), 'user' ON CONFLICT (desire_id, tag) DO NOTHING`,
        [desireId, tags]
      );
    }
  }

  return getDesireById(desireId, { includeUnpublishedForUserId: userId });
});

const deleteDesire = async (userId, desireId) => {
  const result = await db.query(
    `UPDATE wants.desires
     SET deleted_at=now(), status='removed', updated_at=now()
     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
     RETURNING id`,
    [desireId, userId]
  );
  if (!result.rows[0]) throw new AppError("Desire was not found or is not yours.", 404, "DESIRE_NOT_FOUND");
  return { id: result.rows[0].id, deleted: true };
};

const getMyDesires = async (userId, { limit = 24, offset = 0 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const result = await db.query(
    `${DESIRE_SELECT}
     WHERE d.user_id=$1 AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC, d.id DESC LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset]
  );
  return result.rows.map(serializeDesire);
};

module.exports = {
  createDesire,
  getDesireById,
  updateDesire,
  deleteDesire,
  getMyDesires
};
