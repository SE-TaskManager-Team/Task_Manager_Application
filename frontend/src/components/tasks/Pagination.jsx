import React from 'react';

export function Pagination({ page = 1, pages = 1, total = 0, limit = 20, onPageChange, onLimitChange }) {
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="pagination-container" data-testid="pagination">
      <div className="pagination-info">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{total}</strong> tasks
      </div>

      <div className="pagination-controls">
        <label className="pagination-limit-label">
          Per page:
          <select
            value={limit}
            onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
            className="pagination-limit-select"
            data-testid="pagination-limit-select"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>

        <div className="pagination-buttons">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange && onPageChange(page - 1)}
            disabled={page <= 1}
            data-testid="pagination-prev"
          >
            ← Previous
          </button>
          <span className="pagination-current-page" data-testid="pagination-page-indicator">
            Page {page} of {Math.max(1, pages)}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange && onPageChange(page + 1)}
            disabled={page >= pages}
            data-testid="pagination-next"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
