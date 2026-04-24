const mongoose = require("mongoose");

const PurchaseSchema = new mongoose.Schema({
    userId : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
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
    },
    paidBy : {
        type: String,
        enum: ["company", "self"],
        required: true
    }
}, { timestamps: true })

module.exports = mongoose.model("Purchase", PurchaseSchema);
