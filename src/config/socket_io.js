const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../app/modules/user/user.model");

let socketIO = null;
let onlineUsers = new Map();

const ALLOWED_ORIGINS = [
  "https://cryptocial.vercel.app",
  "https://crptoscial.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.PROD_CLIENT_URL,
  process.env.STAGE_CLIENT_URL,
].filter(Boolean);

const socketConfig = {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(null, true);
    },
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e8,
};

function connect(server) {
  socketIO = new Server(server, socketConfig);

  socketIO.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  socketIO.on("connection", (socket) => {
    console.log(`⚡ User connected: ${socket.userId}`);

    onlineUsers.set(socket.userId, socket.id);
    socket.join(`user:${socket.userId}`);
    User.findByIdAndUpdate(socket.userId, { isOnline: true }).catch(() => {});
    socketIO.emit("online-users", Array.from(onlineUsers.keys()));

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
    });

    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
    });

    socket.on("send-message", (data) => {
      if (data.receiverId && data.message) {
        const receiverSocketId = onlineUsers.get(data.receiverId);
        if (receiverSocketId) {
          socketIO.to(receiverSocketId).emit("receive-message", {
            ...data,
            sender: socket.userId,
          });
        }
      }
    });

    socket.on("typing", (data) => {
      if (data.receiverId) {
        const receiverSocketId = onlineUsers.get(data.receiverId);
        if (receiverSocketId) {
          socketIO.to(receiverSocketId).emit("user-typing", { userId: data.userId });
        }
      }
      if (data.room) socket.to(data.room).emit("user-typing", { userId: data.userId });
    });

    socket.on("stop-typing", (data) => {
      if (data.receiverId) {
        const receiverSocketId = onlineUsers.get(data.receiverId);
        if (receiverSocketId) {
          socketIO.to(receiverSocketId).emit("user-stop-typing", { userId: data.userId });
        }
      }
      if (data.room) socket.to(data.room).emit("user-stop-typing", { userId: data.userId });
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.userId);
      User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() }).catch(() => {});
      socketIO.emit("online-users", Array.from(onlineUsers.keys()));
      console.log(`⚡ User disconnected: ${socket.userId}`);
    });
  });
}

const getSocket = () => socketIO;
const getOnlineUsers = () => Array.from(onlineUsers.keys());
const getSocketIO = () => socketIO;

module.exports = { connect, getSocket, getOnlineUsers, getSocketIO };
