const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const videoController = require("./video.controller");

router.post("/", auth.verifyToken, videoController.createVideo);
router.get("/", auth.verifyToken, videoController.getAllVideos);
router.post("/:id/like", auth.verifyToken, videoController.likeVideo);
router.post("/:id/comment", auth.verifyToken, videoController.addComment);
router.post("/:id/view", auth.verifyToken, videoController.incrementViews);
router.delete("/:id", auth.verifyToken, videoController.deleteVideo);
router.get("/:id", auth.verifyToken, videoController.getVideo);

module.exports = router;
