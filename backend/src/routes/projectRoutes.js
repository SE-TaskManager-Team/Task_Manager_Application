
const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const fail = (res, status, code, message) =>
  res.status(status).json({
    success: false,
    error: { code, message }
  });

const validId = (id) => /^[a-f\d]{24}$/i.test(id);

const isValidDeadline = (value) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

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
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Project name must be between 2 and 120 characters.'
      );
    }

    if (
      typeof description !== 'string' ||
      description.trim().length > 2000
    ) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Project description must not exceed 2000 characters.'
      );
    }

    if (!isValidDeadline(deadline)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Deadline must be a valid date in YYYY-MM-DD format.'
      );
    }

    const project = await Project.create({
      name: name.trim(),
      description: description.trim(),
      deadline: new Date(`${deadline}T00:00:00.000Z`),
      teamLeaderId: req.user._id,
      memberIds: []
    });

    return res.status(201).json({
      success: true,
      data: { project }
    });
  } catch (error) {
    return next(error);
  }
});

// List projects visible to the current user.
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

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
      data: {
        items,
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
});

// View a project only if the user belongs to it or is its leader/admin.
router.get('/:id/progress', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[a-f\d]{24}$/i.test(id)) {
      return fail(res, 400, 'INVALID_PROJECT_ID', 'Invalid project ID.');
    }

    const project = await Project.findById(id).select(
      '_id name teamLeaderId memberIds'
    );

    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    const isAdmin = req.user.role === 'admin';
    const isLeader = String(project.teamLeaderId) === String(req.user._id);
    const isMember = Array.isArray(project.memberIds) &&
      project.memberIds.some(memberId => String(memberId) === String(req.user._id));

    if (!isAdmin && !isLeader && !isMember) {
      return fail(
        res,
        403,
        'PROJECT_ACCESS_DENIED',
        'You do not have access to this project.'
      );
    }

    const [totalTasks, completedTasks, inProgressTasks, pendingTasks] =
      await Promise.all([
        Task.countDocuments({ projectId: project._id }),
        Task.countDocuments({ projectId: project._id, status: 'completed' }),
        Task.countDocuments({ projectId: project._id, status: 'inProgress' }),
        Task.countDocuments({ projectId: project._id, status: 'todo' })
      ]);

    return res.json({
      success: true,
      data: {
        projectId: project._id,
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        progress: totalTasks
          ? Math.round(completedTasks * 100 / totalTasks)
          : 0
      }
    });
  } catch (error) {
    return next(error);
  }
});
router.get('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return fail(
        res,
        404,
        'PROJECT_NOT_FOUND',
        'Project was not found.'
      );
    }

    const allowed =
      req.user.role === 'admin' ||
      String(project.teamLeaderId) === String(req.user._id) ||
      project.memberIds.some(
        id => String(id) === String(req.user._id)
      );

    if (!allowed) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'You do not have access to this project.'
      );
    }

    return res.json({
      success: true,
      data: { project }
    });
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
      return fail(
        res,
        404,
        'PROJECT_NOT_FOUND',
        'Project was not found.'
      );
    }

    if (
      req.user.role !== 'teamLeader' ||
      String(project.teamLeaderId) !== String(req.user._id)
    ) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'Only this project team leader can update it.'
      );
    }

    const body = req.body || {};
    const allowedFields = ['name', 'description', 'deadline'];

    if (
      Object.keys(body).some(key => !allowedFields.includes(key))
    ) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Only name, description, and deadline may be updated.'
      );
    }

    if (body.name !== undefined) {
      if (
        typeof body.name !== 'string' ||
        body.name.trim().length < 2 ||
        body.name.trim().length > 120
      ) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Project name must be between 2 and 120 characters.'
        );
      }

      project.name = body.name.trim();
    }

    if (body.description !== undefined) {
      if (
        typeof body.description !== 'string' ||
        body.description.trim().length > 2000
      ) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Project description must not exceed 2000 characters.'
        );
      }

      project.description = body.description.trim();
    }

    if (body.deadline !== undefined) {
      if (!isValidDeadline(body.deadline)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Deadline must be a valid date in YYYY-MM-DD format.'
        );
      }

      project.deadline = new Date(
        `${body.deadline}T00:00:00.000Z`
      );
    }

    await project.save();

    return res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    return next(error);
  }
});

// Delete a project and cascade-delete associated tasks, comments, and notifications.
router.delete('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return fail(
        res,
        404,
        'PROJECT_NOT_FOUND',
        'Project was not found.'
      );
    }

    if (
      req.user.role !== 'teamLeader' ||
      String(project.teamLeaderId) !== String(req.user._id)
    ) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'Only this project team leader can delete it.'
      );
    }

    let session = null;
    if (
      mongoose.connection &&
      mongoose.connection.readyState === 1 &&
      typeof mongoose.connection.startSession === 'function' &&
      mongoose.connection.client?.topology?.description?.type &&
      mongoose.connection.client.topology.description.type !== 'Single'
    ) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch (err) {
        session = null;
      }
    }

    const sessionOpts = session ? { session } : {};

    try {
      const tasks = await Task.find({ projectId: project._id }, '_id', sessionOpts);
      const taskIds = tasks.map((t) => t._id);

      if (taskIds.length > 0) {
        await Promise.all([
          Comment.deleteMany({ taskId: { $in: taskIds } }, sessionOpts),
          Notification.deleteMany({ taskId: { $in: taskIds } }, sessionOpts)
        ]);
      }

      await Task.deleteMany({ projectId: project._id }, sessionOpts);
      await project.deleteOne(sessionOpts);

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
    } catch (cascadeError) {
      if (session) {
        await session.abortTransaction().catch(() => {});
        session.endSession().catch(() => {});
      }
      throw cascadeError;
    }

    return res.json({
      success: true,
      data: { message: 'Project deleted.' }
    });
  } catch (error) {
    return next(error);
  }
});

// Add a team member to a project.
router.post(
  '/:id/members',
  authorize('teamLeader'),
  async (req, res, next) => {
    try {
      if (!validId(req.params.id)) {
        return fail(
          res,
          400,
          'INVALID_ID',
          'Project id is invalid.'
        );
      }

      const { userId } = req.body || {};

      if (typeof userId !== 'string' || !validId(userId)) {
        return fail(
          res,
          400,
          'INVALID_ID',
          'A valid userId is required.'
        );
      }

      const project = await Project.findById(req.params.id);

      if (!project) {
        return fail(
          res,
          404,
          'PROJECT_NOT_FOUND',
          'Project was not found.'
        );
      }

      if (String(project.teamLeaderId) !== String(req.user._id)) {
        return fail(
          res,
          403,
          'FORBIDDEN',
          'Only this project team leader can manage its members.'
        );
      }

      const user = await User.findById(userId);

      if (!user || !user.isActive) {
        return fail(
          res,
          404,
          'USER_NOT_FOUND',
          'Active user was not found.'
        );
      }

      if (user.role !== 'teamMember') {
        return fail(
          res,
          400,
          'INVALID_MEMBER_ROLE',
          'Only users with the teamMember role can be added.'
        );
      }

      if (String(user._id) === String(project.teamLeaderId)) {
        return fail(
          res,
          400,
          'INVALID_MEMBER',
          'The team leader cannot be added as a member.'
        );
      }

      if (
        project.memberIds.some(
          id => String(id) === String(user._id)
        )
      ) {
        return fail(
          res,
          409,
          'ALREADY_MEMBER',
          'This user is already a project member.'
        );
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
  }
);

// Remove a team member from a project.
router.delete(
  '/:id/members/:userId',
  authorize('teamLeader'),
  async (req, res, next) => {
    try {
      const { id, userId } = req.params;

      if (!validId(id) || !validId(userId)) {
        return fail(
          res,
          400,
          'INVALID_ID',
          'Project id or user id is invalid.'
        );
      }

      const project = await Project.findById(id);

      if (!project) {
        return fail(
          res,
          404,
          'PROJECT_NOT_FOUND',
          'Project was not found.'
        );
      }

      if (String(project.teamLeaderId) !== String(req.user._id)) {
        return fail(
          res,
          403,
          'FORBIDDEN',
          'Only this project team leader can manage its members.'
        );
      }

      const memberIndex = project.memberIds.findIndex(
        memberId => String(memberId) === String(userId)
      );

      if (memberIndex === -1) {
        return fail(
          res,
          404,
          'MEMBER_NOT_FOUND',
          'This user is not a member of the project.'
        );
      }

      await Task.updateMany(
        { projectId: project._id, assigneeId: userId },
        { $set: { assigneeId: null } }
      );

      project.memberIds.splice(memberIndex, 1);
      await project.save();

      return res.json({
        success: true,
        data: { project }
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
module.exports.isValidDeadline = isValidDeadline;

