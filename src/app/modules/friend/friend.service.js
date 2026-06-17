const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const FriendRequest = require("../friend/friend.model");
const User = require("../user/user.model");

const sendRequest = async (senderId, receiverId) => {
  if (senderId === receiverId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot send friend request to yourself");
  }

  const existing = await FriendRequest.findOne({
    $or: [
      { sender: senderId, receiver: receiverId },
      { sender: receiverId, receiver: senderId },
    ],
  });

  if (existing) {
    if (existing.status === "pending") throw new ApiError(httpStatus.BAD_REQUEST, "Friend request already pending");
    if (existing.status === "accepted") throw new ApiError(httpStatus.BAD_REQUEST, "Already friends");
  }

  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);
  if (!sender || !receiver) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  if (sender.friends.includes(receiverId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Already friends");
  }

  const request = await FriendRequest.create({ sender: senderId, receiver: receiverId });
  return request.populate("sender", "name avatar");
};

const acceptRequest = async (requestId, userId) => {
  const request = await FriendRequest.findById(requestId);
  if (!request) throw new ApiError(httpStatus.NOT_FOUND, "Friend request not found");
  if (request.receiver.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");
  if (request.status !== "pending") throw new ApiError(httpStatus.BAD_REQUEST, "Request already processed");

  request.status = "accepted";
  await request.save();

  await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } });
  await User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } });

  return request.populate("sender", "name avatar");
};

const rejectRequest = async (requestId, userId) => {
  const request = await FriendRequest.findById(requestId);
  if (!request) throw new ApiError(httpStatus.NOT_FOUND, "Friend request not found");
  if (request.receiver.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");

  request.status = "rejected";
  await request.save();
  return request;
};

const cancelRequest = async (requestId, userId) => {
  const request = await FriendRequest.findById(requestId);
  if (!request) throw new ApiError(httpStatus.NOT_FOUND, "Friend request not found");
  if (request.sender.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");

  await FriendRequest.findByIdAndDelete(requestId);
};

const removeFriend = async (userId, friendId) => {
  await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
  await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });
  await FriendRequest.deleteMany({
    $or: [
      { sender: userId, receiver: friendId },
      { sender: friendId, receiver: userId },
    ],
  });
};

const getPendingRequests = async (userId) => {
  const requests = await FriendRequest.find({ receiver: userId, status: "pending" })
    .populate("sender", "name avatar mutualFriends")
    .sort({ createdAt: -1 });
  return requests;
};

const getSuggestions = async (userId) => {
  const user = await User.findById(userId);
  const friendIds = user.friends || [];
  const pendingSent = await FriendRequest.find({ sender: userId }).distinct("receiver");
  const pendingReceived = await FriendRequest.find({ receiver: userId }).distinct("sender");

  const excludeIds = [...friendIds, userId, ...pendingSent, ...pendingReceived];

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const suggestions = await User.find({ _id: { $nin: excludeIds } })
    .select("name avatar friends createdAt")
    .sort({ createdAt: -1 })
    .limit(20);

  return suggestions.map(s => ({
    ...s.toObject(),
    mutualFriends: s.friends.filter(f => friendIds.some(fId => fId.toString() === f.toString())).length,
    isNew: s.createdAt >= oneWeekAgo,
  }));
};

const getSentRequests = async (userId) => {
  const requests = await FriendRequest.find({ sender: userId, status: "pending" })
    .populate("receiver", "name avatar")
    .sort({ createdAt: -1 });
  return requests;
};

const getFriendsList = async (userId) => {
  const user = await User.findById(userId).populate("friends", "name avatar isOnline lastSeen");
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  return user.friends;
};

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeFriend,
  getPendingRequests,
  getSuggestions,
  getFriendsList,
};
