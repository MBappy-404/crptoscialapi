const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const videoService = require("./video.service");
const { httpResponse } = require("../../../utils/httpResponse");

const createVideo = catchAsync(async (req, res) => {
  const video = await videoService.createVideo(req.user.id, req.body);
  res.status(httpStatus.CREATED).json(httpResponse("success", video, "Video uploaded."));
});

const getVideo = catchAsync(async (req, res) => {
  const video = await videoService.getVideoById(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", video, ""));
});

const getAllVideos = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, category, search } = req.query;
  const result = await videoService.getAllVideos(parseInt(page), parseInt(limit), category, search);
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const likeVideo = catchAsync(async (req, res) => {
  const result = await videoService.likeVideo(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const addComment = catchAsync(async (req, res) => {
  const comment = await videoService.addComment(req.params.id, req.user.id, req.body.text);
  res.status(httpStatus.CREATED).json(httpResponse("success", comment, "Comment added."));
});

const deleteVideo = catchAsync(async (req, res) => {
  await videoService.deleteVideo(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Video deleted."));
});

const incrementViews = catchAsync(async (req, res) => {
  const result = await videoService.incrementViews(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

module.exports = { createVideo, getVideo, getAllVideos, likeVideo, addComment, incrementViews, deleteVideo };
