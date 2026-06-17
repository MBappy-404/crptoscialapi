const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const savedController = require("./saved.controller");

router.get("/", auth.verifyToken, savedController.getSavedPosts);
router.get("/check/:postId", auth.verifyToken, savedController.checkSaved);
router.post("/:postId", auth.verifyToken, savedController.savePost);
router.delete("/:postId", auth.verifyToken, savedController.unsavePost);

module.exports = router;
