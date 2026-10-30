const express=require("express");
const asyncHandler=require("../utils/asyncHandler");
const c=require("../controllers/trendingController");
const router=express.Router();
router.get("/global",asyncHandler(c.global));
router.get("/country/:countryCode",asyncHandler(c.country));
router.get("/category/:categorySlug",asyncHandler(c.category));
module.exports=router;
