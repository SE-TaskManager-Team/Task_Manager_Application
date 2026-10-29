import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskManagement } from '../components/tasks/TaskManagement';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';

describe('Project Progress Indicator (SRS TM-F-015 / TC-PROJ-04)', () => {
  const currentProject = {
    _id: 'proj-1',
    name: 'Website Redesign',
    teamLeaderId: 'leader-1',
    memberIds: ['member-1', 'member-2']
  };

  const currentUser = {
    _id: 'leader-1',
    name: 'Alice Leader',
    role: 'teamLeader'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles projects with zero tasks sensibly (0% progress, empty progress bar)', async () => {
    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    vi.spyOn(projectService, 'getProjectProgress').mockResolvedValue({
      projectId: 'proj-1',
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      progress: 0
    });

    render(
      <TaskManagement
        projectId="proj-1"
        project={currentProject}
        currentUser={currentUser}
        token="test-token"
      />
    );

    expect(await screen.findByTestId('project-progress-container')).toBeInTheDocument();
    expect(screen.getByTestId('project-progress-percentage')).toHaveTextContent('0%');
    expect(screen.getByTestId('project-progress-details')).toHaveTextContent('0 of 0 tasks completed');

    const progressBar = screen.getByTestId('project-progress-bar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');

    const progressFill = screen.getByTestId('project-progress-fill');
    expect(progressFill).toHaveStyle({ width: '0%' });

    expect(screen.getByTestId('metric-progress-value')).toHaveTextContent('0%');
  });

  it('displays correct percentage and bar for partially completed tasks', async () => {
    const tasks = [
      { _id: 't-1', projectId: 'proj-1', title: 'Task 1', status: 'completed' },
      { _id: 't-2', projectId: 'proj-1', title: 'Task 2', status: 'inProgress' },
      { _id: 't-3', projectId: 'proj-1', title: 'Task 3', status: 'todo' },
      { _id: 't-4', projectId: 'proj-1', title: 'Task 4', status: 'completed' }
    ];

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: tasks,
      total: 4,
      page: 1,
      pages: 1
    });

    vi.spyOn(projectService, 'getProjectProgress').mockResolvedValue({
      projectId: 'proj-1',
      totalTasks: 4,
      completedTasks: 2,
      inProgressTasks: 1,
      pendingTasks: 1,
      progress: 50
    });

    render(
      <TaskManagement
        projectId="proj-1"
        project={currentProject}
        currentUser={currentUser}
        token="test-token"
      />
    );

    expect(await screen.findByTestId('project-progress-container')).toBeInTheDocument();
    expect(screen.getByTestId('project-progress-percentage')).toHaveTextContent('50%');
    expect(screen.getByTestId('project-progress-details')).toHaveTextContent('2 of 4 tasks completed');

    const progressBar = screen.getByTestId('project-progress-bar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');

    const progressFill = screen.getByTestId('project-progress-fill');
    expect(progressFill).toHaveStyle({ width: '50%' });

    expect(screen.getByTestId('metric-progress-value')).toHaveTextContent('50%');
  });

  it('displays 100% when all project tasks are completed', async () => {
    const tasks = [
      { _id: 't-1', projectId: 'proj-1', title: 'Task 1', status: 'completed' },
      { _id: 't-2', projectId: 'proj-1', title: 'Task 2', status: 'completed' },
      { _id: 't-3', projectId: 'proj-1', title: 'Task 3', status: 'completed' }
    ];

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: tasks,
      total: 3,
      page: 1,
      pages: 1
    });

    vi.spyOn(projectService, 'getProjectProgress').mockResolvedValue({
      projectId: 'proj-1',
      totalTasks: 3,
      completedTasks: 3,
      inProgressTasks: 0,
      pendingTasks: 0,
      progress: 100
    });

    render(
      <TaskManagement
        projectId="proj-1"
        project={currentProject}
        currentUser={currentUser}
        token="test-token"
      />
    );

    expect(await screen.findByTestId('project-progress-container')).toBeInTheDocument();
    expect(screen.getByTestId('project-progress-percentage')).toHaveTextContent('100%');
    expect(screen.getByTestId('project-progress-details')).toHaveTextContent('3 of 3 tasks completed');

    const progressBar = screen.getByTestId('project-progress-bar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');

    const progressFill = screen.getByTestId('project-progress-fill');
    expect(progressFill).toHaveStyle({ width: '100%' });

    expect(screen.getByTestId('metric-progress-value')).toHaveTextContent('100%');
  });

  it('ensures progress is calculated strictly from tasks belonging to the selected project, not globally', async () => {
    // When falling back to tasks calculation, tasks with other projectIds are filtered out
    const mixedTasks = [
      { _id: 't-1', projectId: 'proj-1', title: 'Task 1', status: 'completed' },
      { _id: 't-2', projectId: 'proj-1', title: 'Task 2', status: 'todo' },
      // Tasks belonging to other projects
      { _id: 't-other-1', projectId: 'proj-2', title: 'Other 1', status: 'completed' },
      { _id: 't-other-2', projectId: 'proj-2', title: 'Other 2', status: 'completed' }
    ];

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: mixedTasks,
      total: 4,
      page: 1,
      pages: 1
    });

    // Simulate getProjectProgress failing so fallback tasks-based calculation is exercised
    vi.spyOn(projectService, 'getProjectProgress').mockRejectedValue(new Error('Network error'));

    render(
      <TaskManagement
        projectId="proj-1"
        project={currentProject}
        currentUser={currentUser}
        token="test-token"
      />
    );

    // Only proj-1 tasks (1 completed out of 2 = 50%), not 3 out of 4 (75%)
    expect(await screen.findByTestId('project-progress-container')).toBeInTheDocument();
    expect(screen.getByTestId('project-progress-percentage')).toHaveTextContent('50%');
    expect(screen.getByTestId('project-progress-details')).toHaveTextContent('1 of 2 tasks completed');
    expect(screen.getByTestId('project-progress-bar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('updates project progress when a task status changes', async () => {
    const initialTasks = [
      {
        _id: 'task-1',
        projectId: 'proj-1',
        title: 'Feature Task',
        status: 'todo',
        priority: 'high',
        assigneeId: 'member-1'
      },
      {
        _id: 'task-2',
        projectId: 'proj-1',
        title: 'Doc Task',
        status: 'todo',
        priority: 'medium',
        assigneeId: null
      }
    ];

    const updatedTasks = [
      {
        _id: 'task-1',
        projectId: 'proj-1',
        title: 'Feature Task',
        status: 'completed',
        priority: 'high',
        assigneeId: 'member-1'
      },
      {
        _id: 'task-2',
        projectId: 'proj-1',
        title: 'Doc Task',
        status: 'todo',
        priority: 'medium',
        assigneeId: null
      }
    ];

    const getTasksSpy = vi.spyOn(taskService, 'getProjectTasks')
      .mockResolvedValueOnce({ items: initialTasks, total: 2, page: 1, pages: 1 })
      .mockResolvedValueOnce({ items: updatedTasks, total: 2, page: 1, pages: 1 });

    const getProgressSpy = vi.spyOn(projectService, 'getProjectProgress')
      .mockResolvedValueOnce({
        projectId: 'proj-1',
        totalTasks: 2,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 2,
        progress: 0
      })
      .mockResolvedValueOnce({
        projectId: 'proj-1',
        totalTasks: 2,
        completedTasks: 1,
        inProgressTasks: 0,
        pendingTasks: 1,
        progress: 50
      });

    vi.spyOn(taskService, 'updateTaskStatus').mockResolvedValue({
      task: updatedTasks[0]
    });

    render(
      <TaskManagement
        projectId="proj-1"
        project={currentProject}
        currentUser={currentUser}
        token="test-token"
      />
    );

    // Initial state: 0% progress
    expect(await screen.findByTestId('project-progress-percentage')).toHaveTextContent('0%');
    expect(screen.getByTestId('project-progress-bar')).toHaveAttribute('aria-valuenow', '0');

    // Leader clicks "Status" button on task-1
    fireEvent.click(screen.getByTestId('task-status-btn-task-1'));

    // Status modal opens
    expect(await screen.findByTestId('task-status-modal')).toBeInTheDocument();

    // Select 'completed'
    fireEvent.change(screen.getByTestId('status-select'), {
      target: { value: 'completed' }
    });

    // Submit status change
    fireEvent.click(screen.getByTestId('status-submit-btn'));

    // Progress updates to 50%
    await waitFor(() => {
      expect(screen.getByTestId('project-progress-percentage')).toHaveTextContent('50%');
    });

    expect(screen.getByTestId('project-progress-bar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByTestId('project-progress-fill')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('project-progress-details')).toHaveTextContent('1 of 2 tasks completed');
  });
});
