const mongoose = require('mongoose');
const Task = require('../src/models/Task');

describe('Task Model Test', () => {
  // Utility to create a base valid task
  const createValidTaskData = () => ({
    title: 'Valid Task',
    description: 'This is a valid task',
    priority: 'medium',
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day in the future
    projectId: new mongoose.Types.ObjectId(),
    createdById: new mongoose.Types.ObjectId(),
  });

  test('A valid task has the expected fields and default status todo', () => {
    const taskData = createValidTaskData();
    const task = new Task(taskData);
    const err = task.validateSync();

    expect(err).toBeUndefined();
    expect(task.title).toBe(taskData.title);
    expect(task.description).toBe(taskData.description);
    expect(task.priority).toBe(taskData.priority);
    expect(task.deadline).toEqual(taskData.deadline);
    expect(task.projectId).toEqual(taskData.projectId);
    expect(task.createdById).toEqual(taskData.createdById);
    expect(task.status).toBe('todo'); // Default status
  });

  test('Missing required fields fail validation', () => {
    const task = new Task({});
    const err = task.validateSync();

    expect(err).toBeDefined();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.priority).toBeDefined();
    expect(err.errors.deadline).toBeDefined();
    expect(err.errors.projectId).toBeDefined();
    expect(err.errors.createdById).toBeDefined();
  });

  test('Invalid priority values fail validation', () => {
    const taskData = createValidTaskData();
    taskData.priority = 'super-high'; // Invalid

    const task = new Task(taskData);
    const err = task.validateSync();

    expect(err).toBeDefined();
    expect(err.errors.priority).toBeDefined();
  });

  test('Invalid status values fail validation', () => {
    const taskData = createValidTaskData();
    taskData.status = 'done'; // Invalid

    const task = new Task(taskData);
    const err = task.validateSync();

    expect(err).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });

  test('assigneeId can be null', () => {
    const taskData = createValidTaskData();
    taskData.assigneeId = null;

    const task = new Task(taskData);
    const err = task.validateSync();

    expect(err).toBeUndefined();
    expect(task.assigneeId).toBeNull();
  });

  test('The isOverdue virtual is true when the deadline is in the past and the task is not completed', () => {
    const taskData = createValidTaskData();
    taskData.deadline = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day in the past
    taskData.status = 'inProgress';

    const task = new Task(taskData);
    expect(task.isOverdue).toBe(true);
  });

  test('The isOverdue virtual is false when the status is completed, even if the deadline is in the past', () => {
    const taskData = createValidTaskData();
    taskData.deadline = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day in the past
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
