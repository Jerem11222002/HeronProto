// src/config/api.js
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const API_ENDPOINTS = {
  COMMENTS: (postId) => `${API_URL}/api/posts/${postId}/comments`,
};
