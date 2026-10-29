import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { notificationService } from '../services/notificationService';

describe('notificationService', () => {
  const token = 'test-token-123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getNotifications calls GET /api/notifications with auth headers', async () => {
    const mockData = {
      items: [
        { _id: 'notif-1', message: 'Task assigned', isRead: false }
      ],
      total: 1,
      unreadCount: 1,
      page: 1,
      pages: 1
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData })
    });

    const result = await notificationService.getNotifications(token, 1, 20);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/notifications?page=1&limit=20',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`
        })
      })
    );
    expect(result).toEqual(mockData);
  });

  it('markAsRead calls PATCH /api/notifications/:id/read', async () => {
    const mockUpdated = { _id: 'notif-1', isRead: true };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { notification: mockUpdated } })
    });

    const result = await notificationService.markAsRead('notif-1', token);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/notifications/notif-1/read',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`
        })
      })
    );
    expect(result.notification).toEqual(mockUpdated);
  });

  it('markAllAsRead calls PATCH /api/notifications/read-all', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { message: 'All notifications marked as read.' } })
    });

    const result = await notificationService.markAllAsRead(token);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/notifications/read-all',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`
        })
      })
    );
    expect(result.message).toBe('All notifications marked as read.');
  });

  it('throws an error with message when server response fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this notification.' }
      })
    });

    await expect(notificationService.markAsRead('forbidden-id', token)).rejects.toThrow(
      'You do not have permission to access this notification.'
    );
  });
});
