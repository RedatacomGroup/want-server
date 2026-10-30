const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const userController = require("../controllers/userController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validateMiddleware");
const { updateProfileSchema, interestsSchema, colorsSchema, onboardingSchema } = require("../validators/userValidators");

const router = express.Router();
router.get("/interests", asyncHandler(userController.getAvailableInterests));
router.get("/me", authMiddleware, asyncHandler(userController.getMe));
router.patch("/me", authMiddleware, validate(updateProfileSchema), asyncHandler(userController.updateMe));
router.put("/me/interests", authMiddleware, validate(interestsSchema), asyncHandler(userController.updateInterests));
router.put("/me/colors", authMiddleware, validate(colorsSchema), asyncHandler(userController.updateColors));
router.post("/me/onboarding", authMiddleware, validate(onboardingSchema), asyncHandler(userController.completeOnboarding));
router.get("/:username/desires", asyncHandler(userController.getPublicDesires));
router.get("/:username/stats", asyncHandler(userController.getPublicStats));
router.get("/:username", asyncHandler(userController.getPublicProfile));
module.exports = router;
