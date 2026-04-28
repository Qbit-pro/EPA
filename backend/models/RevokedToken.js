const mongoose = require("mongoose");

const RevokedTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: {
        expires: 0,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RevokedToken", RevokedTokenSchema);
