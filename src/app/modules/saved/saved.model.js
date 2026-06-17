const mongoose = require("mongoose");

const savedPostSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    folder: { type: String, default: "default" },
  },
  { timestamps: true }
);

savedPostSchema.index({ user: 1, post: 1 }, { unique: true });

const SavedPost = mongoose.model("SavedPost", savedPostSchema);
module.exports = SavedPost;
