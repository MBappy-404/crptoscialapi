const jwt = require("jsonwebtoken");
const { httpResponse } = require("../../utils/httpResponse");
const { createToken } = require("../../utils/authUtils");

const checkRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    return null;
  }
};

const auth = {
  verifyToken: (req, res, next) => {
    const authToken = req.cookies.token;
    const refreshToken = req.cookies.refreshToken;

    if (!authToken) {
      return res.status(401).json(httpResponse("error", {}, "User not logged in."));
    }

    jwt.verify(authToken, process.env.ACCESS_TOKEN_SECRET, async (err, decodedUser) => {
      if (err) {
        const userDecoded = checkRefreshToken(refreshToken);
        if (userDecoded) {
          const accessToken = createToken(
            { id: userDecoded.id, email: userDecoded.email, name: userDecoded.name },
            process.env.ACCESS_TOKEN_SECRET,
            process.env.ACCESS_TOKEN_EXPIRES || "1d"
          );

          req.user = userDecoded;

          res.cookie("token", accessToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            expires: new Date(Date.now() + 12 * 60 * 60 * 1000),
          });

          next();
        } else {
          return res.status(403).json(httpResponse("error", {}, "Token expired."));
        }
      } else {
        req.user = decodedUser;
        next();
      }
    });
  },

  optionalToken: (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (!err) req.user = decoded;
      });
    }
    next();
  },
};

module.exports = auth;
