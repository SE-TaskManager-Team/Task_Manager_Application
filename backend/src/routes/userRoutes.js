const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const { authenticate, authorize } = require('../middleware/auth');
const { hashPassword } = require('../utils/security');
const router = express.Router();
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });
const validId = (id) => /^[a-f\d]{24}$/i.test(id);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(authenticate);

router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 80 ||
      typeof email !== 'string' ||
      !emailPattern.test(email.trim()) ||
      email.trim().length > 254 ||
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 128
    ) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Provide a valid name (2–80 characters), email, and password (8–128 characters).');
    }

    const assignedRole = role !== undefined ? role : 'teamMember';
    if (!['admin', 'teamLeader', 'teamMember'].includes(assignedRole)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Role must be admin, teamLeader, or teamMember.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return fail(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
      isActive: true
    });

    return res.status(201).json({ success: true, data: { user: user.toJSON() } });
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    return next(error);
  }
});

router.get('/', authorize('admin', 'teamLeader'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (req.user.role === 'teamLeader') {
      filter.role = 'teamMember';
      filter.isActive = true;
    } else {
      if (['admin', 'teamLeader', 'teamMember'].includes(req.query.role)) filter.role = req.query.role;
      if (req.query.isActive === 'true' || req.query.isActive === 'false') filter.isActive = req.query.isActive === 'true';
    }
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter)
    ]);
    return res.json({ success: true, data: { items, total, page, pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'User id is invalid.');
    if (req.user.role !== 'admin' && String(req.user._id) !== req.params.id) return fail(res, 403, 'FORBIDDEN', 'You may only view your own account.');
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'User was not found.');
    return res.json({ success: true, data: { user } });
  } catch (error) { return next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'User id is invalid.');
    const self = String(req.user._id) === req.params.id;
    if (!self && req.user.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'You may only update your own account.');
    const body = req.body || {};
    const allowed = self ? ['name', 'password'] : ['name', 'password', 'role', 'isActive'];
    if (Object.keys(body).some((key) => !allowed.includes(key))) return fail(res, 403, 'FORBIDDEN', 'One or more fields cannot be changed by this user.');
    const user = await User.findById(req.params.id).select('+passwordHash');
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'User was not found.');
    const wasActive = user.isActive;
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) return fail(res, 400, 'VALIDATION_ERROR', 'Name must be between 2 and 80 characters.');
      user.name = body.name.trim();
    }
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) return fail(res, 400, 'VALIDATION_ERROR', 'Password must be between 8 and 128 characters.');
      user.passwordHash = await hashPassword(body.password);
    }
    if (!self && body.role !== undefined) {
      if (!['admin', 'teamLeader', 'teamMember'].includes(body.role)) return fail(res, 400, 'VALIDATION_ERROR', 'Role is invalid.');
      if (user.role === 'admin' && body.role !== 'admin' && user.isActive) {
        const count = await User.countDocuments({ role: 'admin', isActive: true });
        if (count <= 1) return fail(res, 400, 'LAST_ACTIVE_ADMIN', 'The last active admin cannot be demoted.');
      }
      user.role = body.role;
    }
    if (!self && body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return fail(res, 400, 'VALIDATION_ERROR', 'isActive must be a boolean.');
      if (user.role === 'admin' && user.isActive && !body.isActive) {
        const count = await User.countDocuments({ role: 'admin', isActive: true });
        if (count <= 1) return fail(res, 400, 'LAST_ACTIVE_ADMIN', 'The last active admin cannot be deactivated.');
      }
      user.isActive = body.isActive;
    }
    if (wasActive && user.isActive === false) {
      await Task.updateMany(
        { assigneeId: user._id },
        { $set: { assigneeId: null } }
      );
    }
    await user.save();
    return res.json({ success: true, data: { user: user.toJSON() } });
  } catch (error) { return next(error); }
});

router.patch('/:id/deactivate', authorize('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'User id is invalid.');
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'User was not found.');
    if (user.isActive && user.role === 'admin' && await User.countDocuments({ role: 'admin', isActive: true }) <= 1) return fail(res, 400, 'LAST_ACTIVE_ADMIN', 'The last active admin cannot be deactivated.');
    user.isActive = false;
    await Task.updateMany(
      { assigneeId: user._id },
      { $set: { assigneeId: null } }
    );
    await user.save();
    return res.json({ success: true, data: { user: user.toJSON() } });
  } catch (error) { return next(error); }
});
module.exports = router;
