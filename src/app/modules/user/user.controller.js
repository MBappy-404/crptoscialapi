const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const userService = require("./user.service");
const { httpResponse } = require("../../../utils/httpResponse");

const getProfile = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", user, ""));
});

const updateProfile = catchAsync(async (req, res) => {
  let oldAvatar = "";
  try {
    const currentUser = await userService.getUserById(req.user.id);
    oldAvatar = currentUser?.avatar || "";
  } catch (err) {}

  const user = await userService.updateUserById(req.user.id, req.body);
  const newAvatar = req.body.avatar;

  if (newAvatar && newAvatar !== oldAvatar) {
    const Post = require("../post/post.model");
    await Post.create({
      user: req.user.id,
      image: newAvatar,
      postType: "avatar_update",
      visibility: "public",
    });
  }

  res.status(httpStatus.OK).json(httpResponse("success", user, "Profile updated."));
});

const searchUsers = catchAsync(async (req, res) => {
  const users = await userService.searchUsers(req.query.q, req.user.id, req.query.friendsOnly === "true");
  res.status(httpStatus.OK).json(httpResponse("success", users, ""));
});

const followUser = catchAsync(async (req, res) => {
  const result = await userService.followUser(req.user.id, req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", result, result.isFollowing ? "Followed" : "Unfollowed"));
});

const getFollowers = catchAsync(async (req, res) => {
  const followers = await userService.getUserFollowers(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", followers, ""));
});

const getFollowing = catchAsync(async (req, res) => {
  const following = await userService.getUserFollowing(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", following, ""));
});

module.exports = { getProfile, updateProfile, searchUsers, followUser, getFollowers, getFollowing };
