
const request = require('supertest');
const app = require('../src/app');

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

});
