const mongoose = require("mongoose");

const groupPostSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, maxlength: 5000, default: "" },
    image: { type: String, default: "" },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true, maxlength: 1000 },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const groupSchema = mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 2000 },
    coverPhoto: { type: String, default: "" },
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    posts: [groupPostSchema],
  },
  { timestamps: true }
);

groupSchema.index({ name: "text" });

const Group = mongoose.model("Group", groupSchema);
module.exports = Group;
