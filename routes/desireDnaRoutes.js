const express=require("express");
const asyncHandler=require("../utils/asyncHandler");
const c=require("../controllers/desireDnaController");
const {authMiddleware}=require("../middleware/authMiddleware");
const router=express.Router();
router.get("/me",authMiddleware,asyncHandler(c.mine));
router.get("/users/:username",asyncHandler(c.publicDna));
module.exports=router;
