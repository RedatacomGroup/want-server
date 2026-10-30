const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const desireController = require("../controllers/desireController");
const { authMiddleware } = require("../middleware/authMiddleware");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");
const { singleDesireImage } = require("../middleware/uploadMiddleware");
const { validate } = require("../middleware/validateMiddleware");
const { createDesireSchema, updateDesireSchema } = require("../validators/desireValidators");
const { desireCreateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();
router.get("/me", authMiddleware, asyncHandler(desireController.getMine));
router.post("/", authMiddleware, desireCreateLimiter, singleDesireImage, validate(createDesireSchema), asyncHandler(desireController.create));
router.get("/:desireId", optionalAuthMiddleware, asyncHandler(desireController.getOne));
router.patch("/:desireId", authMiddleware, validate(updateDesireSchema), asyncHandler(desireController.update));
router.delete("/:desireId", authMiddleware, asyncHandler(desireController.remove));
module.exports = router;
