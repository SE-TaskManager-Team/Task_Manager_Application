import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { dashboardService } from '../services/dashboardService';

describe('dashboardService (TM-F-019)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches dashboard data with Bearer authorization header', async () => {
    const mockData = {
      role: 'teamLeader',
      summary: {
        totalProjects: 2,
        totalTasks: 10,
        completedTasks: 4,
        inProgressTasks: 3,
        todoTasks: 3,
        overdueTasks: 1,
        completionPercentage: 40
      },
      projects: [],
      upcomingTasks: []
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockData })
    });

    const result = await dashboardService.getDashboardData('my-jwt-token');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/dashboard$/),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer my-jwt-token'
        }
      }
    );
    expect(result).toEqual(mockData);
  });

  it('throws structured error on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token is expired or invalid' }
      })
    });

    await expect(dashboardService.getDashboardData('bad-token')).rejects.toThrow(
      'Token is expired or invalid'
    );
  });

  it('throws fallback error when json parsing fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Not JSON');
      }
    });

    await expect(dashboardService.getDashboardData('token')).rejects.toThrow(
      'Request failed with status 500'
    );
  });
});
