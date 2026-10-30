const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const ALGORITHM = "HS256";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token, "utf8").digest("hex");

const signAccessToken = (user) =>
  jwt.sign(
    { username: user.username, type: "access" },
    env.jwtAccessSecret,
    {
      algorithm: ALGORITHM,
      subject: user.id,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      expiresIn: env.jwtAccessExpiresIn
    }
  );

const signRefreshToken = ({ user, sessionId }) =>
  jwt.sign(
    { sid: sessionId, type: "refresh" },
    env.jwtRefreshSecret,
    {
      algorithm: ALGORITHM,
      subject: user.id,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      expiresIn: env.jwtRefreshExpiresIn
    }
  );

const verifyAccessToken = (token) =>
  jwt.verify(token, env.jwtAccessSecret, {
    algorithms: [ALGORITHM],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  });

const verifyRefreshToken = (token) =>
  jwt.verify(token, env.jwtRefreshSecret, {
    algorithms: [ALGORITHM],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  });

const getTokenExpiry = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== "object" || !decoded.exp) {
    throw new Error("Token expiration is missing.");
  }
  return new Date(decoded.exp * 1000);
};

module.exports = {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpiry
};
