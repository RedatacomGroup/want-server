const crypto = require("crypto");
const authService = require("../services/authService");
const { AppError } = require("../middleware/errorMiddleware");

const ipHashFromRequest = (req) => {
  if (!req.ip) return null;
  return crypto.createHash("sha256").update(req.ip).digest("hex");
};

const requestMeta = (req) => ({
  deviceName: req.get("x-device-name") || null,
  userAgent: req.get("user-agent") || null,
  ipHash: ipHashFromRequest(req)
});

const register = async (req, res) => {
  const result = await authService.register({ ...req.body, ...requestMeta(req) });
  res.status(201).json({ success: true, ...result, requestId: req.requestId });
};

const login = async (req, res) => {
  const result = await authService.login({ ...req.body, ...requestMeta(req) });
  res.status(200).json({ success: true, ...result, requestId: req.requestId });
};

const refresh = async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken) throw new AppError("Refresh token is required.", 400, "REFRESH_TOKEN_REQUIRED");
  const result = await authService.refresh({ refreshToken, ...requestMeta(req) });
  res.status(200).json({ success: true, ...result, requestId: req.requestId });
};

const logout = async (req, res) => {
  const result = await authService.logout({ refreshToken: req.body?.refreshToken, userId: req.user?.id });
  res.status(200).json({ success: true, ...result, requestId: req.requestId });
};

const me = async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.status(200).json({ success: true, user, requestId: req.requestId });
};

module.exports = { register, login, refresh, logout, me };
