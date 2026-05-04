/**
 * Centralized API service with exponential backoff retry for all requests
 * Handles notifications and messages with automatic retry on transient failures
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create instance with retry config built-in
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 65000 // Match backend 60s timeout + 5s buffer
});

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 500; // ms

const isRetryableError = (error) => {
  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Network errors
  if (!error.response) {
    return true;
  }

  // Server errors that might be transient
  const retryableStatuses = [408, 429, 500, 502, 503, 504, 522, 524];
  return retryableStatuses.includes(error.response.status);
};

const retryWithBackoff = async (fn, retryCount = 0) => {
  try {
    return await fn();
  } catch (error) {
    // Don't retry authentication errors
    if (error.response?.status === 401) {
      throw error;
    }

    if (isRetryableError(error) && retryCount < MAX_RETRIES) {
      const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.warn(
        `⚠️  API request failed (attempt ${retryCount + 1}/${MAX_RETRIES}), ` +
        `retrying in ${delayMs}ms: ${error.message}`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return retryWithBackoff(fn, retryCount + 1);
    }

    throw error;
  }
};

// API Methods with automatic retry
export const apiService = {
  // Notifications
  getNotifications: (page = 1, limit = 20) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.get('/api/notifications', {
        params: { page, limit },
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  getNotificationStatus: () =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.get('/api/notifications/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  markNotificationAsRead: (notificationId) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.post(`/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  markAllNotificationsAsRead: () =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.post('/api/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  // Admin Notifications
  getAdminNotifications: (page = 1, limit = 20) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('adminToken');
      return api.get('/api/admin/notifications', {
        params: { page, limit },
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  getAdminNotificationStatus: () =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('adminToken');
      return api.get('/api/admin/notifications/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  markAdminNotificationAsRead: (notificationId) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('adminToken');
      return api.post(`/api/admin/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  markAllAdminNotificationsAsRead: () =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('adminToken');
      return api.post('/api/admin/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  deleteAdminNotification: (notificationId) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('adminToken');
      return api.delete(`/api/admin/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  // Messages
  getConversations: (page = 1, limit = 20) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.get('/api/messages/conversations', {
        params: { page, limit },
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  getMessages: (conversationId, page = 1, limit = 30) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.get(`/api/messages/conversations/${conversationId}/messages`, {
        params: { page, limit },
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  startConversation: (userId) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.post(`/api/messages/start/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  sendMessage: (conversationId, messageData) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('token');
      return api.post(`/api/messages/conversations/${conversationId}/messages`, messageData, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }),

  // Bug Reports (Admin Only)
  getAdminBugReports: (limit = 50) =>
    retryWithBackoff(async () => {
      const token = localStorage.getItem('adminToken');
      return api.get('/api/bug-reports/all', {
        params: { limit },
        headers: { Authorization: `Bearer ${token}` }
      });
    })
};

export default apiService;
