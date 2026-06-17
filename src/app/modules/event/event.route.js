const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const eventController = require("./event.controller");

router.post("/", auth.verifyToken, eventController.createEvent);
router.get("/", auth.verifyToken, eventController.getAllEvents);
router.get("/my", auth.verifyToken, eventController.getUserEvents);
router.post("/:id/attend", auth.verifyToken, eventController.attendEvent);
router.post("/:id/interested", auth.verifyToken, eventController.interestedInEvent);
router.post("/:id/cancel", auth.verifyToken, eventController.cancelAttendance);
router.delete("/:id", auth.verifyToken, eventController.deleteEvent);
router.get("/:id", auth.verifyToken, eventController.getEvent);

module.exports = router;
