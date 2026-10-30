const leaderboardService = require("../services/leaderboardService");
const global = async (req,res) => res.json({ success:true, items:await leaderboardService.globalLeaderboard(req.query), requestId:req.requestId });
const country = async (req,res) => res.json({ success:true, ...(await leaderboardService.countryLeaderboard(req.params.countryCode,req.query)), requestId:req.requestId });
const category = async (req,res) => res.json({ success:true, ...(await leaderboardService.categoryLeaderboard(req.params.categorySlug,req.query)), requestId:req.requestId });
const hot = async (req,res) => res.json({ success:true, ...(await leaderboardService.hotNowLeaderboard(req.query)), requestId:req.requestId });
module.exports = { global, country, category, hot };
