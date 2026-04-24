const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require("./routes/expenseRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// middleware
app.use(cors());            
app.use(express.json({ limit: "20mb" }));  
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// routes
app.use('/api/expense', expenseRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/auth', authRoutes);

// database connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected");
    })
    .catch((err) => {
        console.log(err);
    });

// server start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
