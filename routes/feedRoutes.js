const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const feedController = require("../controllers/feedController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);
router.get("/", asyncHandler(feedController.home));
router.get("/fresh", asyncHandler(feedController.fresh));
router.get("/local", asyncHandler(feedController.local));
router.get("/category/:slug", asyncHandler(feedController.category));
module.exports = router;
