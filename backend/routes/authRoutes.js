const express = require("express");
const router = express.Router();

const { signup, login, me, googleAuth, googleCallback } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// existing routes
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authMiddleware, me);


router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

module.exports = router;
