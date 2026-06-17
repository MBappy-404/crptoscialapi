const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const friendController = require("./friend.controller");

router.get("/pending", auth.verifyToken, friendController.getPendingRequests);
router.get("/sent", auth.verifyToken, friendController.getSentRequests);
router.get("/suggestions", auth.verifyToken, friendController.getSuggestions);
router.get("/list", auth.verifyToken, friendController.getFriendsList);
router.get("/list/:id", auth.verifyToken, friendController.getFriendsList);
router.post("/request/:id", auth.verifyToken, friendController.sendRequest);
router.put("/accept/:id", auth.verifyToken, friendController.acceptRequest);
router.put("/reject/:id", auth.verifyToken, friendController.rejectRequest);
router.delete("/cancel/:id", auth.verifyToken, friendController.cancelRequest);
router.delete("/remove/:id", auth.verifyToken, friendController.removeFriend);

module.exports = router;
