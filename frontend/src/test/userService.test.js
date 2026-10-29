import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { userService } from '../services/userService';

describe('userService API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getUsers fetches /api/users?limit=100 with Authorization header', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [{ _id: 'u-1', name: 'Alice', email: 'alice@example.com' }], total: 1 }
      })
    });

    const result = await userService.getUsers('mock-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/users?limit=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token'
        })
      })
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Alice');
  });

  it('updateUser sends PUT to /api/users/:id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { user: { _id: 'u-1', role: 'teamLeader' } }
      })
    });

    const result = await userService.updateUser('mock-token', 'u-1', { role: 'teamLeader' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/u-1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({ role: 'teamLeader' })
      })
    );
    expect(result.user.role).toBe('teamLeader');
  });

  it('deactivateUser sends PATCH to /api/users/:id/deactivate', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { user: { _id: 'u-1', isActive: false } }
      })
    });

    const result = await userService.deactivateUser('mock-token', 'u-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/u-1/deactivate',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token'
        })
      })
    );
    expect(result.user.isActive).toBe(false);
  });

  it('createUser sends POST to /api/users with payload and Authorization header', async () => {
    const newUser = {
      name: 'Bob Builder',
      email: 'bob@example.com',
      password: 'SecurePassword123!',
      role: 'teamMember'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            _id: 'u-2',
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            isActive: true
          }
        }
      })
    });

    const result = await userService.createUser('mock-token', newUser);

    expect(fetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(newUser)
      })
    );
    expect(result.user._id).toBe('u-2');
    expect(result.user.name).toBe('Bob Builder');
  });

  it('createUser supports swapped argument order (userData, token)', async () => {
    const newUser = {
      name: 'Bob Builder',
      email: 'bob@example.com',
      password: 'SecurePassword123!',
      role: 'teamMember'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { user: { _id: 'u-2', name: newUser.name } }
      })
    });

    const result = await userService.createUser(newUser, 'mock-token');

    expect(fetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token'
        })
      })
    );
    expect(result.user._id).toBe('u-2');
  });

  it('createUser throws meaningful error on duplicate email (409)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          code: 'EMAIL_IN_USE',
          message: 'An account with this email already exists.'
        }
      })
    });

    await expect(
      userService.createUser('mock-token', {
        name: 'Existing User',
        email: 'exists@example.com',
        password: 'Password123!',
        role: 'teamMember'
      })
    ).rejects.toThrow('An account with this email already exists.');
  });
});
