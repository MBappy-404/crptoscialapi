const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const Post = require("../post/post.model");
const User = require("../user/user.model");

const createPost = async (userId, postData) => {
  const post = await Post.create({ user: userId, ...postData });
  return post.populate("user", "name avatar");
};

const getPostById = async (postId) => {
  const post = await Post.findById(postId)
    .populate("user", "name avatar")
    .populate("comments.user", "name avatar")
    .populate("comments.mentions", "name avatar")
    .populate("reactions.user", "name avatar")
    .populate("shares.user", "name avatar")
    .populate("mentions", "name avatar")
    .populate("collaborators", "name avatar");
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  if (post.sharedFrom) {
    await post.populate({ path: "sharedFrom", populate: { path: "user", select: "name avatar" } });
  }
  return post;
};

const getFeedPosts = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const user = await User.findById(userId).select("friends");
  const friendIds = (user?.friends || []).map(f => f.toString());

  const posts = await Post.find({
    $or: [
      { visibility: "public" },
      { visibility: "friends", user: { $in: friendIds } },
      { visibility: "friends", user: userId },
      { user: userId },
      { visibility: "specific", specificPeople: userId },
    ],
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("user", "name avatar")
    .populate("comments.user", "name avatar")
    .populate("comments.mentions", "name avatar")
    .populate("reactions.user", "name avatar")
    .populate("mentions", "name avatar")
    .populate("collaborators", "name avatar");

  for (const post of posts) {
    if (post.sharedFrom) {
      await post.populate({ path: "sharedFrom", populate: { path: "user", select: "name avatar" } });
    }
  }

  const total = await Post.countDocuments({
    $or: [
      { visibility: "public" },
      { visibility: "friends", user: { $in: friendIds } },
      { visibility: "friends", user: userId },
      { user: userId },
      { visibility: "specific", specificPeople: userId },
    ],
  });
  return { posts, total, page, pages: Math.ceil(total / limit) };
};

const getUserPosts = async (userId, page = 1, limit = 10, viewerId = null) => {
  const skip = (page - 1) * limit;

  const query = { user: userId };

  if (viewerId && viewerId !== userId) {
    const viewer = await User.findById(viewerId).select("friends");
    const friendIds = (viewer?.friends || []).map(f => f.toString());
    const isFriend = friendIds.includes(userId);

    query.$or = [
      { visibility: "public" },
      ...(isFriend ? [{ visibility: "friends" }] : []),
      { visibility: "specific", specificPeople: viewerId },
    ];

    if (query.$or.length === 1) {
      const val = query.$or[0];
      delete query.$or;
      Object.assign(query, val);
    }
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("user", "name avatar")
    .populate("comments.user", "name avatar")
    .populate("comments.mentions", "name avatar")
    .populate("reactions.user", "name avatar")
    .populate("mentions", "name avatar")
    .populate("collaborators", "name avatar");

  for (const post of posts) {
    if (post.sharedFrom) {
      await post.populate({ path: "sharedFrom", populate: { path: "user", select: "name avatar" } });
    }
  }

  const total = await Post.countDocuments(query);
  return { posts, total, page, pages: Math.ceil(total / limit) };
};

const updatePost = async (postId, userId, updateData) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  const isOwner = post.user.toString() === userId;
  const isCollaborator = post.collaborators.some(c => c.toString() === userId);
  if (!isOwner && !isCollaborator) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");

  Object.assign(post, updateData);
  await post.save();
  return post.populate("user", "name avatar");
};

const deletePost = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  if (post.user.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");

  await Post.findByIdAndDelete(postId);
};

const reactToPost = async (postId, userId, reactionType = "like") => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");

  const existingIndex = post.reactions.findIndex(
    (r) => r.user.toString() === userId
  );

  let isReacted = false;
  let myReaction = null;

  if (existingIndex >= 0) {
    const existing = post.reactions[existingIndex];
    if (existing.type === reactionType) {
      post.reactions.splice(existingIndex, 1);
      isReacted = false;
      myReaction = null;
    } else {
      existing.type = reactionType;
      isReacted = true;
      myReaction = reactionType;
    }
  } else {
    post.reactions.push({ user: userId, type: reactionType });
    isReacted = true;
    myReaction = reactionType;
  }

  await post.save();

  const reactionCounts = {};
  post.reactions.forEach((r) => {
    reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
  });

  return {
    isReacted,
    myReaction,
    reactionCounts,
    totalReactions: post.reactions.length,
  };
};

const addComment = async (postId, userId, text, urlPreview) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");

  const commentData = { user: userId, text };
  if (urlPreview) {
    commentData.urlPreview = urlPreview;
  }
  post.comments.push(commentData);
  await post.save();
  await post.populate("comments.user", "name avatar");
  return post.comments[post.comments.length - 1];
};

const replyToComment = async (postId, commentId, userId, text, urlPreview) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");

  const parentComment = post.comments.id(commentId);
  if (!parentComment) throw new ApiError(httpStatus.NOT_FOUND, "Parent comment not found");

  const replyData = { user: userId, text, parentId: commentId };
  if (urlPreview) {
    replyData.urlPreview = urlPreview;
  }
  post.comments.push(replyData);
  await post.save();
  await post.populate("comments.user", "name avatar");
  return post.comments[post.comments.length - 1];
};

const deleteComment = async (postId, commentId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");

  const comment = post.comments.id(commentId);
  if (!comment) throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");
  if (comment.user.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");

  post.comments.pull(commentId);
  await post.save();
};

const likeComment = async (postId, commentId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");

  const comment = post.comments.id(commentId);
  if (!comment) throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");

  const isLiked = comment.likes.includes(userId);
  if (isLiked) {
    comment.likes.pull(userId);
  } else {
    comment.likes.addToSet(userId);
  }
  await post.save();
  return { likes: comment.likes, isLiked: !isLiked };
};

const sharePost = async (postId, userId, shareText = "") => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(httpStatus.NOT_FOUND, "Post not found");

  post.shares.push({ user: userId });
  await post.save();

  const repost = await Post.create({
    user: userId,
    content: shareText || "",
    visibility: "public",
    sharedFrom: postId,
  });

  return repost.populate("user", "name avatar");
};

const getStats = async () => {
  const totalPosts = await Post.countDocuments();
  const totalReactions = await Post.aggregate([
    { $project: { count: { $size: "$reactions" } } },
    { $group: { _id: null, total: { $sum: "$count" } } },
  ]);
  const totalComments = await Post.aggregate([
    { $project: { count: { $size: "$comments" } } },
    { $group: { _id: null, total: { $sum: "$count" } } },
  ]);
  return {
    totalPosts,
    totalReactions: totalReactions[0]?.total || 0,
    totalComments: totalComments[0]?.total || 0,
  };
};

const addCollaborator = async (postId, userId, collaboratorId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");
  if (post.user.toString() !== userId) throw new ApiError(403, "Only the post owner can add collaborators");
  if (post.user.toString() === collaboratorId) throw new ApiError(400, "Cannot add yourself as collaborator");
  if (post.collaborators.includes(collaboratorId)) throw new ApiError(400, "User is already a collaborator");
  post.collaborators.push(collaboratorId);
  await post.save();
  return post.populate("collaborators", "name avatar");
};

const removeCollaborator = async (postId, userId, collaboratorId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");
  if (post.user.toString() !== userId) throw new ApiError(403, "Only the post owner can remove collaborators");
  post.collaborators = post.collaborators.filter(c => c.toString() !== collaboratorId);
  await post.save();
  return post.populate("collaborators", "name avatar");
};

module.exports = {
  createPost,
  getPostById,
  getFeedPosts,
  getUserPosts,
  updatePost,
  deletePost,
  reactToPost,
  addComment,
  deleteComment,
  likeComment,
  sharePost,
  getStats,
  addCollaborator,
  removeCollaborator,
};
