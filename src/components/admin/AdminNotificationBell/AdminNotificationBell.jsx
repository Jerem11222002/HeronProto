import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import Badge from '@mui/material/Badge';
import AdminNotificationDropdown from './AdminNotificationDropdown';
import apiService from '../../../services/apiService';
import './adminNotificationBell.scss';

const AdminNotificationBell = memo(() => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState(null);
  const [organization, setOrganization] = useState(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');

      if (!token) {
        console.warn('[AdminNotificationBell] No admin token found');
        setError('Admin authentication required');
        setLoading(false);
        return;
      }

      const response = await apiService.getAdminNotificationStatus();

      if (response.data?.success) {
        setUnreadCount(response.data.unreadCount);
        setAdminRole(response.data.adminRole);
        setOrganization(response.data.organization);
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('[AdminNotificationBell] Error fetching unread count:', error);
      if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      }
      setError(error.response?.data?.message || 'Failed to load notifications');
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchUnreadCount();

    // Set up periodic refresh
    const refreshInterval = setInterval(fetchUnreadCount, 60000); // Every minute

    return () => {
      clearInterval(refreshInterval);
    };
  }, [fetchUnreadCount]);

  const handleClickOutside = useCallback((e) => {
    // Only close if clicking outside the bell component
    if (!e.target.closest('.admin-notification-bell')) {
      setShowDropdown(false);
    }
  }, []);

  const toggleDropdown = useCallback((e) => {
    e.stopPropagation();
    setShowDropdown(prev => !prev);
  }, []);

  const handleDropdownClose = useCallback(() => {
    setShowDropdown(false);
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDropdown, handleClickOutside]);

  // Listen for socket events for real-time updates
  useEffect(() => {
    const socket = window.socket;
    if (socket) {
      socket.on('admin:notification:new', () => {
        setUnreadCount(prev => prev + 1);
      });

      socket.on('admin:notification:read', () => {
        setUnreadCount(prev => Math.max(0, prev - 1));
      });

      socket.on('admin:notifications:clear', () => {
        setUnreadCount(0);
      });
    }

    return () => {
      if (socket) {
        socket.off('admin:notification:new');
        socket.off('admin:notification:read');
        socket.off('admin:notifications:clear');
      }
    };
  }, []);

  return (
    <div className="admin-notification-bell">
      <Badge
        badgeContent={loading ? '...' : unreadCount}
        color={error ? "error" : "primary"}
        className="admin-notification-badge"
        max={99}
        overlap="circular"
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <button
          className={`admin-notification-button ${error ? 'error' : ''} ${loading ? 'loading' : ''}`}
          onClick={toggleDropdown}
          aria-label={`${unreadCount} admin notifications${organization ? ` for ${organization}` : ''}`}
          title={`Admin Notifications${organization ? ` - ${organization}` : ''}${adminRole === 'super' ? ' (Superadmin)' : ''}`}
        >
          <NotificationsOutlinedIcon className="admin-notification-icon" />
        </button>
      </Badge>

      {showDropdown && (
        <div
          className="admin-notification-dropdown-wrapper"
          onClick={(e) => e.stopPropagation()}
        >
          <AdminNotificationDropdown
            onClose={handleDropdownClose}
            onError={(err) => setError(err)}
            adminRole={adminRole}
            organization={organization}
          />
        </div>
      )}
    </div>
  );
});

AdminNotificationBell.displayName = 'AdminNotificationBell';

export default AdminNotificationBell;
