const reportService = require("./report.service");
const httpResponse = require("../../../utils/httpResponse");

const createReport = async (req, res) => {
  const { postId, reason, description } = req.body;
  const report = await reportService.createReport(
    req.user.id,
    postId,
    reason,
    description
  );
  return res
    .status(201)
    .json(httpResponse("success", report, "Report submitted"));
};

const checkReported = async (req, res) => {
  const reported = await reportService.hasReported(
    req.user.id,
    req.params.postId
  );
  return res
    .status(200)
    .json(httpResponse("success", { reported }, "Check complete"));
};

const getReports = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const data = await reportService.getReports(
    parseInt(page),
    parseInt(limit),
    status
  );
  return res
    .status(200)
    .json(httpResponse("success", data, "Reports fetched"));
};

const updateReportStatus = async (req, res) => {
  const { status, adminNote } = req.body;
  const report = await reportService.updateReportStatus(
    req.params.id,
    status,
    adminNote
  );
  return res
    .status(200)
    .json(httpResponse("success", report, "Report updated"));
};

module.exports = {
  createReport,
  checkReported,
  getReports,
  updateReportStatus,
};
