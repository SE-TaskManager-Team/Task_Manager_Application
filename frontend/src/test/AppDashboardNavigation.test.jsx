import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import App from '../App';
import { authService } from '../services/authService';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { dashboardService } from '../services/dashboardService';

describe('App Dashboard Navigation Workflow (SRS TM-F-019)', () => {
  const leaderUser = {
    _id: 'leader-1',
    name: 'Leader Alice',
    email: 'alice@example.com',
    role: 'teamLeader'
  };

  const project1 = {
    _id: 'proj-1',
    name: 'Apollo Project',
    description: 'First Mission',
    teamLeaderId: 'leader-1',
    memberIds: []
  };

  const project2 = {
    _id: 'proj-2',
    name: 'Gemini Project',
    description: 'Second Mission',
    teamLeaderId: 'leader-1',
    memberIds: []
  };

  const dashboardData = {
    role: 'teamLeader',
    summary: {
      totalProjects: 2,
      totalTasks: 5,
      completedTasks: 2,
      inProgressTasks: 2,
      todoTasks: 1,
      overdueTasks: 0,
      completionPercentage: 40
    },
    projects: [
      {
        projectId: 'proj-1',
        name: 'Apollo Project',
        description: 'First Mission',
        deadline: '2026-11-30',
        totalTasks: 3,
        completedTasks: 2,
        inProgressTasks: 1,
        todoTasks: 0,
        overdueTasks: 0,
        progress: 67
      },
      {
        projectId: 'proj-2',
        name: 'Gemini Project',
        description: 'Second Mission',
        deadline: '2026-12-15',
        totalTasks: 2,
        completedTasks: 0,
        inProgressTasks: 1,
        todoTasks: 1,
        overdueTasks: 0,
        progress: 0
      }
    ],
    upcomingTasks: [
      {
        _id: 'task-apollo-1',
        title: 'Launch Preparation',
        priority: 'high',
        status: 'inProgress',
        deadline: '2026-11-20',
        projectId: 'proj-1',
        projectName: 'Apollo Project'
      }
    ]
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens directly to Dashboard page after login with full metrics and projects', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-leader-token',
      user: leaderUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project1, project2],
      total: 2,
      page: 1,
      pages: 1
    });

    vi.spyOn(dashboardService, 'getDashboardData').mockResolvedValue(dashboardData);

    render(<App />);

    // Renders header subtitle and navigation bar
    expect(await screen.findByText('User Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tasks')).toBeInTheDocument();

    // Dashboard view is rendered and active
    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-projects')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-total-tasks')).toHaveTextContent('5');
    expect(screen.getByTestId('stat-completed-tasks')).toHaveTextContent('2');

    // Both projects visible with progress in dashboard cards
    expect(screen.getByTestId('project-card-proj-1')).toHaveTextContent('Apollo Project');
    expect(screen.getByTestId('project-card-proj-2')).toHaveTextContent('Gemini Project');
    expect(screen.getByTestId('project-card-proj-1')).toHaveTextContent('67%');
  });

  it('navigates between Dashboard and Task Management via navigation bar and back button', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-leader-token',
      user: leaderUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project1, project2],
      total: 2,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    vi.spyOn(dashboardService, 'getDashboardData').mockResolvedValue(dashboardData);

    render(<App />);

    // Wait for Dashboard to mount
    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();

    // Click "📋 Task Management" navigation button
    fireEvent.click(screen.getByTestId('nav-tasks'));

    // Subtitle updates to Task Management
    expect(screen.getByText('Task Management')).toBeInTheDocument();
    expect(screen.getByTestId('task-management')).toBeInTheDocument();

    // Click "← Back to Dashboard" button in Task Management view
    fireEvent.click(screen.getByTestId('back-to-dashboard-btn'));

    // Subtitle updates back to User Dashboard and dashboard is active
    expect(screen.getByText('User Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('user-dashboard')).toBeInTheDocument();
  });

  it('navigates to specific project in Task Management when clicking "View Tasks →" on project card', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-leader-token',
      user: leaderUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project1, project2],
      total: 2,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    vi.spyOn(dashboardService, 'getDashboardData').mockResolvedValue(dashboardData);

    render(<App />);

    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();

    // Click "View Tasks →" for Gemini Project (proj-2)
    const viewGeminiBtn = screen.getByTestId('btn-view-project-proj-2');
    fireEvent.click(viewGeminiBtn);

    // Switches to Task Management with Gemini Project selected
    expect(await screen.findByTestId('task-management')).toBeInTheDocument();
    expect(screen.getByTestId('project-select')).toHaveValue('proj-2');
    expect(screen.getByText('Gemini Project – Tasks')).toBeInTheDocument();
  });
});
