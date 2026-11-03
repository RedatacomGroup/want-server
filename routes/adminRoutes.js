const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");
const { validate } = require("../middleware/validateMiddleware");
const {
  reportDecisionSchema,
  desireModerationSchema,
  userEnforcementSchema,
} = require("../validators/moderationValidators");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.use(authMiddleware, requireAdmin());

router.get("/reports", asyncHandler(adminController.reports));
router.patch(
  "/reports/:reportId",
  validate(reportDecisionSchema),
  asyncHandler(adminController.decideReport),
);

router.get("/desires", asyncHandler(adminController.desires));
router.patch(
  "/desires/:desireId",
  validate(desireModerationSchema),
  asyncHandler(adminController.moderateDesire),
);

router.get("/users", asyncHandler(adminController.users));
router.patch(
  "/users/:userId/enforcement",
  requireAdmin(["admin", "super_admin"]),
  validate(userEnforcementSchema),
  asyncHandler(adminController.enforceUser),
);

module.exports = router;
