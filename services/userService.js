const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const AGE_BANDS = new Set(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]);
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,30}$/;

const cleanNullableText = (value, maxLength, field) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const cleaned = String(value).trim();
  if (cleaned.length > maxLength) {
    throw new AppError(`${field} must not exceed ${maxLength} characters.`, 400, "INVALID_PROFILE_FIELD");
  }
  return cleaned;
};

const normalizeStringArray = (values, maxItems, field) => {
  if (!Array.isArray(values)) {
    throw new AppError(`${field} must be an array.`, 400, "INVALID_PROFILE_FIELD");
  }
  return [...new Set(values.map((v) => String(v).trim().toLowerCase()).filter(Boolean))].slice(0, maxItems);
};

const publicProfileSql = `
  SELECT
    p.user_id, p.username, p.display_name, p.bio, p.profile_image_url,
    p.country_code, p.desires_posted, p.total_wants_generated,
    p.profile_views, p.equipped_badge_code, p.equipped_badge_name,
    p.equipped_badge_icon_key,
    up.region, up.city,
    us.current_streak_days, us.longest_streak_days
  FROM wants.v_public_profiles p
  JOIN wants.user_profiles up ON up.user_id = p.user_id
  JOIN wants.user_stats us ON us.user_id = p.user_id
`;

const getInterests = async (userId, executor = db) => {
  const result = await executor.query(
    `SELECT i.slug, i.name, ui.weight, ui.source
     FROM wants.user_interests ui
     JOIN wants.interests i ON i.id=ui.interest_id
     WHERE ui.user_id=$1 AND i.is_active=true
     ORDER BY ui.weight DESC, i.name ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    weight: Number(row.weight),
    source: row.source
  }));
};

const getMe = async (userId) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.username, u.status, u.email_verified_at, u.created_at,
            p.display_name, p.bio, p.profile_image_url, p.country_code, p.region,
            p.city, p.age_band, p.gender, p.favorite_colors, p.profile_visibility,
            p.show_country, p.onboarding_completed_at,
            s.desires_posted, s.total_wants_generated, s.total_passes_generated,
            s.wants_given, s.passes_given, s.profile_views,
            s.current_streak_days, s.longest_streak_days,
            b.code AS equipped_badge_code, b.name AS equipped_badge_name,
            b.icon_key AS equipped_badge_icon_key
     FROM wants.users u
     JOIN wants.user_profiles p ON p.user_id=u.id
     JOIN wants.user_stats s ON s.user_id=u.id
     LEFT JOIN wants.user_equipped_badges eb ON eb.user_id=u.id
     LEFT JOIN wants.user_badges ub ON ub.id=eb.user_badge_id AND ub.revoked_at IS NULL
     LEFT JOIN wants.badges b ON b.id=ub.badge_id
     WHERE u.id=$1 AND u.status='active' AND u.deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) throw new AppError("User account was not found.", 404, "USER_NOT_FOUND");

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    profile: {
      displayName: row.display_name,
      bio: row.bio,
      profileImageUrl: row.profile_image_url,
      countryCode: row.country_code,
      region: row.region,
      city: row.city,
      ageBand: row.age_band,
      gender: row.gender,
      favoriteColors: row.favorite_colors || [],
      profileVisibility: row.profile_visibility,
      showCountry: row.show_country,
      onboardingCompletedAt: row.onboarding_completed_at
    },
    interests: await getInterests(userId),
    stats: {
      desiresPosted: Number(row.desires_posted || 0),
      totalWantsGenerated: Number(row.total_wants_generated || 0),
      totalPassesGenerated: Number(row.total_passes_generated || 0),
      wantsGiven: Number(row.wants_given || 0),
      passesGiven: Number(row.passes_given || 0),
      profileViews: Number(row.profile_views || 0),
      currentStreakDays: Number(row.current_streak_days || 0),
      longestStreakDays: Number(row.longest_streak_days || 0)
    },
    equippedBadge: row.equipped_badge_code ? {
      code: row.equipped_badge_code,
      name: row.equipped_badge_name,
      iconKey: row.equipped_badge_icon_key
    } : null
  };
};

const updateMe = async (userId, body) => db.withTransaction(async (client) => {
  const allowedUser = new Set(["username"]);
  const allowedProfile = new Set([
    "displayName", "bio", "profileImageUrl", "countryCode", "region", "city",
    "ageBand", "gender", "favoriteColors", "profileVisibility", "showCountry"
  ]);
  const supplied = Object.keys(body || {});
  const unsupported = supplied.filter((key) => !allowedUser.has(key) && !allowedProfile.has(key));
  if (unsupported.length) {
    throw new AppError(`Unsupported profile fields: ${unsupported.join(", ")}`, 400, "UNSUPPORTED_PROFILE_FIELDS");
  }

  if (body.username !== undefined) {
    const username = String(body.username).trim();
    if (!USERNAME_REGEX.test(username)) {
      throw new AppError("Username must be 3-30 characters using letters, numbers, or underscores.", 400, "INVALID_USERNAME");
    }
    await client.query(`UPDATE wants.users SET username=$2, updated_at=now() WHERE id=$1`, [userId, username]);
  }

  const assignments = [];
  const values = [userId];
  const add = (column, value) => {
    values.push(value);
    assignments.push(`${column}=$${values.length}`);
  };

  const displayName = cleanNullableText(body.displayName, 60, "Display name");
  const bio = cleanNullableText(body.bio, 240, "Bio");
  const profileImageUrl = cleanNullableText(body.profileImageUrl, 2000, "Profile image URL");
  const region = cleanNullableText(body.region, 100, "Region");
  const city = cleanNullableText(body.city, 100, "City");
  const gender = cleanNullableText(body.gender, 30, "Gender");

  if (displayName !== undefined) add("display_name", displayName);
  if (bio !== undefined) add("bio", bio);
  if (profileImageUrl !== undefined) add("profile_image_url", profileImageUrl);
  if (region !== undefined) add("region", region);
  if (city !== undefined) add("city", city);
  if (gender !== undefined) add("gender", gender);

  if (body.countryCode !== undefined) {
    const countryCode = body.countryCode === null || String(body.countryCode).trim() === "" ? null : String(body.countryCode).trim().toUpperCase();
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) throw new AppError("Country code must contain two letters.", 400, "INVALID_COUNTRY_CODE");
    add("country_code", countryCode);
  }
  if (body.ageBand !== undefined) {
    if (!AGE_BANDS.has(body.ageBand)) throw new AppError("Select a valid age band.", 400, "INVALID_AGE_BAND");
    add("age_band", body.ageBand);
  }
  if (body.favoriteColors !== undefined) add("favorite_colors", normalizeStringArray(body.favoriteColors, 10, "favoriteColors"));
  if (body.profileVisibility !== undefined) {
    if (!["public", "private"].includes(body.profileVisibility)) throw new AppError("profileVisibility must be public or private.", 400, "INVALID_VISIBILITY");
    add("profile_visibility", body.profileVisibility);
  }
  if (body.showCountry !== undefined) {
    if (typeof body.showCountry !== "boolean") throw new AppError("showCountry must be boolean.", 400, "INVALID_PROFILE_FIELD");
    add("show_country", body.showCountry);
  }

  if (assignments.length) {
    await client.query(`UPDATE wants.user_profiles SET ${assignments.join(", ")}, updated_at=now() WHERE user_id=$1`, values);
  }
  return getMe(userId);
});

const replaceInterests = async (userId, interestSlugs) => {
  const slugs = normalizeStringArray(interestSlugs, 20, "interests");
  if (!slugs.length) throw new AppError("Select at least one interest.", 400, "INTEREST_REQUIRED");

  return db.withTransaction(async (client) => {
    const validResult = await client.query(
      `SELECT slug FROM wants.interests WHERE slug=ANY($1::text[]) AND is_active=true`,
      [slugs]
    );
    const valid = new Set(validResult.rows.map((row) => row.slug));
    const invalid = slugs.filter((slug) => !valid.has(slug));
    if (invalid.length) throw new AppError(`Unknown interests: ${invalid.join(", ")}`, 400, "INVALID_INTERESTS");

    await client.query(`DELETE FROM wants.user_interests WHERE user_id=$1 AND source='declared'`, [userId]);
    await client.query(
      `INSERT INTO wants.user_interests (user_id, interest_id, source)
       SELECT $1, id, 'declared' FROM wants.interests WHERE slug=ANY($2::text[])
       ON CONFLICT (user_id, interest_id) DO UPDATE SET source='declared', weight=1.000, updated_at=now()`,
      [userId, slugs]
    );
    return getInterests(userId, client);
  });
};

const replaceColors = async (userId, colors) => {
  const cleanColors = normalizeStringArray(colors, 10, "colors");
  await db.query(`UPDATE wants.user_profiles SET favorite_colors=$2, updated_at=now() WHERE user_id=$1`, [userId, cleanColors]);
  return cleanColors;
};

const completeOnboarding = async (userId, body) => db.withTransaction(async (client) => {
  const { displayName, countryCode, region, city, ageBand, gender, favoriteColors = [], interests = [] } = body || {};
  if (!displayName || !String(displayName).trim()) throw new AppError("Display name is required.", 400, "DISPLAY_NAME_REQUIRED");
  if (!AGE_BANDS.has(ageBand)) throw new AppError("Select a valid age band.", 400, "INVALID_AGE_BAND");
  if (!Array.isArray(interests) || !interests.length) throw new AppError("Select at least one interest.", 400, "INTEREST_REQUIRED");

  const country = String(countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new AppError("Country code must contain two letters.", 400, "INVALID_COUNTRY_CODE");

  const colors = normalizeStringArray(favoriteColors, 10, "favoriteColors");
  const slugs = normalizeStringArray(interests, 20, "interests");
  const validResult = await client.query(`SELECT slug FROM wants.interests WHERE slug=ANY($1::text[]) AND is_active=true`, [slugs]);
  if (validResult.rowCount !== slugs.length) throw new AppError("One or more interests are invalid.", 400, "INVALID_INTERESTS");

  await client.query(
    `UPDATE wants.user_profiles
       SET display_name=$2, country_code=$3, region=$4, city=$5, age_band=$6,
           gender=$7, favorite_colors=$8, onboarding_completed_at=COALESCE(onboarding_completed_at, now()), updated_at=now()
     WHERE user_id=$1`,
    [userId, String(displayName).trim().slice(0,60), country, cleanNullableText(region,100,"Region"), cleanNullableText(city,100,"City"), ageBand, cleanNullableText(gender,30,"Gender"), colors]
  );
  await client.query(`DELETE FROM wants.user_interests WHERE user_id=$1 AND source='declared'`, [userId]);
  await client.query(
    `INSERT INTO wants.user_interests (user_id, interest_id, source)
     SELECT $1, id, 'declared' FROM wants.interests WHERE slug=ANY($2::text[])
     ON CONFLICT (user_id, interest_id) DO UPDATE SET source='declared', weight=1.000, updated_at=now()`,
    [userId, slugs]
  );
  return getMe(userId);
});

const getPublicProfile = async (username) => {
  const result = await db.query(`${publicProfileSql} WHERE lower(p.username)=lower($1) LIMIT 1`, [String(username || "").trim()]);
  const row = result.rows[0];
  if (!row) throw new AppError("Public profile was not found.", 404, "PUBLIC_PROFILE_NOT_FOUND");

  const [interests, badgeResult] = await Promise.all([
    getInterests(row.user_id),
    db.query(
      `SELECT b.code, b.name, b.description, b.icon_key, b.icon_url, b.rarity, ub.awarded_at
       FROM wants.user_badges ub JOIN wants.badges b ON b.id=ub.badge_id
       WHERE ub.user_id=$1 AND ub.revoked_at IS NULL AND b.is_active=true
       ORDER BY ub.awarded_at DESC`,
      [row.user_id]
    )
  ]);

  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    profileImageUrl: row.profile_image_url,
    countryCode: row.country_code,
    region: row.region,
    city: row.city,
    totalWantsGenerated: Number(row.total_wants_generated || 0),
    desiresPosted: Number(row.desires_posted || 0),
    profileViews: Number(row.profile_views || 0),
    currentStreakDays: Number(row.current_streak_days || 0),
    longestStreakDays: Number(row.longest_streak_days || 0),
    equippedBadge: row.equipped_badge_code ? { code: row.equipped_badge_code, name: row.equipped_badge_name, iconKey: row.equipped_badge_icon_key } : null,
    interests,
    badges: badgeResult.rows.map((badge) => ({
      code: badge.code, name: badge.name, description: badge.description,
      iconKey: badge.icon_key, iconUrl: badge.icon_url, rarity: badge.rarity, awardedAt: badge.awarded_at
    }))
  };
};

const getUserDesires = async (username, { limit = 24, offset = 0 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const result = await db.query(
    `SELECT d.*, m.url AS image_url, m.thumbnail_url
     FROM wants.v_published_desires d
     LEFT JOIN LATERAL (
       SELECT url, thumbnail_url FROM wants.desire_media dm
       WHERE dm.desire_id=d.id ORDER BY dm.sort_order ASC LIMIT 1
     ) m ON true
     WHERE lower(d.username)=lower($1)
     ORDER BY d.published_at DESC NULLS LAST, d.id DESC
     LIMIT $2 OFFSET $3`,
    [String(username || "").trim(), safeLimit, safeOffset]
  );
  return result.rows;
};

const getUserStats = async (username) => {
  const profile = await getPublicProfile(username);
  const [globalResult, countryResult, categoryResult] = await Promise.all([
    db.query(`SELECT global_rank FROM wants.v_global_tastemakers WHERE user_id=$1`, [profile.userId]),
    db.query(`SELECT country_rank FROM wants.v_country_tastemakers WHERE user_id=$1`, [profile.userId]),
    db.query(`SELECT category_slug, category_name, category_wants_generated, category_desires, category_rank FROM wants.v_category_tastemakers WHERE user_id=$1 ORDER BY category_wants_generated DESC`, [profile.userId])
  ]);
  return {
    totalWantsGenerated: profile.totalWantsGenerated,
    desiresPosted: profile.desiresPosted,
    globalRank: globalResult.rows[0] ? Number(globalResult.rows[0].global_rank) : null,
    countryRank: countryResult.rows[0] ? Number(countryResult.rows[0].country_rank) : null,
    categories: categoryResult.rows.map((row) => ({
      slug: row.category_slug, name: row.category_name,
      wantsGenerated: Number(row.category_wants_generated), desires: Number(row.category_desires), rank: Number(row.category_rank)
    }))
  };
};

const getAvailableInterests = async () => {
  const result = await db.query(
    `SELECT i.slug, i.name, c.slug AS category_slug, c.name AS category_name, c.icon_key
     FROM wants.interests i LEFT JOIN wants.categories c ON c.id=i.category_id
     WHERE i.is_active=true ORDER BY COALESCE(c.sort_order,9999), i.name`
  );
  return result.rows.map((row) => ({ slug: row.slug, name: row.name, categorySlug: row.category_slug, categoryName: row.category_name, iconKey: row.icon_key }));
};

module.exports = {
  getMe, updateMe, replaceInterests, replaceColors, completeOnboarding,
  getPublicProfile, getUserDesires, getUserStats, getAvailableInterests
};
