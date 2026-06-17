const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const messageController = require("./message.controller");

router.get("/conversations", auth.verifyToken, messageController.getConversations);
router.get("/unread", auth.verifyToken, messageController.getUnreadCount);
router.post("/send/:receiverId", auth.verifyToken, messageController.sendMessage);
router.get("/:otherUserId", auth.verifyToken, messageController.getMessages);
router.post("/read/:senderId", auth.verifyToken, messageController.markAsRead);

module.exports = router;
