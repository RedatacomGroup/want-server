const crypto = require("crypto");
const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");
const { validatePassword, hashPassword, verifyPassword } = require("../utils/password");
const {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getTokenExpiry
} = require("../utils/jwt");

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AGE_BANDS = new Set(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]);

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeUsername = (username) => String(username || "").trim();

const sanitizeUser = (row) => ({
  id: row.id,
  email: row.email,
  username: row.username,
  status: row.status,
  emailVerifiedAt: row.email_verified_at,
  lastLoginAt: row.last_login_at,
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
    onboardingCompletedAt: row.onboarding_completed_at
  },
  stats: {
    desiresPosted: Number(row.desires_posted || 0),
    totalWantsGenerated: Number(row.total_wants_generated || 0),
    wantsGiven: Number(row.wants_given || 0),
    passesGiven: Number(row.passes_given || 0),
    currentStreakDays: Number(row.current_streak_days || 0),
    longestStreakDays: Number(row.longest_streak_days || 0)
  }
});

const selectUserSql = `
  SELECT
    u.id, u.email, u.username, u.password_hash, u.status,
    u.email_verified_at, u.last_login_at, u.created_at,
    p.display_name, p.bio, p.profile_image_url, p.country_code,
    p.region, p.city, p.age_band, p.gender, p.favorite_colors,
    p.onboarding_completed_at,
    s.desires_posted, s.total_wants_generated, s.wants_given,
    s.passes_given, s.current_streak_days, s.longest_streak_days
  FROM wants.users u
  JOIN wants.user_profiles p ON p.user_id = u.id
  JOIN wants.user_stats s ON s.user_id = u.id
`;

const getUserById = async (userId, executor = db) => {
  const result = await executor.query(`${selectUserSql} WHERE u.id = $1 AND u.deleted_at IS NULL LIMIT 1`, [userId]);
  return result.rows[0] || null;
};

const createSessionTokens = async ({ client, user, deviceName, userAgent, ipHash }) => {
  const sessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ user, sessionId });
  const refreshTokenHash = hashToken(refreshToken);
  const refreshExpiresAt = getTokenExpiry(refreshToken);

  await client.query(
    `INSERT INTO wants.user_sessions
      (id, user_id, refresh_token_hash, device_name, ip_hash, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sessionId, user.id, refreshTokenHash, deviceName || null, ipHash || null, userAgent || null, refreshExpiresAt]
  );

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    refreshExpiresAt
  };
};

const register = async ({ email, username, password, ageBand, countryCode, interests = [], favoriteColors = [], deviceName, userAgent, ipHash }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new AppError("Enter a valid email address.", 400, "INVALID_EMAIL");
  }
  if (!USERNAME_REGEX.test(normalizedUsername)) {
    throw new AppError("Username must be 3-30 characters using letters, numbers, or underscores.", 400, "INVALID_USERNAME");
  }
  if (!AGE_BANDS.has(ageBand)) {
    throw new AppError("Select a valid age band.", 400, "INVALID_AGE_BAND");
  }
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new AppError(passwordValidation.message, 400, "INVALID_PASSWORD");
  }

  const cleanCountryCode = countryCode ? String(countryCode).trim().toUpperCase() : null;
  if (cleanCountryCode && !/^[A-Z]{2}$/.test(cleanCountryCode)) {
    throw new AppError("Country code must use a two-letter ISO-style code.", 400, "INVALID_COUNTRY_CODE");
  }

  const cleanInterests = [...new Set((Array.isArray(interests) ? interests : []).map((v) => String(v).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  const cleanColors = [...new Set((Array.isArray(favoriteColors) ? favoriteColors : []).map((v) => String(v).trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  const passwordHash = await hashPassword(password);

  return db.withTransaction(async (client) => {
    const userInsert = await client.query(
      `INSERT INTO wants.users (email, username, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, email, username, status, email_verified_at, last_login_at, created_at`,
      [normalizedEmail, normalizedUsername, passwordHash]
    );
    const newUser = userInsert.rows[0];

    await client.query(
      `UPDATE wants.user_profiles
       SET age_band=$2, country_code=$3, favorite_colors=$4, updated_at=now()
       WHERE user_id=$1`,
      [newUser.id, ageBand, cleanCountryCode, cleanColors]
    );

    if (cleanInterests.length) {
      await client.query(
        `INSERT INTO wants.user_interests (user_id, interest_id, source)
         SELECT $1, i.id, 'declared'
         FROM wants.interests i
         WHERE i.slug = ANY($2::text[]) AND i.is_active = true
         ON CONFLICT (user_id, interest_id) DO NOTHING`,
        [newUser.id, cleanInterests]
      );
    }

    const userRow = await getUserById(newUser.id, client);
    const tokens = await createSessionTokens({ client, user: userRow, deviceName, userAgent, ipHash });
    return { user: sanitizeUser(userRow), ...tokens };
  });
};

const login = async ({ identifier, password, deviceName, userAgent, ipHash }) => {
  const normalizedIdentifier = String(identifier || "").trim();
  if (!normalizedIdentifier || typeof password !== "string") {
    throw new AppError("Email/username and password are required.", 400, "MISSING_CREDENTIALS");
  }

  const result = await db.query(
    `${selectUserSql}
     WHERE u.deleted_at IS NULL
       AND (lower(u.email) = lower($1) OR lower(u.username) = lower($1))
     LIMIT 1`,
    [normalizedIdentifier]
  );
  const user = result.rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new AppError("Invalid email/username or password.", 401, "INVALID_CREDENTIALS");
  }
  if (user.status !== "active") {
    throw new AppError("This account is not currently active.", 403, "ACCOUNT_NOT_ACTIVE");
  }

  return db.withTransaction(async (client) => {
    await client.query(`UPDATE wants.users SET last_login_at=now(), updated_at=now() WHERE id=$1`, [user.id]);
    const updatedUser = await getUserById(user.id, client);
    const tokens = await createSessionTokens({ client, user: updatedUser, deviceName, userAgent, ipHash });
    return { user: sanitizeUser(updatedUser), ...tokens };
  });
};

const refresh = async ({ refreshToken, deviceName, userAgent, ipHash }) => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError("Refresh token is invalid or expired.", 401, "INVALID_REFRESH_TOKEN");
  }

  if (payload.type !== "refresh" || !payload.sid || !payload.sub) {
    throw new AppError("Refresh token is invalid.", 401, "INVALID_REFRESH_TOKEN");
  }

  return db.withTransaction(async (client) => {
    const sessionResult = await client.query(
      `SELECT id, user_id, refresh_token_hash, expires_at, revoked_at
       FROM wants.user_sessions
       WHERE id=$1 AND user_id=$2
       FOR UPDATE`,
      [payload.sid, payload.sub]
    );
    const session = sessionResult.rows[0];

    if (!session || session.revoked_at || new Date(session.expires_at) <= new Date() || session.refresh_token_hash !== hashToken(refreshToken)) {
      throw new AppError("Refresh session is no longer valid.", 401, "INVALID_REFRESH_SESSION");
    }

    const user = await getUserById(payload.sub, client);
    if (!user || user.status !== "active") {
      throw new AppError("Account is not active.", 403, "ACCOUNT_NOT_ACTIVE");
    }

    await client.query(`UPDATE wants.user_sessions SET revoked_at=now() WHERE id=$1`, [session.id]);
    const tokens = await createSessionTokens({ client, user, deviceName, userAgent, ipHash });
    return { user: sanitizeUser(user), ...tokens };
  });
};

const logout = async ({ refreshToken, userId }) => {
  if (!refreshToken) return { revoked: false };
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_) {
    return { revoked: false };
  }

  if (!payload.sid || (userId && payload.sub !== userId)) return { revoked: false };
  const result = await db.query(
    `UPDATE wants.user_sessions SET revoked_at=COALESCE(revoked_at, now()) WHERE id=$1 AND user_id=$2 RETURNING id`,
    [payload.sid, payload.sub]
  );
  return { revoked: result.rowCount > 0 };
};

const getMe = async (userId) => {
  const user = await getUserById(userId);
  if (!user || user.status !== "active") {
    throw new AppError("User account was not found.", 404, "USER_NOT_FOUND");
  }
  return sanitizeUser(user);
};

module.exports = { register, login, refresh, logout, getMe };
