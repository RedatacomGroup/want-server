const { z, strictPartialObject } = require("./commonValidators");

const notificationPreferencesSchema = strictPartialObject({
  badgeUnlocked: z.boolean(),
  desireMilestone: z.boolean(),
  desireTrending: z.boolean(),
  rankChanged: z.boolean(),
  system: z.boolean(),
});

module.exports = { notificationPreferencesSchema };
