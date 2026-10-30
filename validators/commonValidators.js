const { z } = require("zod");

const username = z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_]+$/);
const password = z.string().min(8).max(72);
const ageBand = z.enum(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]);
const countryCode = z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase());
const uuid = z.string().uuid();
const nonEmptySlug = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
const colorArray = z.array(z.string().trim().min(1).max(40)).max(10);

const strictPartialObject = (shape) => z.strictObject(shape).partial();

module.exports = { z, username, password, ageBand, countryCode, uuid, nonEmptySlug, colorArray, strictPartialObject };
