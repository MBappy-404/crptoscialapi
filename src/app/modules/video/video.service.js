const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const Video = require("../video/video.model");

const createVideo = async (userId, data) => {
  const video = await Video.create({ ...data, user: userId });
  return video.populate("user", "name avatar");
};

const getVideoById = async (videoId) => {
  const video = await Video.findById(videoId).populate("user", "name avatar").populate("comments.user", "name avatar");
  if (!video) throw new ApiError(httpStatus.NOT_FOUND, "Video not found");
  return video;
};

const getAllVideos = async (page = 1, limit = 20, category, search) => {
  const skip = (page - 1) * limit;
  const filter = {};
  if (category && category !== "all") filter.category = category;
  if (search) filter.$text = { $search: search };
  const videos = await Video.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "name avatar");
  const total = await Video.countDocuments(filter);
  return { videos, total, page, pages: Math.ceil(total / limit) };
};

const likeVideo = async (videoId, userId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(httpStatus.NOT_FOUND, "Video not found");
  const isLiked = video.likes.includes(userId);
  if (isLiked) video.likes.pull(userId);
  else video.likes.addToSet(userId);
  await video.save();
  return { isLiked: !isLiked, likesCount: video.likes.length };
};

const addComment = async (videoId, userId, text) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(httpStatus.NOT_FOUND, "Video not found");
  video.comments.push({ user: userId, text });
  await video.save();
  await video.populate("comments.user", "name avatar");
  return video.comments[video.comments.length - 1];
};

const incrementViews = async (videoId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(httpStatus.NOT_FOUND, "Video not found");
  video.views += 1;
  await video.save();
  return { views: video.views };
};

const deleteVideo = async (videoId, userId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(httpStatus.NOT_FOUND, "Video not found");
  if (video.user.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");
  await Video.findByIdAndDelete(videoId);
};

module.exports = { createVideo, getVideoById, getAllVideos, likeVideo, addComment, incrementViews, deleteVideo };
