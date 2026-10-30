const { z, uuid } = require("./commonValidators");

const swipeSchema = z.strictObject({
  desireId: uuid,
  decision: z.enum(["want", "pass"]),
  surface: z.enum(["home", "fresh", "local", "category", "trending", "profile", "detail"]).default("home"),
  sessionKey: uuid.nullable().optional(),
});

module.exports = { swipeSchema };
