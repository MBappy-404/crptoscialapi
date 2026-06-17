const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const Story = require("../story/story.model");

const createStory = async (userId, storyData) => {
  const story = await Story.create({ user: userId, ...storyData });
  return story.populate("user", "name avatar");
};

const getStories = async (userId) => {
  const stories = await Story.find({
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate("user", "name avatar")
    .populate("viewers", "name avatar")
    .populate("reactions.user", "name avatar");
  return stories;
};

const getUserStories = async (userId) => {
  const stories = await Story.find({
    user: userId,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate("user", "name avatar")
    .populate("viewers", "name avatar")
    .populate("reactions.user", "name avatar");
  return stories;
};

const viewStory = async (storyId, userId) => {
  const story = await Story.findById(storyId);
  if (!story) throw new ApiError(httpStatus.NOT_FOUND, "Story not found");

  if (!story.viewers.includes(userId)) {
    story.viewers.addToSet(userId);
    await story.save();
  }
  return story;
};

const reactToStory = async (storyId, userId, reactionType = "like") => {
  const story = await Story.findById(storyId);
  if (!story) throw new ApiError(httpStatus.NOT_FOUND, "Story not found");

  const existingIndex = story.reactions.findIndex(
    (r) => r.user.toString() === userId
  );

  let isReacted = false;
  let myReaction = null;

  if (existingIndex >= 0) {
    const existing = story.reactions[existingIndex];
    if (existing.type === reactionType) {
      story.reactions.splice(existingIndex, 1);
      isReacted = false;
      myReaction = null;
    } else {
      existing.type = reactionType;
      isReacted = true;
      myReaction = reactionType;
    }
  } else {
    story.reactions.push({ user: userId, type: reactionType });
    isReacted = true;
    myReaction = reactionType;
  }

  await story.save();

  const reactionCounts = {};
  story.reactions.forEach((r) => {
    reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
  });

  return {
    isReacted,
    myReaction,
    reactionCounts,
    totalReactions: story.reactions.length,
  };
};

const deleteStory = async (storyId, userId) => {
  const story = await Story.findById(storyId);
  if (!story) throw new ApiError(httpStatus.NOT_FOUND, "Story not found");
  if (story.user.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");

  await Story.findByIdAndDelete(storyId);
};

module.exports = {
  createStory,
  getStories,
  getUserStories,
  viewStory,
  reactToStory,
  deleteStory,
};
