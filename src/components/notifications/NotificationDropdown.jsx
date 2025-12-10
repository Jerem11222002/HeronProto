import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NotificationItem from './NotificationItem';
import { CircularProgress } from '@mui/material';
import './notifications.scss';

const NotificationDropdown = ({ onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await axios.get('/api/notifications', {
        params: { page: pageNum, limit: 20 },
        headers: {
          Authorization: `Bearer ${token}`
        },
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
      });

      const { notifications: newNotifications, pagination } = response.data;
      
      setNotifications(prev => 
        pageNum === 1 ? newNotifications : [...prev, ...newNotifications]
      );
      setHasMore(pagination.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/notifications/read-all', null, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
      });
      
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      onClose?.();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const socket = window.socket;
    if (socket) {
      socket.on('notification:new', (newNotification) => {
        setNotifications(prev => [newNotification, ...prev]);
      });
    }

    return () => {
      if (socket) {
        socket.off('notification:new');
      }
    };
  }, []);

  if (error) {
    return (
      <div className="notification-dropdown error">
        <p>{error}</p>
        <button onClick={() => fetchNotifications(1)} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="notification-dropdown">
      <div className="notification-header">
        <h3>Notifications</h3>
        {notifications.length > 0 && (
          <button onClick={markAllAsRead} className="mark-all-read">
            Mark all as read
          </button>
        )}
      </div>

      <div className="notification-list">
        {notifications.length === 0 && !loading ? (
          <div className="no-notifications">
            <p>No notifications yet</p>
          </div>
        ) : (
          <>
            {notifications.map(notification => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onUpdate={fetchNotifications}
              />
            ))}
            {loading && (
              <div className="loading-more">
                <CircularProgress size={24} />
              </div>
            )}
            {hasMore && !loading && (
              <button onClick={loadMore} className="load-more-button">
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(NotificationDropdown);
