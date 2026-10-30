const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const uploadController = require("../controllers/uploadController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/configuration", authMiddleware, asyncHandler(uploadController.getUploadConfiguration));
module.exports = router;
