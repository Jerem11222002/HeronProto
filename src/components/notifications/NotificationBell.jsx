import React, { useState, useEffect, useCallback } from 'react';
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import Badge from "@mui/material/Badge";
import axios from 'axios';
import NotificationDropdown from './NotificationDropdown';
import './notifications.scss';

const NotificationBell = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);


  const fetchUnreadCount = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No auth token found');
        setError('Authentication required');
        return;
      }
  
      const response = await axios.get('/api/notifications/status', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        baseURL: process.env.REACT_APP_API_BASE_URL // Use the existing env variable
      });
  
      if (response.data?.success) {
        setUnreadCount(response.data.unreadCount);
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setError(error.response?.data?.message || 'Failed to load notifications');
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleClickOutside = useCallback(() => {
    setShowDropdown(false);
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
    fetchUnreadCount();

    // Set up event listener for clicks outside
    document.addEventListener('click', handleClickOutside);

    // Socket listener for new notifications
    const socket = window.socket;
    if (socket) {
      socket.on('notification:new', () => {
        setUnreadCount(prev => prev + 1);
      });

      socket.on('notification:read', () => {
        setUnreadCount(prev => Math.max(0, prev - 1));
      });

      socket.on('notifications:clear', () => {
        setUnreadCount(0);
      });
    }

    // Periodic refresh of unread count
    const refreshInterval = setInterval(fetchUnreadCount, 60000); // Every minute

    return () => {
      document.removeEventListener('click', handleClickOutside);
      if (socket) {
        socket.off('notification:new');
        socket.off('notification:read');
        socket.off('notifications:clear');
      }
      clearInterval(refreshInterval);
    };
  }, [fetchUnreadCount, handleClickOutside]);

  return (
    <div className="notification-bell">
      <Badge 
        badgeContent={loading ? '...' : unreadCount} 
        color={error ? "error" : "primary"}
        className="notification-badge"
        max={99}
      >
        <NotificationsOutlinedIcon 
          onClick={!loading ? toggleDropdown : undefined}
          className={`nav-icon ${error ? 'error' : ''} ${loading ? 'loading' : ''}`}
        />
      </Badge>
      
      {showDropdown && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="notification-dropdown-wrapper"
        >
          <NotificationDropdown 
            onClose={handleDropdownClose}
            onError={() => setError(true)}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(NotificationBell);
