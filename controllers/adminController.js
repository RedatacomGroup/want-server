const moderationService=require("../services/moderationService");
const paging=(req)=>({limit:Math.min(Math.max(Number(req.query.limit)||50,1),100),offset:Math.max(Number(req.query.offset)||0,0)});
const reports=async(req,res)=>res.json({success:true,items:await moderationService.listReports({status:req.query.status||"open",...paging(req)}),requestId:req.requestId});
const decideReport=async(req,res)=>res.json({success:true,report:await moderationService.decideReport(req.user.id,req.params.reportId,req.body),requestId:req.requestId});
const desires=async(req,res)=>res.json({success:true,items:await moderationService.listDesires(paging(req)),requestId:req.requestId});
const moderateDesire=async(req,res)=>res.json({success:true,desire:await moderationService.moderateDesire(req.user.id,req.params.desireId,req.body),requestId:req.requestId});
const users=async(req,res)=>res.json({success:true,items:await moderationService.listUsers(paging(req)),requestId:req.requestId});
module.exports={reports,decideReport,desires,moderateDesire,users};
