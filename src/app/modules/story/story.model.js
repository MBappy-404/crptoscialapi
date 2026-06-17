const mongoose = require("mongoose");

const storyReactionSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "love", "haha", "wow", "sad", "angry"],
      default: "like",
    },
  },
  { _id: false }
);

const storySchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      maxlength: 500,
      default: "",
    },
    backgroundColor: {
      type: String,
      default: "#1877f2",
    },
    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    reactions: [storyReactionSchema],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  }
);

storySchema.index({ user: 1, createdAt: -1 });

const Story = mongoose.model("Story", storySchema);
module.exports = Story;
