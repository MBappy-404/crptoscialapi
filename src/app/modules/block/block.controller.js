const blockService = require("./block.service");
const httpResponse = require("../../../utils/httpResponse");

const block = async (req, res) => {
  await blockService.blockUser(req.user.id, req.body.userId);
  return res.status(200).json(httpResponse("success", null, "User blocked"));
};

const unblock = async (req, res) => {
  await blockService.unblockUser(req.user.id, req.params.userId);
  return res.status(200).json(httpResponse("success", null, "User unblocked"));
};

const checkBlock = async (req, res) => {
  const blocked = await blockService.isBlocked(req.user.id, req.params.userId);
  return res.status(200).json(httpResponse("success", { blocked }, "Check complete"));
};

const getBlockedUsers = async (req, res) => {
  const users = await blockService.getBlockedUsers(req.user.id);
  return res.status(200).json(httpResponse("success", users, "Blocked users fetched"));
};

module.exports = {
  block,
  unblock,
  checkBlock,
  getBlockedUsers,
};
