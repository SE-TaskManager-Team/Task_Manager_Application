import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '../../services/notificationService';

export function NotificationBell({ token, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationService.getNotifications(token);
      const items = Array.isArray(data?.items) ? data.items : [];
      setNotifications(items);
      const unread = typeof data?.unreadCount === 'number'
        ? data.unreadCount
        : items.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Initial load and periodic polling (every 60s per TM-F-017 / API contract)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id, token);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || 'Failed to mark notification as read.');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(token);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || 'Failed to mark all as read.');
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="notification-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={handleToggle}
        aria-label="Notifications"
        data-testid="notification-bell"
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge" data-testid="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown" data-testid="notification-dropdown">
          <div className="notification-header">
            <h4>Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}</h4>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  data-testid="btn-mark-all-read"
                  title="Mark all as read"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={fetchNotifications}
                data-testid="btn-refresh-notifications"
                title="Refresh notifications"
              >
                🔄
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ margin: '0.5rem', padding: '0.5rem' }}>
              {error}
            </div>
          )}

          {isLoading && notifications.length === 0 ? (
            <div className="notification-empty" data-testid="loading-notifications">
              Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty" data-testid="no-notifications">
              No notifications yet.
            </div>
          ) : (
            <ul className="notification-list" data-testid="notification-list">
              {notifications.map((item) => (
                <li
                  key={item._id}
                  className={`notification-item ${!item.isRead ? 'unread' : ''}`}
                  data-testid={`notification-item-${item._id}`}
                >
                  <div className="notification-item-body">
                    <span className="notification-icon">
                      {item.type === 'taskAssigned' ? '📋' : '🔄'}
                    </span>
                    <span
                      className="notification-message"
                      data-testid={`notification-message-${item._id}`}
                    >
                      {item.message}
                    </span>
                  </div>
                  <div className="notification-item-meta">
                    <span className="notification-time">{formatTime(item.createdAt)}</span>
                    {!item.isRead && (
                      <button
                        type="button"
                        className="notification-mark-read-btn"
                        onClick={() => handleMarkAsRead(item._id)}
                        data-testid={`btn-mark-read-${item._id}`}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
