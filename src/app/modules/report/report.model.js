const mongoose = require("mongoose");

const reportSchema = mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    reason: {
      type: String,
      enum: [
        "spam",
        "hate_speech",
        "violence",
        "nudity",
        "harassment",
        "false_information",
        "intellectual_property",
        "self_harm",
        "other",
      ],
      required: true,
    },
    description: {
      type: String,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
    },
    adminNote: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, post: 1 }, { unique: true });
reportSchema.index({ post: 1 });
reportSchema.index({ status: 1 });

const Report = mongoose.model("Report", reportSchema);
module.exports = Report;
