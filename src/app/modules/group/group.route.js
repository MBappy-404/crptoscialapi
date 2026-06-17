const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const groupController = require("./group.controller");

router.post("/", auth.verifyToken, groupController.createGroup);
router.get("/", auth.verifyToken, groupController.getAllGroups);
router.get("/my", auth.verifyToken, groupController.getUserGroups);
router.post("/:id/join", auth.verifyToken, groupController.joinGroup);
router.post("/:id/leave", auth.verifyToken, groupController.leaveGroup);
router.post("/:id/post", auth.verifyToken, groupController.addPost);
router.post("/:id/post/:postId/like", auth.verifyToken, groupController.likeGroupPost);
router.post("/:id/post/:postId/comment", auth.verifyToken, groupController.commentOnGroupPost);
router.delete("/:id", auth.verifyToken, groupController.deleteGroup);
router.get("/:id", auth.verifyToken, groupController.getGroup);

module.exports = router;
