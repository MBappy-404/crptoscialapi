const httpStatus = require("http-status");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ApiError = require("../../../utils/ApiError");
const User = require("../user/user.model");
const { createToken, addCookies } = require("../../../utils/authUtils");

const register = async (userData) => {
  if (await User.isEmailTaken(userData.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
  }

  const user = await User.create(userData);
  const userObj = user.toObject();
  delete userObj.password;
  return userObj;
};

const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }

  const isMatch = await user.isPasswordMatch(password);
  if (!isMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }

  const userObject = user.toObject();
  delete userObject.password;
  return userObject;
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const isMatch = await user.isPasswordMatch(oldPassword);
  if (!isMatch) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect current password");
  }

  user.password = newPassword;
  await user.save();
};

module.exports = {
  register,
  loginUserWithEmailAndPassword,
  changePassword,
};
