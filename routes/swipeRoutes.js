const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const swipeController = require("../controllers/swipeController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validateMiddleware");
const { swipeSchema } = require("../validators/swipeValidators");
const { swipeLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();
router.use(authMiddleware);
router.post("/", swipeLimiter, validate(swipeSchema), asyncHandler(swipeController.swipe));
router.get("/history", asyncHandler(swipeController.history));
router.get("/wants", asyncHandler(swipeController.wants));
module.exports = router;
