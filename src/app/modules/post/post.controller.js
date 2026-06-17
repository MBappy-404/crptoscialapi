const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const postService = require("./post.service");
const notificationService = require("../notification/notification.service");
const User = require("../user/user.model");
const Post = require("../post/post.model");
const { httpResponse } = require("../../../utils/httpResponse");
const axios = require("axios");

const MENTION_REGEX = /@(\w[\w\s]*?\w|\w)/g;
const URL_REGEX = /https?:\/\/[^\s]+/i;

const fetchUrlPreview = async (url) => {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FacebookClone/1.0)" },
      maxRedirects: 3,
    });
    const getMeta = (prop) => {
      const patterns = [
        new RegExp(`<meta[^>]*property="${prop}"[^>]*content="([^"]*)"`, "i"),
        new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${prop}"`, "i"),
        new RegExp(`<meta[^>]*name="${prop}"[^>]*content="([^"]*)"`, "i"),
        new RegExp(`<meta[^>]*content="([^"]*)"[^>]*name="${prop}"`, "i"),
      ];
      for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
      return "";
    };
    const title = getMeta("og:title") || getMeta("twitter:title") || "";
    const description = getMeta("og:description") || getMeta("twitter:description") || getMeta("description") || "";
    let image = getMeta("og:image") || getMeta("twitter:image") || "";
    const siteName = getMeta("og:site_name") || "";
    if (image && !image.startsWith("http")) { try { image = new URL(image, url).href; } catch (e) {} }
    return { url, title, description, image, siteName };
  } catch (err) {
    return { url, title: "", description: "", image: "", siteName: "" };
  }
};

const sendMentionNotifications = async (text, postId, fromUserId) => {
  if (!text) return [];
  const mentions = [...text.matchAll(MENTION_REGEX)].map(m => m[1].trim());
  if (mentions.length === 0) return [];

  const fromUser = await User.findById(fromUserId).select("name");
  if (!fromUser) return [];

  const mentionedIds = [];
  for (const name of mentions) {
    const user = await User.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: fromUserId },
    });
    if (user) {
      mentionedIds.push(user._id);
      await notificationService.createNotification({
        user: user._id,
        from: fromUserId,
        type: "mention",
        post: postId,
        message: `mentioned you in a post`,
      });
    }
  }
  return mentionedIds;
};

const createPost = catchAsync(async (req, res) => {
  const post = await postService.createPost(req.user.id, req.body);
  
  if (req.body.content) {
    const mentionedIds = await sendMentionNotifications(req.body.content, post._id, req.user.id);
    if (mentionedIds.length > 0) {
      post.mentions = mentionedIds;
      await post.save();
    }
  }

  res.status(httpStatus.CREATED).json(httpResponse("success", post, "Post created."));
});

const getPost = catchAsync(async (req, res) => {
  const post = await postService.getPostById(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", post, ""));
});

const getFeed = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await postService.getFeedPosts(req.user.id, parseInt(page), parseInt(limit));
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const getUserPosts = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await postService.getUserPosts(req.params.userId, parseInt(page), parseInt(limit), req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const updatePost = catchAsync(async (req, res) => {
  const post = await postService.updatePost(req.params.id, req.user.id, req.body);
  res.status(httpStatus.OK).json(httpResponse("success", post, "Post updated."));
});

const deletePost = catchAsync(async (req, res) => {
  await postService.deletePost(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Post deleted."));
});

const reactToPost = catchAsync(async (req, res) => {
  const { type = "like" } = req.body;
  const result = await postService.reactToPost(req.params.id, req.user.id, type);

  if (result.isReacted) {
    const post = await postService.getPostById(req.params.id);
    if (post.user._id.toString() !== req.user.id) {
      await notificationService.createNotification({
        user: post.user._id,
        from: req.user.id,
        type: "like",
        post: post._id,
        message: `reacted ${type} to your post`,
      });
    }
  }

  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const addComment = catchAsync(async (req, res) => {
  const comment = await postService.addComment(req.params.id, req.user.id, req.body.text);

  const urlMatch = (req.body.text || "").match(URL_REGEX);
  if (urlMatch) {
    const preview = await fetchUrlPreview(urlMatch[0]);
    if (preview.title || preview.image) {
      comment.urlPreview = preview;
      await comment.save();
    }
  }

  const post = await postService.getPostById(req.params.id);
  if (post.user._id.toString() !== req.user.id) {
    await notificationService.createNotification({
      user: post.user._id,
      from: req.user.id,
      type: "comment",
      post: post._id,
      message: `commented: "${req.body.text.substring(0, 50)}..."`,
    });
  }

  await sendMentionNotifications(req.body.text, post._id, req.user.id);

  res.status(httpStatus.CREATED).json(httpResponse("success", comment, "Comment added."));
});

const deleteComment = catchAsync(async (req, res) => {
  await postService.deleteComment(req.params.id, req.params.commentId, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Comment deleted."));
});

const likeComment = catchAsync(async (req, res) => {
  const result = await postService.likeComment(req.params.id, req.params.commentId, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const replyToComment = catchAsync(async (req, res) => {
  const comment = await postService.replyToComment(req.params.id, req.params.commentId, req.user.id, req.body.text);

  const urlMatch = (req.body.text || "").match(URL_REGEX);
  if (urlMatch) {
    const preview = await fetchUrlPreview(urlMatch[0]);
    if (preview.title || preview.image) {
      comment.urlPreview = preview;
      await comment.save();
    }
  }

  const post = await postService.getPostById(req.params.id);
  if (post.user._id.toString() !== req.user.id) {
    await notificationService.createNotification({
      user: post.user._id,
      from: req.user.id,
      type: "comment",
      post: post._id,
      message: `replied: "${req.body.text.substring(0, 50)}..."`,
    });
  }

  await sendMentionNotifications(req.body.text, post._id, req.user.id);

  res.status(httpStatus.CREATED).json(httpResponse("success", comment, "Reply added."));
});

const sharePost = catchAsync(async (req, res) => {
  const result = await postService.sharePost(req.params.id, req.user.id, req.body.text || "");

  const post = await postService.getPostById(req.params.id);
  if (post.user._id.toString() !== req.user.id) {
    await notificationService.createNotification({
      user: post.user._id,
      from: req.user.id,
      type: "share",
      post: post._id,
      message: "shared your post",
    });
  }

  res.status(httpStatus.OK).json(httpResponse("success", result, "Post shared."));
});

const getStats = catchAsync(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalPosts = await Post.countDocuments();
  const totalFriends = await User.aggregate([
    { $project: { count: { $size: "$friends" } } },
    { $group: { _id: null, total: { $sum: "$count" } } },
  ]);
  const totalReactions = await Post.aggregate([
    { $project: { count: { $size: "$reactions" } } },
    { $group: { _id: null, total: { $sum: "$count" } } },
  ]);
  const totalComments = await Post.aggregate([
    { $project: { count: { $size: "$comments" } } },
    { $group: { _id: null, total: { $sum: "$count" } } },
  ]);

  res.status(httpStatus.OK).json(httpResponse("success", {
    totalUsers,
    totalPosts,
    totalFriends: totalFriends[0]?.total || 0,
    totalReactions: totalReactions[0]?.total || 0,
    totalComments: totalComments[0]?.total || 0,
  }, ""));
});

const getRecentPosts = catchAsync(async (req, res) => {
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("user", "name avatar");
  res.status(httpStatus.OK).json(httpResponse("success", posts, ""));
});

const getUrlPreview = catchAsync(async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(httpStatus.BAD_REQUEST).json(httpResponse("error", null, "URL is required"));

  try {
    const { data: html } = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FacebookClone/1.0)",
      },
      maxRedirects: 3,
    });

    const getMeta = (prop) => {
      const patterns = [
        new RegExp(`<meta[^>]*property="${prop}"[^>]*content="([^"]*)"`, "i"),
        new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${prop}"`, "i"),
        new RegExp(`<meta[^>]*name="${prop}"[^>]*content="([^"]*)"`, "i"),
        new RegExp(`<meta[^>]*content="([^"]*)"[^>]*name="${prop}"`, "i"),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1];
      }
      return "";
    };

    const title = getMeta("og:title") || getMeta("twitter:title") || "";
    const description = getMeta("og:description") || getMeta("twitter:description") || getMeta("description") || "";
    let image = getMeta("og:image") || getMeta("twitter:image") || "";
    const siteName = getMeta("og:site_name") || "";

    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, url).href;
      } catch (e) {}
    }

    const preview = { url, title, description, image, siteName };
    res.status(httpStatus.OK).json(httpResponse("success", preview, ""));
  } catch (err) {
    res.status(httpStatus.OK).json(httpResponse("success", { url, title: "", description: "", image: "", siteName: "" }, ""));
  }
});

const addCollaborator = async (req, res) => {
  const { collaboratorId } = req.body;
  const post = await postService.addCollaborator(req.params.id, req.user.id, collaboratorId);
  res.status(httpStatus.OK).json(httpResponse("success", post, "Collaborator added"));
};

const removeCollaborator = async (req, res) => {
  const post = await postService.removeCollaborator(req.params.id, req.user.id, req.params.collaboratorId);
  res.status(httpStatus.OK).json(httpResponse("success", post, "Collaborator removed"));
};

module.exports = {
  createPost, getPost, getFeed, getUserPosts, updatePost, deletePost,
  reactToPost, addComment, deleteComment, likeComment, replyToComment, sharePost,
  getStats, getRecentPosts, getUrlPreview, addCollaborator, removeCollaborator,
};
