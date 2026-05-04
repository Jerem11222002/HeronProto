import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import Badge from '@mui/material/Badge';
import { toast } from 'react-toastify';
import { useSocket } from '../../../context/SocketContext';
import AdminNotificationDropdown from './AdminNotificationDropdown';
import apiService from '../../../services/apiService';
import './adminNotificationBell.scss';

const AdminNotificationBell = memo(() => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState(null);
  const [organization, setOrganization] = useState(null);
  const isInitialLoadRef = useRef(true);

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
        const newUnreadCount = response.data.unreadCount;
        
        setUnreadCount(newUnreadCount);
        setAdminRole(response.data.adminRole);
        setOrganization(response.data.organization);
        setError(null);
        
        // Show toast for unread notifications on initial load only
        // Track the last shown count in localStorage to avoid showing the same notifications again
        if (isInitialLoadRef.current && newUnreadCount > 0) {
          const lastShownCount = parseInt(localStorage.getItem('adminNotificationLastShown') || '0', 10);
          
          // Only show toast if there are NEW unread notifications (count increased)
          if (newUnreadCount > lastShownCount) {
            const newNotificationsCount = newUnreadCount - lastShownCount;
            console.log('[AdminNotificationBell] Showing toast for new unread notifications:', newNotificationsCount);
            
            if (newNotificationsCount === 1) {
              toast.info('You have 1 new notification', {
                position: 'top-right',
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              });
            } else {
              toast.info(`You have ${newNotificationsCount} new notifications`, {
                position: 'top-right',
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              });
            }
            
            // Update the last shown count
            localStorage.setItem('adminNotificationLastShown', newUnreadCount.toString());
          }
          
          isInitialLoadRef.current = false;
        }
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
    
    // Update the last shown count when dropdown closes (user has seen the notifications)
    // This prevents showing toasts for notifications the user has already viewed
    const currentCount = unreadCount;
    if (currentCount === 0) {
      // If all notifications are read, reset the counter
      localStorage.setItem('adminNotificationLastShown', '0');
    }
  }, [fetchUnreadCount, unreadCount]);
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
    console.log('[AdminNotificationBell] Socket setup:', {
      socketExists: !!socket,
      socketConnected: isConnected
    });
    
    if (!socket || !isConnected) {
      console.warn('[AdminNotificationBell] Socket not available or not connected');
      return;
    }

    const handleNewNotification = (data) => {
      console.log('[AdminNotificationBell] Received admin:notification:new event:', data);
      
      setUnreadCount(prev => prev + 1);
      
      // Show toast notification
      const notificationType = data?.type || 'notification';
      const severity = data?.severity || '';
      const title = data?.title || '';
      
      let message = 'New admin notification';
      if (notificationType === 'bug_report') {
        message = `New ${severity} bug report${title ? `: ${title}` : ''}`;
      } else if (notificationType === 'organization_registration') {
        message = 'New event registration';
      } else if (notificationType === 'organization_event') {
        message = 'New organization event';
      }
      
      console.log('[AdminNotificationBell] Showing toast:', message);
      
      toast.info(message, {
        position: 'top-right',
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    };

    const handleNotificationRead = () => {
      console.log('[AdminNotificationBell] Received admin:notification:read event');
      setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleNotificationsClear = () => {
      console.log('[AdminNotificationBell] Received admin:notifications:clear event');
      setUnreadCount(0);
    };

    socket.on('admin:notification:new', handleNewNotification);
    socket.on('admin:notification:read', handleNotificationRead);
    socket.on('admin:notifications:clear', handleNotificationsClear);

    return () => {
      socket.off('admin:notification:new', handleNewNotification);
      socket.off('admin:notification:read', handleNotificationRead);
      socket.off('admin:notifications:clear', handleNotificationsClear);
    };
  }, [socket, isConnected]);

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
            isOpen={showDropdown}
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
