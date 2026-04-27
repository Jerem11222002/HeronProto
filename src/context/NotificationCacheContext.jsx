import React, { createContext, useContext, useRef } from 'react';

const NotificationCacheContext = createContext();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const NotificationCacheProvider = ({ children }) => {
  const cacheRef = useRef({
    data: null,
    pagination: null,
    timestamp: null
  });

  const isCacheValid = () => {
    if (!cacheRef.current.data || !cacheRef.current.timestamp) {
      return false;
    }
    const age = Date.now() - cacheRef.current.timestamp;
    return age < CACHE_TTL;
  };

  const getCachedNotifications = () => {
    if (isCacheValid()) {
      const timeLeft = Math.round((CACHE_TTL - (Date.now() - cacheRef.current.timestamp)) / 1000);
      console.log('📦 Using cached notifications (valid for', timeLeft, 's)');
      return cacheRef.current.data;
    }
    return null;
  };

  const getCachedPagination = () => {
    if (isCacheValid()) {
      return cacheRef.current.pagination;
    }
    return null;
  };

  const setCachedNotifications = (notifications, pagination) => {
    cacheRef.current = {
      data: notifications,
      pagination: pagination,
      timestamp: Date.now()
    };
    console.log('💾 Cached notifications for', Math.round(CACHE_TTL / 1000), 'seconds');
  };

  const invalidateCache = () => {
    cacheRef.current = {
      data: null,
      pagination: null,
      timestamp: null
    };
  };

  return (
    <NotificationCacheContext.Provider
      value={{
        isCacheValid,
        getCachedNotifications,
        getCachedPagination,
        setCachedNotifications,
        invalidateCache
      }}
    >
      {children}
    </NotificationCacheContext.Provider>
  );
};

export const useNotificationCache = () => {
  const context = useContext(NotificationCacheContext);
  if (!context) {
    throw new Error('useNotificationCache must be used within NotificationCacheProvider');
  }
  return context;
};
