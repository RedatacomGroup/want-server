const { z, uuid } = require("./commonValidators");

const reportSchema = z
  .strictObject({
    desireId: uuid.optional(),
    reportedUserId: uuid.optional(),
    reason: z.enum([
      "spam",
      "scam",
      "harassment",
      "hate",
      "violence",
      "illegal",
      "copyright",
      "impersonation",
      "other",
    ]),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Boolean(value.desireId || value.reportedUserId), {
    message: "A desireId or reportedUserId is required.",
  });

const reportDecisionSchema = z.strictObject({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolution: z.string().trim().max(1000).optional(),
});

const desireModerationSchema = z.strictObject({
  action: z.enum(["remove", "restore"]),
  reason: z.string().trim().min(3).max(1000),
});

const userEnforcementSchema = z.strictObject({
  action: z.enum(["terminate", "reactivate"]),
  reason: z.string().trim().min(8).max(1000),
  reportId: uuid.optional(),
});

module.exports = {
  reportSchema,
  reportDecisionSchema,
  desireModerationSchema,
  userEnforcementSchema,
};
