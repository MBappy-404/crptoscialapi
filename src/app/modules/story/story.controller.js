const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const storyService = require("./story.service");
const notificationService = require("../notification/notification.service");
const { httpResponse } = require("../../../utils/httpResponse");

const createStory = catchAsync(async (req, res) => {
  const story = await storyService.createStory(req.user.id, req.body);
  res.status(httpStatus.CREATED).json(httpResponse("success", story, "Story created."));
});

const getStories = catchAsync(async (req, res) => {
  const stories = await storyService.getStories(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", stories, ""));
});

const getUserStories = catchAsync(async (req, res) => {
  const stories = await storyService.getUserStories(req.params.userId);
  res.status(httpStatus.OK).json(httpResponse("success", stories, ""));
});

const viewStory = catchAsync(async (req, res) => {
  const story = await storyService.viewStory(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", story, ""));
});

const reactToStory = catchAsync(async (req, res) => {
  const { type = "like" } = req.body;
  const result = await storyService.reactToStory(req.params.id, req.user.id, type);

  if (result.isReacted) {
    const Story = require("./story.model");
    const story = await Story.findById(req.params.id).populate("user", "name avatar");
    if (story && story.user._id.toString() !== req.user.id) {
      await notificationService.createNotification({
        user: story.user._id,
        from: req.user.id,
        type: "story_like",
        story: story._id,
        message: `reacted ${type} to your story`,
      });
    }
  }

  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const deleteStory = catchAsync(async (req, res) => {
  await storyService.deleteStory(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Story deleted."));
});

module.exports = { createStory, getStories, getUserStories, viewStory, reactToStory, deleteStory };
