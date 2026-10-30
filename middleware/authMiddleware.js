const db = require("../config/db");
const { AppError } = require("./errorMiddleware");
const { verifyAccessToken } = require("../utils/jwt");

const extractBearerToken = (req) => {
  const header = req.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new AppError("Authentication is required.", 401, "AUTH_REQUIRED");

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (_) {
      throw new AppError("Access token is invalid or expired.", 401, "INVALID_ACCESS_TOKEN");
    }

    if (payload.type !== "access" || !payload.sub) {
      throw new AppError("Access token is invalid.", 401, "INVALID_ACCESS_TOKEN");
    }

    const result = await db.query(
      `SELECT id, username, status FROM wants.users WHERE id=$1 AND deleted_at IS NULL LIMIT 1`,
      [payload.sub]
    );
    const user = result.rows[0];
    if (!user || user.status !== "active") throw new AppError("Account is not active.", 401, "ACCOUNT_NOT_ACTIVE");

    req.user = { id: user.id, username: user.username, status: user.status };
    req.accessToken = token;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authMiddleware, extractBearerToken };
