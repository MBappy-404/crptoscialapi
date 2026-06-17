const Report = require("./report.model");
const ApiError = require("../../../utils/ApiError");

async function createReport(reporterId, postId, reason, description) {
  const existing = await Report.findOne({ reporter: reporterId, post: postId });
  if (existing) {
    throw new ApiError(400, "You have already reported this post");
  }
  return Report.create({
    reporter: reporterId,
    post: postId,
    reason,
    description: description || "",
  });
}

async function hasReported(reporterId, postId) {
  const report = await Report.findOne({ reporter: reporterId, post: postId });
  return !!report;
}

async function getReports(page = 1, limit = 20, status) {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate("reporter", "name avatar")
      .populate({
        path: "post",
        select: "content image user visibility",
        populate: { path: "user", select: "name avatar" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter),
  ]);
  return { reports, total, page, pages: Math.ceil(total / limit) };
}

async function updateReportStatus(reportId, status, adminNote) {
  const report = await Report.findByIdAndUpdate(
    reportId,
    { status, adminNote: adminNote || "" },
    { new: true }
  )
    .populate("reporter", "name avatar")
    .populate({
      path: "post",
      select: "content image user visibility",
      populate: { path: "user", select: "name avatar" },
    });
  if (!report) throw new ApiError(404, "Report not found");
  return report;
}

async function getReportCount(postId) {
  return Report.countDocuments({ post: postId });
}

module.exports = {
  createReport,
  hasReported,
  getReports,
  updateReportStatus,
  getReportCount,
};
