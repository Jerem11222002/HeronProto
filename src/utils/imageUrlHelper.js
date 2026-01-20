// src/utils/imageUrlHelper.js

/**
 * Resolves and returns the correct image URL
 * Handles data URLs, http URLs, and server uploads
 * @param {string} imageSource - The image source (filename, data URL, or full URL)
 * @param {string} apiUrl - Optional custom API URL (defaults to env var)
 * @returns {string} - Full image URL
 */
export const getImageUrl = (imageSource, apiUrl = null) => {
  // Use default image if no source provided
  if (!imageSource || imageSource.trim() === '') {
    return '/assets/person/Default.jpg';
  }

  // If it's already a data URL, return as-is
  if (imageSource.startsWith('data:')) {
    return imageSource;
  }

  // If it's already a full HTTP/HTTPS URL, return as-is
  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    return imageSource;
  }

  // Otherwise, prepend the server uploads URL
  const baseUrl = apiUrl || (process.env.REACT_APP_API_URL || 'http://localhost:5000');
  return `${baseUrl}/uploads/${imageSource}`;
};

/**
 * Gets the best available profile picture from user object
 * Tries multiple possible property names
 * @param {object} user - User object with potential picture properties
 * @returns {string} - Profile picture source
 */
export const getUserProfilePic = (user) => {
  if (!user) return null;

  // Try different possible property names
  return (
    user.profilePicture ||
    user.profilePic ||
    user.avatar ||
    user.photo ||
    user.picture ||
    null
  );
};

/**
 * Gets the complete profile picture URL for a user
 * @param {object} user - User object
 * @param {string} apiUrl - Optional custom API URL
 * @returns {string} - Complete profile picture URL
 */
export const getUserProfilePicUrl = (user, apiUrl = null) => {
  const pic = getUserProfilePic(user);
  return getImageUrl(pic, apiUrl);
};

export default getImageUrl;
