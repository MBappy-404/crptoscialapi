const mongoose = require("mongoose");

const eventSchema = mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 2000 },
    coverPhoto: { type: String, default: "" },
    location: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    interested: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
    },
  },
  { timestamps: true }
);

eventSchema.index({ startDate: 1 });

const Event = mongoose.model("Event", eventSchema);
module.exports = Event;
