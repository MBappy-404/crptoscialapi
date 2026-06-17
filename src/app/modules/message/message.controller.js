const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const messageService = require("./message.service");
const { httpResponse } = require("../../../utils/httpResponse");
const { getSocket, getOnlineUsers } = require("../../../config/socket_io");

const sendMessage = catchAsync(async (req, res) => {
  const message = await messageService.sendMessage(req.user.id, req.params.receiverId, req.body.text, req.body.image);

  const io = getSocket();
  if (io) {
    const receiverId = message.receiver._id?.toString();
    io.to(`user:${receiverId}`).emit("receive-message", message);
  }

  const notificationService = require("../notification/notification.service");
  await notificationService.createNotification({
    user: req.params.receiverId,
    from: req.user.id,
    type: "message",
    message: req.body.text?.substring(0, 50) || "sent you a message",
  });

  res.status(httpStatus.CREATED).json(httpResponse("success", message, "Message sent."));
});

const getMessages = catchAsync(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const result = await messageService.getMessages(req.user.id, req.params.otherUserId, parseInt(page), parseInt(limit));
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const getConversations = catchAsync(async (req, res) => {
  const conversations = await messageService.getConversations(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", conversations, ""));
});

const markAsRead = catchAsync(async (req, res) => {
  await messageService.markAsRead(req.params.senderId, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Marked as read."));
});

const getUnreadCount = catchAsync(async (req, res) => {
  const count = await messageService.getUnreadCount(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", { count }, ""));
});

module.exports = { sendMessage, getMessages, getConversations, markAsRead, getUnreadCount };
