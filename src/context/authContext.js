import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { io } from "socket.io-client";
import axios from 'axios';
import { 
  saveAuthData, 
  clearAuthData, 
  getAuthToken, 
  isTokenValid as checkTokenValidity 
} from '../utils/tokenManager';
import { DarkModeContext } from './darkModeContext';

export const AuthContext = createContext({
  currentUser: null,
  loading: true,
  isAdmin: false,
  userRelationships: {
    following: [],
    followers: [],
    mutualFriends: []
  },
  setCurrentUser: () => {},
  login: async () => false,
  adminLogin: async () => false,
  logout: () => {},
  adminLogout: () => {},
  refreshUser: async () => {},
  fetchUserRelationships: async () => {},
  updateUserRelationships: () => {},
  followUser: async () => false,
  unfollowUser: async () => false,
  checkMutualFollow: () => false,
  updateRelationshipStatus: () => {},
  updateSetupFlags: async () => false,
  updateUserProfile: async () => false,
  initialized: false
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthContextProvider');
  }
  return context;
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';


export const AuthContextProvider = ({ children }) => {
  // read dark mode setter from context so we can sync user's saved theme on login/refresh
  const dmCtx = useContext(DarkModeContext) || {};
  const setDarkModeFromCtx = typeof dmCtx.setDarkMode === 'function' ? dmCtx.setDarkMode : null;

  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [userRelationships, setUserRelationships] = useState({
    following: [],
    followers: [],
    mutualFriends: []
  });
  
  const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

  // Fetch saved settings from server and apply/persist theme
  const fetchAndApplyUserSettings = useCallback(async (userId, token) => {
    if (!userId) return;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${BASE_URL}/api/users/settings`, { headers });
      const settings = res?.data;
      const theme = settings?.theme;
      if (theme) {
        try {
          localStorage.setItem('theme', theme);
          localStorage.setItem(`userTheme_${userId}`, theme);
        } catch (e) { /* ignore storage errors */ }
        if (setDarkModeFromCtx) setDarkModeFromCtx(theme === 'dark');
      }
    } catch (err) {
      console.warn('Could not fetch user settings:', err?.message || err);
    }
  }, [BASE_URL, setDarkModeFromCtx]);

  // Fixed JWT validation with proper base64 decoding
  // Replace the existing isTokenValid function with one that accepts either
  // a token string OR an isAdmin boolean flag.
  const isTokenValid = useCallback((arg) => {
    try {
      // If a token string was passed, validate it directly
      if (typeof arg === 'string' && arg.length > 0) {
        return checkTokenValidity(arg);
      }
      // Otherwise treat arg as boolean isAdmin flag (default false)
      const isAdminFlag = Boolean(arg);
      const token = getAuthToken(isAdminFlag);
      return checkTokenValidity(token);
    } catch (error) {
      console.error("ðŸ”‘ Token validation error:", error.message);
      return false;
    }
  }, []);

  const fetchUserRelationships = useCallback(async (userId) => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // fetch endpoints (some endpoints return array directly, others wrap with { success, data })
      const [mutualRes, followingRes, followersRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/users/${userId}/mutual-friends`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/api/users/${userId}/following`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/api/users/${userId}/followers`, { headers }).catch(() => ({ data: [] }))
      ]);

      const extractArray = (r) => {
        if (!r) return [];
        const body = r.data ?? r;
        if (Array.isArray(body)) return body;
        if (Array.isArray(body.data)) return body.data;
        if (body && body.success && Array.isArray(body.data)) return body.data;
        return [];
      };

      const normalizeUsers = (arr) => (extractArray(arr) || []).map(u => ({
        ...u,
        _id: String(u._id || u.id || ''),
        name: u.name || '',
        username: u.username || '',
        profilePic: u.profilePic || u.profilePicture || null,
        sex: u.sex || u.gender || null
      }));

      const mutual = normalizeUsers(mutualRes);
      const following = normalizeUsers(followingRes);
      const followers = normalizeUsers(followersRes);

      setUserRelationships({
        mutualFriends: mutual,
        following,
        followers
      });

      setInitialized(true);
      return true;
    } catch (error) {
      console.error('âŒ Relationship fetch failed:', error);
      return false;
    }
  }, [BASE_URL]);

  const clearAuthState = useCallback(() => {
    setCurrentUser(null);
    setIsAdmin(false);
    setUserRelationships({ following: [], followers: [], mutualFriends: [] });
    setInitialized(false);
    clearAuthData();
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const getDefaultProfilePic = (sex) => 
    sex === 'female' ? '/assets/person/Female.jpg' : '/assets/person/Male.jpg';

  const normalizeUserData = useCallback((userData) => {
    if (!userData) return null;

    // Handle relative URLs and admin normalization
    const normalizeUrl = (url) =>
      url && url.startsWith('http') ? url : url ? `${BASE_URL}${url}` : '';

    const profilePic = normalizeUrl(
      userData.profilePic ||
      userData.profilePicture ||
      getDefaultProfilePic(userData.gender || userData.sex)
    );
    const profilePicture = profilePic; // Always keep them in sync

    // Normalize common identity fields
    const studentId = userData.studentId || userData.studentID || userData.student_id || userData.student_number || null;
    const phone = userData.phone || userData.phoneNumber || userData.mobile || null;

    // Normalize admin fields so router guards can read role/permissions
    const normalizeAdmin = () => {
      const adminRole = userData.adminRole || userData.role || null;
      let adminPermissions = userData.adminPermissions || userData.permissions || {};
      // if backend returned permissions as an array, convert to lookup object
      if (Array.isArray(adminPermissions)) {
        adminPermissions = adminPermissions.reduce((acc, p) => {
          acc[p] = true;
          return acc;
        }, {});
      }
      return { adminRole, adminPermissions };
    };

    if (userData.isAdmin) {
      const { adminRole, adminPermissions } = normalizeAdmin();
      return {
        ...userData,
        id: userData._id || userData.id,
        _id: userData._id || userData.id,
        interestsSelected: true,
        profileSetup: true,
        profilePic,
        profilePicture,
        coverPic: normalizeUrl(userData.coverPic),
        isAdmin: true,
        studentId,
        phone,
        adminRole,
        adminPermissions
      };
    }
 
    return {
      ...userData,
      id: userData._id || userData.id,
      _id: userData._id || userData.id,
      interestsSelected: Boolean(userData.interestsSelected),
      profileSetup: Boolean(userData.profileSetup),
      profilePic,
      profilePicture,
      coverPic: normalizeUrl(userData.coverPic),
      studentId,
      phone
    };
  }, [BASE_URL]);

  const adminLogin = useCallback(async (username, password) => {
    setLoading(true);
    try {
      clearAuthData();
      setCurrentUser(null);

      const response = await axios.post(`${BASE_URL}/api/admin/auth/login`, {
        username: username.toLowerCase(),
        password
      });

      if (!response.data?.token || !response.data?.user) {
        throw new Error('Invalid admin response from server');
      }

      // Normalize user before saving
      const normalizedUser = normalizeUserData(response.data.user);
      // Save to storage
      saveAuthData({
        token: response.data.token,
        user: normalizedUser
      }, true);

      setCurrentUser(normalizedUser);
      setIsAdmin(true);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      await fetchAndApplyUserSettings(normalizedUser._id || normalizedUser.id, response.data.token);

      setLoading(false);
      return {
        success: true,
        data: {
          token: response.data.token,
          user: normalizedUser
        }
      };

    } catch (error) {
      console.error("âŒ Admin login failed:", error);
      clearAuthData();
      setLoading(false);
      throw error;
    }
  }, [BASE_URL, normalizeUserData, fetchAndApplyUserSettings]);


  const adminLogout = useCallback(async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (token) {
        await axios.post(`${BASE_URL}/api/admin/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error("âŒ Admin logout error:", error);
    } finally {
      clearAuthState();
    }
  }, [BASE_URL, clearAuthState]);

    const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      // Clear previous auth state
      clearAuthData();
      setCurrentUser(null);
      setIsAdmin(false);
  
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: username.toLowerCase(),
        password
      });
  
      console.log('ðŸ“¡ Login API response:', response);
  
      if (!response.data?.token || !response.data?.user) {
        throw new Error('Invalid response from server');
      }
  
      // Save auth data using token manager
      const authData = saveAuthData({
        token: response.data.token,
        user: response.data.user
      }, false);
  
      if (!authData) {
        throw new Error('Failed to save authentication data');
      }
  
      // Set current user and axios defaults
      const normalizedUser = normalizeUserData(authData.user);
      setCurrentUser(normalizedUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${authData.token}`;
      // fetch and apply server-saved settings and theme
      await fetchAndApplyUserSettings(normalizedUser._id || normalizedUser.id, authData.token);
  
      if (!normalizedUser.isAdmin) {
        await fetchUserRelationships(normalizedUser._id);
      }
  
      setLoading(false);
      return {
        success: true,
        data: {
          token: authData.token,
          user: normalizedUser
        }
      };
  
    } catch (error) {
      console.error("âŒ Login failed:", error);
      clearAuthData();
      setLoading(false);
      throw error;
    }
  }, [BASE_URL, normalizeUserData, fetchUserRelationships, clearAuthData, fetchAndApplyUserSettings]);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error("âŒ Logout error:", error);
    } finally {
      clearAuthState();
    }
  }, [BASE_URL, clearAuthState]);

    const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      await logout();
      return false;
    }
  
    try {
      // First verify token validity
      if (!isTokenValid(token)) {
        throw new Error("Token expired");
      }
  
      const response = await axios.get(`${BASE_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.data.success || !response.data.user) {
        throw new Error("Verification failed");
      }
  
      const normalizedUser = normalizeUserData(response.data.user);
      setCurrentUser(normalizedUser);
      localStorage.setItem("currentUser", JSON.stringify(normalizedUser));
      
      if (!normalizedUser.isAdmin) {
        await fetchUserRelationships(normalizedUser._id);
      }
      return true;
    } catch (error) {
      console.error("âŒ User refresh failed:", error);
      await logout();
      return false;
    }
  }, [BASE_URL, isTokenValid, logout, normalizeUserData, fetchUserRelationships]);



  const followUser = useCallback(async (targetUserId) => {
    if (!currentUser?._id) return { success: false, error: "Not authenticated" };
    
    try {
      const token = localStorage.getItem("token");
      if (!token || !isTokenValid(token)) throw new Error("Invalid token");

      const response = await axios.post(`${BASE_URL}/api/users/${targetUserId}/follow`, {
        followerName: currentUser.name,
        followerPic: currentUser.profilePic
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.data.success) throw new Error(response.data.message);

      await fetchUserRelationships(currentUser._id);
      return { success: true, isMutualFollow: response.data.isMutualFollow };
    } catch (error) {
      console.error("âŒ Follow failed:", error);
      return { success: false, error: error.message };
    }
  }, [currentUser, BASE_URL, isTokenValid, fetchUserRelationships]);

  const unfollowUser = useCallback(async (targetUserId) => {
    if (!currentUser?._id) return { success: false, error: "Not authenticated" };
    
    try {
      const token = localStorage.getItem("token");
      if (!token || !isTokenValid(token)) throw new Error("Invalid token");

      const response = await axios.post(`${BASE_URL}/api/users/${targetUserId}/unfollow`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.data.success) throw new Error(response.data.message);

      await fetchUserRelationships(currentUser._id);
      return { success: true };
    } catch (error) {
      console.error("âŒ Unfollow failed:", error);
      return { success: false, error: error.message };
    }
  }, [currentUser, BASE_URL, isTokenValid, fetchUserRelationships]);

    const updateUserProfile = useCallback(async (updates) => {
  if (!currentUser?._id) return false;

  try {
    // Immediately update local state and persist â€” backend update for arbitrary profile fields
    // is not implemented as a single PATCH route in the server, so keep this local and
    // let endpoints that modify specific fields (bio, images) handle persistence.
    setCurrentUser(prev => {
      const merged = normalizeUserData({ ...(prev || {}), ...(updates || {}) });
      try {
        localStorage.setItem("currentUser", JSON.stringify(merged));
      } catch (e) {
        console.warn("Could not persist currentUser to localStorage", e);
      }
      return merged;
    });

    // Return true to indicate success (caller already performed server-side update for images/bio)
    return true;
  } catch (error) {
    console.error("âŒ Profile update failed (local):", error);
    // attempt to restore from storage if available
    try {
      const stored = JSON.parse(localStorage.getItem("currentUser") || "null");
      if (stored) setCurrentUser(normalizeUserData(stored));
    } catch (e) { /* ignore */ }
    return false;
  }
}, [currentUser, normalizeUserData]);

    const updateProfileImage = useCallback(async (type, imageUrl) => {
    if (!currentUser?._id) return false;
    
    try {
      const fieldName = type === 'profilePic' ? 'profilePic' : 'coverPic';

      // Normalize user after image update
      setCurrentUser(prev => normalizeUserData({ ...prev, [fieldName]: imageUrl }));

      const updatedUser = normalizeUserData({ ...currentUser, [fieldName]: imageUrl });
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));

      return true;
    } catch (error) {
      console.error(`âŒ ${type} update failed:`, error);
      return false;
    }
  }, [currentUser, normalizeUserData]);

  // Initialize auth state with mount check
    useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setLoading(true);
      try {
        const adminToken = getAuthToken(true);
        const userToken = getAuthToken(false);

        if (adminToken && checkTokenValidity(adminToken)) {
          const adminData = JSON.parse(localStorage.getItem('adminUser'));
          if (isMounted && adminData?.isAdmin) {
            // Always normalize before using
            const normalized = normalizeUserData(adminData);
            setCurrentUser(normalized);
            setIsAdmin(true);
            axios.defaults.headers.common['Authorization'] = `Bearer ${adminToken}`;
            await fetchAndApplyUserSettings(normalized._id || normalized.id, adminToken);
            setLoading(false); // <-- ensure loading is set to false here
            return;
          }
        }

        if (userToken && checkTokenValidity(userToken)) {
          const userData = JSON.parse(localStorage.getItem('currentUser'));
          if (isMounted && userData) {
            const normalizedUser = normalizeUserData(userData);
            setCurrentUser(normalizedUser);
            axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
            await fetchAndApplyUserSettings(normalizedUser._id || normalizedUser.id, userToken);
            setLoading(false); // <-- ensure loading is set to false here
            return;
          }
        }
        setLoading(false); // <-- set loading to false if no user found
      } catch (error) {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [normalizeUserData, fetchAndApplyUserSettings]);

  // Socket.io real-time updates
  useEffect(() => {
    if (!currentUser?._id) return;
    
    const token = localStorage.getItem(currentUser.isAdmin ? 'adminToken' : 'token');
    if (!token) return;
  
    const socket = io(BASE_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  
    socket.on('connect', () => {
      console.log('ðŸ”Œ Socket connected:', socket.id);
    });
  
    socket.on('connect_error', (error) => {
      console.error('ðŸ”Œ Socket connection error:', error.message);
    });
  
    socket.on('user:profileUpdate', async (data) => {
      if (data.userId === currentUser._id) {
        await refreshUser();
      }
    });
  
    return () => {
      if (socket.connected) {
        socket.disconnect();
        console.log('ðŸ”Œ Socket disconnected');
      }
    };
  }, [currentUser, refreshUser, BASE_URL]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
      isAdmin,
      isTokenValid, // Add this line
      userRelationships,
      setCurrentUser,
      login,
      adminLogin,
      logout,
      adminLogout,
      refreshUser,
      fetchUserRelationships,
      updateUserRelationships: setUserRelationships,
      followUser,
      unfollowUser,
      // provide a real checkMutualFollow helper
      checkMutualFollow: (userId) => {
        if (!userRelationships || !Array.isArray(userRelationships.mutualFriends)) return false;
        return userRelationships.mutualFriends.some(u => String(u._id || u.id) === String(userId));
      },
      // expose image updater used elsewhere
      updateProfileImage,
      updateUserProfile, // <-- add this export so Profile.jsx can call it
      initialized
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContextProvider;
