const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email");
        }
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      private: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    coverPhoto: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },
    location: {
      type: String,
      default: "",
    },
    workplace: {
      type: String,
      default: "",
    },
    education: {
      type: String,
      default: "",
    },
    from: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    birthday: {
      type: Date,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};

userSchema.methods.isPasswordMatch = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
