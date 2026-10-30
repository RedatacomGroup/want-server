const trendingService = require("../services/trendingService");
const global = async (req,res) => res.json({ success:true, trending:await trendingService.globalTrending(req.query), requestId:req.requestId });
const country = async (req,res) => res.json({ success:true, trending:await trendingService.countryTrending(req.params.countryCode,req.query), requestId:req.requestId });
const category = async (req,res) => res.json({ success:true, trending:await trendingService.categoryTrending(req.params.categorySlug,req.query), requestId:req.requestId });
module.exports = { global, country, category };
