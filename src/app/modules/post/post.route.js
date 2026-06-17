const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const postController = require("./post.controller");

router.get("/stats", auth.verifyToken, postController.getStats);
router.get("/recent", auth.verifyToken, postController.getRecentPosts);
router.post("/url-preview", auth.verifyToken, postController.getUrlPreview);
router.post("/", auth.verifyToken, postController.createPost);
router.get("/feed", auth.verifyToken, postController.getFeed);
router.get("/myposts", auth.verifyToken, postController.getUserPosts);
router.get("/user/:userId", auth.verifyToken, postController.getUserPosts);
router.get("/:id", auth.verifyToken, postController.getPost);
router.put("/:id", auth.verifyToken, postController.updatePost);
router.delete("/:id", auth.verifyToken, postController.deletePost);
router.post("/:id/react", auth.verifyToken, postController.reactToPost);
router.post("/:id/comment", auth.verifyToken, postController.addComment);
router.delete("/:id/comment/:commentId", auth.verifyToken, postController.deleteComment);
router.post("/:id/comment/:commentId/like", auth.verifyToken, postController.likeComment);
router.post("/:id/comment/:commentId/reply", auth.verifyToken, postController.replyToComment);
router.post("/:id/share", auth.verifyToken, postController.sharePost);
router.post("/:id/collaborator", auth.verifyToken, postController.addCollaborator);
router.delete("/:id/collaborator/:collaboratorId", auth.verifyToken, postController.removeCollaborator);

module.exports = router;
