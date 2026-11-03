const {
  z,
  username,
  password,
  ageBand,
  countryCode,
  nonEmptySlug,
  colorArray,
} = require("./commonValidators");

const registerSchema = z.strictObject({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  username,
  password,
  ageBand,
  countryCode: countryCode.optional(),
  interests: z.array(nonEmptySlug).max(20).default([]),
  favoriteColors: colorArray.default([]),
});

const loginSchema = z.strictObject({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(72),
});

const refreshSchema = z.strictObject({
  refreshToken: z.string().min(20).max(4096),
});

const logoutSchema = z.strictObject({
  refreshToken: z.string().min(20).max(4096),
});

const forgotPasswordSchema = z.strictObject({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

const verifyResetCodeSchema = z.strictObject({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit verification code."),
});

const resetPasswordSchema = z.strictObject({
  resetToken: z.string().min(20).max(512),
  newPassword: password,
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
};
