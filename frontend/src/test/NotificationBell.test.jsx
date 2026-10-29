import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { notificationService } from '../services/notificationService';

describe('NotificationBell Component (TM-F-017 / TC-NOTIF-01)', () => {
  const token = 'jwt-member-token';
  const currentUser = {
    _id: 'user-1',
    name: 'Alice Member',
    email: 'alice@example.com',
    role: 'teamMember'
  };

  const sampleNotifications = [
    {
      _id: 'notif-101',
      recipientId: 'user-1',
      type: 'taskAssigned',
      taskId: 'task-1',
      message: 'Task "Implement Auth" has been assigned to you.',
      isRead: false,
      createdAt: '2026-10-29T10:00:00.000Z'
    },
    {
      _id: 'notif-102',
      recipientId: 'user-1',
      type: 'statusChanged',
      taskId: 'task-2',
      message: 'Task "Design UI" status changed to inProgress.',
      isRead: true,
      createdAt: '2026-10-29T09:30:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders notification bell icon and fetches notifications on mount for authenticated user only', async () => {
    const getNotifsSpy = vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: sampleNotifications,
      total: 2,
      unreadCount: 1,
      page: 1,
      pages: 1
    });

    render(<NotificationBell token={token} currentUser={currentUser} />);

    // Bell button is visible
    const bellBtn = screen.getByTestId('notification-bell');
    expect(bellBtn).toBeInTheDocument();

    // Verify fetched with authenticated user's token
    await waitFor(() => {
      expect(getNotifsSpy).toHaveBeenCalledWith(token);
    });

    // Unread badge displays 1
    const badge = await screen.findByTestId('notification-badge');
    expect(badge).toHaveTextContent('1');
  });

  it('opens notifications dropdown when bell icon is clicked and lists notifications', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: sampleNotifications,
      total: 2,
      unreadCount: 1,
      page: 1,
      pages: 1
    });

    render(<NotificationBell token={token} currentUser={currentUser} />);

    // Click bell icon
    fireEvent.click(screen.getByTestId('notification-bell'));

    // Dropdown is opened
    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('notification-list')).toBeInTheDocument();

    // Both notification items are visible with correct messages
    expect(screen.getByTestId('notification-item-notif-101')).toBeInTheDocument();
    expect(screen.getByTestId('notification-message-notif-101')).toHaveTextContent(
      'Task "Implement Auth" has been assigned to you.'
    );
    expect(screen.getByTestId('notification-item-notif-102')).toBeInTheDocument();
    expect(screen.getByTestId('notification-message-notif-102')).toHaveTextContent(
      'Task "Design UI" status changed to inProgress.'
    );

    // Unread item has "Mark read" button
    expect(screen.getByTestId('btn-mark-read-notif-101')).toBeInTheDocument();
  });

  it('allows user to mark a specific notification as read and decrements unread count', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: sampleNotifications,
      total: 2,
      unreadCount: 1,
      page: 1,
      pages: 1
    });

    const markReadSpy = vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
      notification: { ...sampleNotifications[0], isRead: true }
    });

    render(<NotificationBell token={token} currentUser={currentUser} />);

    // Open dropdown
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

    // Click mark read
    const markReadBtn = screen.getByTestId('btn-mark-read-notif-101');
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(markReadSpy).toHaveBeenCalledWith('notif-101', token);
    });

    // Badge should disappear because unreadCount is now 0
    await waitFor(() => {
      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    });
  });

  it('allows user to mark all notifications as read', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: sampleNotifications,
      total: 2,
      unreadCount: 1,
      page: 1,
      pages: 1
    });

    const markAllSpy = vi.spyOn(notificationService, 'markAllAsRead').mockResolvedValue({
      message: 'All notifications marked as read.'
    });

    render(<NotificationBell token={token} currentUser={currentUser} />);

    // Open dropdown
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

    // Click mark all read
    const markAllBtn = screen.getByTestId('btn-mark-all-read');
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(markAllSpy).toHaveBeenCalledWith(token);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    });
  });

  it('displays empty state when user has no notifications', async () => {
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
      items: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      pages: 1
    });

    render(<NotificationBell token={token} currentUser={currentUser} />);

    fireEvent.click(screen.getByTestId('notification-bell'));

    expect(await screen.findByTestId('no-notifications')).toHaveTextContent(
      'No notifications yet.'
    );
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });
});
