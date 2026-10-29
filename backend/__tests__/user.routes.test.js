process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken, verifyPassword } = require('../src/utils/security');

describe('User Management Routes (/api/users)', () => {
  const adminId = new mongoose.Types.ObjectId().toString();
  const leaderId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();

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

  const usersDb = {
    [adminId]: adminUser,
    [leaderId]: leaderUser,
    [memberId]: memberUser
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

  describe('POST /api/users - Non-Admin authorization', () => {
    test('rejects unauthenticated requests with 401', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          name: 'New Person',
          email: 'newperson@example.com',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('rejects teamLeader requests with 403 FORBIDDEN', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(leaderUser))
        .send({
          name: 'New Person',
          email: 'newperson@example.com',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects teamMember requests with 403 FORBIDDEN', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(memberUser))
        .send({
          name: 'New Person',
          email: 'newperson@example.com',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/users - Validation', () => {
    test('rejects missing or too short name (< 2 chars)', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'A',
          email: 'valid@example.com',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects name exceeding 80 characters', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'A'.repeat(81),
          email: 'valid@example.com',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid email format', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Valid Name',
          email: 'not-an-email',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects password shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Valid Name',
          email: 'valid@example.com',
          password: 'short',
          role: 'teamMember'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects password longer than 128 characters', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Valid Name',
          email: 'valid@example.com',
          password: 'A'.repeat(129),
          role: 'teamMember'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid role', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Valid Name',
          email: 'valid@example.com',
          password: 'Password123!',
          role: 'superAdmin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/users - Duplicate email check', () => {
    test('returns 409 EMAIL_IN_USE when email already exists via User.exists', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Duplicate User',
          email: 'existing@example.com',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_IN_USE');
      expect(response.body.error.message).toMatch(/already exists/i);
    });

    test('returns 409 EMAIL_IN_USE when User.create throws E11000 duplicate key error', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue(false);
      const duplicateError = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      jest.spyOn(User, 'create').mockRejectedValue(duplicateError);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Duplicate User',
          email: 'existing@example.com',
          password: 'Password123!',
          role: 'teamMember'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_IN_USE');
    });
  });

  describe('POST /api/users - Successful creation', () => {
    test('creates user with hashed password and returns user without password or passwordHash', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue(false);

      let createdUserPayload = null;
      const createdUserId = new mongoose.Types.ObjectId();
      jest.spyOn(User, 'create').mockImplementation(async (payload) => {
        createdUserPayload = payload;
        return {
          _id: createdUserId,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          isActive: payload.isActive,
          toJSON: () => ({
            _id: createdUserId.toString(),
            name: payload.name,
            email: payload.email,
            role: payload.role,
            isActive: payload.isActive
          })
        };
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Jane Doe',
          email: 'JANE.DOE@example.com',
          password: 'SecurePassword123!',
          role: 'teamLeader'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user._id).toBe(createdUserId.toString());
      expect(response.body.data.user.name).toBe('Jane Doe');
      expect(response.body.data.user.email).toBe('jane.doe@example.com');
      expect(response.body.data.user.role).toBe('teamLeader');
      expect(response.body.data.user.isActive).toBe(true);
      // Ensure plaintext password and passwordHash are NEVER returned in response
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();

      // Ensure password was hashed in the database payload
      expect(createdUserPayload).not.toBeNull();
      expect(createdUserPayload.password).toBeUndefined();
      expect(createdUserPayload.passwordHash).toBeDefined();
      expect(createdUserPayload.passwordHash.startsWith('scrypt$')).toBe(true);
      const isPasswordValid = await verifyPassword('SecurePassword123!', createdUserPayload.passwordHash);
      expect(isPasswordValid).toBe(true);
    });

    test('defaults to role teamMember when role is omitted', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue(false);

      let createdUserPayload = null;
      jest.spyOn(User, 'create').mockImplementation(async (payload) => {
        createdUserPayload = payload;
        return {
          _id: new mongoose.Types.ObjectId(),
          ...payload,
          toJSON: () => ({ ...payload, _id: 'new-id' })
        };
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Default Role User',
          email: 'defaultrole@example.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(201);
      expect(createdUserPayload.role).toBe('teamMember');
    });

    test('allows creating an admin user', async () => {
      jest.spyOn(User, 'exists').mockResolvedValue(false);

      let createdUserPayload = null;
      jest.spyOn(User, 'create').mockImplementation(async (payload) => {
        createdUserPayload = payload;
        return {
          _id: new mongoose.Types.ObjectId(),
          ...payload,
          toJSON: () => ({ ...payload, _id: 'new-id' })
        };
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(adminUser))
        .send({
          name: 'Second Admin',
          email: 'admin2@example.com',
          password: 'Password123!',
          role: 'admin'
        });

      expect(response.status).toBe(201);
      expect(createdUserPayload.role).toBe('admin');
    });
  });
});
