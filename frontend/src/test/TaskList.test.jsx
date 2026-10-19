import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskList } from '../components/tasks/TaskList';

describe('TaskList Component', () => {
  const sampleTasks = [
    {
      _id: 'task-1',
      title: 'First Feature Task',
      description: 'First feature description',
      status: 'todo',
      priority: 'high',
      deadline: '2026-10-15T23:59:59.999Z',
      assigneeId: 'user-member-1',
      isOverdue: false
    },
    {
      _id: 'task-2',
      title: 'Second Bug Task',
      description: 'Second bug description',
      status: 'inProgress',
      priority: 'medium',
      deadline: '2026-10-01T23:59:59.999Z',
      assigneeId: null,
      isOverdue: true
    }
  ];

  it('renders loading state when isLoading is true', () => {
    render(<TaskList isLoading={true} />);
    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument();
  });

  it('renders error message when error prop is provided', () => {
    render(<TaskList error="Failed to fetch tasks" />);
    expect(screen.getByTestId('task-list-error')).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch tasks/i)).toBeInTheDocument();
  });

  it('renders empty state when tasks list is empty', () => {
    render(<TaskList tasks={[]} />);
    expect(screen.getByTestId('task-list-empty')).toBeInTheDocument();
    expect(screen.getByText(/No Tasks Found/i)).toBeInTheDocument();
  });

  it('renders task cards with titles, badges, and metadata', () => {
    render(
      <TaskList
        tasks={sampleTasks}
        currentUserId="user-member-1"
        isLeader={false}
      />
    );

    expect(screen.getByText('First Feature Task')).toBeInTheDocument();
    expect(screen.getByText('Second Bug Task')).toBeInTheDocument();
    expect(screen.getByText('Assigned to You')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText(/Overdue/i)).toBeInTheDocument();
  });

  it('shows Team Leader action buttons (edit, assign, delete) only when isLeader is true', () => {
    const { rerender } = render(
      <TaskList
        tasks={sampleTasks}
        currentUserId="user-member-1"
        isLeader={false}
      />
    );

    expect(screen.queryByTestId('task-edit-btn-task-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-delete-btn-task-1')).not.toBeInTheDocument();

    rerender(
      <TaskList
        tasks={sampleTasks}
        currentUserId="user-leader-1"
        isLeader={true}
      />
    );

    expect(screen.getByTestId('task-edit-btn-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-assign-btn-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-delete-btn-task-1')).toBeInTheDocument();
  });

  it('allows assigned team member to quick-advance task status', () => {
    const handleQuickAdvance = vi.fn();

    render(
      <TaskList
        tasks={sampleTasks}
        currentUserId="user-member-1"
        isLeader={false}
        onQuickAdvanceStatus={handleQuickAdvance}
      />
    );

    // task-1 is 'todo' and assigned to user-member-1
    const advanceBtn = screen.getByTestId('task-advance-btn-task-1');
    expect(advanceBtn).toBeInTheDocument();
    expect(advanceBtn).toHaveTextContent(/Start \(In Progress\)/i);

    fireEvent.click(advanceBtn);
    expect(handleQuickAdvance).toHaveBeenCalledWith('task-1', 'inProgress');
  });
});
