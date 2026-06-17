const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const friendService = require("./friend.service");
const notificationService = require("../notification/notification.service");
const { httpResponse } = require("../../../utils/httpResponse");

const sendRequest = catchAsync(async (req, res) => {
  const request = await friendService.sendRequest(req.user.id, req.params.id);

  await notificationService.createNotification({
    user: req.params.id,
    from: req.user.id,
    type: "friend_request",
    message: "sent you a friend request",
  });

  res.status(httpStatus.CREATED).json(httpResponse("success", request, "Friend request sent."));
});

const acceptRequest = catchAsync(async (req, res) => {
  const request = await friendService.acceptRequest(req.params.id, req.user.id);

  await notificationService.createNotification({
    user: request.sender._id,
    from: req.user.id,
    type: "friend_accept",
    message: "accepted your friend request",
  });

  res.status(httpStatus.OK).json(httpResponse("success", request, "Friend request accepted."));
});

const rejectRequest = catchAsync(async (req, res) => {
  await friendService.rejectRequest(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Friend request rejected."));
});

const cancelRequest = catchAsync(async (req, res) => {
  await friendService.cancelRequest(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Friend request cancelled."));
});

const removeFriend = catchAsync(async (req, res) => {
  await friendService.removeFriend(req.user.id, req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Friend removed."));
});

const getPendingRequests = catchAsync(async (req, res) => {
  const requests = await friendService.getPendingRequests(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", requests, ""));
});

const getSentRequests = catchAsync(async (req, res) => {
  const requests = await friendService.getSentRequests(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", requests, ""));
});

const getSuggestions = catchAsync(async (req, res) => {
  const suggestions = await friendService.getSuggestions(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", suggestions, ""));
});

const getFriendsList = catchAsync(async (req, res) => {
  const friends = await friendService.getFriendsList(req.params.id || req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", friends, ""));
});

module.exports = { sendRequest, acceptRequest, rejectRequest, cancelRequest, removeFriend, getPendingRequests, getSentRequests, getSuggestions, getFriendsList };
