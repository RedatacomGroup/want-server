const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authMiddleware } = require("../middleware/authMiddleware");
const socialController = require("../controllers/socialController");

const router = express.Router();

router.use(authMiddleware);
router.get("/search", asyncHandler(socialController.searchUsers));
router.get("/pins", asyncHandler(socialController.listPins));
router.get("/pins/:userId", asyncHandler(socialController.getPinStatus));
router.post("/pins/:userId", asyncHandler(socialController.pinUser));
router.delete("/pins/:userId", asyncHandler(socialController.unpinUser));

module.exports = router;
