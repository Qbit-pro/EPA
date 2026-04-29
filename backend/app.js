const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const dns = require("dns");
require("dotenv").config();
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require("./routes/expenseRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const DNS_SERVERS = (process.env.DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

if (DNS_SERVERS.length > 0) {
    dns.setServers(DNS_SERVERS);
}

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});


app.use('/api/expense', expenseRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
    if (err?.type === "request.aborted" || err?.message === "request aborted") {
        console.warn(`Request aborted by client: ${req.method} ${req.originalUrl}`);
        return;
    }

    if (err?.type === "entity.too.large") {
        return res.status(413).json({ message: "Request is too large. Try a smaller receipt image." });
    }

    if (res.headersSent) {
        return next(err);
    }

    console.error(err);
    return res.status(err.status || 500).json({
        message: err.message || "Server error"
    });
});

if (!MONGO_URI) {
    console.error("MONGO_URI is missing. Add it to backend/.env before starting the server.");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected");
    })
    .catch((err) => {
        console.log(err);
    });


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
