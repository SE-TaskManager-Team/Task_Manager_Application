process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Project = require('../src/models/Project');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken } = require('../src/utils/security');

describe('Dashboard API Tests (TM-F-019 / TC-DASH-01)', () => {
  const adminId = new mongoose.Types.ObjectId().toString();
  const leaderId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();
  const emptyUserId = new mongoose.Types.ObjectId().toString();

  const adminUser = {
    _id: new mongoose.Types.ObjectId(adminId),
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true
  };

  const leaderUser = {
    _id: new mongoose.Types.ObjectId(leaderId),
    name: 'Team Leader',
    email: 'leader@example.com',
    role: 'teamLeader',
    isActive: true
  };

  const memberUser = {
    _id: new mongoose.Types.ObjectId(memberId),
    name: 'Team Member',
    email: 'member@example.com',
    role: 'teamMember',
    isActive: true
  };

  const emptyUser = {
    _id: new mongoose.Types.ObjectId(emptyUserId),
    name: 'Empty User',
    email: 'empty@example.com',
    role: 'teamMember',
    isActive: true
  };

  const usersDb = {
    [adminId]: adminUser,
    [leaderId]: leaderUser,
    [memberId]: memberUser,
    [emptyUserId]: emptyUser
  };

  const tokenFor = (user) => `Bearer ${signToken(user)}`;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TokenBlocklist, 'exists').mockResolvedValue(false);

    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const user = usersDb[String(id)] || null;
      return {
        select: jest.fn().mockResolvedValue(user),
        then: (resolve, reject) => Promise.resolve(user).then(resolve, reject)
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  test('returns system-wide totals and user stats for admin (TM-F-019)', async () => {
    const projId = new mongoose.Types.ObjectId();
    const mockProjects = [
      {
        _id: projId,
        name: 'Enterprise Platform',
        description: 'Main project',
        teamLeaderId: leaderId,
        memberIds: [memberId],
        deadline: new Date('2026-12-31')
      }
    ];

    jest.spyOn(Project, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProjects)
      })
    });

    // Mock User counts for admin
    jest.spyOn(User, 'countDocuments').mockImplementation(async (query) => {
      if (query && query.isActive) return 5;
      return 6;
    });

    // Mock Task counts: total=10, completed=4, inProgress=3, todo=3, overdue=1
    jest.spyOn(Task, 'countDocuments').mockImplementation(async (filter) => {
      if (filter && filter.status === 'completed') return 4;
      if (filter && filter.status === 'inProgress') return 3;
      if (filter && filter.status === 'todo') return 3;
      if (filter && filter.deadline) return 1;
      return 10;
    });

    const mockTasks = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Security Audit',
        priority: 'high',
        status: 'inProgress',
        deadline: new Date('2026-11-15'),
        projectId: projId
      }
    ];

    jest.spyOn(Task, 'find').mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockTasks)
          })
        })
      })
    });

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', tokenFor(adminUser));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { data } = res.body;

    expect(data.role).toBe('admin');
    expect(data.summary.totalProjects).toBe(1);
    expect(data.summary.totalTasks).toBe(10);
    expect(data.summary.completedTasks).toBe(4);
    expect(data.summary.inProgressTasks).toBe(3);
    expect(data.summary.todoTasks).toBe(3);
    expect(data.summary.overdueTasks).toBe(1);
    expect(data.summary.completionPercentage).toBe(40);
    expect(data.summary.totalUsers).toBe(6);
    expect(data.summary.activeUsers).toBe(5);

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe('Enterprise Platform');
    expect(data.projects[0].progress).toBe(40);

    expect(data.upcomingTasks).toHaveLength(1);
    expect(data.upcomingTasks[0].title).toBe('Security Audit');
    expect(data.upcomingTasks[0].projectName).toBe('Enterprise Platform');
  });

  test('returns leader projects and relevant task summaries for Team Leader', async () => {
    const projId = new mongoose.Types.ObjectId();
    const mockProjects = [
      {
        _id: projId,
        name: 'Leader Project Alpha',
        description: 'Alpha goals',
        teamLeaderId: leaderId,
        memberIds: [memberId],
        deadline: new Date('2026-11-30')
      }
    ];

    jest.spyOn(Project, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProjects)
      })
    });

    jest.spyOn(Task, 'countDocuments').mockImplementation(async (filter) => {
      if (filter && filter.status === 'completed') return 5;
      if (filter && filter.status === 'inProgress') return 2;
      if (filter && filter.status === 'todo') return 1;
      if (filter && filter.deadline) return 0;
      return 8;
    });

    jest.spyOn(Task, 'find').mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      })
    });

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', tokenFor(leaderUser));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { data } = res.body;

    expect(data.role).toBe('teamLeader');
    expect(data.summary.totalProjects).toBe(1);
    expect(data.summary.totalTasks).toBe(8);
    expect(data.summary.completedTasks).toBe(5);
    expect(data.summary.completionPercentage).toBe(63); // 5/8 = 62.5% -> 63%
    expect(data.summary.totalUsers).toBeUndefined(); // Leaders should not see user admin stats

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe('Leader Project Alpha');
    expect(data.projects[0].totalTasks).toBe(8);
  });

  test('returns member accessible projects and assigned tasks for Team Member', async () => {
    const projId = new mongoose.Types.ObjectId();
    const mockProjects = [
      {
        _id: projId,
        name: 'Member Accessible Project',
        description: 'Project details',
        teamLeaderId: leaderId,
        memberIds: [memberId],
        deadline: new Date('2026-12-15')
      }
    ];

    jest.spyOn(Project, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProjects)
      })
    });

    // Member has 3 assigned tasks: 1 completed, 1 in progress, 1 todo, 0 overdue
    jest.spyOn(Task, 'countDocuments').mockImplementation(async (filter) => {
      if (filter && filter.assigneeId) {
        if (filter.status === 'completed') return 1;
        if (filter.status === 'inProgress') return 1;
        if (filter.status === 'todo') return 1;
        if (filter.deadline) return 0;
        return 3;
      }
      // Project level filter: total 10, completed 5
      if (filter && filter.status === 'completed') return 5;
      return 10;
    });

    const assignedUpcoming = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Fix UI Alignment',
        priority: 'medium',
        status: 'todo',
        deadline: new Date('2026-11-10'),
        projectId: projId,
        assigneeId: memberId
      }
    ];

    jest.spyOn(Task, 'find').mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(assignedUpcoming)
          })
        })
      })
    });

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', tokenFor(memberUser));

    expect(res.status).toBe(200);
    const { data } = res.body;

    expect(data.role).toBe('teamMember');
    expect(data.summary.totalProjects).toBe(1);
    expect(data.summary.totalTasks).toBe(3); // Assigned tasks
    expect(data.summary.completedTasks).toBe(1);
    expect(data.summary.completionPercentage).toBe(33);

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe('Member Accessible Project');
    expect(data.projects[0].progress).toBe(50); // Project overall: 5/10

    expect(data.upcomingTasks).toHaveLength(1);
    expect(data.upcomingTasks[0].title).toBe('Fix UI Alignment');
    expect(data.upcomingTasks[0].projectName).toBe('Member Accessible Project');
  });

  test('handles empty states gracefully when user has no projects or tasks', async () => {
    jest.spyOn(Project, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });

    jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

    jest.spyOn(Task, 'find').mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      })
    });

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', tokenFor(emptyUser));

    expect(res.status).toBe(200);
    const { data } = res.body;

    expect(data.summary.totalProjects).toBe(0);
    expect(data.summary.totalTasks).toBe(0);
    expect(data.summary.completedTasks).toBe(0);
    expect(data.summary.inProgressTasks).toBe(0);
    expect(data.summary.todoTasks).toBe(0);
    expect(data.summary.overdueTasks).toBe(0);
    expect(data.summary.completionPercentage).toBe(0);
    expect(data.projects).toEqual([]);
    expect(data.upcomingTasks).toEqual([]);
  });
});
