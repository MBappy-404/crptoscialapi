const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const notificationService = require("./notification.service");
const { httpResponse } = require("../../../utils/httpResponse");

const getNotifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await notificationService.getUserNotifications(req.user.id, parseInt(page), parseInt(limit));
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const markAsRead = catchAsync(async (req, res) => {
  await notificationService.markAsRead(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Marked as read."));
});

const markAllAsRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "All marked as read."));
});

const getUnreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", { count }, ""));
});

const deleteNotification = catchAsync(async (req, res) => {
  await notificationService.deleteNotification(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Notification deleted."));
});

module.exports = { getNotifications, markAsRead, markAllAsRead, getUnreadCount, deleteNotification };
