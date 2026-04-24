const express = require("express");
const router = express.Router();
const {createExpense, getExpenses, deleteExpense} = require("../controllers/expenseController");
const authMiddleware = require('../middleware/authMiddleware');
const { uploadSingleImage } = require("../middleware/upload");
const { uploadToDrive } = require("../controllers/purchaseController");

router.post("/upload", authMiddleware, uploadSingleImage, uploadToDrive);
router.post('/add', authMiddleware, createExpense);
router.post('/', authMiddleware, createExpense);
router.get("/all", authMiddleware, getExpenses);
router.get("/", authMiddleware, getExpenses);
router.delete("/:id", authMiddleware, deleteExpense);

module.exports = router;
