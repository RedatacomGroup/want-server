const { z, nonEmptySlug, strictPartialObject } = require("./commonValidators");

const httpUrl = z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), "Must be an HTTP or HTTPS URL");
const tags = z.union([
  z.string().max(1000),
  z.array(z.string().trim().min(1).max(60)).max(12),
]);

const createDesireSchema = z.strictObject({
  title: z.string().trim().min(2).max(120),
  caption: z.string().trim().max(500).optional(),
  categorySlug: nonEmptySlug,
  brandName: z.string().trim().max(120).optional(),
  productName: z.string().trim().max(160).optional(),
  sourceUrl: httpUrl.optional(),
  altText: z.string().trim().max(240).optional(),
  tags: tags.optional(),
});

const updateDesireSchema = strictPartialObject({
  title: z.string().trim().min(2).max(120),
  caption: z.string().trim().max(500).nullable(),
  categorySlug: nonEmptySlug,
  brandName: z.string().trim().max(120).nullable(),
  productName: z.string().trim().max(160).nullable(),
  sourceUrl: httpUrl.nullable(),
  tags,
});

module.exports = { createDesireSchema, updateDesireSchema };
