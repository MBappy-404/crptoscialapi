const mongoose = require("mongoose");

const friendRequestSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);
module.exports = FriendRequest;
