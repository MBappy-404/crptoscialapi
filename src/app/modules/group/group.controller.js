const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const groupService = require("./group.service");
const { httpResponse } = require("../../../utils/httpResponse");
const notificationService = require("../notification/notification.service");
const Group = require("./group.model");

const createGroup = catchAsync(async (req, res) => {
  const group = await groupService.createGroup(req.user.id, req.body);
  res.status(httpStatus.CREATED).json(httpResponse("success", group, "Group created."));
});

const getGroup = catchAsync(async (req, res) => {
  const group = await groupService.getGroupById(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", group, ""));
});

const getAllGroups = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await groupService.getAllGroups(parseInt(page), parseInt(limit));
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const getUserGroups = catchAsync(async (req, res) => {
  const groups = await groupService.getUserGroups(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", groups, ""));
});

const joinGroup = catchAsync(async (req, res) => {
  await groupService.joinGroup(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Joined group."));
});

const leaveGroup = catchAsync(async (req, res) => {
  await groupService.leaveGroup(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Left group."));
});

const addPost = catchAsync(async (req, res) => {
  const post = await groupService.addPost(req.params.id, req.user.id, req.body);
  res.status(httpStatus.CREATED).json(httpResponse("success", post, "Post added."));
});

const likeGroupPost = catchAsync(async (req, res) => {
  const result = await groupService.likeGroupPost(req.params.id, req.params.postId, req.user.id);
  if (result.isLiked) {
    const group = await Group.findById(req.params.id).select("posts");
    const post = group?.posts?.id(req.params.postId);
    if (post && post.user.toString() !== req.user.id) {
      await notificationService.createNotification({
        user: post.user,
        from: req.user.id,
        type: "like",
        message: "liked your post in a group",
      });
    }
  }
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const commentOnGroupPost = catchAsync(async (req, res) => {
  const comment = await groupService.commentOnGroupPost(req.params.id, req.params.postId, req.user.id, req.body.text);
  const group = await Group.findById(req.params.id).select("posts");
  const post = group?.posts?.id(req.params.postId);
  if (post && post.user.toString() !== req.user.id) {
    await notificationService.createNotification({
      user: post.user,
      from: req.user.id,
      type: "comment",
      message: "commented on your post in a group",
    });
  }
  res.status(httpStatus.CREATED).json(httpResponse("success", comment, "Comment added."));
});

const deleteGroup = catchAsync(async (req, res) => {
  await groupService.deleteGroup(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Group deleted."));
});

module.exports = {
  createGroup, getGroup, getAllGroups, getUserGroups,
  joinGroup, leaveGroup, addPost, likeGroupPost, commentOnGroupPost, deleteGroup,
};
