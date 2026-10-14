const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const fail = (res, status, code, message) =>
  res.status(status).json({
    success: false,
    error: { code, message }
  });

const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

const isSameAssignee = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return String(a) === String(b);
};

const isValidTaskDeadline = (value) => {
  if (!value) return false;
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value !== 'string') return false;

  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }

  // ISO timestamp format
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value.slice(0, 10);
  }

  return false;
};

const parseDeadline = (value) => {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }
  return new Date(value);
};

// Ensure authentication
router.use((req, res, next) => {
  if (req.user) return next();
  return authenticate(req, res, next);
});

// POST /api/projects/:projectId/tasks
// Authenticated Team Leader can create tasks only in a project they lead
router.post('/', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!validId(projectId)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    if (
      req.user.role !== 'teamLeader' ||
      String(project.teamLeaderId) !== String(req.user._id)
    ) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'Only the project team leader can create tasks.'
      );
    }

    const body = req.body || {};
    const { title, description, priority, deadline, assigneeId } = body;

    if (
      typeof title !== 'string' ||
      title.trim().length === 0 ||
      title.trim().length > 200
    ) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Task title is required and must not exceed 200 characters.'
      );
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.trim().length > 2000) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Description must be a string and not exceed 2000 characters.'
        );
      }
    }

    if (!priority || !['low', 'medium', 'high'].includes(priority)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Priority is required and must be one of: low, medium, high.'
      );
    }

    if (!isValidTaskDeadline(deadline)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Deadline is required and must be a valid date in YYYY-MM-DD or ISO format.'
      );
    }

    let resolvedAssigneeId = null;
    if (assigneeId !== undefined && assigneeId !== null && assigneeId !== '') {
      if (!validId(assigneeId)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Assignee id is invalid.'
        );
      }

      const isMember =
        Array.isArray(project.memberIds) &&
        project.memberIds.some(
          (mId) => String(mId) === String(assigneeId)
        );

      if (!isMember) {
        return fail(
          res,
          400,
          'INVALID_ASSIGNEE',
          'Assignee must be an active member of this project.'
        );
      }

      const assigneeUser = await User.findById(assigneeId);
      if (!assigneeUser || !assigneeUser.isActive) {
        return fail(
          res,
          400,
          'INVALID_ASSIGNEE',
          'Assignee must be an active user.'
        );
      }

      resolvedAssigneeId = assigneeUser._id;
    }

    const task = await Task.create({
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      priority,
      deadline: parseDeadline(deadline),
      status: 'todo',
      projectId: project._id,
      assigneeId: resolvedAssigneeId,
      createdById: req.user._id
    });

    return res.status(201).json({
      success: true,
      data: { task }
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/projects/:projectId/tasks
// Authenticated project members and the project's Team Leader may list tasks for that project
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!validId(projectId)) {
      return fail(res, 400, 'INVALID_ID', 'Project id is invalid.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    const isLeader = String(project.teamLeaderId) === String(req.user._id);
    const isMember =
      Array.isArray(project.memberIds) &&
      project.memberIds.some(
        (mId) => String(mId) === String(req.user._id)
      );

    if (!isLeader && !isMember) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'You do not have access to this project.'
      );
    }

    // Pagination validation
    let page = 1;
    if (req.query.page !== undefined) {
      if (!/^\d+$/.test(req.query.page) || parseInt(req.query.page, 10) < 1) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Page must be a positive integer.'
        );
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
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Limit must be an integer between 1 and 100.'
        );
      }
      limit = parseInt(req.query.limit, 10);
    }

    const filter = { projectId: project._id };

    if (req.query.status !== undefined) {
      if (!['todo', 'inProgress', 'completed'].includes(req.query.status)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Status filter is invalid.'
        );
      }
      filter.status = req.query.status;
    }

    if (req.query.priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(req.query.priority)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Priority filter is invalid.'
        );
      }
      filter.priority = req.query.priority;
    }

    if (req.query.deadline !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.deadline)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Deadline filter must be in YYYY-MM-DD format.'
        );
      }
      const start = new Date(`${req.query.deadline}T00:00:00.000Z`);
      const end = new Date(`${req.query.deadline}T23:59:59.999Z`);
      if (
        !Number.isFinite(start.getTime()) ||
        start.toISOString().slice(0, 10) !== req.query.deadline
      ) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Deadline filter must be a valid calendar date.'
        );
      }
      filter.deadline = { $gte: start, $lte: end };
    }

    if (req.query.overdue !== undefined) {
      if (!['true', 'false'].includes(req.query.overdue)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'overdue filter must be true or false.'
        );
      }

      const now = new Date();
      if (req.query.overdue === 'true') {
        const andConditions = [];

        if (filter.status) {
          andConditions.push({ status: filter.status });
          delete filter.status;
        }
        andConditions.push({ status: { $ne: 'completed' } });

        if (filter.deadline) {
          andConditions.push({ deadline: filter.deadline });
          delete filter.deadline;
        }
        andConditions.push({ deadline: { $lt: now } });

        filter.$and = (filter.$and || []).concat(andConditions);
      } else {
        const notOverdueCondition = {
          $or: [
            { deadline: { $gte: now } },
            { status: 'completed' }
          ]
        };
        filter.$and = (filter.$and || []).concat([notOverdueCondition]);
      }
    }

    if (req.query.assigneeId !== undefined) {
      if (
        req.query.assigneeId === 'null' ||
        req.query.assigneeId === 'unassigned'
      ) {
        filter.assigneeId = null;
      } else if (!validId(req.query.assigneeId)) {
        return fail(
          res,
          400,
          'INVALID_ID',
          'Assignee id filter is invalid.'
        );
      } else {
        filter.assigneeId = req.query.assigneeId;
      }
    }

    const { sortBy, order } = req.query;

    if (
      sortBy !== undefined &&
      !['deadline', 'priority', 'status'].includes(sortBy)
    ) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'sortBy must be one of: deadline, priority, status.'
      );
    }

    if (order !== undefined && !['asc', 'desc'].includes(order)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'order must be asc or desc.'
      );
    }

    const total = await Task.countDocuments(filter);
    let items;

    if (sortBy === 'priority') {
      const priorityDirection = order === 'desc' ? -1 : 1;
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            priorityWeight: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'low'] }, then: 1 },
                  { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                  { case: { $eq: ['$priority', 'high'] }, then: 3 }
                ],
                default: 99
              }
            }
          }
        },
        { $sort: { priorityWeight: priorityDirection, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { priorityWeight: 0 } }
      ];

      const rawDocs = await Task.aggregate(pipeline);
      items = rawDocs.map((doc) => {
        const instance = new Task(doc);
        return typeof instance.toJSON === 'function'
          ? instance.toJSON()
          : instance;
      });
    } else {
      const sortField = ['deadline', 'status'].includes(sortBy)
        ? sortBy
        : 'createdAt';
      const sortOrder = sortBy ? (order === 'desc' ? -1 : 1) : -1;
      const sortOptions = { [sortField]: sortOrder };
      if (sortField !== 'createdAt') {
        sortOptions.createdAt = -1;
      }

      const docs = await Task.find(filter)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit);

      items = docs.map((doc) =>
        typeof doc.toJSON === 'function' ? doc.toJSON() : doc
      );
    }

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

// GET /api/tasks/my
// Authenticated user may view tasks assigned to them across all projects
router.get('/my', async (req, res, next) => {
  try {
    let page = 1;
    if (req.query.page !== undefined) {
      if (!/^\d+$/.test(req.query.page) || parseInt(req.query.page, 10) < 1) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Page must be a positive integer.'
        );
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
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Limit must be an integer between 1 and 100.'
        );
      }
      limit = parseInt(req.query.limit, 10);
    }

    const filter = { assigneeId: req.user._id };

    const [docs, total] = await Promise.all([
      Task.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Task.countDocuments(filter)
    ]);

    const items = docs.map((doc) =>
      typeof doc.toJSON === 'function' ? doc.toJSON() : doc
    );

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

// GET /api/tasks/:id
// Authenticated project members and the project's Team Leader may view the task
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, 'INVALID_ID', 'Task id is invalid.');
    }

    const task = await Task.findById(id);
    if (!task) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    const isLeader = String(project.teamLeaderId) === String(req.user._id);
    const isMember =
      Array.isArray(project.memberIds) &&
      project.memberIds.some((mId) => String(mId) === String(req.user._id));

    if (!isLeader && !isMember) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'You do not have access to this task.'
      );
    }

    return res.json({
      success: true,
      data: {
        task: typeof task.toJSON === 'function' ? task.toJSON() : task
      }
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/tasks/:id
// Authenticated Team Leader of the task's parent project can update task details
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, 'INVALID_ID', 'Task id is invalid.');
    }

    const task = await Task.findById(id);
    if (!task) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    if (
      req.params.projectId &&
      String(task.projectId) !== String(req.params.projectId)
    ) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    const isLeader =
      req.user.role === 'teamLeader' &&
      String(project.teamLeaderId) === String(req.user._id);

    if (!isLeader) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'Only the project team leader can update task details.'
      );
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Request body must be an object.'
      );
    }

    const allowedFields = ['title', 'description', 'priority', 'deadline'];
    const invalidFields = Object.keys(body).filter(
      (key) => !allowedFields.includes(key)
    );

    if (invalidFields.length > 0) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Only title, description, priority, and deadline may be updated.'
      );
    }

    if (body.title !== undefined) {
      if (
        typeof body.title !== 'string' ||
        body.title.trim().length === 0 ||
        body.title.trim().length > 200
      ) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Task title is required and must not exceed 200 characters.'
        );
      }
      task.title = body.title.trim();
    }

    if (body.description !== undefined) {
      if (body.description === null) {
        task.description = '';
      } else if (
        typeof body.description !== 'string' ||
        body.description.trim().length > 2000
      ) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Description must be a string and not exceed 2000 characters.'
        );
      } else {
        task.description = body.description.trim();
      }
    }

    if (body.priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(body.priority)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Priority must be one of: low, medium, high.'
        );
      }
      task.priority = body.priority;
    }

    if (body.deadline !== undefined) {
      if (!isValidTaskDeadline(body.deadline)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Deadline must be a valid date in YYYY-MM-DD or ISO format.'
        );
      }
      task.deadline = parseDeadline(body.deadline);
    }

    await task.save();

    return res.json({
      success: true,
      data: {
        task: typeof task.toJSON === 'function' ? task.toJSON() : task
      }
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/tasks/:id
// Authenticated Team Leader of the task's parent project can delete it
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, 'INVALID_ID', 'Task id is invalid.');
    }

    const task = await Task.findById(id);
    if (!task) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    if (
      req.params.projectId &&
      String(task.projectId) !== String(req.params.projectId)
    ) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    const isLeader =
      req.user.role === 'teamLeader' &&
      String(project.teamLeaderId) === String(req.user._id);

    if (!isLeader) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'Only the project team leader can delete tasks.'
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
      await Promise.all([
        Comment.deleteMany({ taskId: task._id }, sessionOpts),
        Notification.deleteMany({ taskId: task._id }, sessionOpts)
      ]);

      await task.deleteOne(sessionOpts);

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
      data: { message: 'Task deleted.' }
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/tasks/:id/status
// Update task status (Assignee can transition forward linearly; Team Leader can set any valid status)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, 'INVALID_ID', 'Task id is invalid.');
    }

    const task = await Task.findById(id);
    if (!task) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    if (
      req.params.projectId &&
      String(task.projectId) !== String(req.params.projectId)
    ) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    const isLeader =
      req.user.role === 'teamLeader' &&
      String(project.teamLeaderId) === String(req.user._id);

    const isAssignee =
      task.assigneeId && String(task.assigneeId) === String(req.user._id);

    if (!isLeader && !isAssignee) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'You do not have permission to update this task status.'
      );
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Request body must be an object.'
      );
    }

    const allowedFields = ['status'];
    if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Only status may be updated via this endpoint.'
      );
    }

    const { status } = body;
    if (!status || !['todo', 'inProgress', 'completed'].includes(status)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Status is required and must be one of: todo, inProgress, completed.'
      );
    }

    // Assignee transition restrictions
    if (!isLeader) {
      if (status !== task.status) {
        const isValidMemberTransition =
          (task.status === 'todo' && status === 'inProgress') ||
          (task.status === 'inProgress' && status === 'completed');

        if (!isValidMemberTransition) {
          return fail(
            res,
            403,
            'FORBIDDEN',
            'Assignees may only progress tasks linearly: todo -> inProgress -> completed.'
          );
        }
      }
    }

    // Determine notification recipient
    const recipientId = isLeader
      ? (task.assigneeId && String(task.assigneeId) !== String(req.user._id)
          ? task.assigneeId
          : null)
      : project.teamLeaderId;

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
      // 1. Unchanged status: return task, recovering any missing notification from a previous attempt
      if (status === task.status) {
        if (recipientId) {
          const existingNotif = await Notification.findOne({
            taskId: task._id,
            type: 'statusChanged',
            recipientId,
            message: `Task "${task.title}" status changed to ${status}.`
          });

          if (!existingNotif) {
            if (session) {
              await Notification.create(
                [
                  {
                    recipientId,
                    type: 'statusChanged',
                    taskId: task._id,
                    message: `Task "${task.title}" status changed to ${status}.`
                  }
                ],
                sessionOpts
              );
            } else {
              await Notification.create({
                recipientId,
                type: 'statusChanged',
                taskId: task._id,
                message: `Task "${task.title}" status changed to ${status}.`
              });
            }
          }
        }

        if (session) {
          await session.commitTransaction();
        }

        return res.json({
          success: true,
          data: {
            task: typeof task.toJSON === 'function' ? task.toJSON() : task
          }
        });
      }

      // 2. Perform atomic conditional update to prevent stale-state transitions
      let updatedTask = await Task.findOneAndUpdate(
        { _id: task._id, status: task.status },
        { status },
        { new: true, ...sessionOpts }
      );

      if (!updatedTask) {
        // Concurrency detected: task status was modified between reading and writing.
        // Re-fetch current state to evaluate stale request appropriately.
        const freshTask = await Task.findById(id);
        if (!freshTask) {
          if (session) await session.abortTransaction().catch(() => {});
          return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
        }

        // Case A: The concurrent request already transitioned to the requested status
        if (freshTask.status === status) {
          if (session) await session.commitTransaction();
          return res.json({
            success: true,
            data: {
              task: typeof freshTask.toJSON === 'function' ? freshTask.toJSON() : freshTask
            }
          });
        }

        // Case B: Stale request - re-evaluate transition against freshTask.status
        if (!isLeader) {
          const isFreshTransitionValid =
            (freshTask.status === 'todo' && status === 'inProgress') ||
            (freshTask.status === 'inProgress' && status === 'completed');

          if (!isFreshTransitionValid) {
            if (session) await session.abortTransaction().catch(() => {});
            return fail(
              res,
              403,
              'FORBIDDEN',
              'Assignees may only progress tasks linearly: todo -> inProgress -> completed.'
            );
          }
        }

        // Re-attempt atomic update with the fresh status
        updatedTask = await Task.findOneAndUpdate(
          { _id: freshTask._id, status: freshTask.status },
          { status },
          { new: true, ...sessionOpts }
        );

        if (!updatedTask) {
          if (session) await session.abortTransaction().catch(() => {});
          return fail(
            res,
            409,
            'CONFLICT',
            'Task status was updated concurrently. Please refresh and try again.'
          );
        }
      }

      // 3. Dispatch notification for the actual status change
      if (recipientId) {
        if (session) {
          await Notification.create(
            [
              {
                recipientId,
                type: 'statusChanged',
                taskId: updatedTask._id,
                message: `Task "${updatedTask.title}" status changed to ${status}.`
              }
            ],
            sessionOpts
          );
        } else {
          await Notification.create({
            recipientId,
            type: 'statusChanged',
            taskId: updatedTask._id,
            message: `Task "${updatedTask.title}" status changed to ${status}.`
          });
        }
      }

      if (session) {
        await session.commitTransaction();
      }

      return res.json({
        success: true,
        data: {
          task: typeof updatedTask.toJSON === 'function' ? updatedTask.toJSON() : updatedTask
        }
      });
    } catch (saveError) {
      if (session) {
        await session.abortTransaction().catch(() => {});
      }
      throw saveError;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/tasks/:id/assign
// Assign or reassign task to an active project member (Team Leader only)
router.patch('/:id/assign', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, 'INVALID_ID', 'Task id is invalid.');
    }

    const task = await Task.findById(id);
    if (!task) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    if (
      req.params.projectId &&
      String(task.projectId) !== String(req.params.projectId)
    ) {
      return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return fail(res, 404, 'PROJECT_NOT_FOUND', 'Project was not found.');
    }

    const isLeader =
      req.user.role === 'teamLeader' &&
      String(project.teamLeaderId) === String(req.user._id);

    if (!isLeader) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'Only the project team leader can assign tasks.'
      );
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Request body must be an object.'
      );
    }

    const allowedFields = ['assigneeId'];
    if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Only assigneeId may be updated via this endpoint.'
      );
    }

    if (!('assigneeId' in body) || body.assigneeId === undefined) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'assigneeId is required.'
      );
    }

    let resolvedAssigneeId = null;
    if (body.assigneeId !== null) {
      if (!validId(body.assigneeId)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Assignee id is invalid.'
        );
      }

      const isMember =
        Array.isArray(project.memberIds) &&
        project.memberIds.some(
          (mId) => String(mId) === String(body.assigneeId)
        );

      if (!isMember) {
        return fail(
          res,
          400,
          'INVALID_ASSIGNEE',
          'Assignee must be an active member of this project.'
        );
      }

      const assigneeUser = await User.findById(body.assigneeId);
      if (!assigneeUser || !assigneeUser.isActive) {
        return fail(
          res,
          400,
          'INVALID_ASSIGNEE',
          'Assignee must be an active user.'
        );
      }

      resolvedAssigneeId = assigneeUser._id;
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
      // 1. Unchanged assignee: return task, recovering any missing notification
      if (isSameAssignee(task.assigneeId, resolvedAssigneeId)) {
        if (resolvedAssigneeId) {
          const notifMessage = `Task "${task.title}" has been assigned to you.`;
          const existingNotif = await Notification.findOne({
            taskId: task._id,
            type: 'taskAssigned',
            recipientId: resolvedAssigneeId,
            message: notifMessage
          });

          if (!existingNotif) {
            if (session) {
              await Notification.create(
                [
                  {
                    recipientId: resolvedAssigneeId,
                    type: 'taskAssigned',
                    taskId: task._id,
                    message: notifMessage
                  }
                ],
                sessionOpts
              );
            } else {
              await Notification.create({
                recipientId: resolvedAssigneeId,
                type: 'taskAssigned',
                taskId: task._id,
                message: notifMessage
              });
            }
          }
        }

        if (session) {
          await session.commitTransaction();
        }

        return res.json({
          success: true,
          data: {
            task: typeof task.toJSON === 'function' ? task.toJSON() : task
          }
        });
      }

      // 2. Perform atomic conditional update to prevent stale assignment updates
      let updatedTask = await Task.findOneAndUpdate(
        { _id: task._id, assigneeId: task.assigneeId },
        { assigneeId: resolvedAssigneeId },
        { new: true, ...sessionOpts }
      );

      if (!updatedTask) {
        // Concurrency detected: task assigneeId was modified between reading and writing.
        const freshTask = await Task.findById(id);
        if (!freshTask) {
          if (session) await session.abortTransaction().catch(() => {});
          return fail(res, 404, 'TASK_NOT_FOUND', 'Task was not found.');
        }

        // Case A: Concurrent request already assigned to the requested assigneeId
        if (isSameAssignee(freshTask.assigneeId, resolvedAssigneeId)) {
          if (session) await session.commitTransaction();
          return res.json({
            success: true,
            data: {
              task: typeof freshTask.toJSON === 'function' ? freshTask.toJSON() : freshTask
            }
          });
        }

        // Case B: Re-attempt atomic update with the fresh assigneeId
        updatedTask = await Task.findOneAndUpdate(
          { _id: freshTask._id, assigneeId: freshTask.assigneeId },
          { assigneeId: resolvedAssigneeId },
          { new: true, ...sessionOpts }
        );

        if (!updatedTask) {
          if (session) await session.abortTransaction().catch(() => {});
          return fail(
            res,
            409,
            'CONFLICT',
            'Task assignment was updated concurrently. Please refresh and try again.'
          );
        }
      }

      // 3. Dispatch notification for the actual assignment (if assigned to a user)
      if (resolvedAssigneeId) {
        const notifMessage = `Task "${updatedTask.title}" has been assigned to you.`;
        if (session) {
          await Notification.create(
            [
              {
                recipientId: resolvedAssigneeId,
                type: 'taskAssigned',
                taskId: updatedTask._id,
                message: notifMessage
              }
            ],
            sessionOpts
          );
        } else {
          await Notification.create({
            recipientId: resolvedAssigneeId,
            type: 'taskAssigned',
            taskId: updatedTask._id,
            message: notifMessage
          });
        }
      }

      if (session) {
        await session.commitTransaction();
      }

      return res.json({
        success: true,
        data: {
          task: typeof updatedTask.toJSON === 'function' ? updatedTask.toJSON() : updatedTask
        }
      });
    } catch (saveError) {
      if (session) {
        await session.abortTransaction().catch(() => {});
      }
      throw saveError;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.isValidTaskDeadline = isValidTaskDeadline;
