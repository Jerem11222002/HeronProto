import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const DEFAULT_AVATARS = {
  male: '/assets/person/Male.jpg',
  female: '/assets/person/Female.jpg',
  default: '/assets/person/default-avatar.png'
};

export const useProfilePicture = (user, type = 'avatar') => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageSrc, setImageSrc] = useState('');
  const { socket } = useSocket();

  const getDefaultAvatar = useCallback((gender = 'default') => {
    const normalizedGender = gender?.toLowerCase()?.trim();
    return DEFAULT_AVATARS[normalizedGender] || DEFAULT_AVATARS.default;
  }, []);

  const getImageUrl = useCallback((imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${BASE_URL}/uploads/${imagePath.replace(/^\/+/, '')}`;
  }, []);

  const verifyImageUrl = useCallback(async (url) => {
    if (!url) return false;
    try {
      const response = await axios.head(url);
      return response.status === 200;
    } catch {
      return false;
    }
  }, []);

  const loadImage = useCallback(async () => {
    if (!user) {
      setImageSrc(getDefaultAvatar('default'));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const imageField = type === 'avatar' ? 'profilePic' : 'coverPic';
      const imageUrl = user[imageField];

      if (!imageUrl) {
        setImageSrc(getDefaultAvatar(user.gender));
        return;
      }

      const fullUrl = getImageUrl(imageUrl);
      const isValid = await verifyImageUrl(fullUrl);

      if (!isValid) {
        throw new Error('Image not accessible');
      }

      // Pre-load image
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = `${fullUrl}?t=${Date.now()}`;
      });

      setImageSrc(fullUrl);
    } catch (err) {
      console.warn('Profile image load failed:', {
        userId: user._id,
        imageField: type,
        error: err.message
      });
      setError(err);
      setImageSrc(getDefaultAvatar(user.gender));
    } finally {
      setIsLoading(false);
    }
  }, [user, type, getDefaultAvatar, getImageUrl, verifyImageUrl]);

  // Effect for initial load and updates
  useEffect(() => {
    loadImage();
  }, [loadImage, user?.[type === 'avatar' ? 'profilePic' : 'coverPic']]);

  // Socket updates
  useEffect(() => {
    if (!socket || !user?._id) return;

    const handleProfileUpdate = (data) => {
      if (data.userId === user._id) {
        const updates = data.updates || {};
        const relevantUpdate = type === 'avatar' ? updates.profilePic : updates.coverPic;
        if (relevantUpdate) {
          loadImage();
        }
      }
    };

    socket.on('user:profileUpdate', handleProfileUpdate);
    return () => socket.off('user:profileUpdate', handleProfileUpdate);
  }, [socket, user?._id, type, loadImage]);

  return [
    imageSrc,     // Current image URL or default avatar URL
    loadImage,    // Function to manually refresh the image
    isLoading,    // Loading state
    error         // Error state if any
  ];
};

export default useProfilePicture;