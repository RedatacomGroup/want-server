const express=require("express");
const asyncHandler=require("../utils/asyncHandler");
const c=require("../controllers/leaderboardController");
const router=express.Router();
router.get("/global",asyncHandler(c.global));
router.get("/hot",asyncHandler(c.hot));
router.get("/country/:countryCode",asyncHandler(c.country));
router.get("/category/:categorySlug",asyncHandler(c.category));
module.exports=router;
