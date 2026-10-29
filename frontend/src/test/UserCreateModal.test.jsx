import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserCreateModal, UserCreateForm } from '../components/admin/UserCreateModal';

describe('UserCreateModal & UserCreateForm', () => {
  const adminUser = {
    _id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin'
  };

  const nonAdminUser = {
    _id: 'leader-1',
    name: 'Team Leader',
    email: 'leader@example.com',
    role: 'teamLeader'
  };

  it('renders all form fields when open for admin', () => {
    render(
      <UserCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        currentUser={adminUser}
      />
    );

    expect(screen.getByTestId('user-create-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create new user/i })).toBeInTheDocument();
    expect(screen.getByTestId('user-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-role-select')).toBeInTheDocument();
    expect(screen.getByTestId('user-submit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('user-cancel-btn')).toBeInTheDocument();
  });

  it('renders unauthorized message when non-admin opens form', () => {
    render(
      <UserCreateForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        currentUser={nonAdminUser}
      />
    );

    expect(screen.getByTestId('user-create-unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('user-name-input')).not.toBeInTheDocument();
  });

  it('validates required fields: empty name, email, and password', () => {
    const handleSubmit = vi.fn();
    render(
      <UserCreateForm
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
        currentUser={adminUser}
      />
    );

    fireEvent.click(screen.getByTestId('user-submit-btn'));

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('user-name-error')).toHaveTextContent(/name is required/i);
    expect(screen.getByTestId('user-email-error')).toHaveTextContent(/email is required/i);
    expect(screen.getByTestId('user-password-error')).toHaveTextContent(/password is required/i);
  });

  it('validates name length between 2 and 80 characters', () => {
    const handleSubmit = vi.fn();
    render(
      <UserCreateForm
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
        currentUser={adminUser}
      />
    );

    fireEvent.change(screen.getByTestId('user-name-input'), { target: { value: 'A' } });
    fireEvent.change(screen.getByTestId('user-email-input'), { target: { value: 'valid@example.com' } });
    fireEvent.change(screen.getByTestId('user-password-input'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('user-submit-btn'));

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('user-name-error')).toHaveTextContent(/between 2 and 80 characters/i);
  });

  it('validates email format', () => {
    const handleSubmit = vi.fn();
    render(
      <UserCreateForm
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
        currentUser={adminUser}
      />
    );

    fireEvent.change(screen.getByTestId('user-name-input'), { target: { value: 'Valid Name' } });
    fireEvent.change(screen.getByTestId('user-email-input'), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByTestId('user-password-input'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('user-submit-btn'));

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('user-email-error')).toHaveTextContent(/valid email address is required/i);
  });

  it('validates password length of at least 8 characters', () => {
    const handleSubmit = vi.fn();
    render(
      <UserCreateForm
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
        currentUser={adminUser}
      />
    );

    fireEvent.change(screen.getByTestId('user-name-input'), { target: { value: 'Valid Name' } });
    fireEvent.change(screen.getByTestId('user-email-input'), { target: { value: 'valid@example.com' } });
    fireEvent.change(screen.getByTestId('user-password-input'), { target: { value: '12345' } });
    fireEvent.click(screen.getByTestId('user-submit-btn'));

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('user-password-error')).toHaveTextContent(/between 8 and 128 characters/i);
  });

  it('submits valid user payload with specified role', () => {
    const handleSubmit = vi.fn();
    render(
      <UserCreateForm
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
        currentUser={adminUser}
      />
    );

    fireEvent.change(screen.getByTestId('user-name-input'), { target: { value: ' Alice Smith ' } });
    fireEvent.change(screen.getByTestId('user-email-input'), { target: { value: ' ALICE@Example.com ' } });
    fireEvent.change(screen.getByTestId('user-password-input'), { target: { value: 'SecretP@ss123' } });
    fireEvent.change(screen.getByTestId('user-role-select'), { target: { value: 'teamLeader' } });

    fireEvent.click(screen.getByTestId('user-submit-btn'));

    expect(handleSubmit).toHaveBeenCalledWith({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'SecretP@ss123',
      role: 'teamLeader'
    });
  });

  it('displays error message from backend when error prop is passed', () => {
    render(
      <UserCreateForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        error="An account with this email already exists."
        currentUser={adminUser}
      />
    );

    expect(screen.getByTestId('user-create-error')).toHaveTextContent(
      'An account with this email already exists.'
    );
  });

  it('triggers onCancel when Cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(
      <UserCreateModal
        isOpen={true}
        onClose={handleCancel}
        onSubmit={vi.fn()}
        currentUser={adminUser}
      />
    );

    fireEvent.click(screen.getByTestId('user-cancel-btn'));
    expect(handleCancel).toHaveBeenCalled();
  });

  it('triggers onClose when Close button (✕) is clicked', () => {
    const handleClose = vi.fn();
    render(
      <UserCreateModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={vi.fn()}
        currentUser={adminUser}
      />
    );

    fireEvent.click(screen.getByTestId('user-modal-close-btn'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    render(
      <UserCreateModal
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        currentUser={adminUser}
      />
    );

    expect(screen.queryByTestId('user-create-modal')).not.toBeInTheDocument();
  });
});
