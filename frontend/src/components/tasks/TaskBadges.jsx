import React from 'react';

/**
 * Status Badge Component
 */
export function StatusBadge({ status }) {
  const normalized = (status || '').toLowerCase();

  let label = 'Unknown';
  let className = 'badge-status-unknown';

  if (normalized === 'todo') {
    label = 'To Do';
    className = 'badge-status-todo';
  } else if (normalized === 'inprogress') {
    label = 'In Progress';
    className = 'badge-status-inprogress';
  } else if (normalized === 'completed') {
    label = 'Completed';
    className = 'badge-status-completed';
  }

  return (
    <span className={`badge ${className}`} data-testid="status-badge">
      {label}
    </span>
  );
}

/**
 * Priority Badge Component
 */
export function PriorityBadge({ priority }) {
  const normalized = (priority || '').toLowerCase();

  let label = 'Normal';
  let className = 'badge-priority-medium';

  if (normalized === 'low') {
    label = 'Low';
    className = 'badge-priority-low';
  } else if (normalized === 'medium') {
    label = 'Medium';
    className = 'badge-priority-medium';
  } else if (normalized === 'high') {
    label = 'High';
    className = 'badge-priority-high';
  }

  return (
    <span className={`badge ${className}`} data-testid="priority-badge">
      {label}
    </span>
  );
}

/**
 * Overdue Badge Component
 */
export function OverdueBadge({ isOverdue }) {
  if (!isOverdue) return null;

  return (
    <span className="badge badge-overdue" data-testid="overdue-badge">
      ⚠️ Overdue
    </span>
  );
}

/**
 * Formats task deadlines nicely
 */
export function formatDeadline(deadlineString) {
  if (!deadlineString) return 'No deadline';
  try {
    const d = new Date(deadlineString);
    if (!Number.isFinite(d.getTime())) return String(deadlineString);
    // If time is 23:59:59.999Z, format as date only
    if (deadlineString.includes('T23:59:59.999Z') || /^\d{4}-\d{2}-\d{2}$/.test(deadlineString)) {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_e) {
    return String(deadlineString);
  }
}
