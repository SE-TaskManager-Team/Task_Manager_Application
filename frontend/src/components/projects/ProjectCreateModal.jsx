import React, { useState, useEffect } from 'react';

export const isValidDeadline = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function ProjectCreateForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  error = null,
  currentUser = null
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [clientErrors, setClientErrors] = useState({});

  if (currentUser && currentUser.role !== 'teamLeader') {
    return (
      <div
        className="alert alert-error"
        role="alert"
        data-testid="project-create-unauthorized"
      >
        Only team leaders are authorized to create projects.
      </div>
    );
  }

  const validate = () => {
    const errors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errors.name = 'Project name is required.';
    } else if (trimmedName.length < 2 || trimmedName.length > 120) {
      errors.name = 'Project name must be between 2 and 120 characters.';
    }

    if (description && description.trim().length > 2000) {
      errors.description = 'Project description must not exceed 2000 characters.';
    }

    if (!deadline) {
      errors.deadline = 'Deadline is required.';
    } else if (!isValidDeadline(deadline)) {
      errors.deadline = 'Deadline must be a valid date in YYYY-MM-DD format.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      deadline: deadline.trim()
    });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="project-create-form">
      <div className="modal-body">
        {error && (
          <div
            className="alert alert-error"
            role="alert"
            data-testid="project-create-error"
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="project-name">
            Project Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Website Modernization"
            className={`form-input ${clientErrors.name ? 'is-invalid' : ''}`}
            data-testid="project-name-input"
          />
          {clientErrors.name && (
            <small
              className="text-danger"
              data-testid="project-name-error"
            >
              {clientErrors.name}
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Provide project objectives, milestones, or context..."
            className={`form-input ${clientErrors.description ? 'is-invalid' : ''}`}
            data-testid="project-description-input"
          />
          {clientErrors.description && (
            <small
              className="text-danger"
              data-testid="project-description-error"
            >
              {clientErrors.description}
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="project-deadline">
            Deadline <span className="text-danger">*</span>
          </label>
          <input
            type="date"
            id="project-deadline"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={`form-input ${clientErrors.deadline ? 'is-invalid' : ''}`}
            data-testid="project-deadline-input"
          />
          {clientErrors.deadline && (
            <small
              className="text-danger"
              data-testid="project-deadline-error"
            >
              {clientErrors.deadline}
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
            data-testid="project-cancel-btn"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          data-testid="project-submit-btn"
        >
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}

export function ProjectCreateModal({
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
      data-testid="project-create-modal"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3>Create New Project</h3>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="project-modal-close-btn"
          >
            ✕
          </button>
        </div>

        <ProjectCreateForm
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
