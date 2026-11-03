const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const authController = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validateMiddleware");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
} = require("../validators/authValidators");
const {
  authRegisterLimiter,
  authLoginLimiter,
  authRefreshLimiter,
} = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.post(
  "/register",
  authRegisterLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.post(
  "/login",
  authLoginLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post(
  "/refresh",
  authRefreshLimiter,
  validate(refreshSchema),
  asyncHandler(authController.refresh),
);

router.post(
  "/logout",
  authMiddleware,
  validate(logoutSchema),
  asyncHandler(authController.logout),
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(authController.me),
);

router.get(
  "/username-availability",
  authRegisterLimiter,
  asyncHandler(authController.usernameAvailability),
);

router.post(
  "/forgot-password",
  authRegisterLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

router.post(
  "/verify-reset-code",
  authLoginLimiter,
  validate(verifyResetCodeSchema),
  asyncHandler(authController.verifyResetCode),
);

router.post(
  "/reset-password",
  authLoginLimiter,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

module.exports = router;
