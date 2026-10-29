process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Task = require('../src/models/Task');
const Project = require('../src/models/Project');
const User = require('../src/models/User');
const Comment = require('../src/models/Comment');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken } = require('../src/utils/security');

describe('Task Comments Endpoints (TM-F-016 / TC-COM-01)', () => {
  const leaderId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();
  const nonMemberId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();
  const projectId = new mongoose.Types.ObjectId().toString();
  const taskId = new mongoose.Types.ObjectId().toString();

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

  const mockProject = {
    _id: new mongoose.Types.ObjectId(projectId),
    name: 'Comments Test Project',
    teamLeaderId: new mongoose.Types.ObjectId(leaderId),
    memberIds: [new mongoose.Types.ObjectId(memberId)]
  };

  const mockTask = {
    _id: new mongoose.Types.ObjectId(taskId),
    title: 'Task For Commenting',
    description: 'Testing comment features',
    priority: 'high',
    status: 'inProgress',
    projectId: new mongoose.Types.ObjectId(projectId),
    createdById: new mongoose.Types.ObjectId(leaderId),
    assigneeId: new mongoose.Types.ObjectId(memberId)
  };

  const usersDb = {
    [leaderId]: leaderUser,
    [memberId]: memberUser,
    [nonMemberId]: nonMemberUser,
    [adminId]: adminUser
  };

  let commentsDb = [];

  const tokenFor = (user) => `Bearer ${signToken(user)}`;

  beforeEach(() => {
    jest.clearAllMocks();
    commentsDb = [];

    jest.spyOn(TokenBlocklist, 'exists').mockResolvedValue(false);

    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const user = usersDb[String(id)] || null;
      return {
        select: jest.fn().mockResolvedValue(user),
        then: (resolve, reject) => Promise.resolve(user).then(resolve, reject)
      };
    });

    jest.spyOn(Project, 'findById').mockImplementation((id) => {
      if (String(id) === projectId) {
        return Promise.resolve(mockProject);
      }
      return Promise.resolve(null);
    });

    jest.spyOn(Task, 'findById').mockImplementation((id) => {
      if (String(id) === taskId) {
        return Promise.resolve(mockTask);
      }
      return Promise.resolve(null);
    });

    jest.spyOn(Comment, 'create').mockImplementation((data) => {
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        taskId: new mongoose.Types.ObjectId(data.taskId),
        authorId: data.authorId,
        text: data.text,
        createdAt: new Date(),
        updatedAt: new Date(),
        populate: jest.fn().mockImplementation(async function () {
          const author = usersDb[String(this.authorId)];
          if (author) {
            this.authorId = {
              _id: author._id,
              name: author.name,
              email: author.email,
              role: author.role
            };
          }
          return this;
        })
      };
      commentsDb.push(doc);
      return Promise.resolve(doc);
    });

    jest.spyOn(Comment, 'find').mockImplementation((query) => {
      const filtered = commentsDb
        .filter((c) => String(c.taskId) === String(query.taskId))
        .map((c) => {
          const author = usersDb[String(c.authorId?._id || c.authorId)];
          return {
            ...c,
            authorId: author
              ? {
                  _id: author._id,
                  name: author.name,
                  email: author.email,
                  role: author.role
                }
              : c.authorId
          };
        });

      return {
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(filtered)
        })
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/tasks/:id/comments', () => {
    test('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get(`/api/tasks/${taskId}/comments`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid task id with 400', async () => {
      const res = await request(app)
        .get('/api/tasks/not-valid-id/comments')
        .set('Authorization', tokenFor(leaderUser));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 if task not found', async () => {
      const missingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/tasks/${missingId}/comments`)
        .set('Authorization', tokenFor(leaderUser));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    test('returns 403 FORBIDDEN for user who is neither leader nor member of the project', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(nonMemberUser));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('returns 403 FORBIDDEN for admin without project membership (no blanket bypass)', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(adminUser));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('allows team leader to retrieve empty comments list', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(leaderUser));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comments).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    test('allows team member to retrieve comments with author info populated', async () => {
      commentsDb.push({
        _id: new mongoose.Types.ObjectId(),
        taskId: new mongoose.Types.ObjectId(taskId),
        authorId: new mongoose.Types.ObjectId(leaderId),
        text: 'Initial review comment',
        createdAt: new Date('2026-10-29T08:00:00Z'),
        updatedAt: new Date('2026-10-29T08:00:00Z')
      });

      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comments).toHaveLength(1);
      expect(res.body.data.comments[0].text).toBe('Initial review comment');
      expect(res.body.data.comments[0].authorId.name).toBe('Team Leader');
    });

    test('rejects request when taskId is accessed via mismatched projectId parameter', async () => {
      const mismatchedProjectId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/projects/${mismatchedProjectId}/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(leaderUser));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('POST /api/tasks/:id/comments', () => {
    test('rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .send({ text: 'Hello' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects invalid task id with 400', async () => {
      const res = await request(app)
        .post('/api/tasks/not-valid-id/comments')
        .set('Authorization', tokenFor(leaderUser))
        .send({ text: 'Hello' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 if task not found', async () => {
      const missingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/tasks/${missingId}/comments`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ text: 'Hello' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    test('returns 403 FORBIDDEN for non-member user', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(nonMemberUser))
        .send({ text: 'Unauthorized comment' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('returns 403 FORBIDDEN for admin user without project membership', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(adminUser))
        .send({ text: 'Admin attempt' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects non-object request body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser))
        .send(['not', 'an', 'object']);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects empty comment string with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser))
        .send({ text: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects whitespace-only comment with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ text: '    \t \n  ' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects missing text field with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects non-string text field with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser))
        .send({ text: 12345 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects comments exceeding 2000 characters with 400 VALIDATION_ERROR', async () => {
      const longText = 'a'.repeat(2001);
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser))
        .send({ text: longText });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('allows Team Leader to submit comment and persists in database', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(leaderUser))
        .send({ text: 'Leader: Please prioritize the API tests.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comment.text).toBe('Leader: Please prioritize the API tests.');
      expect(res.body.data.comment.authorId.name).toBe('Team Leader');
      expect(commentsDb).toHaveLength(1);
    });

    test('allows Team Member to submit comment and persists in database', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser))
        .send({ text: 'Member: On it, writing unit tests now.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comment.text).toBe('Member: On it, writing unit tests now.');
      expect(res.body.data.comment.authorId.name).toBe('Team Member');
      expect(commentsDb).toHaveLength(1);
    });

    test('persistence: newly submitted comment is immediately visible via GET', async () => {
      const postRes = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(memberUser))
        .send({ text: 'Persistent comment test' });
      expect(postRes.status).toBe(201);

      const getRes = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', tokenFor(leaderUser));
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.comments).toHaveLength(1);
      expect(getRes.body.data.comments[0].text).toBe('Persistent comment test');
      expect(getRes.body.data.comments[0].authorId.name).toBe('Team Member');
    });
  });
});
