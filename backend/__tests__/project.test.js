process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Project = require('../src/models/Project');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken } = require('../src/utils/security');

describe('Project API', () => {
  test('GET /api/projects rejects requests without authentication', async () => {
    const response = await request(app).get('/api/projects');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  test('GET /api/projects/:id rejects an invalid project ID without authentication first', async () => {
    const response = await request(app).get('/api/projects/not-a-valid-id');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('rejects project creation without authentication', async () => {
    const response = await request(app)
      .post('/api/projects')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  test('rejects project update without authentication', async () => {
    const response = await request(app)
      .put('/api/projects/not-a-valid-id')
      .send({ name: 'Updated Project' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test.each([
    ['POST', '/api/projects'],
    ['PUT', '/api/projects/not-a-valid-id'],
    ['DELETE', '/api/projects/not-a-valid-id'],
    ['POST', '/api/projects/not-a-valid-id/members'],
    ['DELETE', '/api/projects/not-a-valid-id/members/not-a-valid-user']
  ])('%s %s rejects unauthenticated requests', async (method, path) => {
    const response = await request(app)[method.toLowerCase()](path);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  describe('DELETE /api/projects/:id - Delete Project and Cascade', () => {
    const leaderId = new mongoose.Types.ObjectId().toString();
    const otherLeaderId = new mongoose.Types.ObjectId().toString();
    const memberId = new mongoose.Types.ObjectId().toString();
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

    const adminUser = {
      _id: new mongoose.Types.ObjectId(adminId),
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      isActive: true
    };

    const usersDb = {
      [leaderId]: leaderUser,
      [otherLeaderId]: otherLeaderUser,
      [memberId]: memberUser,
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
        name: 'Project to Delete',
        description: 'Test Description',
        deadline: new Date('2026-12-31T00:00:00.000Z'),
        teamLeaderId: new mongoose.Types.ObjectId(leaderId),
        memberIds: [new mongoose.Types.ObjectId(memberId)],
        deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 })
      };

      jest.spyOn(Project, 'findById').mockImplementation((id) => {
        if (String(id) === projectId) {
          return Promise.resolve(mockProjectDoc);
        }
        return Promise.resolve(null);
      });

      jest.spyOn(Task, 'find').mockResolvedValue([]);
      jest.spyOn(Task, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      jest.spyOn(Comment, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      jest.spyOn(Notification, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('rejects invalid project ID format with 400 INVALID_ID', async () => {
      const res = await request(app)
        .delete('/api/projects/not-a-valid-id')
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 PROJECT_NOT_FOUND when project does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/projects/${nonExistentId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('denies team member with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(memberUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('denies team leader of a different project with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(otherLeaderUser));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('successfully deletes project and returns success message for authorized leader', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Project deleted.');
      expect(mockProjectDoc.deleteOne).toHaveBeenCalled();
      expect(Task.deleteMany).toHaveBeenCalledWith(
        { projectId: mockProjectDoc._id },
        expect.any(Object)
      );
    });

    test('cascade deletes all tasks, comments, and notifications associated with the project', async () => {
      const taskId1 = new mongoose.Types.ObjectId();
      const taskId2 = new mongoose.Types.ObjectId();

      jest.spyOn(Task, 'find').mockResolvedValue([{ _id: taskId1 }, { _id: taskId2 }]);

      let taskQuery = null;
      let commentQuery = null;
      let notifQuery = null;

      jest.spyOn(Task, 'deleteMany').mockImplementation((query) => {
        taskQuery = query;
        return Promise.resolve({ acknowledged: true, deletedCount: 2 });
      });

      jest.spyOn(Comment, 'deleteMany').mockImplementation((query) => {
        commentQuery = query;
        return Promise.resolve({ acknowledged: true, deletedCount: 5 });
      });

      jest.spyOn(Notification, 'deleteMany').mockImplementation((query) => {
        notifQuery = query;
        return Promise.resolve({ acknowledged: true, deletedCount: 3 });
      });

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Project deleted.');

      // Check Task.find was called with the project ID
      expect(Task.find).toHaveBeenCalledWith(
        { projectId: mockProjectDoc._id },
        '_id',
        expect.any(Object)
      );

      // Check Comment.deleteMany was scoped to the project's task IDs
      expect(commentQuery).toBeDefined();
      expect(commentQuery.taskId.$in).toEqual([taskId1, taskId2]);

      // Check Notification.deleteMany was scoped to the project's task IDs
      expect(notifQuery).toBeDefined();
      expect(notifQuery.taskId.$in).toEqual([taskId1, taskId2]);

      // Check Task.deleteMany was scoped to the project ID
      expect(taskQuery).toBeDefined();
      expect(String(taskQuery.projectId)).toBe(String(projectId));

      // Check project itself was deleted
      expect(mockProjectDoc.deleteOne).toHaveBeenCalled();
    });

    test('does not attempt comment/notification deletion if project has no tasks', async () => {
      jest.spyOn(Task, 'find').mockResolvedValue([]);
      const commentSpy = jest.spyOn(Comment, 'deleteMany');
      const notifSpy = jest.spyOn(Notification, 'deleteMany');
      const taskSpy = jest.spyOn(Task, 'deleteMany');

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(commentSpy).not.toHaveBeenCalled();
      expect(notifSpy).not.toHaveBeenCalled();
      expect(taskSpy).toHaveBeenCalledWith(
        { projectId: mockProjectDoc._id },
        expect.any(Object)
      );
      expect(mockProjectDoc.deleteOne).toHaveBeenCalled();
    });

    test('propagates error and halts deletion if finding tasks fails', async () => {
      jest.spyOn(Task, 'find').mockRejectedValue(new Error('Task lookup failure'));
      const taskDeleteSpy = jest.spyOn(Task, 'deleteMany');

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(500);
      expect(taskDeleteSpy).not.toHaveBeenCalled();
      expect(mockProjectDoc.deleteOne).not.toHaveBeenCalled();
    });

    test('propagates error and halts deletion if comment cascade cleanup fails', async () => {
      const taskId = new mongoose.Types.ObjectId();
      jest.spyOn(Task, 'find').mockResolvedValue([{ _id: taskId }]);
      jest.spyOn(Comment, 'deleteMany').mockRejectedValue(new Error('Comment cascade failure'));
      const taskDeleteSpy = jest.spyOn(Task, 'deleteMany');

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(500);
      expect(taskDeleteSpy).not.toHaveBeenCalled();
      expect(mockProjectDoc.deleteOne).not.toHaveBeenCalled();
    });

    test('propagates error and halts deletion if notification cascade cleanup fails', async () => {
      const taskId = new mongoose.Types.ObjectId();
      jest.spyOn(Task, 'find').mockResolvedValue([{ _id: taskId }]);
      jest.spyOn(Notification, 'deleteMany').mockRejectedValue(new Error('Notification cascade failure'));
      const taskDeleteSpy = jest.spyOn(Task, 'deleteMany');

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(500);
      expect(taskDeleteSpy).not.toHaveBeenCalled();
      expect(mockProjectDoc.deleteOne).not.toHaveBeenCalled();
    });

    test('propagates error and halts deletion if task cascade cleanup fails', async () => {
      const taskId = new mongoose.Types.ObjectId();
      jest.spyOn(Task, 'find').mockResolvedValue([{ _id: taskId }]);
      jest.spyOn(Task, 'deleteMany').mockRejectedValue(new Error('Task deletion failure'));

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', tokenFor(leaderUser));

      expect(res.status).toBe(500);
      expect(mockProjectDoc.deleteOne).not.toHaveBeenCalled();
    });
  });
});
