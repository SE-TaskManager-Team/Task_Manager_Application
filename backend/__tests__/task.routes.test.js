process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Task = require('../src/models/Task');
const Project = require('../src/models/Project');
const User = require('../src/models/User');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken } = require('../src/utils/security');

describe('Task Management Routes (/api/projects/:projectId/tasks)', () => {
  const leaderId = new mongoose.Types.ObjectId().toString();
  const otherLeaderId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();
  const nonMemberId = new mongoose.Types.ObjectId().toString();
  const inactiveMemberId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();
  const projectId = new mongoose.Types.ObjectId().toString();

  const leaderUser = {
    _id: new mongoose.Types.ObjectId(leaderId),
    name: 'Team Leader',
    email: 'leader@example.com',
    role: 'teamLeader',
    isActive: true
  };

  const otherLeaderUser = {
    _id: new mongoose.Types.ObjectId(otherLeaderId),
    name: 'Other Leader',
    email: 'otherleader@example.com',
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

  const inactiveMemberUser = {
    _id: new mongoose.Types.ObjectId(inactiveMemberId),
    name: 'Inactive Member',
    email: 'inactive@example.com',
    role: 'teamMember',
    isActive: false
  };

  const adminUser = {
    _id: new mongoose.Types.ObjectId(adminId),
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true
  };

  const mockProject = {
    _id: new mongoose.Types.ObjectId(projectId),
    name: 'Test Project',
    description: 'A test project description',
    deadline: new Date('2026-12-31T00:00:00.000Z'),
    teamLeaderId: new mongoose.Types.ObjectId(leaderId),
    memberIds: [
      new mongoose.Types.ObjectId(memberId),
      new mongoose.Types.ObjectId(inactiveMemberId)
    ]
  };

  const usersDb = {
    [leaderId]: leaderUser,
    [otherLeaderId]: otherLeaderUser,
    [memberId]: memberUser,
    [nonMemberId]: nonMemberUser,
    [inactiveMemberId]: inactiveMemberUser,
    [adminId]: adminUser
  };

  const tokenFor = (user) => `Bearer ${signToken(user)}`;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default TokenBlocklist mock: token not blocklisted
    jest.spyOn(TokenBlocklist, 'exists').mockResolvedValue(false);

    // Default User.findById mock
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const user = usersDb[String(id)] || null;
      return {
        select: jest.fn().mockResolvedValue(user),
        then: (resolve, reject) => Promise.resolve(user).then(resolve, reject)
      };
    });

    // Default Project.findById mock
    jest.spyOn(Project, 'findById').mockImplementation((id) => {
      if (String(id) === projectId) {
        return Promise.resolve(mockProject);
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Unauthenticated and Project Existence checks', () => {
    test('POST /api/projects/:projectId/tasks rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: 'Task 1', priority: 'medium', deadline: '2026-12-25' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('GET /api/projects/:projectId/tasks rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/tasks`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/projects/:projectId/tasks rejects invalid project ID with 400', async () => {
      const res = await request(app)
        .post('/api/projects/invalid-id/tasks')
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'Task 1', priority: 'medium', deadline: '2026-12-25' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('GET /api/projects/:projectId/tasks rejects invalid project ID with 400', async () => {
      const res = await request(app)
        .get('/api/projects/invalid-id/tasks')
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('POST /api/projects/:projectId/tasks returns 404 when project is not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/projects/${nonExistentId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'Task 1', priority: 'medium', deadline: '2026-12-25' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('GET /api/projects/:projectId/tasks returns 404 when project is not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/projects/${nonExistentId}/tasks`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('POST /api/projects/:projectId/tasks - Authorization', () => {
    test('teamMember cannot create task (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(memberUser))
        .send({ title: 'Task 1', priority: 'medium', deadline: '2026-12-25' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('teamLeader who does not lead this project cannot create task (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(otherLeaderUser))
        .send({ title: 'Task 1', priority: 'medium', deadline: '2026-12-25' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('admin who does not lead this project cannot create task (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(adminUser))
        .send({ title: 'Task 1', priority: 'medium', deadline: '2026-12-25' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/projects/:projectId/tasks - Validation and Creation', () => {
    test('rejects missing or empty title with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: '   ', priority: 'medium', deadline: '2026-12-25' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects missing priority with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'Task 1', deadline: '2026-12-25' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid priority value with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'Task 1', priority: 'urgent', deadline: '2026-12-25' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid or impossible deadline with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'Task 1', priority: 'medium', deadline: '2026-02-30' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects non-date deadline string with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'Task 1', priority: 'medium', deadline: 'tomorrow' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects assignee not in project memberIds with 400 INVALID_ASSIGNEE', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({
          title: 'Task 1',
          priority: 'medium',
          deadline: '2026-12-25',
          assigneeId: nonMemberId
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });

    test('rejects deactivated member assignee with 400 INVALID_ASSIGNEE', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({
          title: 'Task 1',
          priority: 'medium',
          deadline: '2026-12-25',
          assigneeId: inactiveMemberId
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });

    test('successfully creates an unassigned task with default todo status', async () => {
      let createdData = null;
      jest.spyOn(Task, 'create').mockImplementation((data) => {
        createdData = data;
        const taskInstance = new Task({
          _id: new mongoose.Types.ObjectId(),
          ...data
        });
        return Promise.resolve(taskInstance);
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({
          title: 'Valid Task',
          description: 'A valid task description',
          priority: 'high',
          deadline: '2026-12-25',
          // Client attempts to tamper with protected fields
          status: 'completed',
          projectId: new mongoose.Types.ObjectId().toString(),
          createdById: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task).toBeDefined();
      expect(res.body.data.task.title).toBe('Valid Task');
      expect(res.body.data.task.status).toBe('todo');
      expect(res.body.data.task.priority).toBe('high');
      expect(res.body.data.task.assigneeId).toBeNull();

      // Verify server forced correct IDs and default status and end-of-day date-only deadline
      expect(createdData.projectId.toString()).toBe(projectId);
      expect(createdData.createdById.toString()).toBe(leaderId);
      expect(createdData.status).toBe('todo');
      expect(createdData.deadline).toEqual(new Date('2026-12-25T23:59:59.999Z'));
    });

    test('successfully creates a task assigned to an active project member and preserves exact ISO timestamp', async () => {
      let assignedData = null;
      jest.spyOn(Task, 'create').mockImplementation((data) => {
        assignedData = data;
        const taskInstance = new Task({
          _id: new mongoose.Types.ObjectId(),
          ...data
        });
        return Promise.resolve(taskInstance);
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser))
        .send({
          title: 'Assigned Task',
          priority: 'low',
          deadline: '2026-12-25T12:00:00.000Z',
          assigneeId: memberId
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.assigneeId.toString()).toBe(memberId);
      expect(res.body.data.task.status).toBe('todo');
      expect(assignedData.deadline).toEqual(new Date('2026-12-25T12:00:00.000Z'));
    });
  });

  describe('GET /api/projects/:projectId/tasks - Access Control', () => {
    test('non-member is rejected with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(nonMemberUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('admin without project membership is rejected with 403 FORBIDDEN (no blanket admin access)', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(adminUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('project team leader is allowed to list tasks (200)', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    test('project member is allowed to list tasks (200)', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/projects/:projectId/tasks - Pagination Validation', () => {
    test.each([
      ['0', 'Page must be a positive integer.'],
      ['-1', 'Page must be a positive integer.'],
      ['abc', 'Page must be a positive integer.'],
      ['1.5', 'Page must be a positive integer.']
    ])('rejects invalid page=%s with 400 VALIDATION_ERROR', async (invalidPage, expectedMessage) => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=${invalidPage}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe(expectedMessage);
    });

    test.each([
      ['0', 'Limit must be an integer between 1 and 100.'],
      ['-5', 'Limit must be an integer between 1 and 100.'],
      ['101', 'Limit must be an integer between 1 and 100.'],
      ['abc', 'Limit must be an integer between 1 and 100.'],
      ['20.5', 'Limit must be an integer between 1 and 100.']
    ])('rejects invalid limit=%s with 400 VALIDATION_ERROR', async (invalidLimit, expectedMessage) => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?limit=${invalidLimit}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe(expectedMessage);
    });

    test('supports valid pagination parameters (page=2, limit=15)', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(45);

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=2&limit=15`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.data.page).toBe(2);
      expect(res.body.data.total).toBe(45);
      expect(res.body.data.pages).toBe(3);
      expect(mockFind.skip).toHaveBeenCalledWith(15);
      expect(mockFind.limit).toHaveBeenCalledWith(15);
    });
  });

  describe('GET /api/projects/:projectId/tasks - Overdue & Filter Correctness', () => {
    test('filters overdue tasks (?overdue=true) alone', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?overdue=true`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.projectId.toString()).toBe(projectId);
      expect(capturedFilter.$and).toBeDefined();

      const hasStatusNotCompleted = capturedFilter.$and.some(
        (c) => c.status && c.status.$ne === 'completed'
      );
      const hasDeadlinePast = capturedFilter.$and.some(
        (c) => c.deadline && c.deadline.$lt instanceof Date
      );
      expect(hasStatusNotCompleted).toBe(true);
      expect(hasDeadlinePast).toBe(true);
    });

    test('combination overdue=true and status=completed preserves status=completed without silent override', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?overdue=true&status=completed`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.$and).toBeDefined();

      // Confirms both the caller's requested status and the overdue guard are present in $and
      const hasCompleted = capturedFilter.$and.some((c) => c.status === 'completed');
      const hasNotCompleted = capturedFilter.$and.some(
        (c) => c.status && c.status.$ne === 'completed'
      );
      expect(hasCompleted).toBe(true);
      expect(hasNotCompleted).toBe(true);
    });

    test('combination overdue=true and status=todo preserves status=todo and enforces not-completed and deadline past', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?overdue=true&status=todo`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.$and).toBeDefined();

      const hasTodo = capturedFilter.$and.some((c) => c.status === 'todo');
      const hasNotCompleted = capturedFilter.$and.some(
        (c) => c.status && c.status.$ne === 'completed'
      );
      const hasDeadlinePast = capturedFilter.$and.some(
        (c) => c.deadline && c.deadline.$lt instanceof Date
      );
      expect(hasTodo).toBe(true);
      expect(hasNotCompleted).toBe(true);
      expect(hasDeadlinePast).toBe(true);
    });

    test('combination overdue=true and deadline preserves caller deadline range and requires deadline in the past', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?overdue=true&deadline=2026-10-10`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.$and).toBeDefined();

      const hasDateRange = capturedFilter.$and.some(
        (c) => c.deadline && c.deadline.$gte && c.deadline.$lte
      );
      const hasDeadlinePast = capturedFilter.$and.some(
        (c) => c.deadline && c.deadline.$lt instanceof Date
      );
      expect(hasDateRange).toBe(true);
      expect(hasDeadlinePast).toBe(true);
    });

    test('overdue=false produces valid not-overdue condition (deadline >= now OR status == completed)', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?overdue=false`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.$and).toBeDefined();

      const orCondition = capturedFilter.$and.find((c) => Array.isArray(c.$or));
      expect(orCondition).toBeDefined();
      expect(orCondition.$or).toEqual([
        { deadline: { $gte: expect.any(Date) } },
        { status: 'completed' }
      ]);
    });

    test('combination overdue=false and status=completed preserves status=completed', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?overdue=false&status=completed`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.status).toBe('completed');
      expect(capturedFilter.$and).toBeDefined();
      expect(capturedFilter.$and.some((c) => Array.isArray(c.$or))).toBe(true);
    });

    test('rejects invalid overdue values with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?overdue=yes`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('overdue filter must be true or false.');
    });
  });

  describe('GET /api/projects/:projectId/tasks - General Filters & Sorting', () => {
    test('filters tasks by status, priority, and assigneeId', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(1);
      });

      const mockTask = new Task({
        _id: new mongoose.Types.ObjectId(),
        title: 'Filtered Task',
        priority: 'high',
        status: 'inProgress',
        deadline: new Date('2026-12-25'),
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockTask])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(
          `/api/projects/${projectId}/tasks?status=inProgress&priority=high&assigneeId=${memberId}`
        )
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedFilter.projectId.toString()).toBe(projectId);
      expect(capturedFilter.status).toBe('inProgress');
      expect(capturedFilter.priority).toBe('high');
      expect(capturedFilter.assigneeId).toBe(memberId);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].title).toBe('Filtered Task');
    });

    test('filters tasks by deadline date range', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?deadline=2026-12-25`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.deadline).toBeDefined();
      expect(capturedFilter.deadline.$gte).toEqual(
        new Date('2026-12-25T00:00:00.000Z')
      );
      expect(capturedFilter.deadline.$lte).toEqual(
        new Date('2026-12-25T23:59:59.999Z')
      );
    });

    test('sorts by deadline asc and desc', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      await request(app)
        .get(`/api/projects/${projectId}/tasks?sortBy=deadline&order=asc`)
        .set('Authorization', tokenFor(leaderUser));

      expect(mockFind.sort).toHaveBeenCalledWith({
        deadline: 1,
        createdAt: -1
      });

      await request(app)
        .get(`/api/projects/${projectId}/tasks?sortBy=deadline&order=desc`)
        .set('Authorization', tokenFor(leaderUser));

      expect(mockFind.sort).toHaveBeenCalledWith({
        deadline: -1,
        createdAt: -1
      });
    });

    test('sorts by status asc and desc', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      await request(app)
        .get(`/api/projects/${projectId}/tasks?sortBy=status&order=asc`)
        .set('Authorization', tokenFor(leaderUser));

      expect(mockFind.sort).toHaveBeenCalledWith({
        status: 1,
        createdAt: -1
      });

      await request(app)
        .get(`/api/projects/${projectId}/tasks?sortBy=status&order=desc`)
        .set('Authorization', tokenFor(leaderUser));

      expect(mockFind.sort).toHaveBeenCalledWith({
        status: -1,
        createdAt: -1
      });
    });

    test('sorts by priority respecting contract ordering (low, medium, high)', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(3);

      const lowTaskDoc = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Low task',
        priority: 'low',
        deadline: new Date('2026-12-25'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      };
      const medTaskDoc = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Med task',
        priority: 'medium',
        deadline: new Date('2026-12-25'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      };
      const highTaskDoc = {
        _id: new mongoose.Types.ObjectId(),
        title: 'High task',
        priority: 'high',
        deadline: new Date('2026-12-25'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      };

      let capturedPipeline = null;
      jest.spyOn(Task, 'aggregate').mockImplementation((pipeline) => {
        capturedPipeline = pipeline;
        return Promise.resolve([lowTaskDoc, medTaskDoc, highTaskDoc]);
      });

      const resAsc = await request(app)
        .get(`/api/projects/${projectId}/tasks?sortBy=priority&order=asc`)
        .set('Authorization', tokenFor(leaderUser));

      expect(resAsc.status).toBe(200);
      expect(resAsc.body.data.items[0].priority).toBe('low');
      expect(resAsc.body.data.items[1].priority).toBe('medium');
      expect(resAsc.body.data.items[2].priority).toBe('high');

      const sortStage = capturedPipeline.find((stage) => stage.$sort);
      expect(sortStage.$sort.priorityWeight).toBe(1);

      jest.spyOn(Task, 'aggregate').mockImplementation((pipeline) => {
        capturedPipeline = pipeline;
        return Promise.resolve([highTaskDoc, medTaskDoc, lowTaskDoc]);
      });

      const resDesc = await request(app)
        .get(`/api/projects/${projectId}/tasks?sortBy=priority&order=desc`)
        .set('Authorization', tokenFor(leaderUser));

      expect(resDesc.status).toBe(200);
      expect(resDesc.body.data.items[0].priority).toBe('high');
      expect(resDesc.body.data.items[1].priority).toBe('medium');
      expect(resDesc.body.data.items[2].priority).toBe('low');

      const descSortStage = capturedPipeline.find((stage) => stage.$sort);
      expect(descSortStage.$sort.priorityWeight).toBe(-1);
    });

    test('rejects invalid query parameters with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?status=unknown`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const resSort = await request(app)
        .get(`/api/projects/${projectId}/tasks?sortBy=invalid`)
        .set('Authorization', tokenFor(leaderUser));

      expect(resSort.status).toBe(400);
      expect(resSort.body.success).toBe(false);

      const resOrder = await request(app)
        .get(`/api/projects/${projectId}/tasks?order=random`)
        .set('Authorization', tokenFor(leaderUser));

      expect(resOrder.status).toBe(400);
      expect(resOrder.body.success).toBe(false);
    });
  });

  describe('GET /api/tasks/:id - View Task Detail', () => {
    const taskId = new mongoose.Types.ObjectId().toString();
    const mockTaskInstance = new Task({
      _id: new mongoose.Types.ObjectId(taskId),
      title: 'Detail Task',
      description: 'Detail Task Description',
      priority: 'high',
      deadline: new Date('2026-12-25T23:59:59.999Z'),
      status: 'inProgress',
      projectId: new mongoose.Types.ObjectId(projectId),
      assigneeId: new mongoose.Types.ObjectId(memberId),
      createdById: new mongoose.Types.ObjectId(leaderId)
    });

    beforeEach(() => {
      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === taskId) {
          return Promise.resolve(mockTaskInstance);
        }
        return Promise.resolve(null);
      });
    });

    test('rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED', async () => {
      const res = await request(app).get(`/api/tasks/${taskId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid task ID format with 400 INVALID_ID', async () => {
      const res = await request(app)
        .get('/api/tasks/not-a-valid-task-id')
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
      expect(res.body.error.message).toBe('Task id is invalid.');
    });

    test('returns 404 TASK_NOT_FOUND when task does not exist', async () => {
      const nonExistentTaskId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/tasks/${nonExistentTaskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
      expect(res.body.error.message).toBe('Task was not found.');
    });

    test('returns 404 PROJECT_NOT_FOUND when task parent project does not exist', async () => {
      const orphanTaskId = new mongoose.Types.ObjectId().toString();
      const nonExistentProjectId = new mongoose.Types.ObjectId().toString();
      const orphanTask = new Task({
        _id: new mongoose.Types.ObjectId(orphanTaskId),
        title: 'Orphan Task',
        priority: 'medium',
        deadline: new Date('2026-12-25'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(nonExistentProjectId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === orphanTaskId) return Promise.resolve(orphanTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .get(`/api/tasks/${orphanTaskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('rejects non-member user with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(nonMemberUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('You do not have access to this task.');
    });

    test('rejects admin without project membership with 403 FORBIDDEN (no Admin bypass)', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(adminUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('You do not have access to this task.');
    });

    test('allows project team leader to view task with standard response envelope', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task).toBeDefined();
      expect(res.body.data.task._id.toString()).toBe(taskId);
      expect(res.body.data.task.title).toBe('Detail Task');
      expect(res.body.data.task.priority).toBe('high');
      expect(res.body.data.task.status).toBe('inProgress');
      expect(res.body.data.task.projectId.toString()).toBe(projectId);
      expect(res.body.data.task.isOverdue).toBeDefined();
    });

    test('allows project member to view task with standard response envelope', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task._id.toString()).toBe(taskId);
      expect(res.body.data.task.title).toBe('Detail Task');
    });

    test('preserves isOverdue virtual: true when deadline is in the past and status is not completed', async () => {
      const overdueTaskId = new mongoose.Types.ObjectId().toString();
      const overdueTask = new Task({
        _id: new mongoose.Types.ObjectId(overdueTaskId),
        title: 'Past Task',
        priority: 'medium',
        deadline: new Date(Date.now() - 1000 * 60 * 60 * 24),
        status: 'inProgress',
        projectId: new mongoose.Types.ObjectId(projectId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === overdueTaskId) return Promise.resolve(overdueTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .get(`/api/tasks/${overdueTaskId}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.data.task.isOverdue).toBe(true);
    });

    test('preserves isOverdue virtual: false when deadline is in the past but status is completed', async () => {
      const completedTaskId = new mongoose.Types.ObjectId().toString();
      const completedTask = new Task({
        _id: new mongoose.Types.ObjectId(completedTaskId),
        title: 'Completed Past Task',
        priority: 'medium',
        deadline: new Date(Date.now() - 1000 * 60 * 60 * 24),
        status: 'completed',
        projectId: new mongoose.Types.ObjectId(projectId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === completedTaskId) return Promise.resolve(completedTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .get(`/api/tasks/${completedTaskId}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.data.task.isOverdue).toBe(false);
    });

    test('preserves isOverdue virtual: false when deadline is in the future', async () => {
      const futureTaskId = new mongoose.Types.ObjectId().toString();
      const futureTask = new Task({
        _id: new mongoose.Types.ObjectId(futureTaskId),
        title: 'Future Task',
        priority: 'low',
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === futureTaskId) return Promise.resolve(futureTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .get(`/api/tasks/${futureTaskId}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.data.task.isOverdue).toBe(false);
    });
  });

  describe('GET /api/tasks/my - View My Tasks', () => {
    test('rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED', async () => {
      const res = await request(app).get('/api/tasks/my');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('returns tasks assigned to the authenticated user', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(1);
      });

      const myTask = new Task({
        _id: new mongoose.Types.ObjectId(),
        title: 'My Assigned Task',
        priority: 'medium',
        deadline: new Date('2026-12-25T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([myTask])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get('/api/tasks/my')
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedFilter.assigneeId.toString()).toBe(memberId);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].title).toBe('My Assigned Task');
      expect(res.body.data.items[0].assigneeId.toString()).toBe(memberId);
      expect(res.body.data.total).toBe(1);
    });

    test('never accepts user ID from query string or body to override authenticated user filter', async () => {
      let capturedFilter = null;
      jest.spyOn(Task, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get(`/api/tasks/my?assigneeId=${otherLeaderId}&userId=${otherLeaderId}`)
        .send({ assigneeId: otherLeaderId, userId: otherLeaderId })
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(capturedFilter.assigneeId.toString()).toBe(memberId);
    });

    test('returns empty results when user has no assigned tasks', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get('/api/tasks/my')
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.pages).toBe(0);
    });

    test('validates pagination parameters for /api/tasks/my', async () => {
      const resInvalidPage = await request(app)
        .get('/api/tasks/my?page=0')
        .set('Authorization', tokenFor(memberUser));

      expect(resInvalidPage.status).toBe(400);
      expect(resInvalidPage.body.error.code).toBe('VALIDATION_ERROR');

      const resInvalidLimit = await request(app)
        .get('/api/tasks/my?limit=150')
        .set('Authorization', tokenFor(memberUser));

      expect(resInvalidLimit.status).toBe(400);
      expect(resInvalidLimit.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('supports valid pagination parameters (page=2, limit=5)', async () => {
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(12);

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get('/api/tasks/my?page=2&limit=5')
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.data.page).toBe(2);
      expect(res.body.data.total).toBe(12);
      expect(res.body.data.pages).toBe(3);
      expect(mockFind.skip).toHaveBeenCalledWith(5);
      expect(mockFind.limit).toHaveBeenCalledWith(5);
    });

    test('preserves isOverdue virtual on returned tasks', async () => {
      const overdueTask = new Task({
        _id: new mongoose.Types.ObjectId(),
        title: 'Overdue My Task',
        priority: 'high',
        deadline: new Date(Date.now() - 1000 * 60 * 60 * 24),
        status: 'inProgress',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      const completedTask = new Task({
        _id: new mongoose.Types.ObjectId(),
        title: 'Completed My Task',
        priority: 'low',
        deadline: new Date(Date.now() - 1000 * 60 * 60 * 24),
        status: 'completed',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'countDocuments').mockResolvedValue(2);
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([overdueTask, completedTask])
      };
      jest.spyOn(Task, 'find').mockReturnValue(mockFind);

      const res = await request(app)
        .get('/api/tasks/my')
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items[0].isOverdue).toBe(true);
      expect(res.body.data.items[1].isOverdue).toBe(false);
    });
  });

  describe('PUT /api/tasks/:id - Update Task Details', () => {
    let sampleTask;
    let taskId;

    beforeEach(() => {
      taskId = new mongoose.Types.ObjectId().toString();
      sampleTask = new Task({
        _id: new mongoose.Types.ObjectId(taskId),
        title: 'Original Title',
        description: 'Original Description',
        priority: 'medium',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task.prototype, 'save').mockImplementation(function() {
        return Promise.resolve(this);
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === taskId) return Promise.resolve(sampleTask);
        return Promise.resolve(null);
      });
    });

    test('rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid task ID format with 400 INVALID_ID', async () => {
      const res = await request(app)
        .put('/api/tasks/not-a-valid-id')
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'New Title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 TASK_NOT_FOUND when task does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/api/tasks/${nonExistentId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    test('returns 404 PROJECT_NOT_FOUND when parent project does not exist', async () => {
      const orphanedTaskId = new mongoose.Types.ObjectId().toString();
      const orphanedTask = new Task({
        _id: new mongoose.Types.ObjectId(orphanedTaskId),
        title: 'Orphaned Task',
        priority: 'low',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(), // Unknown project
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === orphanedTaskId) return Promise.resolve(orphanedTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .put(`/api/tasks/${orphanedTaskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('denies project team member with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(memberUser))
        .send({ title: 'New Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies non-member user with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(nonMemberUser))
        .send({ title: 'New Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies team leader of a different project with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(otherLeaderUser))
        .send({ title: 'New Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies admin user with 403 FORBIDDEN (no Admin bypass)', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(adminUser))
        .send({ title: 'New Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects non-object request body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send(['invalid', 'array']);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test.each([
      ['status', 'completed'],
      ['assigneeId', memberId],
      ['projectId', projectId],
      ['createdById', leaderId],
      ['unrecognizedProp', 'value']
    ])('rejects attempt to alter disallowed/protected field "%s" with 400 VALIDATION_ERROR', async (field, value) => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ [field]: value });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/Only title, description, priority, and deadline/i);
    });

    test('rejects empty or whitespace-only title with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects title exceeding 200 characters with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ title: 'a'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects non-string description or description exceeding 2000 characters with 400 VALIDATION_ERROR', async () => {
      const resNonString = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ description: 12345 });

      expect(resNonString.status).toBe(400);
      expect(resNonString.body.error.code).toBe('VALIDATION_ERROR');

      const resTooLong = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ description: 'a'.repeat(2001) });

      expect(resTooLong.status).toBe(400);
      expect(resTooLong.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid priority value with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ priority: 'urgent' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid deadline format with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ deadline: 'tomorrow' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid calendar date (e.g. Feb 31) with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ deadline: '2026-02-31' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('allows project teamLeader to update title and description', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({
          title: 'Updated Task Title',
          description: 'Updated description content.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.title).toBe('Updated Task Title');
      expect(res.body.data.task.description).toBe('Updated description content.');
      expect(sampleTask.title).toBe('Updated Task Title');
      expect(sampleTask.description).toBe('Updated description content.');
    });

    test('allows clearing description by sending null', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.description).toBe('');
      expect(sampleTask.description).toBe('');
    });

    test('allows project teamLeader to update priority', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.priority).toBe('high');
      expect(sampleTask.priority).toBe('high');
    });

    test('stores date-only deadline at 23:59:59.999Z', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ deadline: '2026-12-15' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(new Date(res.body.data.task.deadline).toISOString()).toBe('2026-12-15T23:59:59.999Z');
      expect(sampleTask.deadline.toISOString()).toBe('2026-12-15T23:59:59.999Z');
    });

    test('preserves exact instant for full ISO timestamp deadline', async () => {
      const isoTimestamp = '2026-12-15T14:30:00.000Z';
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ deadline: isoTimestamp });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(new Date(res.body.data.task.deadline).toISOString()).toBe(isoTimestamp);
      expect(sampleTask.deadline.toISOString()).toBe(isoTimestamp);
    });

    test('updates isOverdue virtual dynamically when deadline is in the past', async () => {
      const pastDate = '2025-01-01';
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ deadline: pastDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.isOverdue).toBe(true);
    });

    test('isOverdue remains false when deadline is in the past but task status is completed', async () => {
      sampleTask.status = 'completed';
      const pastDate = '2025-01-01';

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ deadline: pastDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.isOverdue).toBe(false);
    });
  });

  describe('DELETE /api/tasks/:id - Delete Task and Cascade', () => {
    let sampleTask;
    let taskId;

    beforeEach(() => {
      taskId = new mongoose.Types.ObjectId().toString();
      sampleTask = new Task({
        _id: new mongoose.Types.ObjectId(taskId),
        title: 'Task to Delete',
        description: 'Description of task to delete',
        priority: 'high',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === taskId) return Promise.resolve(sampleTask);
        return Promise.resolve(null);
      });

      jest.spyOn(Task.prototype, 'deleteOne').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
      jest.spyOn(Comment, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      jest.spyOn(Notification, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    });

    test('rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED', async () => {
      const res = await request(app).delete(`/api/tasks/${taskId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid task ID format with 400 INVALID_ID', async () => {
      const res = await request(app)
        .delete('/api/tasks/not-a-valid-id')
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 TASK_NOT_FOUND when task does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/tasks/${nonExistentId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    test('returns 404 PROJECT_NOT_FOUND when parent project does not exist', async () => {
      const orphanedTaskId = new mongoose.Types.ObjectId().toString();
      const orphanedTask = new Task({
        _id: new mongoose.Types.ObjectId(orphanedTaskId),
        title: 'Orphaned Task',
        priority: 'low',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(), // Non-existent project
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === orphanedTaskId) return Promise.resolve(orphanedTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .delete(`/api/tasks/${orphanedTaskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('denies project team member with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies non-member user with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(nonMemberUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies team leader of a different project with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(otherLeaderUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies admin user with 403 FORBIDDEN (no Admin bypass)', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(adminUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('successfully deletes task and returns { success: true, data: { message: "Task deleted." } } for authorized leader', async () => {
      const deleteOneSpy = jest.spyOn(Task.prototype, 'deleteOne');

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Task deleted.');
      expect(deleteOneSpy).toHaveBeenCalled();
    });

    test('cascade deletes comments and notifications strictly matching the task ID while preserving unrelated records', async () => {
      let commentQuery = null;
      let notifQuery = null;

      jest.spyOn(Comment, 'deleteMany').mockImplementation((query) => {
        commentQuery = query;
        return Promise.resolve({ acknowledged: true, deletedCount: 4 });
      });

      jest.spyOn(Notification, 'deleteMany').mockImplementation((query) => {
        notifQuery = query;
        return Promise.resolve({ acknowledged: true, deletedCount: 2 });
      });

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify that deleteMany specifically scoped only to the deleted task's ID
      expect(commentQuery).toBeDefined();
      expect(commentQuery.taskId.toString()).toBe(taskId);

      expect(notifQuery).toBeDefined();
      expect(notifQuery.taskId.toString()).toBe(taskId);
    });

    test('propagates error and halts task deletion if cascade comment cleanup fails', async () => {
      jest.spyOn(Comment, 'deleteMany').mockRejectedValue(new Error('Database cascade failure'));
      const deleteOneSpy = jest.spyOn(Task.prototype, 'deleteOne');

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(500);
      expect(deleteOneSpy).not.toHaveBeenCalled();
    });

    test('propagates error and halts task deletion if cascade notification cleanup fails', async () => {
      jest.spyOn(Notification, 'deleteMany').mockRejectedValue(new Error('Notification cleanup failure'));
      const deleteOneSpy = jest.spyOn(Task.prototype, 'deleteOne');

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(500);
      expect(deleteOneSpy).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/tasks/:id/status - Update Task Status', () => {
    let sampleTask;
    let taskId;

    beforeEach(() => {
      taskId = new mongoose.Types.ObjectId().toString();
      sampleTask = new Task({
        _id: new mongoose.Types.ObjectId(taskId),
        title: 'Status Update Task',
        description: 'Testing status update',
        priority: 'high',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === taskId) return Promise.resolve(sampleTask);
        return Promise.resolve(null);
      });

      jest.spyOn(Task.prototype, 'save').mockImplementation(function() {
        return Promise.resolve(this);
      });

      jest.spyOn(Task, 'findOneAndUpdate').mockImplementation((filter, update, options) => {
        if (filter._id && String(filter._id) === taskId) {
          if (filter.status && filter.status !== sampleTask.status) {
            return Promise.resolve(null);
          }
          if (update.status) {
            sampleTask.status = update.status;
          }
          return Promise.resolve(sampleTask);
        }
        return Promise.resolve(null);
      });

      jest.spyOn(Notification, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(Notification, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    });

    test('rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .send({ status: 'inProgress' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid task ID format with 400 INVALID_ID', async () => {
      const res = await request(app)
        .patch('/api/tasks/not-a-valid-id/status')
        .set('Authorization', tokenFor(leaderUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 TASK_NOT_FOUND when task does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/tasks/${nonExistentId}/status`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    test('returns 404 PROJECT_NOT_FOUND when task parent project does not exist', async () => {
      const orphanedTaskId = new mongoose.Types.ObjectId().toString();
      const orphanedTask = new Task({
        _id: new mongoose.Types.ObjectId(orphanedTaskId),
        title: 'Orphaned Task',
        priority: 'low',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(), // Unknown project
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === orphanedTaskId) return Promise.resolve(orphanedTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .patch(`/api/tasks/${orphanedTaskId}/status`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('denies non-assigned member with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(nonMemberUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies team leader of a different project with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(otherLeaderUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies admin user with 403 FORBIDDEN (no Admin bypass)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(adminUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects non-object request body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send(['inProgress']);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects extra or unexpected fields in body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress', title: 'Hacked Title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/Only status may be updated/i);
    });

    test('rejects missing or invalid status value with 400 VALIDATION_ERROR', async () => {
      const resMissing = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({});

      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error.code).toBe('VALIDATION_ERROR');

      const resInvalid = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'archived' });

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('allows assigned member forward transition: todo -> inProgress and notifies project leader', async () => {
      sampleTask.status = 'todo';
      let createdNotif = null;
      jest.spyOn(Notification, 'create').mockImplementation((data) => {
        createdNotif = Array.isArray(data) ? data[0] : data;
        return Promise.resolve(createdNotif);
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.status).toBe('inProgress');
      expect(sampleTask.status).toBe('inProgress');

      expect(createdNotif).toBeDefined();
      expect(createdNotif.recipientId.toString()).toBe(leaderId);
      expect(createdNotif.type).toBe('statusChanged');
      expect(createdNotif.taskId.toString()).toBe(taskId);
      expect(createdNotif.message).toMatch(/status changed to inProgress/i);
    });

    test('allows assigned member forward transition: inProgress -> completed and notifies project leader', async () => {
      sampleTask.status = 'inProgress';
      let createdNotif = null;
      jest.spyOn(Notification, 'create').mockImplementation((data) => {
        createdNotif = Array.isArray(data) ? data[0] : data;
        return Promise.resolve(createdNotif);
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.status).toBe('completed');
      expect(sampleTask.status).toBe('completed');

      expect(createdNotif).toBeDefined();
      expect(createdNotif.recipientId.toString()).toBe(leaderId);
      expect(createdNotif.type).toBe('statusChanged');
    });

    test('denies assigned member skipping transition: todo -> completed with 403 FORBIDDEN', async () => {
      sampleTask.status = 'todo';

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'completed' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(sampleTask.status).toBe('todo');
    });

    test('denies assigned member backward transition: inProgress -> todo with 403 FORBIDDEN', async () => {
      sampleTask.status = 'inProgress';

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'todo' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies assigned member backward transition: completed -> inProgress with 403 FORBIDDEN', async () => {
      sampleTask.status = 'completed';

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('allows Team Leader arbitrary transitions: todo -> completed and notifies assignee', async () => {
      sampleTask.status = 'todo';
      let createdNotif = null;
      jest.spyOn(Notification, 'create').mockImplementation((data) => {
        createdNotif = Array.isArray(data) ? data[0] : data;
        return Promise.resolve(createdNotif);
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.status).toBe('completed');
      expect(sampleTask.status).toBe('completed');

      expect(createdNotif).toBeDefined();
      expect(createdNotif.recipientId.toString()).toBe(memberId);
      expect(createdNotif.type).toBe('statusChanged');
    });

    test('allows Team Leader backward transition: completed -> todo', async () => {
      sampleTask.status = 'completed';

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ status: 'todo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.status).toBe('todo');
      expect(sampleTask.status).toBe('todo');
    });

    test('does not create duplicate notification when status is unchanged', async () => {
      sampleTask.status = 'inProgress';
      const notifCreateSpy = jest.spyOn(Notification, 'create');

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.status).toBe('inProgress');
      expect(notifCreateSpy).not.toHaveBeenCalled();
    });

    test('Team Leader updating unassigned task does not create notification', async () => {
      sampleTask.status = 'todo';
      sampleTask.assigneeId = null;
      const notifCreateSpy = jest.spyOn(Notification, 'create');

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sampleTask.status).toBe('inProgress');
      expect(notifCreateSpy).not.toHaveBeenCalled();
    });

    test('correctly preserves isOverdue virtual when transitioning status', async () => {
      // Past deadline
      sampleTask.deadline = new Date(Date.now() - 1000 * 60 * 60);
      sampleTask.status = 'inProgress';

      const resCompleted = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'completed' });

      expect(resCompleted.status).toBe(200);
      expect(resCompleted.body.data.task.isOverdue).toBe(false);

      // Leader moves back to inProgress with past deadline -> isOverdue: true
      const resInProgress = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ status: 'inProgress' });

      expect(resInProgress.status).toBe(200);
      expect(resInProgress.body.data.task.isOverdue).toBe(true);
    });

    test('handles notification creation failure deliberately by returning 500 error', async () => {
      sampleTask.status = 'todo';
      jest.spyOn(Notification, 'create').mockRejectedValue(new Error('Notification service failure'));

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    test('recovers missing notification on subsequent request when previous attempt failed to create it', async () => {
      // Simulate task already at 'inProgress' from a previous attempt where notification failed
      sampleTask.status = 'inProgress';
      let recoveredNotif = null;
      jest.spyOn(Notification, 'findOne').mockResolvedValueOnce(null); // Missing notification!
      jest.spyOn(Notification, 'create').mockImplementation((data) => {
        recoveredNotif = Array.isArray(data) ? data[0] : data;
        return Promise.resolve(recoveredNotif);
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.status).toBe('inProgress');
      expect(recoveredNotif).toBeDefined();
      expect(recoveredNotif.recipientId.toString()).toBe(leaderId);
      expect(recoveredNotif.type).toBe('statusChanged');
    });

    test('prevents duplicate notification on concurrent identical status changes', async () => {
      sampleTask.status = 'todo';
      let notifCallCount = 0;
      jest.spyOn(Notification, 'create').mockImplementation(() => {
        notifCallCount++;
        return Promise.resolve({ _id: new mongoose.Types.ObjectId() });
      });

      const res1 = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res1.status).toBe(200);
      expect(notifCallCount).toBe(1);

      // Now simulate a concurrent stale request where findOneAndUpdate fails because status was already changed
      jest.spyOn(Task, 'findOneAndUpdate').mockResolvedValueOnce(null);
      // findById returns the updated task
      jest.spyOn(Task, 'findById').mockResolvedValueOnce(sampleTask);

      const res2 = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.task.status).toBe('inProgress');
      // Verify no second duplicate notification was dispatched
      expect(notifCallCount).toBe(1);
    });

    test('detects and rejects stale transition when task status was concurrently moved to an incompatible state', async () => {
      sampleTask.status = 'todo';

      // First findOneAndUpdate fails due to status mismatch
      jest.spyOn(Task, 'findOneAndUpdate').mockResolvedValueOnce(null);

      // Re-fetch returns fresh task in 'completed' status
      const completedTask = new Task({
        _id: new mongoose.Types.ObjectId(taskId),
        title: 'Status Update Task',
        priority: 'high',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'completed',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(memberId),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });
      jest.spyOn(Task, 'findById').mockResolvedValueOnce(completedTask);

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .set('Authorization', tokenFor(memberUser))
        .send({ status: 'inProgress' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('guarantees session cleanup when transaction is simulated', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(),
        abortTransaction: jest.fn().mockResolvedValue(),
        endSession: jest.fn()
      };

      const startSessionSpy = jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      const origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;

      const origTopology = mongoose.connection.client?.topology;
      if (!mongoose.connection.client) mongoose.connection.client = {};
      mongoose.connection.client.topology = {
        description: { type: 'ReplicaSetWithPrimary' }
      };

      try {
        const res = await request(app)
          .patch(`/api/tasks/${taskId}/status`)
          .set('Authorization', tokenFor(memberUser))
          .send({ status: 'inProgress' });

        expect(res.status).toBe(200);
        expect(mockSession.commitTransaction).toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalled();
      } finally {
        startSessionSpy.mockRestore();
        mongoose.connection.readyState = origReadyState;
        if (origTopology) {
          mongoose.connection.client.topology = origTopology;
        } else {
          delete mongoose.connection.client.topology;
        }
      }
    });
  });

  describe('PATCH /api/tasks/:id/assign - Task Assignment', () => {
    let sampleTask;
    let taskId;

    beforeEach(() => {
      taskId = new mongoose.Types.ObjectId().toString();
      sampleTask = new Task({
        _id: new mongoose.Types.ObjectId(taskId),
        title: 'Assignment Task',
        description: 'Testing task assignment',
        priority: 'medium',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: null,
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === taskId) return Promise.resolve(sampleTask);
        return Promise.resolve(null);
      });

      jest.spyOn(Task, 'findOneAndUpdate').mockImplementation((filter, update, options) => {
        if (filter._id && String(filter._id) === taskId) {
          const isFilterMatch =
            filter.assigneeId === undefined ||
            (filter.assigneeId === null && sampleTask.assigneeId === null) ||
            (filter.assigneeId && sampleTask.assigneeId && String(filter.assigneeId) === String(sampleTask.assigneeId));
          if (!isFilterMatch) {
            return Promise.resolve(null);
          }
          if ('assigneeId' in update) {
            sampleTask.assigneeId = update.assigneeId;
          }
          return Promise.resolve(sampleTask);
        }
        return Promise.resolve(null);
      });

      jest.spyOn(Notification, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(Notification, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    });

    test('rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .send({ assigneeId: memberId });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid task ID format with 400 INVALID_ID', async () => {
      const res = await request(app)
        .patch('/api/tasks/not-a-valid-id/assign')
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 TASK_NOT_FOUND when task does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/tasks/${nonExistentId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    test('returns 404 TASK_NOT_FOUND when task does not match nested route projectId', async () => {
      const otherProjectId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/projects/${otherProjectId}/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    test('returns 404 PROJECT_NOT_FOUND when task parent project does not exist', async () => {
      const orphanedTaskId = new mongoose.Types.ObjectId().toString();
      const orphanedTask = new Task({
        _id: new mongoose.Types.ObjectId(orphanedTaskId),
        title: 'Orphaned Task',
        priority: 'low',
        deadline: new Date('2026-11-01T23:59:59.999Z'),
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(), // Unknown project
        createdById: new mongoose.Types.ObjectId(leaderId)
      });

      jest.spyOn(Task, 'findById').mockImplementation((id) => {
        if (String(id) === orphanedTaskId) return Promise.resolve(orphanedTask);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .patch(`/api/tasks/${orphanedTaskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('denies non-leader project member with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(memberUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies team leader of a different project with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(otherLeaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies non-member with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(nonMemberUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies admin user with 403 FORBIDDEN (no Admin bypass)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(adminUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects non-object request body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send([memberId]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects missing assigneeId in request body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/assigneeId is required/i);
    });

    test('rejects extra fields in request body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId, title: 'Tampered' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/Only assigneeId may be updated/i);
    });

    test('rejects invalid assigneeId format with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: 'not-valid-hex' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/Assignee id is invalid/i);
    });

    test('rejects assignee not in project memberIds with 400 INVALID_ASSIGNEE', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: nonMemberId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
      expect(res.body.error.message).toMatch(/Assignee must be an active member of this project/i);
    });

    test('rejects deactivated member with 400 INVALID_ASSIGNEE', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: inactiveMemberId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
      expect(res.body.error.message).toMatch(/Assignee must be an active user/i);
    });

    test('rejects member whose user record is not found in database with 400 INVALID_ASSIGNEE', async () => {
      const missingUserId = new mongoose.Types.ObjectId();
      const projectWithMissingUser = {
        ...mockProject,
        memberIds: [...mockProject.memberIds, missingUserId]
      };
      jest.spyOn(Project, 'findById').mockResolvedValueOnce(projectWithMissingUser);

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: missingUserId.toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
      expect(res.body.error.message).toMatch(/Assignee must be an active user/i);
    });

    test('successfully assigns task to an active project member and creates taskAssigned notification', async () => {
      sampleTask.assigneeId = null;
      let createdNotif = null;
      jest.spyOn(Notification, 'create').mockImplementation((data) => {
        createdNotif = Array.isArray(data) ? data[0] : data;
        return Promise.resolve(createdNotif);
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.assigneeId.toString()).toBe(memberId);
      expect(res.body.data.task.isOverdue).toBeDefined();

      expect(createdNotif).toBeDefined();
      expect(createdNotif.recipientId.toString()).toBe(memberId);
      expect(createdNotif.type).toBe('taskAssigned');
      expect(createdNotif.taskId.toString()).toBe(taskId);
      expect(createdNotif.message).toBe(`Task "${sampleTask.title}" has been assigned to you.`);
    });

    test('successfully unassigns a task when assigneeId is null and dispatches no notification', async () => {
      sampleTask.assigneeId = new mongoose.Types.ObjectId(memberId);
      let notifCreated = false;
      jest.spyOn(Notification, 'create').mockImplementation(() => {
        notifCreated = true;
        return Promise.resolve({});
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: null });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.assigneeId).toBeNull();
      expect(notifCreated).toBe(false);
    });

    test('is idempotent when assigning to the current assignee and prevents duplicate notification', async () => {
      sampleTask.assigneeId = new mongoose.Types.ObjectId(memberId);
      let notifCreated = false;
      jest.spyOn(Notification, 'create').mockImplementation(() => {
        notifCreated = true;
        return Promise.resolve({});
      });
      jest.spyOn(Notification, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.assigneeId.toString()).toBe(memberId);
      expect(notifCreated).toBe(false);
    });

    test('is idempotent when task is already unassigned and assigneeId is null', async () => {
      sampleTask.assigneeId = null;
      let notifCreated = false;
      jest.spyOn(Notification, 'create').mockImplementation(() => {
        notifCreated = true;
        return Promise.resolve({});
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: null });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.assigneeId).toBeNull();
      expect(notifCreated).toBe(false);
    });

    test('recovers missing notification on idempotent assignment when previous notification was not created', async () => {
      sampleTask.assigneeId = new mongoose.Types.ObjectId(memberId);
      let recoveredNotif = null;
      jest.spyOn(Notification, 'findOne').mockResolvedValue(null);
      jest.spyOn(Notification, 'create').mockImplementation((data) => {
        recoveredNotif = Array.isArray(data) ? data[0] : data;
        return Promise.resolve(recoveredNotif);
      });

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(recoveredNotif).toBeDefined();
      expect(recoveredNotif.recipientId.toString()).toBe(memberId);
      expect(recoveredNotif.type).toBe('taskAssigned');
    });

    test('handles concurrent identical assignment gracefully without duplicate notification', async () => {
      sampleTask.assigneeId = null;
      let notifCount = 0;
      jest.spyOn(Notification, 'create').mockImplementation(() => {
        notifCount++;
        return Promise.resolve({ _id: new mongoose.Types.ObjectId() });
      });

      const res1 = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res1.status).toBe(200);
      expect(notifCount).toBe(1);

      // Simulate concurrent stale update where first findOneAndUpdate fails because assigneeId was already changed
      jest.spyOn(Task, 'findOneAndUpdate').mockResolvedValueOnce(null);
      // Re-fetch returns the updated task
      jest.spyOn(Task, 'findById').mockResolvedValueOnce(sampleTask);

      const res2 = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res2.status).toBe(200);
      expect(res2.body.data.task.assigneeId.toString()).toBe(memberId);
      expect(notifCount).toBe(1);
    });

    test('re-attempts atomic update when task assigneeId was concurrently changed to another user', async () => {
      sampleTask.assigneeId = null;

      // First findOneAndUpdate fails
      jest.spyOn(Task, 'findOneAndUpdate')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleTask);

      const intermediateTask = new Task({
        _id: new mongoose.Types.ObjectId(taskId),
        title: 'Assignment Task',
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(), // another user
        createdById: new mongoose.Types.ObjectId(leaderId)
      });
      jest.spyOn(Task, 'findById').mockResolvedValueOnce(intermediateTask);

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('returns 409 CONFLICT when re-attempt also fails due to concurrent conflict', async () => {
      sampleTask.assigneeId = null;

      jest.spyOn(Task, 'findOneAndUpdate')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const intermediateTask = new Task({
        _id: new mongoose.Types.ObjectId(taskId),
        title: 'Assignment Task',
        status: 'todo',
        projectId: new mongoose.Types.ObjectId(projectId),
        assigneeId: new mongoose.Types.ObjectId(),
        createdById: new mongoose.Types.ObjectId(leaderId)
      });
      jest.spyOn(Task, 'findById').mockResolvedValueOnce(intermediateTask);

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ assigneeId: memberId });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    test('guarantees session cleanup when transaction is simulated', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(),
        abortTransaction: jest.fn().mockResolvedValue(),
        endSession: jest.fn()
      };

      const startSessionSpy = jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      const origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;

      const origTopology = mongoose.connection.client?.topology;
      if (!mongoose.connection.client) mongoose.connection.client = {};
      mongoose.connection.client.topology = {
        description: { type: 'ReplicaSetWithPrimary' }
      };

      try {
        const res = await request(app)
          .patch(`/api/tasks/${taskId}/assign`)
          .set('Authorization', tokenFor(leaderUser))
          .send({ assigneeId: memberId });

        expect(res.status).toBe(200);
        expect(mockSession.commitTransaction).toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalled();
      } finally {
        startSessionSpy.mockRestore();
        mongoose.connection.readyState = origReadyState;
        if (origTopology) {
          mongoose.connection.client.topology = origTopology;
        } else {
          delete mongoose.connection.client.topology;
        }
      }
    });

    test('guarantees session abort and cleanup when an error occurs during save in a transaction', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(),
        abortTransaction: jest.fn().mockResolvedValue(),
        endSession: jest.fn()
      };

      const startSessionSpy = jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      const origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;

      const origTopology = mongoose.connection.client?.topology;
      if (!mongoose.connection.client) mongoose.connection.client = {};
      mongoose.connection.client.topology = {
        description: { type: 'ReplicaSetWithPrimary' }
      };

      jest.spyOn(Task, 'findOneAndUpdate').mockRejectedValueOnce(new Error('Simulated DB error'));

      try {
        const res = await request(app)
          .patch(`/api/tasks/${taskId}/assign`)
          .set('Authorization', tokenFor(leaderUser))
          .send({ assigneeId: memberId });

        expect(res.status).toBe(500);
        expect(mockSession.abortTransaction).toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalled();
      } finally {
        startSessionSpy.mockRestore();
        mongoose.connection.readyState = origReadyState;
        if (origTopology) {
          mongoose.connection.client.topology = origTopology;
        } else {
          delete mongoose.connection.client.topology;
        }
      }
    });
  });
});
