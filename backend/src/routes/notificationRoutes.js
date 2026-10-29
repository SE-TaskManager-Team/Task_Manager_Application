const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });

const validId = (id) => /^[a-f\d]{24}$/i.test(id);

router.use(authenticate);

// GET /api/notifications
// Return paginated list of notifications for the authenticated user only
router.get('/', async (req, res, next) => {
  try {
    let page = 1;
    if (req.query.page !== undefined) {
      if (!/^\d+$/.test(req.query.page) || parseInt(req.query.page, 10) < 1) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Page must be a positive integer.');
      }
      page = parseInt(req.query.page, 10);
    }

    let limit = 20;
    if (req.query.limit !== undefined) {
      if (
        !/^\d+$/.test(req.query.limit) ||
        parseInt(req.query.limit, 10) < 1 ||
        parseInt(req.query.limit, 10) > 100
      ) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Limit must be an integer between 1 and 100.');
      }
      limit = parseInt(req.query.limit, 10);
    }

    const filter = { recipientId: req.user._id };

    if (req.query.isRead === 'true') {
      filter.isRead = true;
    } else if (req.query.isRead === 'false') {
      filter.isRead = false;
    }

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: req.user._id, isRead: false })
    ]);

    return res.json({
      success: true,
      data: {
        items,
        total,
        unreadCount,
        page,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/notifications/read-all
// Mark all notifications for the authenticated user as read
router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({
      success: true,
      data: { message: 'All notifications marked as read.' }
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/notifications/:id/read
// Mark a specific notification as read (Self only)
router.patch('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, 'INVALID_ID', 'Notification id is invalid.');
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return fail(res, 404, 'NOT_FOUND', 'Notification was not found.');
    }

    if (String(notification.recipientId) !== String(req.user._id)) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'You do not have permission to access this notification.'
      );
    }

    notification.isRead = true;
    await notification.save();

    return res.json({
      success: true,
      data: {
        notification: typeof notification.toJSON === 'function'
          ? notification.toJSON()
          : notification
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
