const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const fail = (res, status, code, message) => res.status(status).json({
  success: false,
  error: { code, message }
});

router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!q) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Search query q is required.');
    }

    if (q.length > 100) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Search query must not exceed 100 characters.');
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyword = new RegExp(escaped, 'i');

    const projectFilter = req.user.role === 'admin'
      ? {}
      : {
          $or: [
            { teamLeaderId: req.user._id },
            { memberIds: req.user._id }
          ]
        };

    const visibleProjects = await Project.find(projectFilter)
      .select('_id')
      .lean();

    const projectIds = visibleProjects.map(project => project._id);

    const [projects, tasks] = await Promise.all([
      Project.find({
        _id: { $in: projectIds },
        $or: [{ name: keyword }, { description: keyword }]
      })
        .select('_id name description teamLeaderId memberIds deadline createdAt')
        .limit(50)
        .lean(),

      Task.find({
        projectId: { $in: projectIds },
        $or: [{ title: keyword }, { description: keyword }]
      })
        .select('_id title description priority deadline status projectId assigneeId createdById createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
    ]);

    return res.json({
      success: true,
      data: {
        query: q,
        projects,
        tasks,
        total: projects.length + tasks.length
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
