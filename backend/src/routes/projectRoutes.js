
const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');


const User = require('../models/User');


const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const fail = (res, status, code, message) =>
  res.status(status).json({
    success: false,
    error: { code, message }
  });

const validId = (id) => /^[a-f\d]{24}$/i.test(id);

router.use(authenticate);

// Create a project. The creator becomes its team leader.
router.post('/', authorize('teamLeader'), async (req, res, next) => {
  try {
    const { name, description = '', deadline } = req.body || {};

    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 120
    ) {
      return fail(res, 400, 'VALIDATION_ERROR',
        'Project name must be between 2 and 120 characters.');
    }

    if (typeof description !== 'string' || description.length > 2000) {
      return fail(res, 400, 'VALIDATION_ERROR',
        'Project description must not exceed 2000 characters.');
    }

    if (!deadline || !Number.isFinite(Date.parse(deadline))) {
      return fail(res, 400, 'VALIDATION_ERROR',
        'A valid project deadline is required.');
    }

    const project = await Project.create({
      name: name.trim(),
      description: description.trim(),
      deadline: new Date(deadline),
      teamLeaderId: req.user._id,
      memberIds: []
    });

    return res.status(201).json({ success: true, data: { project } });
  } catch (error) {
    return next(error);
  }
});

// List projects visible to the current user.
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100,
      Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filter = req.user.role === 'admin'
      ? {}
      : {
          $or: [
            { teamLeaderId: req.user._id },
            { memberIds: req.user._id }
          ]
        };

    const [items, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: { items, total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    return next(error);
  }
});

// View a project only if the user belongs to it or is its leader/admin.
router.get('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    const allowed =
      req.user.role === 'admin' ||
      String(project.teamLeaderId) === String(req.user._id) ||
      project.memberIds.some(id => String(id) === String(req.user._id));

    if (!allowed) {
      return fail(res, 403, 'FORBIDDEN',
        'You do not have access to this project.');
    }

    return res.json({ success: true, data: { project } });
  } catch (error) {
    return next(error);
  }
});

// Only the project's team leader can update it.
router.put('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    if (
      req.user.role !== 'teamLeader' ||
      String(project.teamLeaderId) !== String(req.user._id)
    ) {
      return fail(res, 403, 'FORBIDDEN',
        'Only this project team leader can update it.');
    }

    const body = req.body || {};
    const allowedFields = ['name', 'description', 'deadline'];

    if (Object.keys(body).some(key => !allowedFields.includes(key))) {
      return fail(res, 400, 'VALIDATION_ERROR',
        'Only name, description, and deadline may be updated.');
    }

    if (body.name !== undefined) {
      if (
        typeof body.name !== 'string' ||
        body.name.trim().length < 2 ||
        body.name.trim().length > 120
      ) {
        return fail(res, 400, 'VALIDATION_ERROR',
          'Project name must be between 2 and 120 characters.');
      }
      project.name = body.name.trim();
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' ||
          body.description.length > 2000) {
        return fail(res, 400, 'VALIDATION_ERROR',
          'Project description must not exceed 2000 characters.');
      }
      project.description = body.description.trim();
    }

    if (body.deadline !== undefined) {
      if (!Number.isFinite(Date.parse(body.deadline))) {
        return fail(res, 400, 'VALIDATION_ERROR',
          'Project deadline must be a valid date.');
      }
      project.deadline = new Date(body.deadline);
    }

    await project.save();
    return res.json({ success: true, data: { project } });
  } catch (error) {
    return next(error);
  }
});

// Deletion cleanup will be completed when task/comment/notification
// models are integrated.
router.delete('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    if (
      req.user.role !== 'teamLeader' ||
      String(project.teamLeaderId) !== String(req.user._id)
    ) {
      return fail(res, 403, 'FORBIDDEN',
        'Only this project team leader can delete it.');
    }

    await project.deleteOne();
    return res.json({ success: true, data: { message: 'Project deleted.' } });
  } catch (error) {
    return next(error);
  }
});



/**
 * Add a team member to a project.
 * Only the project's team leader can manage its members.
 */
router.post('/:id/members', authorize('teamLeader'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const { userId } = req.body || {};

    if (typeof userId !== 'string' || !validId(userId)) {
      return fail(res, 400, 'INVALID_ID', 'A valid userId is required.');
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    if (String(project.teamLeaderId) !== String(req.user._id)) {
      return fail(res, 403, 'FORBIDDEN',
        'Only this project team leader can manage its members.');
    }

    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      return fail(res, 404, 'USER_NOT_FOUND',
        'Active user was not found.');
    }

    if (user.role !== 'teamMember') {
      return fail(res, 400, 'INVALID_MEMBER_ROLE',
        'Only users with the teamMember role can be added.');
    }

    if (String(user._id) === String(project.teamLeaderId)) {
      return fail(res, 400, 'INVALID_MEMBER',
        'The team leader cannot be added as a member.');
    }

    if (project.memberIds.some(id => String(id) === String(user._id))) {
      return fail(res, 409, 'ALREADY_MEMBER',
        'This user is already a project member.');
    }

    project.memberIds.push(user._id);
    await project.save();

    return res.status(200).json({
      success: true,
      data: { project }
    });
  } catch (error) {
    return next(error);
  }
});


router.delete('/:id/members/:userId', authorize('teamLeader'), async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    if (!validId(id) || !validId(userId)) {
      return fail(res, 400, 'INVALID_ID', 'Project id or user id is invalid.');
    }

    const project = await Project.findById(id);

    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    if (String(project.teamLeaderId) !== String(req.user._id)) {
      return fail(res, 403, 'FORBIDDEN',
        'Only this project team leader can manage its members.');
    }

    const memberIndex = project.memberIds.findIndex(
      memberId => String(memberId) === String(userId)
    );

    if (memberIndex === -1) {
      return fail(res, 404, 'MEMBER_NOT_FOUND',
        'This user is not a member of the project.');
    }

    project.memberIds.splice(memberIndex, 1);
    await project.save();

    return res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    return next(error);
  }
});


module.exports = router;
