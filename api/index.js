const serverless = require("serverless-http");
const app = require("../src/app");
const { connectDB } = require("./db");

let isConnected = false;
let serverlessHandler = null;

async function ensureDB() {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
}

module.exports = async function handler(req, res) {
  try {
    await ensureDB();
    if (!serverlessHandler) {
      serverlessHandler = serverless(app);
    }
    return serverlessHandler(req, res);
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ status: "error", message: "Server cold start failed" });
  }
};
