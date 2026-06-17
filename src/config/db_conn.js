const mongoose = require("mongoose");

const connectionString =
  process.env.USE_LOCAL_DB === "true"
    ? process.env.LOCAL_DATABASE
    : process.env.ATLAS_URI;

module.exports = {
  connectToServer: function (callback) {
    mongoose.connect(connectionString)
      .then((conn) => {
        console.log("✅ MongoDB connected:", conn.connection.host);
        callback(null);
      })
      .catch((error) => {
        console.error("❌ MongoDB connection error:", error);
        callback(error);
      });
  },
  getDb: function () {
    return mongoose.connection;
  },
};
