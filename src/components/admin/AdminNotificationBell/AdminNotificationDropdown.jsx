import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import SecurityIcon from '@mui/icons-material/Security';
import EventIcon from '@mui/icons-material/Event';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { DarkModeContext } from '../../../context/darkModeContext';
import apiService from '../../../services/apiService';
import './adminNotificationDropdown.scss';

const AdminNotificationDropdown = ({ onClose, onError, adminRole, organization }) => {
  const navigate = useNavigate();
  const { darkMode } = useContext(DarkModeContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async (pageNum = 1, forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getAdminNotifications(pageNum, 20);
      const { notifications: newNotifications, pagination } = response.data.data || {};

      if (!Array.isArray(newNotifications)) {
        throw new Error('Invalid notifications format from server');
      }

      // Use functional update to avoid dependency on notifications state
      setNotifications(prev => pageNum === 1
        ? newNotifications
        : [...prev, ...newNotifications]
      );
      setHasMore(pagination?.hasMore ?? false);
      setPage(pageNum);
    } catch (err) {
      console.error('[AdminNotificationDropdown] Error fetching notifications:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load notifications';
      setError(errorMsg);
      onError?.(errorMsg);

      if (err.response?.status === 401) {
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  // Removed notifications from dependencies to prevent infinite loop
  }, [navigate, onError]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiService.markAdminNotificationAsRead(notificationId);

      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, read: true } : notif
      ));
    } catch (err) {
      console.error('[AdminNotificationDropdown] Error marking as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiService.markAllAdminNotificationsAsRead();

      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      onClose?.();
    } catch (err) {
      console.error('[AdminNotificationDropdown] Error marking all as read:', err);
    }
  }, [onClose]);

  const deleteNotification = useCallback(async (notificationId, e) => {
    e.stopPropagation();
    try {
      await apiService.deleteAdminNotification(notificationId);

      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
    } catch (err) {
      console.error('[AdminNotificationDropdown] Error deleting notification:', err);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchNotifications(1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasMore, page]);

  const handleNotificationClick = useCallback((notification) => {
    if (!notification.read) {
      markAsRead(notification._id);
    }

    // Navigate based on notification type and actionUrl
    if (notification.actionUrl) {
      // For registration notifications, add query params to open specific participant
      if (notification.type === 'organization_registration' && notification.data?.registrationId) {
        const params = new URLSearchParams();
        params.set('registration', notification.data.registrationId);
        if (notification.data?.eventId) {
          params.set('event', notification.data.eventId);
        }
        // Handle old URL format (/admin/events/:id/registrations) by redirecting to /admin/participants
        if (notification.actionUrl.includes('/registrations')) {
          navigate(`/admin/participants?${params.toString()}`);
        } else {
          navigate(`${notification.actionUrl}?${params.toString()}`);
        }
      } else {
        navigate(notification.actionUrl);
      }
    } else {
      // Default navigation based on type
      switch (notification.type) {
        case 'permission_update':
          navigate('/admin/settings');
          break;
        case 'organization_event':
          if (notification.data?.eventId) {
            navigate(`/admin/events/${notification.data.eventId}`);
          }
          break;
        case 'organization_registration':
          if (notification.data?.eventId && notification.data?.registrationId) {
            navigate(`/admin/participants?registration=${notification.data.registrationId}&event=${notification.data.eventId}`);
          } else if (notification.data?.eventId) {
            navigate(`/admin/participants?event=${notification.data.eventId}`);
          } else {
            navigate('/admin/participants');
          }
          break;
        case 'superadmin_alert':
          navigate('/admin/accounts');
          break;
        default:
          break;
      }
    }

    onClose?.();
  }, [markAsRead, navigate, onClose]);

  const getNotificationIcon = useCallback((type) => {
    switch (type) {
      case 'permission_update':
        return <AdminPanelSettingsIcon className="type-icon permission" />;
      case 'organization_event':
      case 'organization_registration':
      case 'organization_update':
        return <BusinessIcon className="type-icon organization" />;
      case 'superadmin_alert':
        return <SecurityIcon className="type-icon alert" />;
      case 'admin_assigned':
        return <AdminPanelSettingsIcon className="type-icon assigned" />;
      default:
        return <NotificationsIcon className="type-icon default" />;
    }
  }, []);

  const getNotificationTypeLabel = useCallback((type) => {
    switch (type) {
      case 'permission_update':
        return 'Permission Update';
      case 'organization_event':
        return 'Organization Event';
      case 'organization_registration':
        return 'Registration';
      case 'organization_update':
        return 'Organization Update';
      case 'superadmin_alert':
        return 'Superadmin Alert';
      case 'admin_assigned':
        return 'Admin Assigned';
      default:
        return 'Notification';
    }
  }, []);

  const formatTimeAgo = useCallback((date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}y ago`;
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    return `${seconds}s ago`;
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  if (error) {
    return (
      <div className={`admin-notification-dropdown error ${darkMode ? 'dark' : ''}`} ref={dropdownRef}>
        <div className="dropdown-header">
          <h3>Admin Notifications</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="error-content">
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            <RefreshIcon sx={{ fontSize: 16, marginRight: '4px' }} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-notification-dropdown ${darkMode ? 'dark' : ''}`} ref={dropdownRef}>
      <div className="dropdown-header">
        <div className="header-title">
          <h3>Admin Notifications</h3>
          {organization && (
            <span className="org-badge">
              <BusinessIcon sx={{ fontSize: 12 }} />
              {organization}
            </span>
          )}
          {adminRole === 'super' && (
            <span className="role-badge super">Superadmin</span>
          )}
        </div>
        <div className="header-actions">
          <button
            onClick={handleRefresh}
            className="refresh-btn"
            title="Refresh notifications"
            disabled={loading}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </button>
          {notifications.length > 0 && (
            <button onClick={markAllAsRead} className="mark-all-btn">
              Mark all read
            </button>
          )}
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="notification-list">
        {notifications.length === 0 && !loading ? (
          <div className="empty-state">
            <NotificationsIcon sx={{ fontSize: 48, opacity: 0.3 }} />
            <p>No notifications</p>
            {organization && <span className="empty-org">for {organization}</span>}
          </div>
        ) : (
          <>
            {notifications.map(notification => (
              <div
                key={notification._id}
                className={`notification-item ${!notification.read ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-icon-wrapper">
                  {getNotificationIcon(notification.type)}
                  {!notification.read && <span className="unread-dot" />}
                </div>

                <div className="notification-content">
                  <div className="notification-meta">
                    <span className="type-label">
                      {getNotificationTypeLabel(notification.type)}
                    </span>
                    <span className="time-ago">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  {notification.organization && notification.organization !== organization && (
                    <span className="org-tag">{notification.organization}</span>
                  )}
                </div>

                <button
                  className="delete-btn"
                  onClick={(e) => deleteNotification(notification._id, e)}
                  title="Delete notification"
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </button>
              </div>
            ))}

            {loading && (
              <div className="loading-more">
                <CircularProgress size={20} />
              </div>
            )}

            {hasMore && !loading && (
              <button onClick={loadMore} className="load-more-btn">
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(AdminNotificationDropdown);
