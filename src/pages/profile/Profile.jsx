import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import "./profile.scss";
import { useLanguage } from "../../hooks/useLanguage";
import FacebookIcon from "@mui/icons-material/Facebook";
import PlaceIcon from "@mui/icons-material/Place";
import LanguageIcon from "@mui/icons-material/Language";
import EmailIcon from "@mui/icons-material/Email";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PeopleIcon from "@mui/icons-material/People";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PostAddIcon from "@mui/icons-material/PostAdd";
import EditIcon from '@mui/icons-material/Edit';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CollectionsIcon from "@mui/icons-material/Collections";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import MessageIcon from "@mui/icons-material/Message";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StarIcon from "@mui/icons-material/Star";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import VisibilityIcon from "@mui/icons-material/Visibility";
import GroupsIcon from "@mui/icons-material/Groups";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ShareIcon from "@mui/icons-material/Share";
import Posts from "../../components/posts/Posts";
import { AuthContext } from "../../context/authContext";
import { useSocket } from '../../context/SocketContext';
import Avatar from "@mui/material/Avatar"; // Add this for avatars
import CircularProgress from "@mui/material/CircularProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import DeleteIcon from "@mui/icons-material/Delete";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";

const formatMediaUrl = (url) => {
  if (!url) return null;
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  
  // If already a full URL, return as is
  if (url.startsWith('http')) return url;

  // If starts with /uploads/, add API_URL
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }

  // For just filenames, construct full path
  const filename = url.split(/[/\\]/).pop();
  return `${API_URL}/uploads/${filename}`;
};


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const DEFAULT_MALE_PIC = '/assets/person/Male.jpg';
const DEFAULT_FEMALE_PIC = '/assets/person/Female.jpg';

const getDefaultProfilePic = (sex) => sex === 'female' ? DEFAULT_FEMALE_PIC : DEFAULT_MALE_PIC;
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  return imageUrl; // Cloudinary URLs are already complete
};
// Component for showing loading state
const LoadingSpinner = () => (
  <motion.div 
    className="loading-spinner"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <div className="spinner"></div>
    <span>Loading...</span>
  </motion.div>
);

// Component for showing stats
const StatCard = ({ icon, count, label, tooltip }) => (
  <Tooltip title={tooltip} arrow placement="top">
    <motion.div 
      className="stat-card"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {icon}
      <span className="count">{count}</span>
      <span className="label">{label}</span>
    </motion.div>
  </Tooltip>
);

const Profile = () => {
  // Context and Hooks
  const { t } = useLanguage();
  const { 
    currentUser, 
    updateUserProfile, 
    updateProfileImage, // fallback helper (kept in auth context)
    refreshUser, 
    fetchUserRelationships 
  } = useContext(AuthContext);
  const { emitProfileUpdate, subscribeToProfileUpdates, socket, isConnected } = useSocket();
  const { userId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();


  // State Management
  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutualFollow, setIsMutualFollow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUploadType, setImageUploadType] = useState(null);
  const [mediaFilter, setMediaFilter] = useState("all"); // Add this state at the top
  const [friendsData, setFriendsData] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const [coverMenuAnchor, setCoverMenuAnchor] = useState(null);
  const [showPrevProfileDialog, setShowPrevProfileDialog] = useState(false);
  const [showPrevCoverDialog, setShowPrevCoverDialog] = useState(false);
  const [prevProfilePics, setPrevProfilePics] = useState([]);
  const [prevCoverPics, setPrevCoverPics] = useState([]);
  const [prevLoading, setPrevLoading] = useState(false);
  const [editBioOpen, setEditBioOpen] = useState(false);
  const [editingBio, setEditingBio] = useState('');
  const [showProfileFullSize, setShowProfileFullSize] = useState(false);
  const [showCoverFullSize, setShowCoverFullSize] = useState(false);
  const [inlineEditingBio, setInlineEditingBio] = useState(false);
  const [inlineBioText, setInlineBioText] = useState('');
  const [bioCharCount, setBioCharCount] = useState(0);
  const [profileViews, setProfileViews] = useState(0);
  const [mutualFollowers, setMutualFollowers] = useState([]);
  const [mutualCount, setMutualCount] = useState(0);

  // Memoized Values
  const isOwnProfile = useMemo(() => 
    location.state?.isOwnProfile || userId === currentUser?._id,
    [location.state?.isOwnProfile, userId, currentUser?._id]
  );

  const resolvedUserId = useMemo(() => 
    userId?.trim() || currentUser?._id,
    [userId, currentUser?._id]
  );

  // Set initial tab from URL (support posts, gallery, friends)
  const initialTab = ["gallery", "friends"].includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : "posts";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL param
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line
  }, [searchParams]);

  // Handler to update tab and URL param
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(location.search);
    if (tab === "posts") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  // Profile Data Fetching
        // Profile Data Fetching
    const fetchProfileData = useCallback(async () => {
  if (!resolvedUserId) return;

  setLoading(true);
  setError(null);

  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    console.log('🔍 Fetching profile data for userId:', resolvedUserId);

    const [userResponse, postsResponse] = await Promise.all([
      axios.get(`${API_URL}/api/users/${resolvedUserId}`, config),
      axios.get(`${API_URL}/api/posts/user/${resolvedUserId}`, config)
    ]);

    // backend returns { success: true, data: userData } — prefer .data.data but fallback to .data
    const userPayload = userResponse?.data?.data ?? userResponse?.data;
    if (!userPayload) throw new Error('User not found');

    // normalize profile/cover URLs so UI gets full URLs
    const normalizedProfilePic = formatMediaUrl(userPayload.profilePic) || (userPayload.profilePic && userPayload.profilePic.startsWith('http') ? userPayload.profilePic : null) || getDefaultProfilePic(userPayload.sex);
    const normalizedCoverPic = formatMediaUrl(userPayload.coverPic) || (userPayload.coverPic && userPayload.coverPic.startsWith('http') ? userPayload.coverPic : '');

    // attach normalized values before setting state
    const normalizedUserPayload = { ...userPayload, profilePic: normalizedProfilePic, coverPic: normalizedCoverPic };

    setUserData(normalizedUserPayload);

    // Check follow status if not own profile
    if (!isOwnProfile && currentUser) {
      const isUserFollowing = (userPayload.followers || []).some(
        followerId => String(followerId) === String(currentUser._id)
      );

      const isUserFollowed = (currentUser.following || []).some(
        followedId => String(followedId) === String(userPayload._id || userPayload.id)
      );

      setIsFollowing(isUserFollowing);
      setIsMutualFollow(isUserFollowing && isUserFollowed);
    }

    console.log('📥 Received posts:', {
      count: postsResponse?.data?.length ?? (postsResponse?.data?.count || 0),
      sample: Array.isArray(postsResponse?.data) ? postsResponse.data[0] : (postsResponse?.data?.sample || null)
    });

    // Process posts with proper URL formatting and null checks
    const postsArray = Array.isArray(postsResponse.data) ? postsResponse.data : (postsResponse.data?.data || []);
    const processedPosts = postsArray.map(post => {
      // Get file name from media path
      const getFileName = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return path.split(/[/\\]/).pop();
      };

      // Format media URLs
      const formatMediaUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads/')) {
          return `${API_URL}${url}`;
        }
        return `${API_URL}/uploads/${getFileName(url)}`;
      };

      // Safely convert IDs to strings with null checks
      const safeToString = (value) => {
        if (!value) return '';
        return typeof value.toString === 'function' ? value.toString() : String(value);
      };

      // Safely process comments
      const processComments = (comments) => {
        if (!Array.isArray(comments)) return [];
        return comments.map(c => ({
          ...c,
          _id: c._id ? safeToString(c._id) : '',
          userId: c.userId ? safeToString(c.userId) : ''
        }));
      };

      return {
        ...post,
        _id: safeToString(post._id),
        userId: safeToString(post.userId),
        name: post.name || userPayload.name,
        desc: post.desc || '',
        img: formatMediaUrl(post.img),
        media: formatMediaUrl(post.media),
        profilePic: formatMediaUrl(post.profilePic) || 
                   getDefaultProfilePic(userPayload.sex),
        likes: Array.isArray(post.likes) ? post.likes.map(safeToString) : [],
        comments: processComments(post.comments),
        engagementMetrics: {
          views: post.engagementMetrics?.views || 0,
          shares: post.engagementMetrics?.shares || 0,
          commentCount: post.engagementMetrics?.commentCount || 0,
          popularity: post.engagementMetrics?.popularity || 0,
          recency: post.engagementMetrics?.recency || 1
        },
        tags: Array.isArray(post.tags) ? post.tags : [],
        contentType: post.contentType || 'regular',
        visibility: post.visibility || 'public'
      };
    });

    // Sort posts by date
    const sortedPosts = processedPosts.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    setUserData(userPayload);
    setUserPosts(sortedPosts);

    // Fetch mutual friends from relationships endpoint (ensures full user objects)
    try {
      const token = localStorage.getItem('token');
      const relationshipsResp = await axios.get(
        `${API_URL}/api/users/relationships/${resolvedUserId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (relationshipsResp.data.success && relationshipsResp.data.data) {
        const mutualFriends = relationshipsResp.data.data.mutualFriends || [];
        setFriendsData(mutualFriends);
      } else {
        setFriendsData([]);
      }
    } catch (e) {
      console.warn('Could not fetch relationships:', e);
      setFriendsData([]);
    }

  } catch (error) {
    console.error("❌ Profile fetch error:", error);
    setError(error.response?.data?.message || error.message || "Failed to load profile data");
  } finally {
    setLoading(false);
  }
}, [resolvedUserId, API_URL, isOwnProfile, currentUser]);

  // Track profile view
  const trackProfileView = useCallback(async () => {
    if (!resolvedUserId || isOwnProfile) return; // Don't track own profile
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await axios.post(
        `${API_URL}/api/profile/track-view/${resolvedUserId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.log('Profile view tracking failed:', err);
    }
  }, [resolvedUserId, isOwnProfile, API_URL]);

  // Calculate mutual followers/connections
  const calculateMutualFollowers = useCallback(() => {
    if (!userData || !currentUser) return;
    
    const userFollowers = userData?.followers || [];
    const currentUserFollowing = currentUser?.following || [];
    
    const mutual = userFollowers.filter(follower => 
      currentUserFollowing.some(following => following._id === follower._id || following === follower._id)
    );
    
    setMutualFollowers(mutual);
    setMutualCount(mutual.length);
  }, [userData, currentUser]);

  // Fetch profile view count
  const fetchProfileViews = useCallback(async () => {
    if (!resolvedUserId) return;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(
        `${API_URL}/api/profile/views/${resolvedUserId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.views !== undefined) {
        setProfileViews(res.data.views);
      }
    } catch (err) {
      console.log('Failed to fetch profile views:', err);
    }
  }, [resolvedUserId, API_URL]);

  // Refetch only the friends list (without full profile reload)
  const refetchFriendsList = useCallback(async () => {
    if (!resolvedUserId) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      console.log('🔄 Refetching friends list for:', resolvedUserId);

      const userResponse = await axios.get(`${API_URL}/api/users/${resolvedUserId}`, config);
      const userPayload = userResponse?.data?.data ?? userResponse?.data;

      if (!userPayload) return;

      // Compute mutual friends from the fresh data
      const rawFollowers = Array.isArray(userPayload.followers) ? userPayload.followers : [];
      const rawFollowing = Array.isArray(userPayload.following) ? userPayload.following : [];

      const idOf = (entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        if (entry._id) return String(entry._id);
        if (entry.id) return String(entry.id);
        return null;
      };

      const followerIds = rawFollowers.map(idOf).filter(Boolean);
      const followingIds = rawFollowing.map(idOf).filter(Boolean);
      const mutualIds = followerIds.filter(id => followingIds.includes(id) && id !== String(userPayload._id));

      if (mutualIds.length === 0) {
        setFriendsData([]);
      } else {
        try {
          const resp = await axios.get(`${API_URL}/api/profile/profile-pics?userIds=${mutualIds.join(',')}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const profileMap = (resp.data && resp.data.data) ? resp.data.data : {};

          const friendsArr = mutualIds.map(id => {
            const fromRaw = rawFollowers.find(r => idOf(r) === id) || rawFollowing.find(r => idOf(r) === id) || {};
            return {
              _id: id,
              name: fromRaw.name || (profileMap[id] && profileMap[id].name) || 'Unknown',
              username: fromRaw.username || (profileMap[id] && profileMap[id].username) || '',
              email: fromRaw.email || (profileMap[id] && profileMap[id].email) || '',
              profilePic: fromRaw.profilePic || (profileMap[id] && profileMap[id].profilePic) || getDefaultProfilePic(fromRaw.sex)
            };
          });

          setFriendsData(friendsArr);
          console.log('✅ Friends list updated:', friendsArr.length);
        } catch (e) {
          console.warn('Could not fetch profile pics for friends:', e);
          setFriendsData([]);
        }
      }
    } catch (error) {
      console.error("❌ Error refetching friends list:", error);
    }
  }, [resolvedUserId, API_URL]);

  // Initial Data Load Effect
  useEffect(() => {
    let isActive = true;
    
    if (resolvedUserId && isActive) {
      fetchProfileData();
    }

    return () => {
      isActive = false;
    };
  }, [resolvedUserId, fetchProfileData]);

    // Track profile view and fetch view count
    useEffect(() => {
      if (userData) {
        trackProfileView();
        fetchProfileViews();
      }
    }, [userData, trackProfileView, fetchProfileViews]);

    // Calculate mutual followers when data changes
    useEffect(() => {
      if (userData && currentUser && !isOwnProfile) {
        calculateMutualFollowers();
      }
    }, [userData, currentUser, isOwnProfile, calculateMutualFollowers]);

    useEffect(() => {
    // Cleanup function to handle component unmount
    return () => {
      setUserData(null);
      setUserPosts([]);
      setError(null);
      setSuccessMessage(null);
      setUploadLoading(false);
      setUploadProgress(0);
    };
  }, []);

  // Follow Update Socket Effect
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleFollowUpdate = async (data) => {
      // Refresh if the profile being viewed is involved in the follow action
      // OR if the current user is involved (for their own profile updates)
      if (data.followedId === resolvedUserId || data.followerId === resolvedUserId || data.followerId === currentUser?._id) {
        console.log('📨 Follow update received:', data);
        // Clear friends data to ensure fresh state
        setFriendsData([]);
        await Promise.all([
          fetchProfileData(),
          fetchUserRelationships(currentUser._id)
        ]);
      }
    };

    socket.emit('join:profile', resolvedUserId);
    socket.on('follow:updated', handleFollowUpdate);

    return () => {
      socket.emit('leave:profile', resolvedUserId);
      socket.off('follow:updated', handleFollowUpdate);
    };
  }, [socket, isConnected, resolvedUserId, currentUser, fetchProfileData, fetchUserRelationships]);

  // Profile Update Socket Effect
  useEffect(() => {
    if (!resolvedUserId) return;

    const cleanup = subscribeToProfileUpdates((data) => {
      if (data.userId === resolvedUserId) {
        setUserData(prev => ({
          ...prev,
          ...(data.updates || {})
        }));
      }
    });

    return cleanup;
  }, [resolvedUserId, subscribeToProfileUpdates]);

  // Image Upload Handler
  // Update handleImageUpload function
  const handleImageUpload = useCallback(async (file, type) => {
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
  
    console.log('Starting upload:', { type, fileName: file.name });
    
    setUploadLoading(true);
    setImageUploadType(type);
    setError(null);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append(type, file, file.name);
  
      const token = localStorage.getItem("token");
      if (!token) {
        navigate('/login');
        throw new Error("Authentication token not found");
      }
  
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      };
  
      // Determine endpoint based on type
      const endpointType = type === 'profilePic' ? 'profile-pic' : 'cover-pic';
      const endpoint = `${API_URL}/api/profile/upload/${endpointType}/${currentUser._id}`;
  
      console.log('📤 Uploading to endpoint:', endpoint);
  
      const response = await axios.post(endpoint, formData, config);
  
      console.log('📨 Upload response:', response.data);
  
      if (response.data.success) {
        const fieldName = type === 'profilePic' ? 'profilePic' : 'coverPic';
        const newImage = response.data[fieldName];

        // Primary: call updateUserProfile if available
        if (typeof updateUserProfile === 'function') {
          try {
            await updateUserProfile({ [fieldName]: newImage });
          } catch (e) {
            console.warn('updateUserProfile failed, falling back:', e);
          }
        } else if (typeof updateProfileImage === 'function') {
          // Backwards-compatible fallback
          try {
            await updateProfileImage(fieldName, newImage);
          } catch (e) {
            console.warn('updateProfileImage failed, falling back to local update:', e);
            setUserData(prev => ({ ...prev, [fieldName]: newImage }));
          }
        } else {
          // Final fallback: update local component state so UI updates immediately
          setUserData(prev => ({ ...prev, [fieldName]: newImage }));
          try {
            // keep localStorage in sync
            const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
            stored[fieldName] = newImage;
            localStorage.setItem('currentUser', JSON.stringify(stored));
          } catch (e) { /* ignore */ }
        }

        // NEW: always update local userData so profile view updates immediately
        setUserData(prev => ({ ...prev, [fieldName]: newImage }));

        // Emit a normalized update event for real-time listeners
        emitProfileUpdate({ userId: currentUser._id, updates: { [fieldName]: newImage } });

        setSuccessMessage(response.data.message || `${type === 'profilePic' ? 'Profile picture' : 'Cover photo'} updated successfully`);
        // refresh relationships and previous images
        await fetchUserRelationships(currentUser._id);
        fetchPreviousImages(); // pre-load history immediately
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error(`❌ ${type} update error:`, error);
  
      if (error.response?.status === 401) {
        console.log('🔄 Token expired, attempting refresh...');
        const refreshResult = await refreshUser();
        
        if (refreshResult) {
          console.log('🔄 Token refreshed, retrying upload...');
          return handleImageUpload(file, type);
        } else {
          setError('Session expired. Please log in again.');
          navigate('/login');
        }
      } else {
        setError(
          error.response?.data?.message || 
          error.message || 
          `Failed to update ${type === 'profilePic' ? 'profile picture' : 'cover photo'}`
        );
      }
    } finally {
      setUploadLoading(false);
      setImageUploadType(null);
      setUploadProgress(0);
      
      // Clear messages after delay
      setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 3000);
    }
  }, [
    API_URL,
    currentUser?._id,
    emitProfileUpdate,
    fetchUserRelationships,
    navigate,
    refreshUser,
    setError,
    setImageUploadType,
    setSuccessMessage,
    setUploadLoading,
    setUploadProgress,
    setUserData,
    updateUserProfile
  ]);

  // Follow Handler
  const handleFollow = useCallback(async () => {
    if (!isConnected) {
      setError('Connection issue - please try again');
      return;
    }

    setFollowLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please login to follow users");

      // Choose endpoint based on current follow state
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      const response = await axios.post(
        `${API_URL}/api/users/${endpoint}/${resolvedUserId}`,
        {
          followerId: currentUser._id,
          followerName: currentUser.name,
          followerPic: currentUser.profilePic || getDefaultProfilePic(currentUser.sex)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        const isNowFollowing = !isFollowing;
        setIsFollowing(isNowFollowing);

        socket?.emit('follow:updated', {
          followerId: currentUser._id,
          followedId: resolvedUserId,
          followerName: currentUser.name,
          followerPic: currentUser.profilePic || getDefaultProfilePic(currentUser.sex),
          action: isNowFollowing ? 'follow' : 'unfollow'
        });

        if (isNowFollowing) {
          socket?.emit('notification:follow', {
            type: 'follow',
            senderId: currentUser._id,
            receiverId: resolvedUserId,
            senderName: currentUser.name,
            senderPic: currentUser.profilePic || getDefaultProfilePic(currentUser.sex),
            message: `${currentUser.name} started following you`
          });
        }

        setSuccessMessage(
          `Successfully ${isNowFollowing ? 'followed' : 'unfollowed'} ${userData.name}`
        );

        // Clear friends data before refetching to ensure fresh state
        setFriendsData([]);
        
        await Promise.all([
          fetchProfileData(),
          fetchUserRelationships(currentUser._id)
        ]);
      }
    } catch (error) {
      console.error("❌ Follow error:", error);
      setError(error.response?.data?.message || "Failed to update follow status");
    } finally {
      setFollowLoading(false);
      setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 3000);
    }
  }, [
    isConnected,
    resolvedUserId,
    isFollowing,
    userData?.name,
    currentUser,
    socket,
    fetchProfileData,
    fetchUserRelationships
  ]);

  // Event Handlers
  const handleProfilePicUpdate = useCallback((event) => 
    handleImageUpload(event.target.files[0], 'profilePic'),
    [handleImageUpload]
  );
  
  const handleCoverPicUpdate = useCallback((event) => 
    handleImageUpload(event.target.files[0], 'coverPic'),
    [handleImageUpload]
  );

  // Fetch previous images from backend
  const fetchPreviousImages = useCallback(async () => {
    setPrevLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/profile/history/${resolvedUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        const imgs = res.data.images || [];
        const profileImgs = imgs.filter(img => img.type === "profilePic").map(i => ({ ...i, url: formatMediaUrl(i.url) || i.url }));
        const coverImgs = imgs.filter(img => img.type === "coverPic").map(i => ({ ...i, url: formatMediaUrl(i.url) || i.url }));
        setPrevProfilePics(profileImgs);
        setPrevCoverPics(coverImgs);
      }
    } catch (err) {
      setPrevProfilePics([]);
      setPrevCoverPics([]);
    } finally {
      setPrevLoading(false);
    }
  }, [API_URL, resolvedUserId]);

  // Handler to set previous image as current
  const handleSetPreviousImage = async (img, type) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");

      const endpoint = type === "profilePic"
        ? `${API_URL}/api/profile/upload/profile-pic/${currentUser._id}`
        : `${API_URL}/api/profile/upload/cover-pic/${currentUser._id}`;

      // server expects { url } for history -> set
      const res = await axios.put(endpoint, { url: img.url }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to set previous image');

      const fieldName = type === 'profilePic' ? 'profilePic' : 'coverPic';
      const normalizedUrl = formatMediaUrl(img.url) || img.url;

      // Update component-local profile view immediately
      setUserData(prev => ({ ...prev, [fieldName]: normalizedUrl }));

      // Update AuthContext so other components (avatars, nav, lists) update instantly
      if (typeof updateUserProfile === 'function') {
        try {
          await updateUserProfile({ [fieldName]: normalizedUrl });
        } catch (e) {
          console.warn('updateUserProfile failed:', e);
          // fallback to updateProfileImage
          if (typeof updateProfileImage === 'function') {
            await updateProfileImage(fieldName, normalizedUrl);
          }
        }
      } else if (typeof updateProfileImage === 'function') {
        await updateProfileImage(fieldName, normalizedUrl);
      } else {
        // last resort persist to localStorage so subsequent reloads see it
        try {
          const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
          stored[fieldName] = normalizedUrl;
          localStorage.setItem('currentUser', JSON.stringify(stored));
        } catch (e) { /* ignore */ }
      }

      // Emit socket so other tabs/users get the update
      emitProfileUpdate({ userId: currentUser._id, updates: { [fieldName]: normalizedUrl } });

      // Refresh lightweight data and UI
      await fetchUserRelationships(currentUser._id);
      setSuccessMessage(`Updated ${type === "profilePic" ? "profile" : "cover"} photo!`);
    } catch (err) {
      console.error('Failed to set previous image:', err);
      setError(err.response?.data?.message || err.message || "Failed to update image");
    } finally {
      setShowPrevProfileDialog(false);
      setShowPrevCoverDialog(false);
    }
  };

  // Profile photo menu handlers
  const handleProfileMenuOpen = (event) => setProfileMenuAnchor(event.currentTarget);
  const handleProfileMenuClose = () => setProfileMenuAnchor(null);

  // Cover photo menu handlers
  const handleCoverMenuOpen = (event) => setCoverMenuAnchor(event.currentTarget);
  const handleCoverMenuClose = () => setCoverMenuAnchor(null);

  // Remove cover photo handler
  const handleRemoveCoverPhoto = useCallback(async () => {
    try {
      if (!isOwnProfile) {
        setError('You can only remove your own cover photo');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await axios.delete(
        `${API_URL}/api/profile/delete/cover-pic/${currentUser._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        // Update local state
        setUserData(prev => ({
          ...prev,
          coverPic: null
        }));

        // Emit socket event for real-time updates
        emitProfileUpdate({
          userId: currentUser._id,
          updates: { coverPic: null }
        });

        setSuccessMessage('Cover photo removed successfully');
      }
    } catch (err) {
      console.error('Error removing cover photo:', err);
      setError(err.response?.data?.message || 'Failed to remove cover photo');
    }
  }, [isOwnProfile, currentUser?._id, API_URL, emitProfileUpdate]);

  // Remove profile photo handler
  const handleRemoveProfilePhoto = useCallback(async () => {
    try {
      if (!isOwnProfile) {
        setError('You can only remove your own profile photo');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await axios.delete(
        `${API_URL}/api/profile/delete/profile-pic/${currentUser._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        // Update local state with default profile pic
        setUserData(prev => ({
          ...prev,
          profilePic: null
        }));

        // Emit socket event for real-time updates
        emitProfileUpdate({
          userId: currentUser._id,
          updates: { profilePic: null }
        });

        setSuccessMessage('Profile photo removed successfully');
      }
    } catch (err) {
      console.error('Error removing profile photo:', err);
      setError(err.response?.data?.message || 'Failed to remove profile photo');
    }
  }, [isOwnProfile, currentUser?._id, API_URL, emitProfileUpdate]);

  // --- MOVE: editable-bio hooks must be declared BEFORE early returns ---
  const handleOpenEditBio = useCallback(() => {
    setEditingBio(userData?.bio || '');
    setEditBioOpen(true);
  }, [userData?.bio]);

  const handleSaveBio = useCallback(async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await axios.put(
        `${API_URL}/api/profile/bio/${currentUser._id}`,
        { bio: editingBio },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        // Update local state immediately
        setUserData(prev => ({
          ...prev,
          bio: editingBio // Use editingBio instead of res.data.bio
        }));
        
        // Emit socket event for real-time updates
        emitProfileUpdate({
          userId: currentUser._id,
          updates: { 
            bio: editingBio,
            profileSetup: true
          }
        });

        setSuccessMessage('Bio updated successfully');
        setEditBioOpen(false);
      } else {
        throw new Error(res.data?.message || 'Failed to update bio');
      }
    } catch (err) {
      console.error('Bio update error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update bio');
    }
  }, [API_URL, currentUser?._id, editingBio, emitProfileUpdate]);
  // --- END MOVE ---

  // Profile Strength Calculator
  const calculateProfileStrength = useCallback(() => {
    let strength = 0;
    let maxPoints = 0;

    // Profile picture (20 points)
    if (userData?.profilePic) strength += 20;
    maxPoints += 20;

    // Cover picture (10 points)
    if (userData?.coverPic) strength += 10;
    maxPoints += 10;

    // Bio (15 points)
    if (userData?.bio && userData.bio.length > 20) strength += 15;
    maxPoints += 15;

    // City/Location (10 points)
    if (userData?.city) strength += 10;
    maxPoints += 10;

    // Website (10 points)
    if (userData?.website) strength += 10;
    maxPoints += 10;

    // Social links (15 points)
    if (userData?.social?.facebook) strength += 5;
    if (userData?.social?.instagram) strength += 5;
    if (userData?.social?.twitter) strength += 5;
    maxPoints += 15;

    // Posts (10 points)
    if (userPosts.length > 0) strength += 10;
    maxPoints += 10;

    // Followers (10 points)
    if ((userData?.followers?.length || 0) > 0) strength += 10;
    maxPoints += 10;

    const percentage = Math.round((strength / maxPoints) * 100);
    return { strength: percentage, category: getStrengthCategory(percentage) };
  }, [userData, userPosts.length]);

  const getStrengthCategory = (percentage) => {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 50) return 'fair';
    if (percentage >= 30) return 'poor';
    return 'very-poor';
  };

  // Inline bio editor handlers
  const handleStartInlineEditBio = () => {
    setInlineBioText(userData?.bio || '');
    setBioCharCount(userData?.bio?.length || 0);
    setInlineEditingBio(true);
  };

  const handleSaveInlineBio = useCallback(async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await axios.put(
        `${API_URL}/api/profile/bio/${currentUser._id}`,
        { bio: inlineBioText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        setUserData(prev => ({
          ...prev,
          bio: inlineBioText
        }));
        
        emitProfileUpdate({
          userId: currentUser._id,
          updates: { bio: inlineBioText }
        });

        setSuccessMessage('Bio updated successfully');
        setInlineEditingBio(false);
      } else {
        throw new Error(res.data?.message || 'Failed to update bio');
      }
    } catch (err) {
      console.error('Bio update error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update bio');
    }
  }, [API_URL, currentUser?._id, inlineBioText, emitProfileUpdate]);

  const handleCancelInlineEditBio = () => {
    setInlineEditingBio(false);
    setInlineBioText('');
    setBioCharCount(0);
  };

  // Quick action handlers
  const handleSendMessage = useCallback(() => {
    // Open chat popup with this user - similar to navbar behavior
    if (userData?._id) {
      const friendData = {
        _id: userData._id,
        name: userData.name || userData.username,
        username: userData.username,
        profilePic: userData.profilePic
      };
      window.dispatchEvent(new CustomEvent('openChatWithUser', { detail: friendData }));
    }
  }, [userData?._id]);

  const handleConnect = useCallback(() => {
    // Could be same as follow or open a "connect" dialog
    handleFollow();
  }, [handleFollow]);

  // Derived media list for gallery view
  const filteredGalleryMedia = useMemo(() => {
    if (!Array.isArray(userPosts)) return [];

    const mediaItems = [];
    
    userPosts.forEach(post => {
      // Check for mediaArray first (new format with multiple media)
      if (Array.isArray(post.mediaArray) && post.mediaArray.length > 0) {
        post.mediaArray.forEach((media, index) => {
          const url = media.url;
          if (!url) return;
          mediaItems.push({
            _id: `${post._id}_${index}`,
            url,
            type: media.type === 'video' ? 'video' : 'photo'
          });
        });
      } else {
        // Fallback to single media field (legacy format)
        const url = post.media || post.img || null;
        if (!url) return;
        const lower = String(url).toLowerCase();
        const isVideo = post.contentType === 'video' || /\.(mp4|webm|ogg|mov|mkv)$/i.test(lower);
        mediaItems.push({
          _id: post._id || `${post._id || Math.random()}`,
          url,
          type: isVideo ? 'video' : 'photo'
        });
      }
    });

    if (mediaFilter === 'all') return mediaItems;
    if (mediaFilter === 'photos') return mediaItems.filter(m => m.type === 'photo');
    if (mediaFilter === 'videos') return mediaItems.filter(m => m.type === 'video');
    return mediaItems;
  }, [userPosts, mediaFilter]);

  // Loading States (these must come AFTER all hooks)
  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-message">{error}</div>;
  if (!userData) return <div className="not-found">Profile not found</div>;

  // Helper for fallback avatar
  const getFallbackProfilePic = (sex) =>
    sex === "female" ? DEFAULT_FEMALE_PIC : DEFAULT_MALE_PIC;

  // Render Component
  return (
    <motion.div className="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="images">
        <div className="cover-container">
          {userData?.coverPic && (
            <motion.img
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              src={userData?.coverPic}
              alt="Cover"
              className="cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = ""; // fallback to blank or gradient
              }}
            />
          )}
          {isOwnProfile && (
            <motion.div className="cover-upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <input
                type="file"
                id="coverPic"
                name="coverPic"
                accept="image/*"
                onChange={handleCoverPicUpdate}
                style={{ display: 'none' }}
                disabled={uploadLoading}
                aria-label="Choose a new cover photo"
              />
              <IconButton
                aria-label="Change cover photo"
                onClick={handleCoverMenuOpen}
                size="large"
                className="upload-icon-btn"
              >
                <CameraAltIcon />
              </IconButton>
              <Menu
                anchorEl={coverMenuAnchor}
                open={Boolean(coverMenuAnchor)}
                onClose={handleCoverMenuClose}
              >
                <MenuItem onClick={() => { document.getElementById('coverPic').click(); handleCoverMenuClose(); }}>
                  <CameraAltIcon fontSize="small" /> {userData?.coverPic ? 'Change Cover' : 'Add Cover'}
                </MenuItem>
                <MenuItem onClick={() => { fetchPreviousImages(); setShowPrevCoverDialog(true); handleCoverMenuClose(); }}>
                  <CollectionsIcon fontSize="small" /> Choose from Previous
                </MenuItem>
                {userData?.coverPic && (
                  <>
                    <MenuItem onClick={() => { setShowCoverFullSize(true); handleCoverMenuClose(); }}>
                      <FullscreenIcon fontSize="small" /> View Full Size
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={() => { handleRemoveCoverPhoto(); handleCoverMenuClose(); }}>
                      <DeleteIcon fontSize="small" /> Remove Cover
                    </MenuItem>
                  </>
                )}
              </Menu>
            </motion.div>
          )}
        </div>

        <div className="profile-pic-container">
          <motion.img
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            src={userData?.profilePic || getFallbackProfilePic(userData?.sex)}
            alt="Profile"
            className="profilePic"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = getFallbackProfilePic(userData?.sex);
            }}
          />
          {isOwnProfile && (
            <motion.div className="profile-upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <input
                type="file"
                id="profilePic"
                name="profilePic"
                accept="image/*"
                onChange={handleProfilePicUpdate}
                style={{ display: 'none' }}
                disabled={uploadLoading}
                aria-label="Choose a new profile photo"
              />
              <IconButton
                aria-label="Change profile photo"
                onClick={handleProfileMenuOpen}
                size="large"
                className="upload-icon-btn"
              >
                <EditIcon />
              </IconButton>
              <Menu
                anchorEl={profileMenuAnchor}
                open={Boolean(profileMenuAnchor)}
                onClose={handleProfileMenuClose}
              >
                <MenuItem onClick={() => { document.getElementById('profilePic').click(); handleProfileMenuClose(); }}>
                  <EditIcon fontSize="small" /> Change Photo
                </MenuItem>
                <MenuItem onClick={() => { setShowProfileFullSize(true); handleProfileMenuClose(); }}>
                  <FullscreenIcon fontSize="small" /> View Full Size
                </MenuItem>
                <MenuItem onClick={() => { fetchPreviousImages(); setShowPrevProfileDialog(true); handleProfileMenuClose(); }}>
                  <CollectionsIcon fontSize="small" /> Choose from Previous
                </MenuItem>
                <MenuItem onClick={() => { handleRemoveProfilePhoto(); handleProfileMenuClose(); }}>
                  <DeleteIcon fontSize="small" /> Remove Photo
                </MenuItem>
              </Menu>
            </motion.div>
          )}
        </div>

        {/* Previous Profile Pics Dialog */}
        <Dialog open={showPrevProfileDialog} onClose={() => setShowPrevProfileDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Choose Previous Profile Photo</DialogTitle>
          <DialogContent>
            {prevLoading ? <CircularProgress /> : (
              <ImageList cols={3} gap={12}>
                {prevProfilePics.map((img, idx) => (
                  <ImageListItem key={`${img.url}-${idx}`}>
                    <img src={img.url} alt="Previous profile" style={{ width: "100%", borderRadius: 12, cursor: "pointer" }}
                      onClick={() => handleSetPreviousImage(img, "profilePic")}
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPrevProfileDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Previous Cover Pics Dialog */}
        <Dialog open={showPrevCoverDialog} onClose={() => setShowPrevCoverDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Choose Previous Cover Photo</DialogTitle>
          <DialogContent>
            {prevLoading ? <CircularProgress /> : (
              <ImageList cols={3} gap={12}>
                {prevCoverPics.map((img, idx) => (
                  <ImageListItem key={`${img.url}-${idx}`}>
                    <img src={img.url} alt="Previous cover" style={{ width: "100%", borderRadius: 12, cursor: "pointer" }}
                      onClick={() => handleSetPreviousImage(img, "coverPic")}
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPrevCoverDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Edit Bio Dialog */}
        <Dialog open={editBioOpen} onClose={() => setEditBioOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Bio</DialogTitle>
          <DialogContent>
            <textarea
              value={editingBio}
              onChange={(e) => setEditingBio(e.target.value)}
              rows={6}
              style={{ width: '100%', padding: 12, fontSize: 15, borderRadius: 8, border: '1px solid #ddd' }}
              maxLength={1000}
            />
            <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
              {editingBio.length}/1000
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditBioOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBio} variant="contained" color="primary">Save</Button>
          </DialogActions>
        </Dialog>

        {/* Full Size Profile Photo Dialog */}
        <Dialog 
          open={showProfileFullSize} 
          onClose={() => setShowProfileFullSize(false)} 
          maxWidth="lg" 
          fullWidth
          PaperProps={{
            style: {
              backgroundColor: '#000',
              backgroundImage: `url(${userData?.profilePic || getFallbackProfilePic(userData?.sex)})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center'
            }
          }}
        >
          <img 
            src={userData?.profilePic || getFallbackProfilePic(userData?.sex)} 
            alt="Profile Full Size"
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '90vh',
              objectFit: 'contain'
            }}
          />
          <DialogActions>
            <Button onClick={() => setShowProfileFullSize(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Full Size Cover Photo Dialog */}
        <Dialog 
          open={showCoverFullSize} 
          onClose={() => setShowCoverFullSize(false)} 
          maxWidth="lg" 
          fullWidth
          PaperProps={{
            style: {
              backgroundColor: '#000',
              backgroundImage: `url(${userData?.coverPic})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center'
            }
          }}
        >
          <img 
            src={userData?.coverPic} 
            alt="Cover Full Size"
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '90vh',
              objectFit: 'contain'
            }}
          />
          <DialogActions>
            <Button onClick={() => setShowCoverFullSize(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <AnimatePresence>
          {uploadLoading && (
            <motion.div className="upload-progress" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="progress-bar">
                <div className="progress" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span>{uploadProgress}%</span>
              <p>
                {imageUploadType === 'profilePic' ? t('updating-profile-pic') : t('updating-cover-photo')}
              </p>
              <CircularProgress size={24} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  
      <motion.div 
        className="profileContainer"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="center">
          <motion.h1 
            className="username"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {userData?.name}
          </motion.h1>
  
          <motion.p 
            className="bio"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {inlineEditingBio ? (
              <div className="inline-bio-editor">
                <textarea
                  value={inlineBioText}
                  onChange={(e) => {
                    setInlineBioText(e.target.value);
                    setBioCharCount(e.target.value.length);
                  }}
                  maxLength={1000}
                  placeholder="Tell us about yourself..."
                  className="bio-textarea"
                />
                <div className="bio-footer">
                  <span className="char-count">{bioCharCount}/1000</span>
                  <div className="bio-actions">
                    <Button 
                      size="small" 
                      onClick={handleCancelInlineEditBio}
                      variant="outlined"
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="small" 
                      onClick={handleSaveInlineBio}
                      variant="contained"
                      color="primary"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bio-view">
                {userData?.bio || <em>{t('no-bio-available')}</em>}
                {isOwnProfile && (
                  <IconButton
                    aria-label={t('edit-bio')}
                    onClick={handleStartInlineEditBio}
                    size="small"
                    className="bio-edit-btn"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </div>
            )}
          </motion.p>

          {/* Profile Strength Indicator */}
          {isOwnProfile && (
            <motion.div 
              className="profile-strength"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.52 }}
            >
              <div className="strength-header">
                <TrendingUpIcon className="strength-icon" />
                <span className="strength-label">Profile Strength</span>
              </div>
              <div className="strength-bar-container">
                <motion.div 
                  className={`strength-bar strength-${calculateProfileStrength().category}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${calculateProfileStrength().strength}%` }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                />
              </div>
              <span className={`strength-text strength-${calculateProfileStrength().category}`}>
                {calculateProfileStrength().strength}%
              </span>
            </motion.div>
          )}

          <motion.div 
            className="stats"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <StatCard 
              icon={<PeopleIcon />}
              count={userData?.followers?.length || 0}
              label={t('followers-label')}
              tooltip="People who follow your profile"
            />
            <StatCard 
              icon={<PersonAddIcon />}
              count={userData?.following?.length || 0}
              label={t('following-label')}
              tooltip="People you are following"
            />
            <StatCard 
              icon={<PostAddIcon />}
              count={userPosts.length}
              label={t('posts-label')}
              tooltip={`${userPosts.length} post${userPosts.length !== 1 ? 's' : ''} shared`}
            />
            <StatCard 
              icon={<VisibilityIcon />}
              count={profileViews}
              label="Profile Views"
              tooltip="Times your profile has been viewed"
            />
          </motion.div>
  
          {/* Mutual Followers Indicator */}
          {!isOwnProfile && mutualCount > 0 && (
            <motion.div 
              className="mutual-followers-indicator"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.65 }}
            >
              <Tooltip 
                title={`Mutual followers: ${mutualFollowers.map(f => f.name || f.username).join(', ')}`}
                arrow
                placement="top"
              >
                <div className="mutual-badge">
                  <GroupsIcon className="mutual-icon" />
                  <span className="mutual-count">{mutualCount}</span>
                  <span className="mutual-label">Mutual Followers</span>
                </div>
              </Tooltip>
            </motion.div>
          )}
  
          {/* Profile Information - only show if has content */}
          {(userData?.city || userData?.website || userData?.email || userData?.joinDate) && (
            <motion.div 
              className="info"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {userData?.city && (
                <div className="item">
                  <PlaceIcon />
                  <span>{userData.city}</span>
                </div>
              )}
              {userData?.website && (
                <div className="item">
                  <LanguageIcon />
                  <a href={userData.website} target="_blank" rel="noopener noreferrer">
                    {userData.website}
                  </a>
                </div>
              )}
              {userData?.email && (
                <div className="item">
                  <EmailIcon />
                  <span>{userData.email}</span>
                </div>
              )}
              {userData?.joinDate && (
                <div className="item">
                  <CalendarMonthIcon />
                  <span>{t('joined')} {new Date(userData.joinDate).toLocaleDateString()}</span>
                </div>
              )}
            </motion.div>
          )}
  
          {/* Social Links - only show if has content */}
          {userData.social?.facebook && (
            <motion.div 
              className="socialLinks"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {userData.social?.facebook && (
                <motion.a 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  href={userData.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon"
                >
                  <FacebookIcon fontSize="large" />
                </motion.a>
              )}
            </motion.div>
          )}
  
          {!isOwnProfile && (
            <>
              {/* Quick Action Buttons */}
              <motion.div 
                className="quick-actions"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.85 }}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendMessage}
                  className="quick-action-btn message-btn"
                  title="Send Message"
                >
                  <MessageIcon />
                  <span>Message</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConnect}
                  className={`quick-action-btn follow-btn ${isFollowing ? 'following' : ''}`}
                  title={isFollowing ? 'Following' : 'Follow'}
                >
                  <PersonAddIcon />
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </motion.button>
              </motion.div>

              {/* Follow Status Messages */}
              <AnimatePresence>
                {(error || successMessage) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={error ? "error-message" : "success-message"}
                  >
                    {error || successMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>

      {/* Achievement Badges Section */}
      <motion.div 
        className="achievements-section"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.0 }}
      >
        <div className="achievements-container">
          <h3 className="achievements-title">
            <StarIcon className="badge-icon" />
            Achievements & Badges
          </h3>
          <div className="badges-grid">
            {/* Profile Complete Badge */}
            {calculateProfileStrength().strength >= 80 && (
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Profile Strength: 80%+"
              >
                <div className="badge-icon-wrapper">
                  <CheckCircleIcon className="badge-icon-large" />
                </div>
                <span className="badge-name">Profile Complete</span>
              </motion.div>
            )}

            {/* Social Butterfly Badge */}
            {(userData?.followers?.length || 0) >= 50 && (
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="50+ Followers"
              >
                <div className="badge-icon-wrapper">
                  <PeopleIcon className="badge-icon-large" />
                </div>
                <span className="badge-name">Social Butterfly</span>
              </motion.div>
            )}

            {/* Content Creator Badge */}
            {userPosts.length >= 20 && (
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="20+ Posts"
              >
                <div className="badge-icon-wrapper">
                  <PostAddIcon className="badge-icon-large" />
                </div>
                <span className="badge-name">Content Creator</span>
              </motion.div>
            )}

            {/* Early Adopter Badge */}
            {userData?.joinDate && (new Date() - new Date(userData.joinDate)) > (365 * 24 * 60 * 60 * 1000) && (
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Member for 1+ Year"
              >
                <div className="badge-icon-wrapper">
                  <CalendarMonthIcon className="badge-icon-large" />
                </div>
                <span className="badge-name">Early Adopter</span>
              </motion.div>
            )}

            {/* Network Builder Badge */}
            {(userData?.following?.length || 0) >= 30 && (
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="30+ Following"
              >
                <div className="badge-icon-wrapper">
                  <PersonAddIcon className="badge-icon-large" />
                </div>
                <span className="badge-name">Network Builder</span>
              </motion.div>
            )}

            {/* All Connected Badge */}
            {userData?.social && Object.values(userData.social).filter(v => v).length >= 2 && (
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Multiple Social Links"
              >
                <div className="badge-icon-wrapper">
                  <FacebookIcon className="badge-icon-large" />
                </div>
                <span className="badge-name">All Connected</span>
              </motion.div>
            )}

            {/* No badges yet */}
            {calculateProfileStrength().strength < 80 && 
             (userData?.followers?.length || 0) < 50 && 
             userPosts.length < 20 && 
             (!userData?.joinDate || (new Date() - new Date(userData.joinDate)) <= (365 * 24 * 60 * 60 * 1000)) &&
             (userData?.following?.length || 0) < 30 &&
             (!userData?.social || Object.values(userData.social).filter(v => v).length < 2) && (
              <div className="no-badges">
                <p>
                  {isOwnProfile 
                    ? "Complete your profile and engage with the community to unlock badges!"
                    : `${userData?.name || userData?.username} is working on earning badges!`
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
  
      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={activeTab === "posts" ? "active" : ""}
          onClick={() => handleTabChange("posts")}
        >
          <CollectionsIcon /> {t('posts-tab')}
        </button>
        <button
          className={activeTab === "gallery" ? "active" : ""}
          onClick={() => handleTabChange("gallery")}
        >
          <PhotoLibraryIcon /> {t('gallery-tab')}
        </button>
        <button
          className={activeTab === "friends" ? "active" : ""}
          onClick={() => handleTabChange("friends")}
        >
          <PeopleIcon /> {t('friends-tab-profile')}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "posts" && (
        <motion.div className="userPosts"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            {userData.name}{t('s-posts')}
          </motion.h2>
          
          {userPosts.length > 0 ? (
            <Posts 
              userPosts={userPosts}
              onPostUpdate={fetchProfileData}
              userId={resolvedUserId} // Make sure this is always defined
              userData={userData}  // Pass user data here
              onDeletePost={(postId) => setUserPosts(prev => prev.filter(post => String(post?._id) !== String(postId)))}
            />
          ) : (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="no-posts"
            >
              {t('no-posts-display')}
            </motion.p>
          )}
        </motion.div>
      )}

      {activeTab === "gallery" && (
        <motion.div className="userGallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>{userData.name}{t('s-gallery')}</h2>
          <div className="gallery-filters">
            <button className={mediaFilter === "all" ? "active" : ""} onClick={() => setMediaFilter("all")}>{t('all-media')}</button>
            <button className={mediaFilter === "photos" ? "active" : ""} onClick={() => setMediaFilter("photos")}>{t('photos')}</button>
            <button className={mediaFilter === "videos" ? "active" : ""} onClick={() => setMediaFilter("videos")}>{t('videos')}</button>
          </div>
          <div className="gallery-grid">
            {filteredGalleryMedia.length === 0 && <div>{t('no-media-found')}</div>}
            {filteredGalleryMedia.map(item =>
              item.type === "video" ? (
                <video key={item._id} controls src={item.url} className="gallery-item video-item" />
              ) : (
                <img key={item._id} src={item.url} alt="" className="gallery-item" />
              )
            )}
          </div>
        </motion.div>
      )}

      {activeTab === "friends" && (
        <motion.div className="userFriends" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>{userData.name}{t('s-friends')}</h2>
          <div className="friends-list">
            {friendsLoading ? (
              <LoadingSpinner />
            ) : friendsError ? (
              <div className="error-message">{friendsError}</div>
            ) : friendsData.length > 0 ? (
              friendsData
                .filter(friend => isOwnProfile ? friend._id !== currentUser._id : true) // Only exclude self when viewing own profile
                .map(friend => (
                  <div
                    key={friend._id}
                    className="friend-item"
                    onClick={() => navigate(`/profile/${friend._id}`)}
                  >
                    <Avatar
                      src={friend.profilePic || getDefaultProfilePic(friend.sex)}
                      alt={friend.name}
                    />
                    <div>
                      <span className="friend-name">{friend.name}</span>
                      <span className="friend-username">@{friend.username}</span>
                      {friend.email && <span className="friend-email">{friend.email}</span>}
                    </div>
                  </div>
                ))
            ) : (
              <div>{t('no-friends-display')}</div>
            )}
          </div>
        </motion.div>
      )}

      <Snackbar
        open={!!successMessage}
        autoHideDuration={3500}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert onClose={() => setSuccessMessage(null)} severity="success" elevation={6} variant="filled">
          {successMessage}
        </MuiAlert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={4500}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert onClose={() => setError(null)} severity="error" elevation={6} variant="filled">
          {error}
        </MuiAlert>
      </Snackbar>
    </motion.div>
  );
}

export default Profile;
