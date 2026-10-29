import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DashboardView } from '../components/dashboard/DashboardView';
import { dashboardService } from '../services/dashboardService';

describe('DashboardView Component (SRS TM-F-019 / TC-DASH-01)', () => {
  const adminUser = {
    _id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin'
  };

  const leaderUser = {
    _id: 'leader-1',
    name: 'Leader Alice',
    email: 'alice@example.com',
    role: 'teamLeader'
  };

  const memberUser = {
    _id: 'member-1',
    name: 'Member Bob',
    email: 'bob@example.com',
    role: 'teamMember'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(dashboardService, 'getDashboardData').mockImplementation(() => new Promise(() => {}));

    render(
      <DashboardView
        currentUser={leaderUser}
        token="test-token"
      />
    );

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading your dashboard…')).toBeInTheDocument();
  });

  it('renders error state and allows retry', async () => {
    const getDashboardSpy = vi.spyOn(dashboardService, 'getDashboardData')
      .mockRejectedValueOnce(new Error('Connection failure'))
      .mockResolvedValueOnce({
        role: 'teamLeader',
        summary: { totalProjects: 0, totalTasks: 0, completedTasks: 0, inProgressTasks: 0, todoTasks: 0, overdueTasks: 0, completionPercentage: 0 },
        projects: [],
        upcomingTasks: []
      });

    render(
      <DashboardView
        currentUser={leaderUser}
        token="test-token"
      />
    );

    expect(await screen.findByTestId('dashboard-error')).toHaveTextContent('Connection failure');

    fireEvent.click(screen.getByTestId('dashboard-retry-btn'));

    await waitFor(() => {
      expect(getDashboardSpy).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();
  });

  it('renders Admin dashboard with system totals and user analytics', async () => {
    const adminData = {
      role: 'admin',
      summary: {
        totalProjects: 5,
        totalTasks: 40,
        completedTasks: 20,
        inProgressTasks: 12,
        todoTasks: 8,
        overdueTasks: 3,
        completionPercentage: 50,
        totalUsers: 15,
        activeUsers: 14
      },
      projects: [
        {
          projectId: 'p-1',
          name: 'Core Architecture',
          description: 'System redesign',
          deadline: '2026-12-31',
          totalTasks: 20,
          completedTasks: 10,
          inProgressTasks: 6,
          todoTasks: 4,
          overdueTasks: 1,
          progress: 50
        }
      ],
      upcomingTasks: [
        {
          _id: 't-1',
          title: 'Upgrade Dependencies',
          priority: 'high',
          status: 'inProgress',
          deadline: '2026-11-20',
          projectId: 'p-1',
          projectName: 'Core Architecture'
        }
      ]
    };

    vi.spyOn(dashboardService, 'getDashboardData').mockResolvedValue(adminData);

    render(
      <DashboardView
        currentUser={adminUser}
        token="admin-token"
      />
    );

    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('dashboard-role-badge')).toHaveTextContent('Administrator');

    // Admin metrics
    expect(screen.getByTestId('stat-total-users')).toHaveTextContent('15');
    expect(screen.getByTestId('stat-active-users')).toHaveTextContent('14');
    expect(screen.getByTestId('stat-total-projects')).toHaveTextContent('5');
    expect(screen.getByTestId('stat-total-tasks')).toHaveTextContent('40');
    expect(screen.getByTestId('stat-todo-tasks')).toHaveTextContent('8');
    expect(screen.getByTestId('stat-inprogress-tasks')).toHaveTextContent('12');
    expect(screen.getByTestId('stat-completed-tasks')).toHaveTextContent('20');
    expect(screen.getByTestId('stat-overdue-tasks')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-completion-rate')).toHaveTextContent('50%');

    // Project Progress
    expect(screen.getByTestId('project-card-p-1')).toHaveTextContent('Core Architecture');
    expect(screen.getByTestId('project-card-p-1')).toHaveTextContent('50%');
    expect(screen.getByTestId('project-card-p-1')).toHaveTextContent(/10 \/ 20 done/);

    // Upcoming Deliverable
    expect(screen.getByText('Upgrade Dependencies')).toBeInTheDocument();
  });

  it('renders Team Leader dashboard with accessible projects and progress', async () => {
    const leaderData = {
      role: 'teamLeader',
      summary: {
        totalProjects: 2,
        totalTasks: 16,
        completedTasks: 8,
        inProgressTasks: 4,
        todoTasks: 4,
        overdueTasks: 0,
        completionPercentage: 50
      },
      projects: [
        {
          projectId: 'p-alpha',
          name: 'Project Alpha',
          description: 'Team project goals',
          deadline: '2026-11-15',
          totalTasks: 10,
          completedTasks: 6,
          inProgressTasks: 2,
          todoTasks: 2,
          overdueTasks: 0,
          progress: 60
        },
        {
          projectId: 'p-beta',
          name: 'Project Beta',
          description: 'Secondary project',
          deadline: '2026-12-01',
          totalTasks: 6,
          completedTasks: 2,
          inProgressTasks: 2,
          todoTasks: 2,
          overdueTasks: 0,
          progress: 33
        }
      ],
      upcomingTasks: [
        {
          _id: 'task-leader-1',
          title: 'Database Migration',
          priority: 'high',
          status: 'inProgress',
          deadline: '2026-11-10',
          projectId: 'p-alpha',
          projectName: 'Project Alpha'
        }
      ]
    };

    vi.spyOn(dashboardService, 'getDashboardData').mockResolvedValue(leaderData);

    const onNavigateMock = vi.fn();
    const onCreateProjectMock = vi.fn();

    render(
      <DashboardView
        currentUser={leaderUser}
        token="leader-token"
        onNavigateToTasks={onNavigateMock}
        onCreateProject={onCreateProjectMock}
      />
    );

    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-role-badge')).toHaveTextContent('Team Leader');

    // Does NOT render admin metrics
    expect(screen.queryByTestId('stat-total-users')).not.toBeInTheDocument();

    // Projects rendered
    expect(screen.getByTestId('project-card-p-alpha')).toHaveTextContent('Project Alpha');
    expect(screen.getByTestId('project-card-p-alpha')).toHaveTextContent('60%');
    expect(screen.getByTestId('project-card-p-beta')).toHaveTextContent('Project Beta');
    expect(screen.getByTestId('project-card-p-beta')).toHaveTextContent('33%');

    // Navigation trigger via "View Tasks →" on project card
    const viewProjBtn = screen.getByTestId('btn-view-project-p-alpha');
    fireEvent.click(viewProjBtn);
    expect(onNavigateMock).toHaveBeenCalledWith('p-alpha');

    // Navigation trigger via header button
    fireEvent.click(screen.getByTestId('btn-go-to-tasks'));
    expect(onNavigateMock).toHaveBeenCalled();

    // Create project trigger in header
    fireEvent.click(screen.getByTestId('dashboard-create-project-btn'));
    expect(onCreateProjectMock).toHaveBeenCalled();
  });

  it('renders Team Member dashboard with personal task counts and assigned tasks', async () => {
    const memberData = {
      role: 'teamMember',
      summary: {
        totalProjects: 1,
        totalTasks: 4,
        completedTasks: 1,
        inProgressTasks: 2,
        todoTasks: 1,
        overdueTasks: 1,
        completionPercentage: 25
      },
      projects: [
        {
          projectId: 'p-member-1',
          name: 'Collab Project',
          description: 'Team space',
          deadline: '2026-12-20',
          totalTasks: 12,
          completedTasks: 6,
          inProgressTasks: 4,
          todoTasks: 2,
          overdueTasks: 1,
          progress: 50
        }
      ],
      upcomingTasks: [
        {
          _id: 'task-mem-1',
          title: 'Write Frontend Tests',
          priority: 'high',
          status: 'todo',
          deadline: '2025-01-01', // Past date -> overdue
          projectId: 'p-member-1',
          projectName: 'Collab Project'
        }
      ]
    };

    vi.spyOn(dashboardService, 'getDashboardData').mockResolvedValue(memberData);
    const onNavigateMock = vi.fn();

    render(
      <DashboardView
        currentUser={memberUser}
        token="member-token"
        onNavigateToTasks={onNavigateMock}
      />
    );

    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-role-badge')).toHaveTextContent('Team Member');

    // Personal labels
    expect(screen.getByTestId('stat-total-projects')).toHaveTextContent('Accessible Projects');
    expect(screen.getByTestId('stat-total-tasks')).toHaveTextContent('My Assigned Tasks');
    expect(screen.getByTestId('stat-total-tasks')).toHaveTextContent('4');
    expect(screen.getByTestId('stat-completed-tasks')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-overdue-tasks')).toHaveTextContent('1');

    // Upcoming task with Overdue badge
    expect(screen.getByText('Write Frontend Tests')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-task-task-mem-1')).toHaveTextContent('Overdue');

    // Click "Open Task →" navigates to tasks with that project
    fireEvent.click(screen.getByTestId('btn-view-task-task-mem-1'));
    expect(onNavigateMock).toHaveBeenCalledWith('p-member-1');
  });

  it('handles empty states gracefully for users with no projects or tasks', async () => {
    const emptyData = {
      role: 'teamLeader',
      summary: {
        totalProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        overdueTasks: 0,
        completionPercentage: 0
      },
      projects: [],
      upcomingTasks: []
    };

    vi.spyOn(dashboardService, 'getDashboardData').mockResolvedValue(emptyData);
    const onCreateProjectMock = vi.fn();

    render(
      <DashboardView
        currentUser={leaderUser}
        token="leader-token"
        onCreateProject={onCreateProjectMock}
      />
    );

    expect(await screen.findByTestId('user-dashboard')).toBeInTheDocument();

    // Summary counts are 0
    expect(screen.getByTestId('stat-total-projects')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-total-tasks')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-completion-rate')).toHaveTextContent('0%');

    // Empty state cards rendered
    expect(screen.getByTestId('dashboard-no-projects')).toHaveTextContent('No projects available');
    expect(screen.getByTestId('dashboard-no-tasks')).toHaveTextContent('No upcoming incomplete tasks or pending deadlines.');

    // Create project button in empty state works
    const createBtn = screen.getByTestId('create-project-btn');
    fireEvent.click(createBtn);
    expect(onCreateProjectMock).toHaveBeenCalled();
  });
});
