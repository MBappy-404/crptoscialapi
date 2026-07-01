const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const User = require("../user/user.model");

const getUserById = async (id) => {
  const user = await User.findById(id).select("-password").populate("friends", "name avatar isOnline lastSeen");
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  return user;
};

const updateUserById = async (userId, updateData) => {
  const user = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true }).select("-password");
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  return user;
};

const searchUsers = async (query, currentUserId, friendsOnly = false) => {
  const currentUser = await User.findById(currentUserId).select("friends");
  const friendIds = currentUser?.friends || [];

  const filter = {
    _id: { $ne: currentUserId },
    $or: [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ],
  };

  if (friendsOnly) {
    filter._id = { $in: friendIds };
  }

  const users = await User.find(filter).select("name avatar isOnline lastSeen").limit(20);
  return users;
};

const followUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot follow yourself");
  }

  const user = await User.findById(currentUserId);
  const targetUser = await User.findById(targetUserId);

  if (!user || !targetUser) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  const isFollowing = user.following.includes(targetUserId);

  if (isFollowing) {
    user.following.pull(targetUserId);
    targetUser.followers.pull(currentUserId);
  } else {
    user.following.addToSet(targetUserId);
    targetUser.followers.addToSet(currentUserId);
  }

  await user.save();
  await targetUser.save();

  return { isFollowing: !isFollowing };
};

const unfollowUser = async (currentUserId, targetUserId) => {
  const user = await User.findById(currentUserId);
  const targetUser = await User.findById(targetUserId);

  if (!user || !targetUser) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  user.following.pull(targetUserId);
  targetUser.followers.pull(currentUserId);

  await user.save();
  await targetUser.save();
};

const getUserFollowers = async (userId) => {
  const user = await User.findById(userId).populate("followers", "name avatar isOnline");
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  return user.followers;
};

const getUserFollowing = async (userId) => {
  const user = await User.findById(userId).populate("following", "name avatar isOnline");
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  return user.following;
};

module.exports = {
  getUserById,
  updateUserById,
  searchUsers,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
};
