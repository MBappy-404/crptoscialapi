const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const SavedPost = require("../saved/saved.model");

const savePost = async (userId, postId, folder = "default") => {
  const existing = await SavedPost.findOne({ user: userId, post: postId });
  if (existing) throw new ApiError(httpStatus.BAD_REQUEST, "Post already saved");
  const saved = await SavedPost.create({ user: userId, post: postId, folder });
  return saved.populate({ path: "post", populate: { path: "user", select: "name avatar" } });
};

const unsavePost = async (userId, postId) => {
  const saved = await SavedPost.findOneAndDelete({ user: userId, post: postId });
  if (!saved) throw new ApiError(httpStatus.NOT_FOUND, "Saved post not found");
};

const getSavedPosts = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const saved = await SavedPost.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: "post", populate: { path: "user", select: "name avatar" } });
  const total = await SavedPost.countDocuments({ user: userId });
  return { saved, total, page, pages: Math.ceil(total / limit) };
};

const isPostSaved = async (userId, postId) => {
  const saved = await SavedPost.findOne({ user: userId, post: postId });
  return !!saved;
};

module.exports = { savePost, unsavePost, getSavedPosts, isPostSaved };
