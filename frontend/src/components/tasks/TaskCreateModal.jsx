import React, { useState } from 'react';

export function TaskCreateModal({
  isOpen,
  onClose,
  onSubmit,
  memberIds = [],
  memberNames = {},
  isSubmitting = false,
  error = null
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [clientErrors, setClientErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (!title.trim()) {
      errors.title = 'Title is required.';
    } else if (title.trim().length > 200) {
      errors.title = 'Title cannot exceed 200 characters.';
    }

    if (description && description.trim().length > 2000) {
      errors.description = 'Description cannot exceed 2000 characters.';
    }

    if (!deadline) {
      errors.deadline = 'Deadline is required.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      deadline
    };

    if (assigneeId) {
      payload.assigneeId = assigneeId;
    }

    onSubmit(payload);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="task-create-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Create New Task</h3>
          <button type="button" className="btn-close" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" role="alert" data-testid="modal-error">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="create-title">
                Title <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="create-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Implement user registration"
                className={`form-input ${clientErrors.title ? 'is-invalid' : ''}`}
                data-testid="create-title-input"
              />
              {clientErrors.title && <small className="text-danger">{clientErrors.title}</small>}
            </div>

            <div className="form-group">
              <label htmlFor="create-description">Description</label>
              <textarea
                id="create-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Provide task details, acceptance criteria, or context..."
                className={`form-input ${clientErrors.description ? 'is-invalid' : ''}`}
                data-testid="create-desc-input"
              />
              {clientErrors.description && <small className="text-danger">{clientErrors.description}</small>}
            </div>

            <div className="form-row">
              <div className="form-group col">
                <label htmlFor="create-priority">
                  Priority <span className="text-danger">*</span>
                </label>
                <select
                  id="create-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="form-input"
                  data-testid="create-priority-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group col">
                <label htmlFor="create-deadline">
                  Deadline <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  id="create-deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={`form-input ${clientErrors.deadline ? 'is-invalid' : ''}`}
                  data-testid="create-deadline-input"
                />
                {clientErrors.deadline && <small className="text-danger">{clientErrors.deadline}</small>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="create-assignee">Assignee (Eligible Project Members)</label>
              <select
                id="create-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="form-input"
                data-testid="create-assignee-select"
              >
                <option value="">Unassigned</option>
                {memberIds.map((mId) => {
                  const idStr = String(mId);
                  const name = memberNames[idStr] || `Member (${idStr.slice(-4)})`;
                  return (
                    <option key={idStr} value={idStr}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <small className="form-help">
                Only active members of this project can be assigned.
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              data-testid="create-submit-btn"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
