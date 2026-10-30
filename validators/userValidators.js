const { z, username, ageBand, countryCode, nonEmptySlug, colorArray, strictPartialObject } = require("./commonValidators");

const updateProfileSchema = strictPartialObject({
  username,
  displayName: z.string().trim().max(60).nullable(),
  bio: z.string().trim().max(240).nullable(),
  profileImageUrl: z.string().url().max(2000).nullable(),
  countryCode: countryCode.nullable(),
  region: z.string().trim().max(100).nullable(),
  city: z.string().trim().max(100).nullable(),
  ageBand,
  gender: z.string().trim().max(30).nullable(),
  favoriteColors: colorArray,
  profileVisibility: z.enum(["public", "private"]),
  showCountry: z.boolean(),
});

const interestsSchema = z.strictObject({ interests: z.array(nonEmptySlug).min(1).max(20) });
const colorsSchema = z.strictObject({ colors: colorArray });
const onboardingSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(60),
  countryCode,
  region: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  ageBand,
  gender: z.string().trim().max(30).nullable().optional(),
  favoriteColors: colorArray.default([]),
  interests: z.array(nonEmptySlug).min(1).max(20),
});

module.exports = { updateProfileSchema, interestsSchema, colorsSchema, onboardingSchema };
