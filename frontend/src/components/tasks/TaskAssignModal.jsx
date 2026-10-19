import React, { useState, useEffect } from 'react';

export function TaskAssignModal({
  isOpen,
  onClose,
  onSubmit,
  task,
  memberIds = [],
  memberNames = {},
  isSubmitting = false,
  error = null
}) {
  const [selectedAssignee, setSelectedAssignee] = useState('');

  useEffect(() => {
    if (task) {
      setSelectedAssignee(task.assigneeId ? String(task.assigneeId) : '');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // If empty string selected, pass null for unassignment
    const assigneePayload = selectedAssignee ? selectedAssignee : null;
    onSubmit(assigneePayload);
  };

  const currentAssigneeLabel = task.assigneeId
    ? memberNames[String(task.assigneeId)] || `Member (${String(task.assigneeId).slice(-4)})`
    : 'Unassigned';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="task-assign-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Task Assignment</h3>
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

            <p>
              Task: <strong>{task.title}</strong>
            </p>
            <p className="text-muted">
              Current Assignee: <strong>{currentAssigneeLabel}</strong>
            </p>

            <div className="form-group">
              <label htmlFor="assign-select">
                Select Assignee <span className="text-danger">*</span>
              </label>
              <select
                id="assign-select"
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="form-input"
                data-testid="assign-select"
              >
                <option value="">Unassigned (No Assignee)</option>
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
            </div>

            <div className="alert alert-info">
              <small>
                🔔 Assigning this task to a member will trigger an in-app notification to the assigned user. Unassigning will revert the task without sending a notification.
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
              data-testid="assign-submit-btn"
            >
              {isSubmitting ? 'Updating...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
