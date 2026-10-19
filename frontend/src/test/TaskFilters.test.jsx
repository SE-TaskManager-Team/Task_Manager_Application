import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskFilters } from '../components/tasks/TaskFilters';

describe('TaskFilters Component', () => {
  it('renders all filter controls properly', () => {
    const handleFiltersChange = vi.fn();
    const handleReset = vi.fn();

    render(
      <TaskFilters
        filters={{ status: 'todo', priority: 'high', sortBy: 'deadline' }}
        onChange={handleFiltersChange}
        onReset={handleReset}
        currentUserId="user-123"
        memberIds={['user-123', 'user-456']}
        memberNames={{ 'user-456': 'Alice Member' }}
      />
    );

    expect(screen.getByTestId('filter-status-select')).toHaveValue('todo');
    expect(screen.getByTestId('filter-priority-select')).toHaveValue('high');
    expect(screen.getByTestId('filter-sort-by-select')).toHaveValue('deadline');
    expect(screen.getByText('Alice Member')).toBeInTheDocument();
    expect(screen.getByText('Assigned to Me')).toBeInTheDocument();
  });

  it('triggers onChange when a filter select changes', () => {
    const handleFiltersChange = vi.fn();
    const handleReset = vi.fn();

    render(
      <TaskFilters
        filters={{ status: '' }}
        onChange={handleFiltersChange}
        onReset={handleReset}
      />
    );

    fireEvent.change(screen.getByTestId('filter-status-select'), {
      target: { value: 'completed' }
    });

    expect(handleFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('triggers onReset when Reset Filters button is clicked', () => {
    const handleFiltersChange = vi.fn();
    const handleReset = vi.fn();

    render(
      <TaskFilters
        filters={{ status: 'completed' }}
        onChange={handleFiltersChange}
        onReset={handleReset}
      />
    );

    fireEvent.click(screen.getByTestId('filter-reset-btn'));
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
