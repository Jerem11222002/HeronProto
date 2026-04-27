import React, { useState, useEffect, useRef, useContext } from 'react';
import NotificationItem from './NotificationItem';
import { CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DarkModeContext } from '../../context/darkModeContext';
import { useNotificationCache } from '../../context/NotificationCacheContext';
import apiService from '../../services/apiService';
import './notifications.scss';

const NotificationDropdown = ({ onClose }) => {
  const { darkMode } = useContext(DarkModeContext);
  const cache = useNotificationCache();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 480 : false
  );
  const [navOffset, setNavOffset] = useState(() => {
    if (typeof window === 'undefined') return 64;
    const nav = document.querySelector('nav, .navbar, header, .topbar');
    if (!nav) return 64;
    const rect = nav.getBoundingClientRect();
    const style = window.getComputedStyle(nav);
    const isFixed = style.position === 'fixed' || style.position === 'sticky';
    return isFixed ? Math.ceil(rect.bottom) : Math.ceil(rect.bottom + window.scrollY);
  });

  const fetchNotifications = async (pageNum = 1, forceRefresh = false) => {
    try {
      // For page 1, check cache first (unless forcing refresh)
      if (pageNum === 1 && !forceRefresh && cache.isCacheValid()) {
        const cachedData = cache.getCachedNotifications();
        const cachedPagination = cache.getCachedPagination();
        setNotifications(cachedData);
        setHasMore(cachedPagination?.hasMore ?? false);
        setPage(pageNum);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      const response = await apiService.getNotifications(pageNum, 20);
      const { notifications: newNotifications, pagination } = response.data.data || response.data;
      
      // Ensure notifications is an array
      if (!Array.isArray(newNotifications)) {
        throw new Error('Invalid notifications format from server');
      }
      
      const updatedNotifications = pageNum === 1 ? newNotifications : [...notifications, ...newNotifications];
      
      // Cache only the first page data
      if (pageNum === 1) {
        cache.setCachedNotifications(newNotifications, pagination);
      }
      
      setNotifications(updatedNotifications);
      setHasMore(pagination?.hasMore ?? false);
      setPage(pageNum);
    } catch (err) {
      console.error('❌ Error fetching notifications:', err.message || err);
      // Handle both error formats from backend
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load notifications (after retries)';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      
      // Invalidate cache since data changed
      cache.invalidateCache();
      
      onClose?.();
    } catch (err) {
      console.error('❌ Error marking all as read:', err.message || err);
    }
  };

  const handleRefresh = () => {
    console.log('🔄 Refreshing notifications...');
    // Invalidate cache and fetch fresh
    cache.invalidateCache();
    fetchNotifications(1, true);
  };

  const handleNotificationUpdate = () => {
    // Invalidate cache when a notification is updated
    cache.invalidateCache();
    fetchNotifications(1, true);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1);
    }
  };

  useEffect(() => {
    // Fetch notifications on mount, or use cache if valid
    fetchNotifications();

    const socket = window.socket;
    if (socket) {
      socket.on('notification:new', (newNotification) => {
        setNotifications(prev => [newNotification, ...prev]);
      });
    }

    const onResize = () => {
      setIsMobile(window.innerWidth <= 480);
      const nav = document.querySelector('nav, .navbar, header, .topbar');
      if (!nav) {
        setNavOffset(64);
        return;
      }
      const rect = nav.getBoundingClientRect();
      const style = window.getComputedStyle(nav);
      const isFixed = style.position === 'fixed' || style.position === 'sticky';
      setNavOffset(isFixed ? Math.ceil(rect.bottom) : Math.ceil(rect.bottom + window.scrollY));
    };

    const onScroll = () => {
      const nav = document.querySelector('nav, .navbar, header, .topbar');
      if (!nav) return;
      const rect = nav.getBoundingClientRect();
      const style = window.getComputedStyle(nav);
      const isFixed = style.position === 'fixed' || style.position === 'sticky';
      if (!isFixed) {
        setNavOffset(Math.ceil(rect.bottom + window.scrollY));
      }
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (socket) {
        socket.off('notification:new');
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [cache]);

  const mobileCenterStyle = isMobile
    ? (()=>{
        const topPx = (navOffset || 64) + 8;
        const maxH = typeof window !== 'undefined' ? Math.max(window.innerHeight - topPx - 16, 120) : 400;
        const bgColor = darkMode ? '#1a1a1a' : '#fff';
        return {
          position: 'fixed',
          left: '50%',
          top: `${topPx}px`,
          transform: 'translateX(-50%)',
          zIndex: 2000,
          width: '92vw',
          maxWidth: 420,
          maxHeight: `${maxH}px`,
          overflowY: 'auto',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          background: bgColor,
          padding: 8,
          boxSizing: 'border-box'
        };
      })()
    : undefined;

  if (error) {
    return (
      <div className="notification-dropdown error" style={mobileCenterStyle}>
        <p>{error}</p>
        <button onClick={() => handleRefresh()} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="notification-dropdown" style={mobileCenterStyle}>
      <div className="notification-header">
        <h3>Notifications</h3>
        <div className="header-actions">
          <button 
            onClick={handleRefresh} 
            className="refresh-button" 
            title="Refresh notifications"
            disabled={loading}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </button>
          {notifications.length > 0 && (
            <button onClick={markAllAsRead} className="mark-all-read">
              Mark all as read
            </button>
          )}
        </div>
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
                onUpdate={handleNotificationUpdate}
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