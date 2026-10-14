import React from 'react';
import { StatusBadge, PriorityBadge, OverdueBadge, formatDeadline } from './TaskBadges';

export function TaskDetailsModal({
  isOpen,
  onClose,
  task,
  isLeader = false,
  isAssignee = false,
  memberNames = {},
  currentUserId,
  onOpenStatus,
  onOpenEdit,
  onOpenAssign,
  onOpenDelete
}) {
  if (!isOpen || !task) return null;

  let assigneeDisplay = 'Unassigned';
  if (task.assigneeId) {
    const idStr = String(task.assigneeId);
    if (currentUserId && idStr === String(currentUserId)) {
      assigneeDisplay = 'Assigned to You';
    } else {
      assigneeDisplay = memberNames[idStr] || `Member (${idStr.slice(-6)})`;
    }
  }

  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleString();
    } catch (_e) {
      return String(iso);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="task-details-modal">
      <div className="modal-content modal-lg">
        <div className="modal-header">
          <div className="modal-title-with-badges">
            <h3>{task.title}</h3>
            <div className="badge-row">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <OverdueBadge isOverdue={task.isOverdue} />
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="task-detail-section">
            <h4>Description</h4>
            <div className="task-description-box" data-testid="task-detail-description">
              {task.description ? (
                <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>
              ) : (
                <p className="text-muted italic">No description provided.</p>
              )}
            </div>
          </div>

          <div className="task-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Deadline:</span>
              <span className="detail-value" data-testid="task-detail-deadline">
                {formatDeadline(task.deadline)}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Assignee:</span>
              <span className="detail-value" data-testid="task-detail-assignee">
                {assigneeDisplay}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className="detail-value">
                <StatusBadge status={task.status} />
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Priority:</span>
              <span className="detail-value">
                <PriorityBadge priority={task.priority} />
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Project ID:</span>
              <span className="detail-value code">{String(task.projectId)}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Created By:</span>
              <span className="detail-value code">{String(task.createdById)}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Created At:</span>
              <span className="detail-value">{formatDate(task.createdAt)}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Last Updated:</span>
              <span className="detail-value">{formatDate(task.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-actions-left">
            {isLeader && (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    onClose();
                    onOpenEdit(task);
                  }}
                  data-testid="detail-edit-btn"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    onClose();
                    onOpenAssign(task);
                  }}
                  data-testid="detail-assign-btn"
                >
                  👤 Assign
                </button>
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => {
                    onClose();
                    onOpenDelete(task);
                  }}
                  data-testid="detail-delete-btn"
                >
                  🗑️ Delete
                </button>
              </>
            )}

            {(isLeader || isAssignee) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose();
                  onOpenStatus(task);
                }}
                data-testid="detail-status-btn"
              >
                🔄 Update Status
              </button>
            )}
          </div>

          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
