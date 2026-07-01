const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const reportController = require("./report.controller");
const catchAsync = require("../../../utils/catchAsync");
const { httpResponse } = require("../../../utils/httpResponse");

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.email !== "sadikulsad0810@gmail.com" && process.env.NODE_ENV !== "development") {
    return res.status(403).json(httpResponse("error", {}, "Admin access required."));
  }
  next();
};

router.post(
  "/",
  auth.verifyToken,
  catchAsync(reportController.createReport)
);

router.get(
  "/post/:postId",
  auth.verifyToken,
  catchAsync(reportController.checkReported)
);

router.get(
  "/admin",
  auth.verifyToken,
  adminOnly,
  catchAsync(reportController.getReports)
);

router.put(
  "/:id/status",
  auth.verifyToken,
  adminOnly,
  catchAsync(reportController.updateReportStatus)
);

module.exports = router;
