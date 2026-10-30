const {z,uuid}=require("./commonValidators");

const reportSchema=z.strictObject({
  desireId:uuid.optional(),
  reportedUserId:uuid.optional(),
  reason:z.enum(["spam","scam","harassment","hate","violence","illegal","copyright","impersonation","other"]),
  details:z.string().trim().max(1000).optional()
}).refine((v)=>Boolean(v.desireId||v.reportedUserId),{message:"A desireId or reportedUserId is required."});

const reportDecisionSchema=z.strictObject({
  status:z.enum(["reviewing","resolved","dismissed"]),
  resolution:z.string().trim().max(1000).optional()
});

const desireModerationSchema=z.strictObject({
  action:z.enum(["remove","restore"]),
  reason:z.string().trim().min(3).max(1000)
});

module.exports={reportSchema,reportDecisionSchema,desireModerationSchema};
