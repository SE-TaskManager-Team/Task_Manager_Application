import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});
