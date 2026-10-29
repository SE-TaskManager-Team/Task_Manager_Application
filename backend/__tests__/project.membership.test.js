process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Project = require('../src/models/Project');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { signToken } = require('../src/utils/security');

describe('Project Membership and Task Assignment', () => {
  const leaderId = new mongoose.Types.ObjectId().toString();
  const otherLeaderId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();
  const newMemberId = new mongoose.Types.ObjectId().toString();
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

  const newMemberUser = {
    _id: new mongoose.Types.ObjectId(newMemberId),
    name: 'New Team Member',
    email: 'newmember@example.com',
    role: 'teamMember',
    isActive: true
  };

  const inactiveUser = {
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

  const leaderAsMemberUser = {
    _id: new mongoose.Types.ObjectId(leaderId),
    name: 'Leader Impersonating Member',
    email: 'leadermember@example.com',
    role: 'teamMember',
    isActive: true
  };

  const usersDb = {
    [leaderId]: leaderUser,
    [otherLeaderId]: otherLeaderUser,
    [memberId]: memberUser,
    [newMemberId]: newMemberUser,
    [inactiveMemberId]: inactiveUser,
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

    jest.spyOn(Task, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 0 });

    mockProjectDoc = {
      _id: new mongoose.Types.ObjectId(projectId),
      name: 'Membership Test Project',
      description: 'Test Description',
      deadline: new Date('2026-12-31T00:00:00.000Z'),
      teamLeaderId: new mongoose.Types.ObjectId(leaderId),
      memberIds: [new mongoose.Types.ObjectId(memberId)],
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(Project, 'findById').mockImplementation((id) => {
      if (String(id) === projectId) {
        return Promise.resolve(mockProjectDoc);
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('adds active team member to project successfully', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', tokenFor(leaderUser))
      .send({ userId: newMemberId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockProjectDoc.memberIds.map(String)).toContain(newMemberId);
    expect(mockProjectDoc.save).toHaveBeenCalled();
  });

  test('rejects duplicate project membership with 409 ALREADY_MEMBER', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', tokenFor(leaderUser))
      .send({ userId: memberId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
    expect(mockProjectDoc.save).not.toHaveBeenCalled();
  });

  test('denies non-leader role from adding members with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', tokenFor(memberUser))
      .send({ userId: newMemberId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('denies leader of a different project from adding members with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', tokenFor(otherLeaderUser))
      .send({ userId: newMemberId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('rejects adding a user with non-teamMember role (e.g. admin) with 400 INVALID_MEMBER_ROLE', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', tokenFor(leaderUser))
      .send({ userId: adminId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_MEMBER_ROLE');
  });

  test('rejects adding team leader as member with 400 INVALID_MEMBER', async () => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      return {
        select: jest.fn().mockResolvedValue(usersDb[String(id)] || null),
        then: (resolve, reject) => {
          const user = String(id) === leaderId ? leaderAsMemberUser : usersDb[String(id)];
          return Promise.resolve(user || null).then(resolve, reject);
        }
      };
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', tokenFor(leaderUser))
      .send({ userId: leaderId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_MEMBER');
  });

  test('rejects adding inactive user with 404 USER_NOT_FOUND', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', tokenFor(leaderUser))
      .send({ userId: inactiveMemberId });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  test('removes member from project successfully', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${memberId}`)
      .set('Authorization', tokenFor(leaderUser));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockProjectDoc.memberIds.map(String)).not.toContain(memberId);
    expect(mockProjectDoc.save).toHaveBeenCalled();
    expect(Task.updateMany).toHaveBeenCalledWith(
      { projectId: mockProjectDoc._id, assigneeId: memberId },
      { $set: { assigneeId: null } }
    );
  });

  test('returns 404 MEMBER_NOT_FOUND when removing user who is not a project member', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${newMemberId}`)
      .set('Authorization', tokenFor(leaderUser));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
  });

  test('task assignment: rejects assigning task to a user who is not a project member', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', tokenFor(leaderUser))
      .send({
        title: 'New Feature Task',
        priority: 'high',
        deadline: '2026-11-20',
        assigneeId: newMemberId
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
  });

  test('task assignment: allows assigning task to an active project member', async () => {
    jest.spyOn(Task, 'create').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      title: 'New Feature Task',
      priority: 'high',
      deadline: new Date('2026-11-20'),
      projectId: mockProjectDoc._id,
      assigneeId: memberUser._id,
      createdById: leaderUser._id,
      status: 'todo'
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', tokenFor(leaderUser))
      .send({
        title: 'New Feature Task',
        priority: 'high',
        deadline: '2026-11-20',
        assigneeId: memberId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/users: team leader can list active team members', async () => {
    jest.spyOn(User, 'find').mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => Promise.resolve([memberUser, newMemberUser])
        })
      })
    });
    jest.spyOn(User, 'countDocuments').mockResolvedValue(2);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', tokenFor(leaderUser));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
  });

  test('GET /api/users: denies team member with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', tokenFor(memberUser));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
