const express=require("express");
const asyncHandler=require("../utils/asyncHandler");
const {authMiddleware}=require("../middleware/authMiddleware");
const {validate}=require("../middleware/validateMiddleware");
const {reportSchema}=require("../validators/moderationValidators");
const controller=require("../controllers/reportController");
const router=express.Router();
router.post("/",authMiddleware,validate(reportSchema),asyncHandler(controller.create));
module.exports=router;
