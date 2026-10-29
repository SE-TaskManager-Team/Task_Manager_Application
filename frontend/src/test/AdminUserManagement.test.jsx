import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AdminUserManagement } from '../components/admin/AdminUserManagement';
import { userService } from '../services/userService';

describe('AdminUserManagement Component', () => {
  const adminUser = {
    _id: 'admin-1',
    name: 'Admin Alice',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true
  };

  const memberUser = {
    _id: 'member-1',
    name: 'Member Bob',
    email: 'bob@example.com',
    role: 'teamMember',
    isActive: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders clearly visible "+ Create User" button and users table', async () => {
    vi.spyOn(userService, 'getUsers').mockResolvedValue({
      items: [adminUser, memberUser],
      total: 2
    });

    render(<AdminUserManagement token="admin-token" currentUser={adminUser} />);

    expect(screen.getByTestId('create-user-btn')).toBeInTheDocument();
    expect(screen.getByText('+ Create User')).toBeInTheDocument();

    expect(await screen.findByText('Member Bob')).toBeInTheDocument();
    expect(screen.getByText('Admin Alice (you)')).toBeInTheDocument();
  });

  it('opens UserCreateModal when "+ Create User" button is clicked', async () => {
    vi.spyOn(userService, 'getUsers').mockResolvedValue({
      items: [adminUser],
      total: 1
    });

    render(<AdminUserManagement token="admin-token" currentUser={adminUser} />);

    await screen.findByText('Admin Alice (you)');

    expect(screen.queryByTestId('user-create-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('create-user-btn'));

    expect(await screen.findByTestId('user-create-modal')).toBeInTheDocument();
    expect(screen.getByTestId('user-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-role-select')).toBeInTheDocument();
  });

  it('successfully creates a user, refreshes user list, and shows success message', async () => {
    const createdUser = {
      _id: 'user-new',
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      role: 'teamLeader',
      isActive: true
    };

    const getUsersMock = vi.spyOn(userService, 'getUsers')
      .mockResolvedValueOnce({ items: [adminUser], total: 1 })
      .mockResolvedValueOnce({ items: [adminUser, createdUser], total: 2 });

    const createUserMock = vi.spyOn(userService, 'createUser').mockResolvedValue({
      user: createdUser
    });

    render(<AdminUserManagement token="admin-token" currentUser={adminUser} />);

    await screen.findByText('Admin Alice (you)');

    // Click "+ Create User"
    fireEvent.click(screen.getByTestId('create-user-btn'));
    expect(await screen.findByTestId('user-create-modal')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByTestId('user-name-input'), {
      target: { value: 'Charlie Brown' }
    });
    fireEvent.change(screen.getByTestId('user-email-input'), {
      target: { value: 'charlie@example.com' }
    });
    fireEvent.change(screen.getByTestId('user-password-input'), {
      target: { value: 'TemporaryPassword123!' }
    });
    fireEvent.change(screen.getByTestId('user-role-select'), {
      target: { value: 'teamLeader' }
    });

    // Submit
    fireEvent.click(screen.getByTestId('user-submit-btn'));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith('admin-token', {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        password: 'TemporaryPassword123!',
        role: 'teamLeader'
      });
    });

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('user-create-modal')).not.toBeInTheDocument();
    });

    // Users list is refreshed
    expect(getUsersMock).toHaveBeenCalledTimes(2);

    // Success message is displayed
    expect(await screen.findByText(/User Charlie Brown created successfully/i)).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('displays error in modal if user creation fails (e.g. duplicate email)', async () => {
    vi.spyOn(userService, 'getUsers').mockResolvedValue({
      items: [adminUser],
      total: 1
    });

    vi.spyOn(userService, 'createUser').mockRejectedValue(
      new Error('An account with this email already exists.')
    );

    render(<AdminUserManagement token="admin-token" currentUser={adminUser} />);

    await screen.findByText('Admin Alice (you)');

    fireEvent.click(screen.getByTestId('create-user-btn'));
    expect(await screen.findByTestId('user-create-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('user-name-input'), {
      target: { value: 'Existing User' }
    });
    fireEvent.change(screen.getByTestId('user-email-input'), {
      target: { value: 'existing@example.com' }
    });
    fireEvent.change(screen.getByTestId('user-password-input'), {
      target: { value: 'Password123!' }
    });

    fireEvent.click(screen.getByTestId('user-submit-btn'));

    expect(await screen.findByTestId('user-create-error')).toHaveTextContent(
      'An account with this email already exists.'
    );
    // Modal stays open so admin can fix input
    expect(screen.getByTestId('user-create-modal')).toBeInTheDocument();
  });

  it('preserves existing role change functionality', async () => {
    vi.spyOn(userService, 'getUsers').mockResolvedValue({
      items: [adminUser, memberUser],
      total: 2
    });

    const updateUserMock = vi.spyOn(userService, 'updateUser').mockResolvedValue({
      user: { ...memberUser, role: 'teamLeader' }
    });

    render(<AdminUserManagement token="admin-token" currentUser={adminUser} />);

    await screen.findByText('Member Bob');

    const select = screen.getByLabelText('Role for Member Bob');
    fireEvent.change(select, { target: { value: 'teamLeader' } });

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith('admin-token', 'member-1', {
        role: 'teamLeader'
      });
    });

    expect(await screen.findByText('Updated role for Member Bob.')).toBeInTheDocument();
  });

  it('preserves existing deactivation functionality', async () => {
    vi.spyOn(userService, 'getUsers').mockResolvedValue({
      items: [adminUser, memberUser],
      total: 2
    });

    const deactivateMock = vi.spyOn(userService, 'deactivateUser').mockResolvedValue({
      user: { ...memberUser, isActive: false }
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AdminUserManagement token="admin-token" currentUser={adminUser} />);

    await screen.findByText('Member Bob');

    const deactivateBtn = screen.getByRole('button', { name: /deactivate member bob/i });
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(deactivateMock).toHaveBeenCalledWith('admin-token', 'member-1');
    });

    expect(await screen.findByText('Deactivated Member Bob.')).toBeInTheDocument();
  });
});
