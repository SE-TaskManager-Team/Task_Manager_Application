import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import App from '../App';
import { authService } from '../services/authService';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { notificationService } from '../services/notificationService';

describe('App Notification Integration Workflow (TM-F-017 / TC-NOTIF-01)', () => {
  const memberUser = {
    _id: 'member-10',
    name: 'Bob Member',
    email: 'bob@example.com',
    role: 'teamMember'
  };

  const project = {
    _id: 'proj-1',
    name: 'Project Orion',
    teamLeaderId: 'leader-1',
    memberIds: ['member-10']
  };

  const notifications = [
    {
      _id: 'notif-1',
      recipientId: 'member-10',
      type: 'taskAssigned',
      taskId: 'task-100',
      message: 'Task "Database Schema" has been assigned to you.',
      isRead: false,
      createdAt: '2026-10-29T10:00:00.000Z'
    },
    {
      _id: 'notif-2',
      recipientId: 'member-10',
      type: 'statusChanged',
      taskId: 'task-100',
      message: 'Task "Database Schema" status changed to completed.',
      isRead: false,
      createdAt: '2026-10-29T11:00:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays notification bell in header, loads user notifications, and allows marking as read', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: memberUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project],
      total: 1,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    const getNotifsSpy = vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: notifications,
      total: 2,
      unreadCount: 2,
      page: 1,
      pages: 1
    });

    const markReadSpy = vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
      notification: { ...notifications[0], isRead: true }
    });

    render(<App />);

    // Wait for App to restore session and load
    expect(await screen.findByTestId('notification-bell')).toBeInTheDocument();

    // Verify notifications were fetched for authenticated user
    await waitFor(() => {
      expect(getNotifsSpy).toHaveBeenCalledWith('jwt-member-token');
    });

    // Badge indicates 2 unread notifications
    const badge = await screen.findByTestId('notification-badge');
    expect(badge).toHaveTextContent('2');

    // Click bell icon to open dropdown
    fireEvent.click(screen.getByTestId('notification-bell'));

    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();
    expect(
      screen.getByText('Task "Database Schema" has been assigned to you.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Task "Database Schema" status changed to completed.')
    ).toBeInTheDocument();

    // Click mark read on the first notification
    const markReadBtn = screen.getByTestId('btn-mark-read-notif-1');
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(markReadSpy).toHaveBeenCalledWith('notif-1', 'jwt-member-token');
    });

    // Unread count decrements to 1
    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
    });
  });

  it('ensures notifications persist and are displayed after page re-render / session restore', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: memberUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project],
      total: 1,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: [
        {
          _id: 'notif-persisted',
          recipientId: 'member-10',
          type: 'taskAssigned',
          taskId: 'task-100',
          message: 'Task "Persistent Task" has been assigned to you.',
          isRead: false,
          createdAt: '2026-10-29T08:00:00.000Z'
        }
      ],
      total: 1,
      unreadCount: 1,
      page: 1,
      pages: 1
    });

    // First render
    const { unmount } = render(<App />);
    expect(await screen.findByTestId('notification-bell')).toBeInTheDocument();
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('1');

    // Simulate page reload / unmount and re-render
    unmount();

    render(<App />);
    expect(await screen.findByTestId('notification-bell')).toBeInTheDocument();
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByText('Task "Persistent Task" has been assigned to you.')).toBeInTheDocument();
  });

  it('clicking a task assignment notification navigates to the project and opens task details modal', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: memberUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project],
      total: 1,
      page: 1,
      pages: 1
    });

    const mockTask = {
      _id: 'task-100',
      title: 'Database Schema',
      description: 'Design the DB tables and relations',
      priority: 'high',
      status: 'todo',
      deadline: '2026-11-20T23:59:59.999Z',
      projectId: 'proj-1',
      assigneeId: 'member-10'
    };

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [mockTask],
      total: 1,
      page: 1,
      pages: 1
    });

    const getTaskSpy = vi.spyOn(taskService, 'getTaskById').mockResolvedValue({
      task: mockTask
    });

    vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: [] });

    const markReadSpy = vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
      notification: { ...notifications[0], isRead: true }
    });

    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: notifications,
      total: 2,
      unreadCount: 2,
      page: 1,
      pages: 1
    });

    render(<App />);

    // Wait for session and notification bell
    expect(await screen.findByTestId('notification-bell')).toBeInTheDocument();
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('2');

    // Currently on dashboard view by default
    expect(screen.getByTestId('dashboard-view-container')).toHaveClass('app-view-active');

    // Open notification dropdown
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

    // Click assignment notification item
    const notifItem = screen.getByTestId('notification-item-notif-1');
    fireEvent.click(notifItem);

    // Dropdown closes
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();

    // Mark as read was dispatched
    expect(markReadSpy).toHaveBeenCalledWith('notif-1', 'jwt-member-token');

    // Unread count decremented immediately
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('1');

    // Task details was fetched
    expect(getTaskSpy).toHaveBeenCalledWith('task-100', 'jwt-member-token');

    // Navigated to tasks view
    await waitFor(() => {
      expect(screen.getByTestId('tasks-view-container')).toHaveClass('app-view-active');
    });

    // Task details modal is open displaying correct task information
    const modal = await screen.findByTestId('task-details-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Database Schema')).toBeInTheDocument();
    expect(within(modal).getByTestId('task-detail-description')).toHaveTextContent(
      'Design the DB tables and relations'
    );
  });

  it('clicking a task status-change notification switches to another project and opens task details', async () => {
    const project2 = {
      _id: 'proj-2',
      name: 'Project Apollo',
      teamLeaderId: 'leader-1',
      memberIds: ['member-10']
    };

    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: memberUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project, project2],
      total: 2,
      page: 1,
      pages: 1
    });

    const statusTask = {
      _id: 'task-apollo-5',
      title: 'Setup Redis Cache',
      description: 'Configure Redis cluster for Apollo',
      priority: 'medium',
      status: 'inProgress',
      deadline: '2026-11-25T23:59:59.999Z',
      projectId: 'proj-2',
      assigneeId: 'member-10'
    };

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getTaskById').mockResolvedValue({
      task: statusTask
    });

    vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: [] });

    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: [
        {
          _id: 'notif-status-apollo',
          recipientId: 'member-10',
          type: 'statusChanged',
          taskId: 'task-apollo-5',
          message: 'Task "Setup Redis Cache" status changed to inProgress.',
          isRead: true, // already read notification
          createdAt: '2026-10-29T11:00:00.000Z'
        }
      ],
      total: 1,
      unreadCount: 0,
      page: 1,
      pages: 1
    });

    render(<App />);

    expect(await screen.findByTestId('notification-bell')).toBeInTheDocument();

    // Open notifications
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

    // Click status changed notification
    fireEvent.click(screen.getByTestId('notification-item-notif-status-apollo'));

    // Navigates and opens details modal
    const modal = await screen.findByTestId('task-details-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Setup Redis Cache')).toBeInTheDocument();
    expect(within(modal).getByTestId('task-detail-description')).toHaveTextContent(
      'Configure Redis cluster for Apollo'
    );

    // Project select in App is now set to proj-2
    expect(screen.getByTestId('project-select')).toHaveValue('proj-2');
  });

  it('handles deleted tasks (404) gracefully with an appropriate error message and does not crash', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: memberUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project],
      total: 1,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    const notFoundError = new Error('Task was not found.');
    notFoundError.status = 404;
    notFoundError.code = 'TASK_NOT_FOUND';
    vi.spyOn(taskService, 'getTaskById').mockRejectedValue(notFoundError);

    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: [
        {
          _id: 'notif-deleted-task',
          recipientId: 'member-10',
          type: 'taskAssigned',
          taskId: 'deleted-task-id',
          message: 'Task "Old Feature" has been assigned to you.',
          isRead: false,
          createdAt: '2026-10-29T10:00:00.000Z'
        }
      ],
      total: 1,
      unreadCount: 1,
      page: 1,
      pages: 1
    });

    render(<App />);

    expect(await screen.findByTestId('notification-bell')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-item-notif-deleted-task'));

    // Safe handling: Error alert is displayed without crashing
    const errorEl = await screen.findByTestId('notification-task-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('This task is no longer available or was deleted.');

    // TaskDetailsModal is NOT open
    expect(screen.queryByTestId('task-details-modal')).not.toBeInTheDocument();
  });

  it('handles unauthorized tasks (403) safely with an appropriate permission message', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: memberUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [project],
      total: 1,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    const forbiddenError = new Error('You do not have access to this task.');
    forbiddenError.status = 403;
    forbiddenError.code = 'FORBIDDEN';
    vi.spyOn(taskService, 'getTaskById').mockRejectedValue(forbiddenError);

    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: [
        {
          _id: 'notif-forbidden-task',
          recipientId: 'member-10',
          type: 'taskAssigned',
          taskId: 'secret-task-id',
          message: 'Task "Confidential Task" has been assigned to you.',
          isRead: false,
          createdAt: '2026-10-29T10:00:00.000Z'
        }
      ],
      total: 1,
      unreadCount: 1,
      page: 1,
      pages: 1
    });

    render(<App />);

    expect(await screen.findByTestId('notification-bell')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-item-notif-forbidden-task'));

    // Safe handling: Permission error alert is displayed without crashing
    const errorEl = await screen.findByTestId('notification-task-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('You do not have permission to view this task.');

    // Modal is NOT open
    expect(screen.queryByTestId('task-details-modal')).not.toBeInTheDocument();
  });
});
