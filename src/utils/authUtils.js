const jwt = require("jsonwebtoken");

const createToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

const addCookies = (res, userData) => {
  const { accessToken, refreshToken, ...rest } = userData;

  res.cookie("token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + 12 * 60 * 60 * 1000),
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.cookie("tokenExp", "1", {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + 12 * 60 * 60 * 1000),
  });
};

const clearCookies = (res) => {
  res.cookie("token", "", { maxAge: 0, path: "/" });
  res.cookie("refreshToken", "", { maxAge: 0, path: "/" });
  res.cookie("tokenExp", "", { maxAge: 0, path: "/" });
};

module.exports = { createToken, addCookies, clearCookies };
