const desireDnaService=require("../services/desireDnaService");
const mine=async(req,res)=>res.json({success:true,dna:await desireDnaService.getMine(req.user.id),requestId:req.requestId});
const publicDna=async(req,res)=>res.json({success:true,dna:await desireDnaService.getPublic(req.params.username),requestId:req.requestId});
module.exports={mine,publicDna};
