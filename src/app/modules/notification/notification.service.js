const Notification = require("../notification/notification.model");
const { getSocket } = require("../../../config/socket_io");

const createNotification = async (data) => {
  const notification = await Notification.create(data);
  const populated = await notification.populate("from", "name avatar");

  const socket = getSocket();
  if (socket) {
    socket.to(`user:${data.user.toString()}`).emit("new-notification", {
      _id: populated._id,
      type: populated.type,
      from: populated.from,
      message: populated.message,
      post: populated.post?._id || populated.post,
      commentId: populated.commentId || null,
      story: populated.story?._id || populated.story,
      read: populated.read,
      createdAt: populated.createdAt,
    });
  }

  return populated;
};

const getUserNotifications = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const notifications = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("from", "name avatar")
    .populate("post", "content image")
    .populate("story", "image text");
  const total = await Notification.countDocuments({ user: userId });
  return { notifications, total, page, pages: Math.ceil(total / limit) };
};

const markAsRead = async (notificationId) => {
  return Notification.findByIdAndUpdate(notificationId, { read: true }, { new: true });
};

const markAllAsRead = async (userId) => {
  return Notification.updateMany({ user: userId, read: false }, { read: true });
};

const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ user: userId, read: false });
};

const deleteNotification = async (notificationId) => {
  return Notification.findByIdAndDelete(notificationId);
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
};
