import React from 'react';
import { StatusBadge, PriorityBadge, OverdueBadge, formatDeadline } from './TaskBadges';

export function TaskList({
  tasks = [],
  isLoading = false,
  error = null,
  currentUserId,
  isLeader = false,
  memberNames = {},
  onSelectTask,
  onOpenStatus,
  onOpenEdit,
  onOpenAssign,
  onOpenDelete,
  onQuickAdvanceStatus
}) {
  if (isLoading) {
    return (
      <div className="task-loading-state" data-testid="task-list-loading">
        <div className="spinner"></div>
        <p>Loading project tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" role="alert" data-testid="task-list-error">
        <strong>Error loading tasks:</strong> {error}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="task-empty-state" data-testid="task-list-empty">
        <div className="empty-icon">📋</div>
        <h4>No Tasks Found</h4>
        <p className="text-muted">
          There are no tasks matching your selected filters in this project.
        </p>
      </div>
    );
  }

  return (
    <div className="task-list-container" data-testid="task-list">
      <div className="task-cards-grid">
        {tasks.map((task) => {
          const isAssignee = currentUserId && task.assigneeId && String(task.assigneeId) === String(currentUserId);
          const idStr = task.assigneeId ? String(task.assigneeId) : null;
          let assigneeText = 'Unassigned';
          if (idStr) {
            if (isAssignee) {
              assigneeText = 'Assigned to You';
            } else {
              assigneeText = memberNames[idStr] || `Member (${idStr.slice(-4)})`;
            }
          }

          // Quick advance eligibility for assigned team member
          const canQuickAdvance = isAssignee && (task.status === 'todo' || task.status === 'inProgress');
          const nextStatusLabel = task.status === 'todo' ? 'Start (In Progress)' : 'Complete Task';
          const nextStatusValue = task.status === 'todo' ? 'inProgress' : 'completed';

          return (
            <div
              key={task._id}
              className={`task-card ${task.isOverdue ? 'task-card-overdue' : ''} ${task.status === 'completed' ? 'task-card-completed' : ''}`}
              data-testid={`task-item-${task._id}`}
            >
              <div className="task-card-header">
                <div className="task-card-badges">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <OverdueBadge isOverdue={task.isOverdue} />
                </div>
                <div className="task-card-date">
                  📅 {formatDeadline(task.deadline)}
                </div>
              </div>

              <div className="task-card-body">
                <h4
                  className="task-card-title"
                  onClick={() => onSelectTask(task)}
                  title="Click to view details"
                >
                  {task.title}
                </h4>

                {task.description && (
                  <p className="task-card-description">
                    {task.description.length > 120
                      ? `${task.description.slice(0, 120)}...`
                      : task.description}
                  </p>
                )}

                <div className="task-card-meta">
                  <span className="task-meta-assignee" title={`Assignee: ${assigneeText}`}>
                    👤 <strong>{assigneeText}</strong>
                  </span>
                </div>
              </div>

              <div className="task-card-footer">
                <div className="task-actions-left">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onSelectTask(task)}
                    data-testid={`task-view-btn-${task._id}`}
                  >
                    View
                  </button>

                  {/* Quick status advance for assignee */}
                  {canQuickAdvance && onQuickAdvanceStatus && (
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      onClick={() => onQuickAdvanceStatus(task._id, nextStatusValue)}
                      data-testid={`task-advance-btn-${task._id}`}
                    >
                      ✓ {nextStatusLabel}
                    </button>
                  )}

                  {/* Full status modal trigger for leader or assignee */}
                  {(isLeader || isAssignee) && !canQuickAdvance && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => onOpenStatus(task)}
                      data-testid={`task-status-btn-${task._id}`}
                    >
                      Status
                    </button>
                  )}
                </div>

                <div className="task-actions-right">
                  {isLeader && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-icon"
                        title="Edit Task"
                        onClick={() => onOpenEdit(task)}
                        data-testid={`task-edit-btn-${task._id}`}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-icon"
                        title="Assign Task"
                        onClick={() => onOpenAssign(task)}
                        data-testid={`task-assign-btn-${task._id}`}
                      >
                        👤
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-icon btn-icon-danger"
                        title="Delete Task"
                        onClick={() => onOpenDelete(task)}
                        data-testid={`task-delete-btn-${task._id}`}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
