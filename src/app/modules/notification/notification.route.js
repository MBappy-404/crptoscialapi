const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const notificationController = require("./notification.controller");

router.get("/", auth.verifyToken, notificationController.getNotifications);
router.get("/unread", auth.verifyToken, notificationController.getUnreadCount);
router.put("/read-all", auth.verifyToken, notificationController.markAllAsRead);
router.put("/read/:id", auth.verifyToken, notificationController.markAsRead);
router.delete("/:id", auth.verifyToken, notificationController.deleteNotification);

module.exports = router;
