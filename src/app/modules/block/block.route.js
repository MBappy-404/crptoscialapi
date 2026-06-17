const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const blockController = require("./block.controller");
const catchAsync = require("../../../utils/catchAsync");

router.post("/", auth.verifyToken, catchAsync(blockController.block));

router.delete("/:userId", auth.verifyToken, catchAsync(blockController.unblock));

router.get("/check/:userId", auth.verifyToken, catchAsync(blockController.checkBlock));

router.get("/", auth.verifyToken, catchAsync(blockController.getBlockedUsers));

module.exports = router;
