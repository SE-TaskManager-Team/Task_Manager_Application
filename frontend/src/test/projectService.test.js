import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { projectService } from '../services/projectService';

describe('projectService API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getProjects fetches /api/projects with Authorization header', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [{ _id: 'proj-1', name: 'Alpha' }], total: 1, page: 1, pages: 1 }
      })
    });

    const result = await projectService.getProjects('mock-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token'
        })
      })
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Alpha');
  });

  it('getProjectById fetches /api/projects/:id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { project: { _id: 'proj-1', name: 'Alpha' } }
      })
    });

    const result = await projectService.getProjectById('proj-1', 'mock-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects/proj-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token'
        })
      })
    );
    expect(result.project.name).toBe('Alpha');
  });

  it('createProject sends POST /api/projects with payload and Authorization header', async () => {
    const newProject = {
      _id: 'proj-new',
      name: 'Modern Project',
      description: 'Project details',
      deadline: '2026-12-31T00:00:00.000Z',
      teamLeaderId: 'leader-1',
      memberIds: []
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: { project: newProject }
      })
    });

    const payload = {
      name: 'Modern Project',
      description: 'Project details',
      deadline: '2026-12-31'
    };

    const result = await projectService.createProject(payload, 'mock-jwt-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token'
        }),
        body: JSON.stringify(payload)
      })
    );
    expect(result.project).toEqual(newProject);
  });

  it('createProject throws error on validation failure from API', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project name must be between 2 and 120 characters.'
        }
      })
    });

    await expect(
      projectService.createProject({ name: 'A', deadline: '2026-12-31' }, 'token-123')
    ).rejects.toThrow('Project name must be between 2 and 120 characters.');
  });

  it('createProject throws error on forbidden authorization failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Your role is not permitted to perform this operation.'
        }
      })
    });

    await expect(
      projectService.createProject({ name: 'Valid Project', deadline: '2026-12-31' }, 'token-member')
    ).rejects.toThrow('Your role is not permitted to perform this operation.');
  });

  it('createProject handles non-JSON network/server errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Not JSON');
      }
    });

    await expect(
      projectService.createProject({ name: 'Valid Project', deadline: '2026-12-31' }, 'token-123')
    ).rejects.toThrow('Request failed with status 502');
  });

  it('addMember sends POST /api/projects/:id/members with userId and token', async () => {
    const updatedProject = {
      _id: 'proj-123',
      name: 'Alpha Project',
      memberIds: ['user-bob']
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { project: updatedProject }
      })
    });

    const result = await projectService.addMember('proj-123', 'user-bob', 'jwt-leader-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects/proj-123/members',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-leader-token'
        }),
        body: JSON.stringify({ userId: 'user-bob' })
      })
    );
    expect(result.project).toEqual(updatedProject);
  });

  it('removeMember sends DELETE /api/projects/:id/members/:userId with token', async () => {
    const updatedProject = {
      _id: 'proj-123',
      name: 'Alpha Project',
      memberIds: []
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { project: updatedProject }
      })
    });

    const result = await projectService.removeMember('proj-123', 'user-bob', 'jwt-leader-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects/proj-123/members/user-bob',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-leader-token'
        })
      })
    );
    expect(result.project).toEqual(updatedProject);
  });

  it('getProjectProgress fetches /api/projects/:id/progress with Authorization header', async () => {
    const mockProgress = {
      projectId: 'proj-123',
      totalTasks: 4,
      completedTasks: 2,
      inProgressTasks: 1,
      pendingTasks: 1,
      progress: 50
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockProgress
      })
    });

    const result = await projectService.getProjectProgress('proj-123', 'jwt-user-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects/proj-123/progress',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-user-token'
        })
      })
    );
    expect(result).toEqual(mockProgress);
  });

  it('getProjectProgress handles server failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found.'
        }
      })
    });

    await expect(
      projectService.getProjectProgress('nonexistent-id', 'jwt-user-token')
    ).rejects.toThrow('Project not found.');
  });
});
