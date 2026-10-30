const moderationService=require("../services/moderationService");
const create=async(req,res)=>res.status(201).json({success:true,report:await moderationService.createReport(req.user.id,req.body),requestId:req.requestId});
module.exports={create};
