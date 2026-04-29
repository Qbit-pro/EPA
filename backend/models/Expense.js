const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema({
    userId : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    username : {
        type: String,
        default: "",
        trim: true
    },
    title : {
        type: String,
        required: true,
        trim: true
    },
    description : {
        type: String,
        default: "",
        trim: true
    },
    date : {
        type: Date,
        required: true
    },
    imageUrl : {
        type: String,
        default: ""
    }
}, { timestamps: true })

module.exports = mongoose.model("Expense", ExpenseSchema);
