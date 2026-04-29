const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  googleDriveConnected: {
    type: Boolean,
    default: false
  },
  googleAccessToken : {
    type : String,
    default : ""
  },
  googleRefreshToken : {
    type : String,
    default : ""
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
