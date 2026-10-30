const badgeService=require("../services/badgeService");
const catalog=async(req,res)=>res.json({success:true,badges:await badgeService.getCatalog(req.user?.id || null),requestId:req.requestId});
const mine=async(req,res)=>res.json({success:true,badges:await badgeService.getMine(req.user.id),requestId:req.requestId});
const publicBadges=async(req,res)=>res.json({success:true,...(await badgeService.getPublicBadges(req.params.username)),requestId:req.requestId});
const refresh=async(req,res)=>res.json({success:true,badges:await badgeService.refreshThresholdBadges(req.user.id),requestId:req.requestId});
const equip=async(req,res)=>res.json({success:true,badge:await badgeService.equipBadge(req.user.id,req.params.code),requestId:req.requestId});
const unequip=async(req,res)=>res.json({success:true,...(await badgeService.unequipBadge(req.user.id)),requestId:req.requestId});
module.exports={catalog,mine,publicBadges,refresh,equip,unequip};
