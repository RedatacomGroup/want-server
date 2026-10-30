const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const notificationController = require("../controllers/notificationController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validateMiddleware");
const { notificationPreferencesSchema } = require("../validators/notificationValidators");

const router = express.Router();
router.use(authMiddleware);
router.get("/", asyncHandler(notificationController.list));
router.get("/unread-count", asyncHandler(notificationController.unreadCount));
router.get("/preferences", asyncHandler(notificationController.getPreferences));
router.patch("/preferences", validate(notificationPreferencesSchema), asyncHandler(notificationController.updatePreferences));
router.post("/read-all", asyncHandler(notificationController.markAllRead));
router.patch("/:notificationId/read", asyncHandler(notificationController.markRead));
router.patch("/:notificationId/unread", asyncHandler(notificationController.markUnread));
router.delete("/:notificationId", asyncHandler(notificationController.remove));
module.exports = router;
