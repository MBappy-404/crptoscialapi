const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const eventService = require("./event.service");
const { httpResponse } = require("../../../utils/httpResponse");
const notificationService = require("../notification/notification.service");
const Event = require("./event.model");

const createEvent = catchAsync(async (req, res) => {
  const event = await eventService.createEvent(req.user.id, req.body);
  res.status(httpStatus.CREATED).json(httpResponse("success", event, "Event created."));
});

const getEvent = catchAsync(async (req, res) => {
  const event = await eventService.getEventById(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", event, ""));
});

const getAllEvents = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await eventService.getAllEvents(parseInt(page), parseInt(limit));
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const getUserEvents = catchAsync(async (req, res) => {
  const events = await eventService.getUserEvents(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", events, ""));
});

const attendEvent = catchAsync(async (req, res) => {
  await eventService.attendEvent(req.params.id, req.user.id);
  const event = await Event.findById(req.params.id).select("creator title");
  if (event && event.creator.toString() !== req.user.id) {
    await notificationService.createNotification({
      user: event.creator,
      from: req.user.id,
      type: "like",
      message: `is attending your event "${event.title}"`,
    });
  }
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Attending event."));
});

const interestedInEvent = catchAsync(async (req, res) => {
  await eventService.interestedInEvent(req.params.id, req.user.id);
  const event = await Event.findById(req.params.id).select("creator title");
  if (event && event.creator.toString() !== req.user.id) {
    await notificationService.createNotification({
      user: event.creator,
      from: req.user.id,
      type: "like",
      message: `is interested in your event "${event.title}"`,
    });
  }
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Marked interested."));
});

const cancelAttendance = catchAsync(async (req, res) => {
  await eventService.cancelAttendance(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Cancelled attendance."));
});

const deleteEvent = catchAsync(async (req, res) => {
  await eventService.deleteEvent(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Event deleted."));
});

module.exports = {
  createEvent, getEvent, getAllEvents, getUserEvents,
  attendEvent, interestedInEvent, cancelAttendance, deleteEvent,
};
