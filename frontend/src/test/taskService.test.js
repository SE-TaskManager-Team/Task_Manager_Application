import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { taskService } from '../services/taskService';

describe('taskService API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getProjectTasks builds correct URL with query parameters and Authorization header', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [], total: 0, page: 1, pages: 1 }
      })
    });

    const result = await taskService.getProjectTasks(
      'proj-123',
      { status: 'todo', priority: 'high', page: 2, limit: 10, sortBy: 'deadline', order: 'asc' },
      'mock-jwt-token'
    );

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects/proj-123/tasks?page=2&limit=10&status=todo&priority=high&sortBy=deadline&order=asc',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-jwt-token'
        })
      })
    );
    expect(result.items).toEqual([]);
  });

  it('getTaskById fetches /api/tasks/:id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { task: { _id: 'task-1', title: 'Task One' } }
      })
    });

    const result = await taskService.getTaskById('task-1', 'mock-jwt-token');
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/task-1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.task.title).toBe('Task One');
  });

  it('getMyTasks fetches /api/tasks/my', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [{ _id: 't-1' }], total: 1 }
      })
    });

    const result = await taskService.getMyTasks({ page: 1, limit: 20 }, 'mock-jwt-token');
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/my?page=1&limit=20',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.total).toBe(1);
  });

  it('createTask posts to /api/projects/:projectId/tasks', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: { task: { _id: 't-created', title: 'Created Task' } }
      })
    });

    const taskPayload = {
      title: 'Created Task',
      description: 'Desc',
      priority: 'medium',
      deadline: '2026-11-01',
      assigneeId: 'user-2'
    };

    const result = await taskService.createTask('proj-1', taskPayload, 'token-abc');
    expect(fetch).toHaveBeenCalledWith(
      '/api/projects/proj-1/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(taskPayload)
      })
    );
    expect(result.task._id).toBe('t-created');
  });

  it('updateTask puts to /api/tasks/:id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { task: { _id: 'task-1', title: 'Updated Title' } }
      })
    });

    const updatePayload = { title: 'Updated Title', priority: 'high' };
    const result = await taskService.updateTask('task-1', updatePayload, 'token-abc');

    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/task-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      })
    );
    expect(result.task.title).toBe('Updated Title');
  });

  it('deleteTask sends DELETE to /api/tasks/:id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { message: 'Task deleted.' }
      })
    });

    const result = await taskService.deleteTask('task-1', 'token-abc');
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/task-1',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(result.message).toBe('Task deleted.');
  });

  it('updateTaskStatus sends PATCH to /api/tasks/:id/status', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { task: { _id: 'task-1', status: 'inProgress' } }
      })
    });

    const result = await taskService.updateTaskStatus('task-1', 'inProgress', 'token-abc');
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/task-1/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'inProgress' })
      })
    );
    expect(result.task.status).toBe('inProgress');
  });

  it('assignTask sends PATCH to /api/tasks/:id/assign', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { task: { _id: 'task-1', assigneeId: 'user-xyz' } }
      })
    });

    const result = await taskService.assignTask('task-1', 'user-xyz', 'token-abc');
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/task-1/assign',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ assigneeId: 'user-xyz' })
      })
    );
    expect(result.task.assigneeId).toBe('user-xyz');
  });

  it('throws structured error with code and status when backend returns failure envelope', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: 'INVALID_ASSIGNEE',
          message: 'Assignee must be an active member of this project.'
        }
      })
    });

    await expect(
      taskService.assignTask('task-1', 'non-member-id', 'token-abc')
    ).rejects.toMatchObject({
      message: 'Assignee must be an active member of this project.',
      code: 'INVALID_ASSIGNEE',
      status: 400
    });
  });
});
