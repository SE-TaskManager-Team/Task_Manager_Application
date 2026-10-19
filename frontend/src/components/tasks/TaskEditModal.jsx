import React, { useState, useEffect } from 'react';

export function TaskEditModal({
  isOpen,
  onClose,
  onSubmit,
  task,
  isSubmitting = false,
  error = null
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      // Format deadline to YYYY-MM-DD for date input
      if (task.deadline) {
        try {
          const d = new Date(task.deadline);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(d.getUTCDate()).padStart(2, '0');
          setDeadline(`${yyyy}-${mm}-${dd}`);
        } catch (_e) {
          setDeadline('');
        }
      } else {
        setDeadline('');
      }
      setClientErrors({});
    }
  }, [task]);

  if (!isOpen || !task) return null;

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

    onSubmit(payload);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="task-edit-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Edit Task Details</h3>
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
              <label htmlFor="edit-title">
                Title <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className={`form-input ${clientErrors.title ? 'is-invalid' : ''}`}
                data-testid="edit-title-input"
              />
              {clientErrors.title && <small className="text-danger">{clientErrors.title}</small>}
            </div>

            <div className="form-group">
              <label htmlFor="edit-description">Description</label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Task description..."
                className={`form-input ${clientErrors.description ? 'is-invalid' : ''}`}
                data-testid="edit-desc-input"
              />
              {clientErrors.description && <small className="text-danger">{clientErrors.description}</small>}
            </div>

            <div className="form-row">
              <div className="form-group col">
                <label htmlFor="edit-priority">
                  Priority <span className="text-danger">*</span>
                </label>
                <select
                  id="edit-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="form-input"
                  data-testid="edit-priority-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group col">
                <label htmlFor="edit-deadline">
                  Deadline <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  id="edit-deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={`form-input ${clientErrors.deadline ? 'is-invalid' : ''}`}
                  data-testid="edit-deadline-input"
                />
                {clientErrors.deadline && <small className="text-danger">{clientErrors.deadline}</small>}
              </div>
            </div>

            <div className="protected-fields-note">
              <small className="text-muted">
                ℹ️ Status and assignment changes are managed separately via dedicated action buttons per system requirements.
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
              data-testid="edit-submit-btn"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
