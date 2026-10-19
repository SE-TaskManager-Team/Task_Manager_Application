import React, { useState, useEffect } from 'react';
import { StatusBadge } from './TaskBadges';

export function TaskStatusModal({
  isOpen,
  onClose,
  onSubmit,
  task,
  isLeader = false,
  isAssignee = false,
  isSubmitting = false,
  error = null
}) {
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    if (task) {
      setSelectedStatus(task.status || 'todo');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  // Compute allowed transitions
  let allowedOptions = [];
  if (isLeader) {
    allowedOptions = [
      { value: 'todo', label: 'To Do' },
      { value: 'inProgress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' }
    ];
  } else if (isAssignee) {
    if (task.status === 'todo') {
      allowedOptions = [
        { value: 'todo', label: 'To Do (Current)' },
        { value: 'inProgress', label: 'In Progress (Next Step)' }
      ];
    } else if (task.status === 'inProgress') {
      allowedOptions = [
        { value: 'inProgress', label: 'In Progress (Current)' },
        { value: 'completed', label: 'Completed (Next Step)' }
      ];
    } else if (task.status === 'completed') {
      allowedOptions = [
        { value: 'completed', label: 'Completed (Final)' }
      ];
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedStatus) return;
    onSubmit(selectedStatus);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="task-status-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Update Task Status</h3>
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
            <div className="status-current-row">
              Current Status: <StatusBadge status={task.status} />
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="status-select">
                Select New Status <span className="text-danger">*</span>
              </label>
              <select
                id="status-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="form-input"
                data-testid="status-select"
              >
                {allowedOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {!isLeader && isAssignee && (
              <div className="alert alert-info">
                <small>
                  ℹ️ Team Members can advance tasks forward linearly (To Do → In Progress → Completed). Team Leaders can adjust tasks to any status.
                </small>
              </div>
            )}
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
              disabled={isSubmitting || selectedStatus === task.status}
              data-testid="status-submit-btn"
            >
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
