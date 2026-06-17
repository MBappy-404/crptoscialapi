const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const Event = require("../event/event.model");

const createEvent = async (userId, data) => {
  const event = await Event.create({ ...data, creator: userId, attendees: [userId] });
  return event.populate("creator", "name avatar");
};

const getEventById = async (eventId) => {
  const event = await Event.findById(eventId)
    .populate("creator", "name avatar")
    .populate("attendees", "name avatar")
    .populate("interested", "name avatar");
  if (!event) throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  return event;
};

const getAllEvents = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const events = await Event.find({ startDate: { $gte: new Date() } })
    .sort({ startDate: 1 })
    .skip(skip)
    .limit(limit)
    .populate("creator", "name avatar")
    .populate("attendees", "name avatar");
  const total = await Event.countDocuments({ startDate: { $gte: new Date() } });
  return { events, total, page, pages: Math.ceil(total / limit) };
};

const getUserEvents = async (userId) => {
  const events = await Event.find({
    $or: [{ attendees: userId }, { interested: userId }, { creator: userId }],
  })
    .sort({ startDate: 1 })
    .populate("creator", "name avatar")
    .populate("attendees", "name avatar");
  return events;
};

const attendEvent = async (eventId, userId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  event.attendees.addToSet(userId);
  event.interested.pull(userId);
  await event.save();
  return event;
};

const interestedInEvent = async (eventId, userId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  event.interested.addToSet(userId);
  await event.save();
  return event;
};

const cancelAttendance = async (eventId, userId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  event.attendees.pull(userId);
  event.interested.pull(userId);
  await event.save();
  return event;
};

const deleteEvent = async (eventId, userId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  if (event.creator.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");
  await Event.findByIdAndDelete(eventId);
};

module.exports = {
  createEvent, getEventById, getAllEvents, getUserEvents,
  attendEvent, interestedInEvent, cancelAttendance, deleteEvent,
};
