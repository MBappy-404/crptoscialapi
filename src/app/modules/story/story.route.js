const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const storyController = require("./story.controller");

router.post("/", auth.verifyToken, storyController.createStory);
router.get("/", auth.verifyToken, storyController.getStories);
router.get("/user/:userId", auth.verifyToken, storyController.getUserStories);
router.post("/:id/view", auth.verifyToken, storyController.viewStory);
router.post("/:id/react", auth.verifyToken, storyController.reactToStory);
router.delete("/:id", auth.verifyToken, storyController.deleteStory);

module.exports = router;
