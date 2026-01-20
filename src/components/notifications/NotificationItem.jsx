import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getImageUrl, getDefaultAvatar } from '../../utils/imageUtils';
import { formatDistanceToNow } from 'date-fns';
import './notifications.scss';

// Add a built-in SVG fallback for user avatar
const DefaultUserSVG = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="#e6e6e6"/>
    <circle cx="20" cy="15" r="7" fill="#bdbdbd"/>
    <ellipse cx="20" cy="29" rx="10" ry="6" fill="#bdbdbd"/>
  </svg>
);

const NotificationItem = ({ notification, onUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const markAsRead = React.useCallback(async (notificationId) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.post(`/api/notifications/${notificationId}/read`, null, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
      });
      
      onUpdate?.(); // Call the update callback if provided
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setError('Failed to mark as read');
    } finally {
      setLoading(false);
    }
  }, [onUpdate]);

  const handleClick = React.useCallback(async () => {
    if (!notification.read && !loading) {
      await markAsRead(notification._id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'like':
      case 'comment':
        navigate(`/post/${notification.postId}`);
        break;
      case 'follow':
        navigate(`/profile/${notification.senderId}`);
        break;
      case 'message':
        navigate(`/messages/${notification.senderId}`);
        break;
      default:
        console.warn('Unknown notification type:', notification.type);
    }
  }, [notification, navigate, markAsRead, loading]);

  const getNotificationIcon = React.useCallback(() => {
    switch (notification.type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'follow':
        return '👥';
      case 'message':
        return '✉️';
      default:
        return '🔔';
    }
  }, [notification.type]);

  if (!notification?._id) return null;

  return (
    <div 
      className={`notification-item ${!notification.read ? 'unread' : ''} ${loading ? 'loading' : ''} ${error ? 'error' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${notification.type} notification from ${notification.senderName}`}
    >
      <div className="notification-avatar">
        {(notification.useSvgFallback || !notification.senderPic) ? (
          <DefaultUserSVG size={40} />
        ) : (
          <img 
            src={notification.senderPic || '/assets/person/Default.jpg'}
            alt={notification.senderName || 'User'}
            loading="lazy"
            onError={(e) => {
              if (e.target.src !== '/assets/person/Default.jpg') {
                e.target.src = '/assets/person/Default.jpg';
              }
            }}
          />
        )}
        <span className="notification-type-icon" aria-hidden="true">
          {getNotificationIcon()}
        </span>
      </div>

      <div className="notification-content">
        <p className="notification-message">
          <strong>{notification.senderName}</strong> {notification.message}
        </p>
        <span className="notification-time" title={new Date(notification.createdAt).toLocaleString()}>
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </span>
        {error && <span className="notification-error">{error}</span>}
      </div>

      {notification.postImage && (
        <div className="notification-preview">
          <img 
            src={getImageUrl(notification.postImage)}
            alt="Post preview"
            onError={(e) => e.target.style.display = 'none'}
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    type: PropTypes.string.isRequired,
    from: PropTypes.object,
    createdAt: PropTypes.string,
    read: PropTypes.bool
  }).isRequired
};

export default React.memo(NotificationItem);