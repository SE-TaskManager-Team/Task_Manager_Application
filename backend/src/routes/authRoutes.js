const express = require('express');
const User = require('../models/User');
const TokenBlocklist = require('../models/TokenBlocklist');
const { hashPassword, verifyPassword, signToken, tokenHash } = require('../utils/security');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || typeof email !== 'string' || !emailPattern.test(email.trim()) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Provide a valid name, email, and password (8–128 characters).');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return fail(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash: await hashPassword(password), role: 'teamMember' });
    return res.status(201).json({ success: true, data: { user: user.toJSON() } });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') return fail(res, 400, 'VALIDATION_ERROR', 'Email and password are required.');
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const token = signToken(user);
    return res.json({ success: true, data: { token, tokenType: 'Bearer', expiresIn: 3600, user: user.toJSON() } });
  } catch (error) { return next(error); }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await TokenBlocklist.updateOne(
      { tokenHash: tokenHash(req.authToken) },
      { $setOnInsert: { tokenHash: tokenHash(req.authToken), expiresAt: new Date(req.authPayload.exp * 1000) } },
      { upsert: true }
    );
    return res.json({ success: true, data: { message: 'Logged out successfully.' } });
  } catch (error) { return next(error); }
});

router.get('/me', authenticate, (req, res) => res.json({ success: true, data: { user: req.user.toJSON() } }));
module.exports = router;
