const express = require("express");
const router = express.Router();
const {createPurchase, getPurchases, deletePurchase} = require("../controllers/purchaseController");
const authMiddleware = require('../middleware/authMiddleware');
const { uploadSingleImage } = require("../middleware/upload");
const { uploadToDrive } = require("../controllers/purchaseController");

router.post("/upload", authMiddleware, uploadSingleImage, uploadToDrive);
router.post('/add', authMiddleware, createPurchase);
router.post('/', authMiddleware, createPurchase);
router.get("/all", authMiddleware, getPurchases);
router.get("/", authMiddleware, getPurchases);
router.delete("/:id", authMiddleware, deletePurchase);

module.exports = router;
