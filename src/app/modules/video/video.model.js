const mongoose = require("mongoose");

const videoSchema = mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 2000 },
    url: { type: String, required: true },
    thumbnail: { type: String, default: "" },
    channel: { type: String, default: "" },
    category: { type: String, enum: ["music", "gaming", "news", "sports", "learning", "other"], default: "other" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

videoSchema.index({ title: "text", description: "text" });

const Video = mongoose.model("Video", videoSchema);
module.exports = Video;
