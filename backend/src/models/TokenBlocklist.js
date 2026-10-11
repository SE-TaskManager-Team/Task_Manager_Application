const mongoose = require('mongoose');
const tokenBlocklistSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true, versionKey: false });
module.exports = mongoose.models.TokenBlocklist || mongoose.model('TokenBlocklist', tokenBlocklistSchema);
