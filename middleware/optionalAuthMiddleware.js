const db = require("../config/db");
const { verifyAccessToken } = require("../utils/jwt");
const { extractBearerToken } = require("./authMiddleware");

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) return next();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (_) {
      return next();
    }

    if (payload.type !== "access" || !payload.sub) return next();

    const result = await db.query(
      `SELECT id, username, status FROM wants.users WHERE id=$1 AND deleted_at IS NULL LIMIT 1`,
      [payload.sub]
    );
    const user = result.rows[0];
    if (user?.status === "active") {
      req.user = { id: user.id, username: user.username, status: user.status };
      req.accessToken = token;
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = optionalAuthMiddleware;
