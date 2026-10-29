process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Project = require('../src/models/Project');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken } = require('../src/utils/security');

describe('Project Progress API (SRS TM-F-015 / TC-PROJ-04)', () => {
  const leaderId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();
  const nonMemberId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();
  const projectId = new mongoose.Types.ObjectId().toString();
  const otherProjectId = new mongoose.Types.ObjectId().toString();

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

  const nonMemberUser = {
    _id: new mongoose.Types.ObjectId(nonMemberId),
    name: 'Non Member',
    email: 'nonmember@example.com',
    role: 'teamMember',
    isActive: true
  };

  const adminUser = {
    _id: new mongoose.Types.ObjectId(adminId),
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true
  };

  const usersDb = {
    [leaderId]: leaderUser,
    [memberId]: memberUser,
    [nonMemberId]: nonMemberUser,
    [adminId]: adminUser
  };

  const tokenFor = (user) => `Bearer ${signToken(user)}`;

  let mockProjectDoc;

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

    mockProjectDoc = {
      _id: new mongoose.Types.ObjectId(projectId),
      name: 'Alpha Project',
      description: 'Alpha Description',
      deadline: new Date('2026-12-31T00:00:00.000Z'),
      teamLeaderId: new mongoose.Types.ObjectId(leaderId),
      memberIds: [new mongoose.Types.ObjectId(memberId)]
    };

    jest.spyOn(Project, 'findById').mockImplementation((id) => {
      const doc = String(id) === String(projectId) ? mockProjectDoc : null;
      return {
        select: jest.fn().mockResolvedValue(doc),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject)
      };
    });
  });

  describe('Authentication & Authorization', () => {
    test('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/progress`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid project id with 400', async () => {
      const res = await request(app)
        .get('/api/projects/not-a-valid-id/progress')
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_PROJECT_ID');
    });

    test('returns 404 if project does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/projects/${nonExistentId}/progress`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('rejects non-member non-leader with 403', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(nonMemberUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_ACCESS_DENIED');
    });

    test('allows project member to view project progress', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('allows admin to view project progress', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(adminUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Progress Calculation & Scenarios', () => {
    test('handles projects with zero tasks sensibly (0% progress, 0 tasks)', async () => {
      // countDocuments returns 0 for all counts
      jest.spyOn(Task, 'countDocuments').mockImplementation(async (filter) => 0);

      const res = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        projectId: mockProjectDoc._id.toString(),
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        progress: 0
      });
    });

    test('calculates correct progress percentage for partially completed tasks', async () => {
      // 4 tasks total: 2 completed, 1 inProgress, 1 todo => 50%
      jest.spyOn(Task, 'countDocuments').mockImplementation(async (filter) => {
        if (!filter.status) return 4;
        if (filter.status === 'completed') return 2;
        if (filter.status === 'inProgress') return 1;
        if (filter.status === 'todo') return 1;
        return 0;
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTasks).toBe(4);
      expect(res.body.data.completedTasks).toBe(2);
      expect(res.body.data.inProgressTasks).toBe(1);
      expect(res.body.data.pendingTasks).toBe(1);
      expect(res.body.data.progress).toBe(50);
    });

    test('calculates 100% progress when all tasks are completed', async () => {
      // 3 tasks total: 3 completed => 100%
      jest.spyOn(Task, 'countDocuments').mockImplementation(async (filter) => {
        if (!filter.status) return 3;
        if (filter.status === 'completed') return 3;
        if (filter.status === 'inProgress') return 0;
        if (filter.status === 'todo') return 0;
        return 0;
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTasks).toBe(3);
      expect(res.body.data.completedTasks).toBe(3);
      expect(res.body.data.progress).toBe(100);
    });

    test('ensures progress is calculated from tasks belonging to the selected project only', async () => {
      const countSpy = jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

      await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(leaderUser));

      // Check all calls to Task.countDocuments include projectId: project._id
      expect(countSpy).toHaveBeenCalledTimes(4);
      countSpy.mock.calls.forEach(([filter]) => {
        expect(filter.projectId).toEqual(mockProjectDoc._id);
      });
    });

    test('updates progress appropriately when task status changes', async () => {
      let completedCount = 0;

      jest.spyOn(Task, 'countDocuments').mockImplementation(async (filter) => {
        if (!filter.status) return 2;
        if (filter.status === 'completed') return completedCount;
        if (filter.status === 'inProgress') return 0;
        if (filter.status === 'todo') return 2 - completedCount;
        return 0;
      });

      // Initially: 0 completed out of 2 => 0%
      const res1 = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(leaderUser));
      expect(res1.body.data.progress).toBe(0);

      // Task status changes to completed
      completedCount = 1;

      // After status change: 1 completed out of 2 => 50%
      const res2 = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(leaderUser));
      expect(res2.body.data.progress).toBe(50);
      expect(res2.body.data.completedTasks).toBe(1);

      // Second task status changes to completed
      completedCount = 2;

      // After all completed: 2 completed out of 2 => 100%
      const res3 = await request(app)
        .get(`/api/projects/${projectId}/progress`)
        .set('Authorization', tokenFor(leaderUser));
      expect(res3.body.data.progress).toBe(100);
      expect(res3.body.data.completedTasks).toBe(2);
    });
  });
});
