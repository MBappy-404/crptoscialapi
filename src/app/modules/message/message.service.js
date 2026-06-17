const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const { Message, Conversation } = require("../message/message.model");

const createConversation = async (participant1, participant2) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [participant1, participant2] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [participant1, participant2],
    });
  }

  return conversation.populate("participants", "name avatar isOnline");
};

const getConversations = async (userId) => {
  const conversations = await Conversation.find({
    participants: userId,
  })
    .sort({ lastMessageAt: -1 })
    .populate("participants", "name avatar isOnline lastSeen")
    .populate({
      path: "lastMessage",
      populate: { path: "sender receiver", select: "name avatar" },
    });
  return conversations;
};

const getConversationById = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId)
    .populate("participants", "name avatar isOnline");
  if (!conversation) throw new ApiError(httpStatus.NOT_FOUND, "Conversation not found");
  return conversation;
};

const sendMessage = async (senderId, receiverId, text, image) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, receiverId] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
    });
  }

  const message = await Message.create({
    sender: senderId,
    receiver: receiverId,
    text,
    image,
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return message.populate("sender receiver", "name avatar");
};

const getMessages = async (userId, otherUserId, page = 1, limit = 50) => {
  const skip = (page - 1) * limit;
  const messages = await Message.find({
    $or: [
      { sender: userId, receiver: otherUserId },
      { sender: otherUserId, receiver: userId },
    ],
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender receiver", "name avatar");

  const total = await Message.countDocuments({
    $or: [
      { sender: userId, receiver: otherUserId },
      { sender: otherUserId, receiver: userId },
    ],
  });

  return { messages: messages.reverse(), total, page, pages: Math.ceil(total / limit) };
};

const markAsRead = async (senderId, receiverId) => {
  await Message.updateMany(
    { sender: senderId, receiver: receiverId, read: false },
    { read: true }
  );
};

const getUnreadCount = async (userId) => {
  const count = await Message.countDocuments({ receiver: userId, read: false });
  return count;
};

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  sendMessage,
  getMessages,
  markAsRead,
  getUnreadCount,
};
