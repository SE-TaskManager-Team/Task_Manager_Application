
jest.mock('mongoose', () => ({
  connect: jest.fn()
}));

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');

describe('Database connection tests', () => {
  const originalUri = process.env.MONGODB_URI;

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    if (originalUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalUri;
    }
  });

  test('connects using the configured MongoDB URI', async () => {
    const connection = { mocked: true };
    process.env.MONGODB_URI =
      'mongodb://localhost:27017/task_manager_test';

    mongoose.connect.mockResolvedValue(connection);

    const result = await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017/task_manager_test'
    );
    expect(result).toBe(connection);
  });

  test('exits with code 1 when the connection fails', async () => {
    mongoose.connect.mockRejectedValue(
      new Error('Connection failed')
    );

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => {});

    await connectDB();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

