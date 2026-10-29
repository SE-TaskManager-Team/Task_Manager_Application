const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const now = new Date();

    const projectFilter = role === 'admin'
      ? {}
      : { $or: [{ teamLeaderId: userId }, { memberIds: userId }] };

    const projects = await Project.find(projectFilter)
      .select('_id name description teamLeaderId memberIds deadline')
      .lean();

    const projectIds = projects.map(project => project._id);

    const taskFilter = role === 'admin'
      ? {}
      : role === 'teamLeader'
        ? { projectId: { $in: projectIds } }
        : { assigneeId: userId };

    const [
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks
    ] = await Promise.all([
      Task.countDocuments(taskFilter),
      Task.countDocuments({ ...taskFilter, status: 'completed' }),
      Task.countDocuments({ ...taskFilter, status: 'inProgress' }),
      Task.countDocuments({ ...taskFilter, status: 'todo' }),
      Task.countDocuments({
        ...taskFilter,
        deadline: { $lt: now },
        status: { $ne: 'completed' }
      })
    ]);

    const summary = {
      totalProjects: projects.length,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks,
      completionPercentage: totalTasks
        ? Math.round((completedTasks * 100) / totalTasks)
        : 0
    };

    const data = { role, summary };

    if (role === 'admin') {
      const [totalUsers, activeUsers] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true })
      ]);
      summary.totalUsers = totalUsers;
      summary.activeUsers = activeUsers;
    }

    data.projects = await Promise.all(
      projects.map(async project => {
        const filter = { projectId: project._id };
        const [total, completed, inProgress, todo, overdue] = await Promise.all([
          Task.countDocuments(filter),
          Task.countDocuments({ ...filter, status: 'completed' }),
          Task.countDocuments({ ...filter, status: 'inProgress' }),
          Task.countDocuments({ ...filter, status: 'todo' }),
          Task.countDocuments({
            ...filter,
            deadline: { $lt: now },
            status: { $ne: 'completed' }
          })
        ]);

        return {
          projectId: project._id,
          name: project.name,
          description: project.description || '',
          deadline: project.deadline || null,
          totalTasks: total,
          completedTasks: completed,
          inProgressTasks: inProgress,
          todoTasks: todo,
          overdueTasks: overdue,
          progress: total ? Math.round((completed * 100) / total) : 0
        };
      })
    );

    const upcomingTasks = await Task.find({
      ...taskFilter,
      status: { $ne: 'completed' }
    })
      .sort({ deadline: 1 })
      .limit(6)
      .select('_id title priority deadline status projectId assigneeId')
      .lean();

    const projectNameMap = new Map(projects.map(p => [String(p._id), p.name]));
    data.upcomingTasks = upcomingTasks.map(task => ({
      ...task,
      projectName: projectNameMap.get(String(task.projectId)) || 'Project'
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
