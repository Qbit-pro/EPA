const express = require("express");
const router = express.Router();

const { signup, login, logout, me, googleAuth, googleCallback } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");


router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, me);


router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

module.exports = router;
