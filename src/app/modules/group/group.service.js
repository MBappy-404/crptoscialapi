const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const Group = require("../group/group.model");

const createGroup = async (userId, data) => {
  const group = await Group.create({ ...data, admin: userId, members: [userId] });
  return group.populate("admin", "name avatar");
};

const getGroupById = async (groupId) => {
  const group = await Group.findById(groupId)
    .populate("admin", "name avatar")
    .populate("members", "name avatar")
    .populate("posts.user", "name avatar")
    .populate("posts.comments.user", "name avatar");
  if (!group) throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  return group;
};

const getAllGroups = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const groups = await Group.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("admin", "name avatar")
    .populate("members", "name avatar");
  const total = await Group.countDocuments();
  return { groups, total, page, pages: Math.ceil(total / limit) };
};

const getUserGroups = async (userId) => {
  const groups = await Group.find({ members: userId })
    .sort({ createdAt: -1 })
    .populate("admin", "name avatar")
    .populate("members", "name avatar");
  return groups;
};

const joinGroup = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  if (group.members.includes(userId)) throw new ApiError(httpStatus.BAD_REQUEST, "Already a member");
  group.members.addToSet(userId);
  await group.save();
  return group;
};

const leaveGroup = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  if (group.admin.toString() === userId) throw new ApiError(httpStatus.BAD_REQUEST, "Admin cannot leave");
  group.members.pull(userId);
  await group.save();
  return group;
};

const addPost = async (groupId, userId, postData) => {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  if (!group.members.includes(userId)) throw new ApiError(httpStatus.FORBIDDEN, "Not a member");
  group.posts.unshift({ user: userId, ...postData });
  await group.save();
  await group.populate("posts.user", "name avatar");
  return group.posts[0];
};

const likeGroupPost = async (groupId, postId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  const post = group.posts.id(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  const isLiked = post.likes.includes(userId);
  if (isLiked) post.likes.pull(userId);
  else post.likes.addToSet(userId);
  await group.save();
  return { isLiked: !isLiked, likesCount: post.likes.length };
};

const commentOnGroupPost = async (groupId, postId, userId, text) => {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  const post = group.posts.id(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  post.comments.push({ user: userId, text });
  await group.save();
  await group.populate("posts.comments.user", "name avatar");
  return post.comments[post.comments.length - 1];
};

const deleteGroup = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  if (group.admin.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");
  await Group.findByIdAndDelete(groupId);
};

module.exports = {
  createGroup, getGroupById, getAllGroups, getUserGroups,
  joinGroup, leaveGroup, addPost, likeGroupPost, commentOnGroupPost, deleteGroup,
};
