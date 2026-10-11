require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/security');

(async () => {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in the environment.');
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters for bootstrap.');
  await mongoose.connect(MONGODB_URI);
  try {
    const email = ADMIN_EMAIL.trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) throw new Error('An account with ADMIN_EMAIL already exists; refusing to overwrite it.');
    const user = await User.create({ name: ADMIN_NAME.trim(), email, passwordHash: await hashPassword(ADMIN_PASSWORD), role: 'admin' });
    console.log(`Created initial admin account: ${user.email}`);
  } finally { await mongoose.disconnect(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
