/**
 * Token types for different user roles
 */
export const TokenTypes = {
  ADMIN: 'adminToken',
  USER: 'token'
};

/**
 * Save authentication data to localStorage
 * @param {Object} authData - Authentication response data
 * @param {boolean} isAdmin - Whether this is an admin login
 * @returns {Object|false} - Processed auth data or false if invalid
 */
export function saveAuthData({ token, user }, isAdmin = false) {
  try {
    if (isAdmin) {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
    } else {
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
    return { token, user };
  } catch (err) {
    return null;
  }
}

/**
 * Get authentication token
 * @param {boolean} isAdmin - Whether to get admin token
 * @returns {string|null} - The stored token or null
 */
export function getAuthToken(isAdmin = false) {
  return isAdmin ? localStorage.getItem('adminToken') : localStorage.getItem('token');
}

/**
 * Clear all authentication data from storage
 */
export function clearAuthData() {
  // remove only auth items, keep theme and userTheme_* keys intact
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('adminUser');
    // Do NOT remove 'theme' or 'userTheme_<id>' here so theme persists across logouts
  } catch (err) {
    // ignore
  }
}

/**
 * Validate JWT token
 * @param {string} token - The token to validate
 * @returns {boolean} - Whether the token is valid
 */
export function isTokenValid(token) {
  // Existing implementation or a lightweight check
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload && (!payload.exp || payload.exp * 1000 > Date.now());
  } catch (e) {
    return false;
  }
}

/**
 * Get user data from storage
 * @param {boolean} isAdmin - Whether to get admin user data
 * @returns {Object|null} - The stored user data or null
 */
export const getUserData = (isAdmin = false) => {
  try {
    const userData = localStorage.getItem(isAdmin ? 'adminUser' : 'currentUser');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('❌ Error parsing user data:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 * @param {boolean} requireAdmin - Whether to check for admin authentication
 * @returns {boolean} - Whether the user is authenticated
 */
export const isAuthenticated = (requireAdmin = false) => {
  try {
    const token = getAuthToken(requireAdmin);
    if (!token || !isTokenValid(token)) return false;

    const user = getUserData(requireAdmin);
    if (!user) return false;

    if (requireAdmin && (!user.isAdmin || !user.adminRole)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Auth check error:', error);
    return false;
  }
};

/**
 * Update stored user data
 * @param {Object} userData - New user data
 * @param {boolean} isAdmin - Whether updating admin user
 * @returns {boolean} - Success status
 */
export const updateUserData = (userData, isAdmin = false) => {
  try {
    if (!userData) return false;
    
    localStorage.setItem(
      isAdmin ? 'adminUser' : 'currentUser',
      JSON.stringify(userData)
    );
    return true;
  } catch (error) {
    console.error('❌ Error updating user data:', error);
    return false;
  }
};