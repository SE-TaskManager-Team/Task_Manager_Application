import React from 'react';

export function TaskFilters({
  filters = {},
  onChange,
  onReset,
  currentUserId,
  memberIds = [],
  memberNames = {}
}) {
  const handleChange = (field, value) => {
    onChange({
      ...filters,
      [field]: value
    });
  };

  return (
    <div className="task-filters-card" data-testid="task-filters">
      <div className="task-filters-header">
        <h3 className="task-filters-title">Filter & Sort Tasks</h3>
        <button
          type="button"
          onClick={onReset}
          className="btn btn-link btn-sm"
          data-testid="filter-reset-btn"
        >
          Reset Filters
        </button>
      </div>

      <div className="task-filters-grid">
        {/* Status Filter */}
        <div className="filter-group">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={filters.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            className="filter-input"
            data-testid="filter-status-select"
          >
            <option value="">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="inProgress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="filter-group">
          <label htmlFor="filter-priority">Priority</label>
          <select
            id="filter-priority"
            value={filters.priority || ''}
            onChange={(e) => handleChange('priority', e.target.value)}
            className="filter-input"
            data-testid="filter-priority-select"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Overdue Filter */}
        <div className="filter-group">
          <label htmlFor="filter-overdue">Overdue</label>
          <select
            id="filter-overdue"
            value={filters.overdue !== undefined ? String(filters.overdue) : ''}
            onChange={(e) => handleChange('overdue', e.target.value)}
            className="filter-input"
            data-testid="filter-overdue-select"
          >
            <option value="">All</option>
            <option value="true">Overdue Only</option>
            <option value="false">Not Overdue</option>
          </select>
        </div>

        {/* Deadline Filter */}
        <div className="filter-group">
          <label htmlFor="filter-deadline">Deadline Date</label>
          <input
            type="date"
            id="filter-deadline"
            value={filters.deadline || ''}
            onChange={(e) => handleChange('deadline', e.target.value)}
            className="filter-input"
            data-testid="filter-deadline-input"
          />
        </div>

        {/* Assignee Filter */}
        <div className="filter-group">
          <label htmlFor="filter-assignee">Assignee</label>
          <select
            id="filter-assignee"
            value={filters.assigneeId || ''}
            onChange={(e) => handleChange('assigneeId', e.target.value)}
            className="filter-input"
            data-testid="filter-assignee-select"
          >
            <option value="">All Assignees</option>
            {currentUserId && (
              <option value={currentUserId}>Assigned to Me</option>
            )}
            <option value="unassigned">Unassigned</option>
            {memberIds.map((mId) => {
              const idStr = String(mId);
              if (idStr === String(currentUserId)) return null;
              const name = memberNames[idStr] || `Member (${idStr.slice(-4)})`;
              return (
                <option key={idStr} value={idStr}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>

        {/* Sort Field */}
        <div className="filter-group">
          <label htmlFor="filter-sortby">Sort By</label>
          <select
            id="filter-sortby"
            value={filters.sortBy || ''}
            onChange={(e) => handleChange('sortBy', e.target.value)}
            className="filter-input"
            data-testid="filter-sort-by-select"
          >
            <option value="">Newest Created</option>
            <option value="deadline">Deadline</option>
            <option value="priority">Priority (Weight)</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="filter-group">
          <label htmlFor="filter-order">Order</label>
          <select
            id="filter-order"
            value={filters.order || ''}
            onChange={(e) => handleChange('order', e.target.value)}
            className="filter-input"
            data-testid="filter-order-select"
          >
            <option value="">Default</option>
            <option value="asc">Ascending (Low → High / Earliest)</option>
            <option value="desc">Descending (High → Low / Latest)</option>
          </select>
        </div>
      </div>

      <div className="filter-note">
        <small className="text-muted">
          💡 Note: Filters and sorting query the live backend Task API. Global keyword search is provided by the separate Search module (<code>/api/search</code>).
        </small>
      </div>
    </div>
  );
}
