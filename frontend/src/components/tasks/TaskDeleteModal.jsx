import React from 'react';

export function TaskDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  task,
  isSubmitting = false,
  error = null
}) {
  if (!isOpen || !task) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="task-delete-modal">
      <div className="modal-content modal-danger">
        <div className="modal-header">
          <h3 className="text-danger">Delete Task</h3>
          <button type="button" className="btn-close" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error" role="alert" data-testid="modal-error">
              {error}
            </div>
          )}

          <p>
            Are you sure you want to delete task <strong>"{task.title}"</strong>?
          </p>

          <div className="alert alert-warning">
            ⚠️ <strong>Warning:</strong> Deleting this task will permanently remove the task and all associated comments and notifications. This action cannot be undone.
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
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid="delete-confirm-btn"
          >
            {isSubmitting ? 'Deleting...' : 'Yes, Delete Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
