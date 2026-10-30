const { rateLimit } = require("express-rate-limit");

const makeLimiter = ({ windowMs, limit, code, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler(req, res, next, options) {
      res.status(options.statusCode).json({
        success: false,
        error: { code, message },
        requestId: req.requestId,
      });
    },
  });

const generalApiLimiter = makeLimiter({
  windowMs: 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_GENERAL_PER_MINUTE || "240", 10),
  code: "RATE_LIMIT_EXCEEDED",
  message: "Too many API requests. Please slow down and try again shortly.",
});

const authRegisterLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_REGISTER_PER_HOUR || "10", 10),
  code: "REGISTER_RATE_LIMITED",
  message: "Too many registration attempts. Please try again later.",
});

const authLoginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_LOGIN_PER_15_MIN || "20", 10),
  code: "LOGIN_RATE_LIMITED",
  message: "Too many login attempts. Please wait before trying again.",
  skipSuccessfulRequests: true,
});

const authRefreshLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_REFRESH_PER_5_MIN || "60", 10),
  code: "REFRESH_RATE_LIMITED",
  message: "Too many token refresh attempts. Please wait before trying again.",
});

const desireCreateLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_DESIRE_CREATE_PER_10_MIN || "30", 10),
  code: "DESIRE_CREATE_RATE_LIMITED",
  message: "Too many desire creation attempts. Please wait before uploading again.",
});

const swipeLimiter = makeLimiter({
  windowMs: 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_SWIPES_PER_MINUTE || "180", 10),
  code: "SWIPE_RATE_LIMITED",
  message: "Swipe rate is too high. Please slow down briefly.",
});

module.exports = {
  generalApiLimiter,
  authRegisterLimiter,
  authLoginLimiter,
  authRefreshLimiter,
  desireCreateLimiter,
  swipeLimiter,
};
