const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
require("dotenv").config();

const indexRouter = require("./app/routes/index");
const ApiError = require("./utils/ApiError");
const { errorConverter, errorHandler } = require("./app/middleware/error");

const app = express();

// CORS must be before helmet
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      "https://cryptocial.vercel.app",
      "https://crptoscial.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
      process.env.PROD_CLIENT_URL,
      process.env.STAGE_CLIENT_URL,
    ].filter(Boolean);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// Security
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(compression());
app.use(mongoSanitize());

// Body parsing
app.use(logger("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API routes
app.use("/api", indexRouter);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Facebook Clone API is running!" });
});

// 404
app.use((req, res, next) => {
  next(new ApiError(404, "Not found"));
});

// Error handling
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
