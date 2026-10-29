import React, { useState } from 'react';

export const USER_ROLES = [
  { value: 'teamMember', label: 'Team Member' },
  { value: 'teamLeader', label: 'Team Leader' },
  { value: 'admin', label: 'Admin' }
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UserCreateForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  error = null,
  currentUser = null
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teamMember');
  const [clientErrors, setClientErrors] = useState({});

  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div
        className="alert alert-error"
        role="alert"
        data-testid="user-create-unauthorized"
      >
        Only administrators are authorized to create users.
      </div>
    );
  }

  const validate = () => {
    const errors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      errors.name = 'Name is required.';
    } else if (trimmedName.length < 2 || trimmedName.length > 80) {
      errors.name = 'Name must be between 2 and 80 characters.';
    }

    if (!trimmedEmail) {
      errors.email = 'Email is required.';
    } else if (!emailPattern.test(trimmedEmail) || trimmedEmail.length > 254) {
      errors.email = 'A valid email address is required.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8 || password.length > 128) {
      errors.password = 'Password must be between 8 and 128 characters.';
    }

    if (!['admin', 'teamLeader', 'teamMember'].includes(role)) {
      errors.role = 'Role must be Admin, Team Leader, or Team Member.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate data-testid="user-create-form">
      <div className="modal-body">
        {error && (
          <div
            className="alert alert-error"
            role="alert"
            data-testid="user-create-error"
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="user-name">
            Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Jane Doe"
            className={`form-input ${clientErrors.name ? 'is-invalid' : ''}`}
            data-testid="user-name-input"
          />
          {clientErrors.name && (
            <small className="text-danger" data-testid="user-name-error">
              {clientErrors.name}
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="user-email">
            Email <span className="text-danger">*</span>
          </label>
          <input
            type="email"
            id="user-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            placeholder="e.g. jane@example.com"
            className={`form-input ${clientErrors.email ? 'is-invalid' : ''}`}
            data-testid="user-email-input"
          />
          {clientErrors.email && (
            <small className="text-danger" data-testid="user-email-error">
              {clientErrors.email}
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="user-password">
            Password or Temporary Password <span className="text-danger">*</span>
          </label>
          <input
            type="password"
            id="user-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={128}
            placeholder="At least 8 characters"
            className={`form-input ${clientErrors.password ? 'is-invalid' : ''}`}
            data-testid="user-password-input"
          />
          {clientErrors.password && (
            <small className="text-danger" data-testid="user-password-error">
              {clientErrors.password}
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="user-role">
            Role <span className="text-danger">*</span>
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`form-input ${clientErrors.role ? 'is-invalid' : ''}`}
            data-testid="user-role-select"
          >
            <option value="teamMember">Team Member</option>
            <option value="teamLeader">Team Leader</option>
            <option value="admin">Admin</option>
          </select>
          {clientErrors.role && (
            <small className="text-danger" data-testid="user-role-error">
              {clientErrors.role}
            </small>
          )}
        </div>
      </div>

      <div className="modal-footer">
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="user-cancel-btn"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          data-testid="user-submit-btn"
        >
          {isSubmitting ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </form>
  );
}

export function UserCreateModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  error = null,
  currentUser = null
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid="user-create-modal"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3>Create New User</h3>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="user-modal-close-btn"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <UserCreateForm
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          error={error}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
