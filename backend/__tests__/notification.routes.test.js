process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken } = require('../src/utils/security');

describe('Notification Routes (/api/notifications)', () => {
  const user1Id = new mongoose.Types.ObjectId().toString();
  const user2Id = new mongoose.Types.ObjectId().toString();
  const taskId = new mongoose.Types.ObjectId().toString();

  const user1 = {
    _id: new mongoose.Types.ObjectId(user1Id),
    name: 'User One',
    email: 'user1@example.com',
    role: 'teamMember',
    isActive: true
  };

  const user2 = {
    _id: new mongoose.Types.ObjectId(user2Id),
    name: 'User Two',
    email: 'user2@example.com',
    role: 'teamLeader',
    isActive: true
  };

  const usersDb = {
    [user1Id]: user1,
    [user2Id]: user2
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

  describe('GET /api/notifications - User Isolation & Authentication', () => {
    test('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('retrieves notifications exclusively scoped to the authenticated user', async () => {
      const notifUser1 = {
        _id: new mongoose.Types.ObjectId(),
        recipientId: new mongoose.Types.ObjectId(user1Id),
        type: 'taskAssigned',
        taskId: new mongoose.Types.ObjectId(taskId),
        message: 'Task assigned to you.',
        isRead: false,
        createdAt: new Date()
      };

      let capturedFilter = null;
      jest.spyOn(Notification, 'find').mockImplementation((filter) => {
        capturedFilter = filter;
        return {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([notifUser1])
        };
      });

      jest.spyOn(Notification, 'countDocuments').mockImplementation((filter) => {
        if (filter.isRead === false) return Promise.resolve(1);
        return Promise.resolve(1);
      });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', tokenFor(user1));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(String(capturedFilter.recipientId)).toBe(user1Id);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.unreadCount).toBe(1);
      expect(res.body.data.total).toBe(1);
    });

    test('validates pagination parameters properly', async () => {
      const resZeroPage = await request(app)
        .get('/api/notifications?page=0')
        .set('Authorization', tokenFor(user1));
      expect(resZeroPage.status).toBe(400);

      const resInvalidLimit = await request(app)
        .get('/api/notifications?limit=200')
        .set('Authorization', tokenFor(user1));
      expect(resInvalidLimit.status).toBe(400);
    });
  });

  describe('PATCH /api/notifications/:id/read - Read Status & Authorization', () => {
    test('rejects unauthenticated request with 401', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const res = await request(app).patch(`/api/notifications/${id}/read`);
      expect(res.status).toBe(401);
    });

    test('returns 400 for invalid notification ID format', async () => {
      const res = await request(app)
        .patch('/api/notifications/invalid-id/read')
        .set('Authorization', tokenFor(user1));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('returns 404 when notification does not exist', async () => {
      jest.spyOn(Notification, 'findById').mockResolvedValue(null);
      const id = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set('Authorization', tokenFor(user1));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('enforces authorization (403 FORBIDDEN) when user attempts to read another user notification', async () => {
      const notifForUser2 = {
        _id: new mongoose.Types.ObjectId(),
        recipientId: new mongoose.Types.ObjectId(user2Id),
        isRead: false
      };
      jest.spyOn(Notification, 'findById').mockResolvedValue(notifForUser2);

      const res = await request(app)
        .patch(`/api/notifications/${notifForUser2._id}/read`)
        .set('Authorization', tokenFor(user1));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('successfully updates and persists isRead: true for owner', async () => {
      const notifId = new mongoose.Types.ObjectId();
      const mockNotif = {
        _id: notifId,
        recipientId: new mongoose.Types.ObjectId(user1Id),
        isRead: false,
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ _id: notifId.toString(), recipientId: user1Id, isRead: true })
      };
      jest.spyOn(Notification, 'findById').mockResolvedValue(mockNotif);

      const res = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Authorization', tokenFor(user1));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockNotif.isRead).toBe(true);
      expect(mockNotif.save).toHaveBeenCalled();
      expect(res.body.data.notification.isRead).toBe(true);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    test('marks all unread notifications for authenticated user as read', async () => {
      let capturedFilter = null;
      let capturedUpdate = null;
      jest.spyOn(Notification, 'updateMany').mockImplementation((filter, update) => {
        capturedFilter = filter;
        capturedUpdate = update;
        return Promise.resolve({ acknowledged: true, modifiedCount: 3 });
      });

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', tokenFor(user1));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(String(capturedFilter.recipientId)).toBe(user1Id);
      expect(capturedFilter.isRead).toBe(false);
      expect(capturedUpdate.$set.isRead).toBe(true);
    });
  });
});
