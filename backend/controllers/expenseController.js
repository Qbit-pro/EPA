const Expense = require("../models/Expense");

exports.createExpense = async (req, res) => {
    try{
        const { title, description = "", date, imageUrl = "" } = req.body;

        if (!title || !date) {
            return res.status(400).json({
                message : "Title and date are required"
            });
        }

        const expense = await Expense.create({
            userId: req.user.id,
            title: title.trim(),
            description: description.trim(),
            date,
            imageUrl
        });

        res.status(201).json({
            message : "Expense saved",
            expense
        });
    }
    catch(error) {
        res.status(500).json({
            error : error.message
        });
    }
};

exports.getExpenses = async (req,res) => {
    try {
        const data = await Expense.find({ userId: req.user.id }).sort({ date: -1, createdAt: -1 });
        res.json(data);
    } catch(error) {
        res.status(500).json({
            error : error.message
        });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                message: "Expense not found"
            });
        }

        res.json({
            message: "Expense deleted"
        });
    } catch(error) {
        res.status(500).json({
            error: error.message
        });
    }
};
