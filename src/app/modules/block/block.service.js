const Block = require("./block.model");
const ApiError = require("../../../utils/ApiError");

async function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) {
    throw new ApiError(400, "You cannot block yourself");
  }
  const existing = await Block.findOne({ blocker: blockerId, blocked: blockedId });
  if (existing) {
    throw new ApiError(400, "User already blocked");
  }
  return Block.create({ blocker: blockerId, blocked: blockedId });
}

async function unblockUser(blockerId, blockedId) {
  const result = await Block.findOneAndDelete({ blocker: blockerId, blocked: blockedId });
  if (!result) throw new ApiError(404, "Block not found");
  return result;
}

async function isBlocked(userId, targetId) {
  const block = await Block.findOne({
    $or: [
      { blocker: userId, blocked: targetId },
      { blocker: targetId, blocked: userId },
    ],
  });
  return !!block;
}

async function getBlockedUsers(userId) {
  const blocks = await Block.find({ blocker: userId })
    .populate("blocked", "name avatar")
    .sort({ createdAt: -1 })
    .lean();
  return blocks.map((b) => b.blocked);
}

async function getBlockedByUsers(userId) {
  const blocks = await Block.find({ blocked: userId })
    .populate("blocker", "name avatar")
    .sort({ createdAt: -1 })
    .lean();
  return blocks.map((b) => b.blocker);
}

module.exports = {
  blockUser,
  unblockUser,
  isBlocked,
  getBlockedUsers,
  getBlockedByUsers,
};
