const mongoose = require('mongoose');
const Task = require('../src/models/Task');

describe('Task Model Test', () => {
  // Utility to create a base valid task
  const createValidTaskData = () => ({
    title: 'Valid Task',
    description: 'This is a valid task',
    priority: 'medium',
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
    projectId: new mongoose.Types.ObjectId(),
    createdById: new mongoose.Types.ObjectId(),
  });

  test('A valid task has the expected fields and default status todo', async () => {
    const taskData = createValidTaskData();
    const task = new Task(taskData);
    await expect(task.validate()).resolves.toBeUndefined();

    expect(task.title).toBe(taskData.title);
    expect(task.description).toBe(taskData.description);
    expect(task.priority).toBe(taskData.priority);
    expect(task.deadline).toEqual(taskData.deadline);
    expect(task.projectId).toEqual(taskData.projectId);
    expect(task.createdById).toEqual(taskData.createdById);
    expect(task.status).toBe('todo');
  });

  test('Missing required fields fail validation', async () => {
    const task = new Task({});

    await expect(task.validate()).rejects.toMatchObject({
      errors: {
        title: expect.anything(),
        priority: expect.anything(),
        deadline: expect.anything(),
        projectId: expect.anything(),
        createdById: expect.anything(),
      },
    });
  });

  test('Invalid priority values fail validation', async () => {
    const taskData = createValidTaskData();
    taskData.priority = 'super-high';

    const task = new Task(taskData);

    await expect(task.validate()).rejects.toMatchObject({
      errors: {
        priority: expect.anything(),
      },
    });
  });

  test('Invalid status values fail validation', async () => {
    const taskData = createValidTaskData();
    taskData.status = 'done';

    const task = new Task(taskData);

    await expect(task.validate()).rejects.toMatchObject({
      errors: {
        status: expect.anything(),
      },
    });
  });

  test('assigneeId can be null', async () => {
    const taskData = createValidTaskData();
    taskData.assigneeId = null;

    const task = new Task(taskData);
    await expect(task.validate()).resolves.toBeUndefined();

    expect(task.assigneeId).toBeNull();
  });

  test('The isOverdue virtual is true when the deadline is in the past and the task is not completed', () => {
    const taskData = createValidTaskData();
    taskData.deadline = new Date(Date.now() - 1000 * 60 * 60 * 24);
    taskData.status = 'inProgress';

    const task = new Task(taskData);
    expect(task.isOverdue).toBe(true);
  });

  test('The isOverdue virtual is false when the status is completed, even if the deadline is in the past', () => {
    const taskData = createValidTaskData();
    taskData.deadline = new Date(Date.now() - 1000 * 60 * 60 * 24);
    taskData.status = 'completed';

    const task = new Task(taskData);
    expect(task.isOverdue).toBe(false);
  });

  test('The virtual is included when the document is converted to JSON', () => {
    const taskData = createValidTaskData();
    taskData.deadline = new Date(Date.now() - 1000 * 60 * 60 * 24);
    taskData.status = 'todo';

    const task = new Task(taskData);
    const taskJson = task.toJSON();

    expect(taskJson.isOverdue).toBeDefined();
    expect(taskJson.isOverdue).toBe(true);
  });

  test('stores date-only deadline string as 23:59:59.999Z', () => {
    const taskData = createValidTaskData();
    taskData.deadline = '2026-10-15';

    const task = new Task(taskData);
    expect(task.deadline).toEqual(new Date('2026-10-15T23:59:59.999Z'));
  });

  test('preserves full ISO timestamp without converting to end of day', () => {
    const taskData = createValidTaskData();
    taskData.deadline = '2026-10-15T14:30:00.000Z';

    const task = new Task(taskData);
    expect(task.deadline).toEqual(new Date('2026-10-15T14:30:00.000Z'));
  });

  test('isOverdue behavior before and after end-of-day deadline, and remains false when completed', () => {
    const taskData = createValidTaskData();
    taskData.deadline = '2026-10-15';
    taskData.status = 'todo';

    const task = new Task(taskData);

    const realDate = Date;
    try {
      // Before end of day
      global.Date = class extends realDate {
        constructor(...args) {
          if (args.length) return new realDate(...args);
          return new realDate('2026-10-15T12:00:00.000Z');
        }
      };
      expect(task.isOverdue).toBe(false);

      // Just before end of day
      global.Date = class extends realDate {
        constructor(...args) {
          if (args.length) return new realDate(...args);
          return new realDate('2026-10-15T23:59:59.998Z');
        }
      };
      expect(task.isOverdue).toBe(false);

      // After end of day
      global.Date = class extends realDate {
        constructor(...args) {
          if (args.length) return new realDate(...args);
          return new realDate('2026-10-16T00:00:00.000Z');
        }
      };
      expect(task.isOverdue).toBe(true);

      // Completed task after end of day remains false
      task.status = 'completed';
      expect(task.isOverdue).toBe(false);
    } finally {
      global.Date = realDate;
    }
  });
});