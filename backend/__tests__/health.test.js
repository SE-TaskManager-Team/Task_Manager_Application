
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');

  return {
    ...actualMongoose,
    connection: {
      ...actualMongoose.connection,
      readyState: 0
    }
  };
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

describe('Health API integration tests', () => {
  beforeEach(() => {
    mongoose.connection.readyState = 0;
  });

  test('returns 503 when the database is disconnected', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.database.status).toBe('disconnected');
  });

  test('returns 200 when the database is connected', async () => {
    mongoose.connection.readyState = 1;

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.database.status).toBe('connected');
  });

  test('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 400 for invalid JSON request bodies', async () => {
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"invalid":');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('liveness succeeds when the database is disconnected', async () => {
    const response = await request(app).get('/api/health/live');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('alive');
  });

  test('readiness returns 503 when the database is disconnected', async () => {
    const response = await request(app).get('/api/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.data.status).toBe('not_ready');
  });

  test('readiness returns 200 when the database is connected', async () => {
    mongoose.connection.readyState = 1;

    const response = await request(app).get('/api/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ready');
  });
});
