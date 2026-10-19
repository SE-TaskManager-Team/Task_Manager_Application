import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  StatusBadge,
  PriorityBadge,
  OverdueBadge,
  formatDeadline
} from '../components/tasks/TaskBadges';

describe('TaskBadges & Formatters', () => {
  it('renders StatusBadge with correct text and class for all statuses', () => {
    const { rerender } = render(<StatusBadge status="todo" />);
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toHaveClass('badge-status-todo');

    rerender(<StatusBadge status="inProgress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toHaveClass('badge-status-inprogress');

    rerender(<StatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toHaveClass('badge-status-completed');
  });

  it('renders PriorityBadge with correct text and class', () => {
    const { rerender } = render(<PriorityBadge priority="low" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByTestId('priority-badge')).toHaveClass('badge-priority-low');

    rerender(<PriorityBadge priority="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByTestId('priority-badge')).toHaveClass('badge-priority-medium');

    rerender(<PriorityBadge priority="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByTestId('priority-badge')).toHaveClass('badge-priority-high');
  });

  it('renders OverdueBadge only when isOverdue is true', () => {
    const { rerender } = render(<OverdueBadge isOverdue={false} />);
    expect(screen.queryByTestId('overdue-badge')).not.toBeInTheDocument();

    rerender(<OverdueBadge isOverdue={true} />);
    expect(screen.getByTestId('overdue-badge')).toBeInTheDocument();
    expect(screen.getByText(/Overdue/i)).toBeInTheDocument();
  });

  it('formatDeadline formats date strings appropriately', () => {
    expect(formatDeadline(null)).toBe('No deadline');
    const formatted = formatDeadline('2026-10-15T23:59:59.999Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Oct');
    expect(formatted).toContain('15');
  });
});
