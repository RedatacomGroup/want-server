const { z, username, password, ageBand, countryCode, nonEmptySlug, colorArray } = require("./commonValidators");

const registerSchema = z.strictObject({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
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

const refreshSchema = z.strictObject({ refreshToken: z.string().min(20).max(4096) });
const logoutSchema = z.strictObject({ refreshToken: z.string().min(20).max(4096) });

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
