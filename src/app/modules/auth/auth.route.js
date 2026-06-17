const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const authController = require("./auth.controller");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/session", authController.session);
router.post("/refresh-tokens", authController.refreshTokens);
router.get("/token", auth.verifyToken, authController.getToken);
router.post("/change-password", auth.verifyToken, authController.changePassword);

module.exports = router;
