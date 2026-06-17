const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const userController = require("./user.controller");
const User = require("./user.model");
const Post = require("../post/post.model");
const FriendRequest = require("../friend/friend.model");
const catchAsync = require("../../../utils/catchAsync");
const { httpResponse } = require("../../../utils/httpResponse");

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json(httpResponse("error", {}, "Admin access required."));
  }
  next();
};

router.get("/search", auth.verifyToken, userController.searchUsers);
router.get("/admin/stats", auth.verifyToken, adminOnly, catchAsync(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalPosts = await Post.countDocuments();
  const today = new Date(); today.setHours(0,0,0,0);
  const activeToday = await User.countDocuments({ lastSeen: { $gte: today } });
  const pendingReports = await FriendRequest.countDocuments({ status: "pending" });
  const totalFriends = await FriendRequest.countDocuments({ status: "accepted" });
  res.status(200).json(httpResponse("success", { totalUsers, totalPosts, activeToday, pendingReports, totalFriends }, ""));
}));
router.get("/admin/reported-users", auth.verifyToken, adminOnly, catchAsync(async (req, res) => {
  const users = await User.find().select("name avatar role friends").limit(50);
  const result = users.map(u => ({
    _id: u._id,
    name: u.name,
    avatar: u.avatar,
    friends: u.friends?.length || 0,
    status: u.role === "admin" ? "active" : "active",
  }));
  res.status(200).json(httpResponse("success", result, ""));
}));
router.get("/admin/monthly-growth", auth.verifyToken, adminOnly, catchAsync(async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  const now = new Date();
  const data = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const newUsers = await User.countDocuments({ createdAt: { $gte: start, $lte: end } });
    const activeUsers = await User.countDocuments({ lastSeen: { $gte: start, $lte: end } });
    const totalPosts = await Post.countDocuments({ createdAt: { $gte: start, $lte: end } });
    data.push({
      month: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
      newUsers,
      activeUsers,
      totalPosts,
    });
  }
  res.status(200).json(httpResponse("success", data, ""));
}));
router.get("/admin/active-users", auth.verifyToken, adminOnly, catchAsync(async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayCount = await User.countDocuments({ lastSeen: { $gte: today } });
  const weekCount = await User.countDocuments({ lastSeen: { $gte: thisWeek } });
  const monthCount = await User.countDocuments({ lastSeen: { $gte: thisMonth } });
  const totalCount = await User.countDocuments();
  const recentlyActive = await User.find({ lastSeen: { $gte: thisWeek } }).select("name avatar lastSeen").sort({ lastSeen: -1 }).limit(20);
  res.status(200).json(httpResponse("success", { todayCount, weekCount, monthCount, totalCount, recentlyActive }, ""));
}));
router.put("/profile/update", auth.verifyToken, userController.updateProfile);
router.get("/", auth.verifyToken, catchAsync(async (req, res) => {
  const users = await User.find().select("name avatar isOnline lastSeen").limit(50);
  res.status(200).json(httpResponse("success", users, ""));
}));
router.get("/:id", auth.verifyToken, userController.getProfile);
router.post("/:id/follow", auth.verifyToken, userController.followUser);
router.get("/:id/followers", auth.verifyToken, userController.getFollowers);
router.get("/:id/following", auth.verifyToken, userController.getFollowing);

module.exports = router;
