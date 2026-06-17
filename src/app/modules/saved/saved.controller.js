const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const savedService = require("./saved.service");
const { httpResponse } = require("../../../utils/httpResponse");

const savePost = catchAsync(async (req, res) => {
  const saved = await savedService.savePost(req.user.id, req.params.postId, req.body.folder);
  res.status(httpStatus.CREATED).json(httpResponse("success", saved, "Post saved."));
});

const unsavePost = catchAsync(async (req, res) => {
  await savedService.unsavePost(req.user.id, req.params.postId);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Post unsaved."));
});

const getSavedPosts = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await savedService.getSavedPosts(req.user.id, parseInt(page), parseInt(limit));
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const checkSaved = catchAsync(async (req, res) => {
  const isSaved = await savedService.isPostSaved(req.user.id, req.params.postId);
  res.status(httpStatus.OK).json(httpResponse("success", { isSaved }, ""));
});

module.exports = { savePost, unsavePost, getSavedPosts, checkSaved };
