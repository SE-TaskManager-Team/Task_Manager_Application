import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import App from '../App';
import { authService } from '../services/authService';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';

describe('App Project Creation Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "+ Create Project" button when teamLeader has no projects', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-leader-token',
      user: {
        _id: 'leader-1',
        name: 'Leader Alice',
        email: 'alice@example.com',
        role: 'teamLeader'
      }
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    render(<App />);

    expect(await screen.findByText('No projects available')).toBeInTheDocument();
    expect(screen.getByTestId('create-project-btn')).toBeInTheDocument();
  });

  it('does NOT render "+ Create Project" button when teamMember has no projects', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: {
        _id: 'member-1',
        name: 'Member Bob',
        email: 'bob@example.com',
        role: 'teamMember'
      }
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    render(<App />);

    expect(await screen.findByText('No projects available')).toBeInTheDocument();
    expect(screen.queryByTestId('create-project-btn')).not.toBeInTheDocument();
  });

  it('does NOT render "+ Create Project" button when admin is logged in', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-admin-token',
      user: {
        _id: 'admin-1',
        name: 'Admin Charlie',
        email: 'admin@example.com',
        role: 'admin'
      }
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    render(<App />);

    expect(await screen.findByText('No projects available')).toBeInTheDocument();
    expect(screen.queryByTestId('create-project-btn')).not.toBeInTheDocument();
  });

  it('successfully creates project, refreshes project list, and displays TaskManagement', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-leader-token',
      user: {
        _id: 'leader-1',
        name: 'Leader Alice',
        email: 'alice@example.com',
        role: 'teamLeader'
      }
    });

    const createdProject = {
      _id: 'proj-12345',
      name: 'Alpha Project',
      description: 'Alpha project goals',
      deadline: '2026-12-31T00:00:00.000Z',
      teamLeaderId: 'leader-1',
      memberIds: []
    };

    // First call: empty list. Second call after creation: returns createdProject.
    const getProjectsMock = vi.spyOn(projectService, 'getProjects')
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, pages: 1 })
      .mockResolvedValueOnce({ items: [createdProject], total: 1, page: 1, pages: 1 });

    const createProjectMock = vi.spyOn(projectService, 'createProject').mockResolvedValue({
      project: createdProject
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    render(<App />);

    // Wait for empty state
    expect(await screen.findByText('No projects available')).toBeInTheDocument();

    // Click "+ Create Project"
    fireEvent.click(screen.getByTestId('create-project-btn'));

    // Modal is opened
    expect(await screen.findByTestId('project-create-modal')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByTestId('project-name-input'), {
      target: { value: 'Alpha Project' }
    });
    fireEvent.change(screen.getByTestId('project-description-input'), {
      target: { value: 'Alpha project goals' }
    });
    fireEvent.change(screen.getByTestId('project-deadline-input'), {
      target: { value: '2026-12-31' }
    });

    // Submit form
    fireEvent.click(screen.getByTestId('project-submit-btn'));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith(
        {
          name: 'Alpha Project',
          description: 'Alpha project goals',
          deadline: '2026-12-31'
        },
        'jwt-leader-token'
      );
    });

    // Verify projects were refreshed
    await waitFor(() => {
      expect(getProjectsMock).toHaveBeenCalledTimes(2);
    });

    // Verify task management view is now shown with the new project
    expect(await screen.findByTestId('task-management')).toBeInTheDocument();
    expect(screen.getByText('Alpha Project – Tasks')).toBeInTheDocument();
  });

  it('displays error in modal if project creation fails', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-leader-token',
      user: {
        _id: 'leader-1',
        name: 'Leader Alice',
        email: 'alice@example.com',
        role: 'teamLeader'
      }
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    vi.spyOn(projectService, 'createProject').mockRejectedValue(
      new Error('Project name must be between 2 and 120 characters.')
    );

    render(<App />);

    expect(await screen.findByText('No projects available')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('create-project-btn'));
    expect(await screen.findByTestId('project-create-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('project-name-input'), {
      target: { value: 'Alpha Project' }
    });
    fireEvent.change(screen.getByTestId('project-deadline-input'), {
      target: { value: '2026-12-31' }
    });

    fireEvent.click(screen.getByTestId('project-submit-btn'));

    expect(
      await screen.findByText('Project name must be between 2 and 120 characters.')
    ).toBeInTheDocument();

    // Modal remains open so user can fix and retry
    expect(screen.getByTestId('project-create-modal')).toBeInTheDocument();
  });
});
