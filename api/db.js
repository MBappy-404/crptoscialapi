const mongoose = require("mongoose");

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const connectionString =
      process.env.USE_LOCAL_DB === "true"
        ? process.env.LOCAL_DATABASE
        : process.env.ATLAS_URI;
    cached.promise = mongoose.connect(connectionString, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    }).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
