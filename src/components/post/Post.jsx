import "./post.scss";
import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../../context/authContext";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import FavoriteOutlinedIcon from "@mui/icons-material/FavoriteOutlined";
import TextsmsOutlinedIcon from "@mui/icons-material/TextsmsOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import BarChartIcon from '@mui/icons-material/BarChart';
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import CloseIcon from "@mui/icons-material/Close";
import ReactPlayer from 'react-player';
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Comments from "../comments/Comments";
import ShareDialog from "./sharedialog";
import EditDialog from "./editdialog";
import { useSocket } from '../../context/SocketContext';
import { getDefaultAvatar, getImageUrl } from "../../utils/imageUtils";

// SVG fallback avatar (gender-neutral)
const DefaultUserSVG = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="#e6e6e6"/>
    <circle cx="20" cy="15" r="7" fill="#bdbdbd"/>
    <ellipse cx="20" cy="29" rx="10" ry="6" fill="#bdbdbd"/>
  </svg>
);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const VALID_GENDERS = ['male', 'female'];
const DEFAULT_GENDER = 'male';
const userCache = new Map();

const validateGender = (gender) => {
  const normalizedGender = gender?.toLowerCase()?.trim();
  return VALID_GENDERS.includes(normalizedGender) ? normalizedGender : DEFAULT_GENDER;
};

const validateUserData = (userData) => {
  if (!userData) return null;
  return {
    ...userData,
    gender: validateGender(userData.gender),
    name: userData.name || 'Unknown User'
  };
};

const GenderAvatar = ({ gender, name }) => (
  <div className={`default-avatar-container ${gender?.toLowerCase() || 'male'}`}>
    <img 
      src={getDefaultAvatar(gender)}
      alt={`${name}'s Avatar`}
      className="default-avatar"
    />
  </div>
);

const getMediaUrl = (media, img) => {
  const path = media || img;
  if (!path) return null;
  if (typeof path !== 'string') return null;
  if (/^https?:\/\/.*/i.test(path)) return path;
  const base = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/uploads/${path.split(/[/\\]/).pop()}`;
};

const inferMediaTypeFromUrl = (url) => {
  if (typeof url !== 'string') return null;
  return /\.(mp4|mov|webm|avi|mkv)$/i.test(url) ? 'video' : 'image';
};

const normalizeMediaArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return { url: item, type: inferMediaTypeFromUrl(item) };
      }
      const url = item.url || item.media || item.img;
      if (!url || typeof url !== 'string') return null;
      return { ...item, url, type: item.type || inferMediaTypeFromUrl(url) };
    })
    .filter(Boolean);
};

// Helper function to check if a post has valid media
const hasValidMedia = (post) => {
  if (!post) return false;

  // Priority: mediaArray first
  if (normalizeMediaArray(post.mediaArray).length > 0) return true;
  
  // For shared posts, check if the shared post has media
  if (post.sharedPost && typeof post.sharedPost === 'object') {
    if (normalizeMediaArray(post.sharedPost.mediaArray).length > 0) return true;
    const sharedMedia = post.sharedPost.media || post.sharedPost.img;
    const sharedMediaType = post.sharedPost.mediaType;
    if (typeof sharedMedia !== 'string' || sharedMedia.trim().length === 0) return false;
    // Reject broken filenames like "400.jpg"
    if (sharedMedia === '400.jpg' || sharedMedia === 'undefined') return false;
    return sharedMediaType && (sharedMediaType === 'image' || sharedMediaType === 'video');
  }
  
  // For regular posts, prioritize img and media but REJECT "400.jpg"
  const imgField = post.img;
  const mediaField = post.media;
  
  // If we have a real img path, use it
  if (imgField && typeof imgField === 'string' && imgField !== '400.jpg' && imgField.length > 5) {
    return imgField.startsWith('/uploads/') || imgField.startsWith('http');
  }
  
  // If we have a real media path, use it (but not "400.jpg")
  if (mediaField && typeof mediaField === 'string' && mediaField !== '400.jpg' && mediaField.length > 5) {
    const mediaType = post.mediaType;
    return mediaType && (mediaType === 'image' || mediaType === 'video');
  }
  
  return false;
};

// Shared Post Renderer
const SharedPost = ({ sharedPost }) => {
  if (!sharedPost) return null;
  const originalUser = sharedPost.user || {};
  
  // Priority: mediaArray > media/img
  const hasMediaArray = Array.isArray(sharedPost.mediaArray) && sharedPost.mediaArray.length > 0;
  const mediaToRender = hasMediaArray ? sharedPost.mediaArray : null;
  const fallbackMedia = sharedPost.media || sharedPost.img;
  const mediaUrl = getMediaUrl(mediaToRender ? mediaToRender[0].url : fallbackMedia);

  return (
    <div className="shared-post">
      <div className="shared-header">
        <span className="shared-label">Shared Post</span>
        <Link
          to={`/profile/${originalUser._id}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <span className="shared-user">
            {originalUser.profilePic ? (
              <img
                src={getImageUrl(originalUser.profilePic)}
                alt={originalUser.name}
                className="shared-profile-pic"
              />
            ) : (
              <DefaultUserSVG size={32} />
            )}
            <span className="shared-name">{originalUser.name}</span>
          </span>
        </Link>
      </div>
      <div className="shared-content">
        <p>{sharedPost.desc}</p>
        {(mediaToRender || fallbackMedia) && (
          sharedPost.mediaType === "video" ? (
            <div className="video-container">
              <ReactPlayer
                url={mediaUrl}
                controls={true}
                width="100%"
                height="auto"
              />
            </div>
          ) : (
            <div className="image-container">
              <img
                src={mediaUrl}
                alt="Shared post content"
                className="shared-image"
              />
            </div>
          )
        )}
      </div>
    </div>
  );
};

const Post = ({ post, onDeletePost, onAddSharedPost, showOnly, fullScreen, showDesc = true, currentMediaIndex: externalMediaIndex, setCurrentMediaIndex: setExternalMediaIndex, hideCarouselControls = false }) => {
  const { currentUser } = useContext(AuthContext);
  const { socket } = useSocket();
  const navigate = useNavigate();

  // States
  const [liked, setLiked] = useState(() => {
    if (!Array.isArray(post?.likes) || !currentUser?.id) return false;
    return post.likes.includes(currentUser.id);
  });
  const [likesCount, setLikesCount] = useState(() => 
    Array.isArray(post?.likes) ? post.likes.length : 0
  );
  const [commentsCount, setCommentsCount] = useState(() => 
    Array.isArray(post?.comments) ? post.comments.length : 0
  );
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [postUser, setPostUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [engagementMetrics, setEngagementMetrics] = useState({
    views: post?.engagementMetrics?.views || 0,
    shares: post?.engagementMetrics?.shares || 0,
    popularity: post?.engagementMetrics?.popularity || 0
  });
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [postMenuAnchor, setPostMenuAnchor] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success"
  });
  
  // Use external media index if provided (for fullscreen), otherwise use internal state
  const [internalMediaIndex, setInternalMediaIndex] = useState(0);
  const currentMediaIndex = externalMediaIndex !== undefined ? externalMediaIndex : internalMediaIndex;
  const setCurrentMediaIndexFunc = setExternalMediaIndex || setInternalMediaIndex;
  
  const [showMediaCarousel, setShowMediaCarousel] = useState(false);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle comment updates
  const handleCommentUpdate = useCallback((count) => {
    setCommentsCount(count);
  }, []);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (!post?.userId) return;

    if (userCache.has(post.userId)) {
      const normalizedUser = validateUserData(userCache.get(post.userId));
      setPostUser(normalizedUser);
      setUserLoading(false);
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/users/${post.userId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }
      );

      // backend may return { success: true, data: user } or the user object directly
      const payload = response?.data?.data ?? response?.data;
      const userObj = payload && typeof payload === 'object' ? payload : null;

      const normalizedUser = validateUserData(userObj || { name: 'Unknown User', gender: DEFAULT_GENDER });
      userCache.set(post.userId, normalizedUser);
      setPostUser(normalizedUser);
    } catch (error) {
      setPostUser({ gender: DEFAULT_GENDER, name: 'Unknown User' });
    } finally {
      setUserLoading(false);
    }
  }, [post?.userId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // DEBUG: Check what data we're receiving
  useEffect(() => {
    if (post) {
      const mediaArrayLength = Array.isArray(post.mediaArray) ? post.mediaArray.length : 0;
      const hasValidMediaArray = mediaArrayLength > 0 && post.mediaArray[0]?.url;
      
      console.log(`[PostDebug] ===== POST COMPONENT DEBUG =====`);
      console.log(`  Post ID: ${post._id?.substring(0, 8)}...`);
      console.log(`  Desc: "${post.desc?.substring(0, 40)}..."`);
      console.log(`  post.media field: "${post.media}"`);
      console.log(`  post.img field: "${post.img?.substring(0, 60)}..."`);
      console.log(`  mediaArray length: ${mediaArrayLength}`);
      if (hasValidMediaArray) {
        console.log(`  First mediaArray URL: ${post.mediaArray[0]?.url?.substring(0, 80)}`);
      }
      console.log(`[PostDebug] ======================`);
    }
  }, [post?._id, post?.mediaArray?.length, post?.media, post?.img]);

  // Socket handlers
  useEffect(() => {
    if (!socket || !post?._id) return;
    const handleCommentUpdate = ({ postId, count }) => {
      if (postId === post._id) {
        setCommentsCount(count);
      }
    };
    socket.on('comment:create', handleCommentUpdate);
    socket.on('comment:delete', handleCommentUpdate);
    return () => {
      socket.off('comment:create', handleCommentUpdate);
      socket.off('comment:delete', handleCommentUpdate);
    };
  }, [socket, post?._id]);

  // Track post view on mount
  useEffect(() => {
    const trackView = async () => {
      if (!post?._id || !currentUser?.id) return;
      try {
        const token = localStorage.getItem(currentUser.isAdmin ? 'adminToken' : 'token');
        if (!token) return;
        const response = await axios.post(
          `${API_URL}/api/posts/${post._id}/view`,
          {},
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (response.data.success) {
          setEngagementMetrics(prev => ({
            ...prev,
            views: response.data.views || prev.views + 1
          }));
        }
      } catch (error) {}
    };
    if (post?._id && currentUser?.id) {
      trackView();
    }
  }, [post._id, currentUser?.id]);

  // --- SHARE HANDLER WITH DIALOG ---
  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handleShareDialogClose = () => {
    setShareDialogOpen(false);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
  };

  const handleEditSave = (updatedPost) => {
    // Update the post data in the component
    post.desc = updatedPost.desc;
    post.tags = updatedPost.tags;
    showSnackbar("Post updated successfully!", "success");
  };

  const handleShareConfirm = async (caption) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/posts/${post._id}/share`,
        { desc: caption },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }
      );
      if (response.status === 201 || response.data.success) {
        if (
          response.data.sharedPost &&
          response.data.sharedPost.user &&
          response.data.sharedPost.user._id !== currentUser.id
        ) {
          setEngagementMetrics(prev => ({
            ...prev,
            shares: prev.shares + 1
          }));
        }
        showSnackbar("Post shared!", "success");
        if (typeof onAddSharedPost === "function") {
          onAddSharedPost(response.data);
        }
      } else {
        showSnackbar("Failed to share post.", "error");
      }
    } catch (error) {
      showSnackbar("Failed to share post.", "error");
    } finally {
      setShareDialogOpen(false);
    }
  };
  // --- END SHARE HANDLER ---

  const handleLike = async () => {
    if (!currentUser?.id || likeLoading) return;
    setLikeLoading(true);
    const newLiked = !liked;
    try {
      const response = await axios.put(
        `${API_URL}/api/posts/${post._id}/like`,
        { userId: currentUser.id },
        {
          headers: { 
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data?.success) {
        setLiked(response.data.liked);
        setLikesCount(response.data.likesCount);
        setEngagementMetrics(prev => ({
          ...prev,
          ...response.data.engagementMetrics
        }));
      } else {
        setLiked(!newLiked);
        setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
      }
    } catch (error) {
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await axios.delete(
        `${API_URL}/api/posts/${post._id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (response.status === 200) {
        socket?.emit('post:delete', post._id);
        onDeletePost?.(post._id);
        showSnackbar("Post deleted successfully!", "success");
      }
    } catch (error) {
      showSnackbar("Failed to delete post.", "error");
    } finally {
      setPostMenuAnchor(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleDeleteConfirmOpen = () => {
    setDeleteConfirmOpen(true);
    setPostMenuAnchor(null);
  };

  const handleDeleteConfirmClose = () => {
    setDeleteConfirmOpen(false);
  };

  const handlePostMenuOpen = (event) => {
    setPostMenuAnchor(event.currentTarget);
  };

  const handlePostMenuClose = () => {
    setPostMenuAnchor(null);
  };

  const handleEditPost = () => {
    setEditDialogOpen(true);
    setPostMenuAnchor(null);
  };

  // Tag context menu handlers
  const handleTagContextMenu = (event, tag) => {
    event.preventDefault();
    setContextMenu({
      tag,
      position: { left: event.clientX - 2, top: event.clientY - 4 }
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleFollowTag = () => {
    if (contextMenu?.tag) {
      navigate(`/follow-tag/${encodeURIComponent(contextMenu.tag)}`);
    }
    handleCloseContextMenu();
  };

  const formatTimeAgo = (date) => {
    if (!date) return "Unknown date";
    const now = new Date();
    const postDate = new Date(date);
    const seconds = Math.floor((now - postDate) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  };

  // Avatar logic for both feed and fullscreen
  const getAvatar = () => {
    let avatarSrc = null;
    if (post.user) {
      avatarSrc = post.user.profilePic || post.user.profilePicture || null;
    } else if (post.profilePic || post.profilePicture) {
      avatarSrc = post.profilePic || post.profilePicture;
    } else if (postUser?.profilePic || postUser?.profilePicture) {
      avatarSrc = postUser.profilePic || postUser.profilePicture;
    }
    if (avatarSrc && !avatarError) {
      return (
        <img
          src={getImageUrl(avatarSrc)}
          alt={postUser?.name || post.user?.name || post.name || "User"}
          className="profile-pic"
          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
          onError={() => setAvatarError(true)}
        />
      );
    }
    // fallback: gender avatar or SVG
    return postUser?.gender ? (
      <GenderAvatar gender={postUser.gender} name={postUser?.name || "Unknown User"} />
    ) : (
      <DefaultUserSVG size={48} />
    );
  };

  const EngagementScore = useMemo(() => {
    if (!post.engagementScore) return null;
    const getScoreClass = () => {
      if (post.engagementScore >= 75) return 'high';
      if (post.engagementScore >= 50) return 'medium';
      return 'low';
    };
    return (
      <div className={`engagement-score ${getScoreClass()}`}>
        <BarChartIcon />
        <span>{Math.round(post.engagementScore)}</span>
      </div>
    );
  }, [post.engagementScore]);

  const renderMedia = () => {
    if (!hasValidMedia(post)) return null;
    if (imageError) return null;

    // PRIORITY: 1) mediaArray (new), 2) img field (uploads), 3) media field (legacy)
    // Skip "400.jpg" and other broken filenames - only use if it's a real path
    let baseMediaArray = [];
    
    if (post.mediaArray && post.mediaArray.length > 0) {
      baseMediaArray = post.mediaArray;
      console.log(`[RenderMedia] Using mediaArray with ${baseMediaArray.length} items`);
    } else if (post.img && post.img !== "400.jpg" && post.img.length > 5) {
      baseMediaArray = [{ url: post.img, type: 'image' }];
      console.log(`[RenderMedia] Using img field: ${post.img}`);
    } else if (post.media && post.media !== "400.jpg" && post.media.length > 5) {
      baseMediaArray = [{ url: post.media, type: post.mediaType || 'image' }];
      console.log(`[RenderMedia] Using media field: ${post.media}`);
    }
    
    const mediaArray = normalizeMediaArray(baseMediaArray);

    if (mediaArray.length === 0) {
      console.log(`[RenderMedia] No valid media found for post ${post._id}`);
      return null;
    }

    // Use Instagram-style carousel for all multi-media posts
    return renderCarouselStyle(mediaArray);
  };

  const handleOpenFullPost = () => {
    navigate(`/post/${post._id}`);
  };

  const renderCarouselStyle = (mediaArray) => {
    const currentMedia = mediaArray[currentMediaIndex];
    const mediaUrl = getMediaUrl(currentMedia.url);
    const isVideo = currentMedia.type === 'video';

    return (
      <div className="instagram-carousel">
        <div className="carousel-main-display">
          {isVideo ? (
            <div className="video-container">
              <ReactPlayer
                url={mediaUrl}
                controls={true}
                width="100%"
                height="auto"
                onReady={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt="Post content"
              className={imageLoading ? 'loading' : 'loaded'}
              onClick={handleOpenFullPost}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
            />
          )}

          {/* Navigation arrows for multiple media - hidden in fullscreen mode */}
          {mediaArray.length > 1 && !hideCarouselControls && (
            <>
              <button
                className="carousel-arrow prev"
                onClick={() => setCurrentMediaIndexFunc((prev) => (prev - 1 + mediaArray.length) % mediaArray.length)}
                aria-label="Previous media"
              >
                <KeyboardArrowLeftIcon />
              </button>
              <button
                className="carousel-arrow next"
                onClick={() => setCurrentMediaIndexFunc((prev) => (prev + 1) % mediaArray.length)}
                aria-label="Next media"
              >
                <KeyboardArrowRightIcon />
              </button>

              {/* Counter */}
              <div className="carousel-counter-inline">
                {currentMediaIndex + 1} / {mediaArray.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail indicators at bottom */}
        {mediaArray.length > 1 && (
          <div className="carousel-indicators">
            {mediaArray.map((media, index) => (
              <button
                key={index}
                className={`indicator-dot ${index === currentMediaIndex ? 'active' : ''}`}
                onClick={() => setCurrentMediaIndexFunc(index)}
                aria-label={`Go to media ${index + 1}`}
                title={`${media.type === 'video' ? 'Video' : 'Image'} ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSingleMedia = (media) => {
    const mediaUrl = getMediaUrl(media.url);
    
    if (media.type === 'video') {
      return (
        <div className="video-container single-media">
          {imageLoading && <div className="video-loading">Loading...</div>}
          <ReactPlayer
            url={mediaUrl}
            controls={true}
            width="100%"
            height="auto"
            onReady={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        </div>
      );
    }

    return (
      <div className="image-container single-media">
        {imageLoading && <div className="image-loading">Loading...</div>}
        <img
          src={mediaUrl}
          alt="Post content"
          className={imageLoading ? 'loading' : 'loaded'}
          onClick={handleOpenFullPost}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />
      </div>
    );
  };

  const renderTwoMediaLayout = (mediaArray) => {
    return (
      <div className="media-grid-layout two-media">
        {mediaArray.map((media, index) => (
          <div key={index} className="media-item">
            {renderMediaItem(media)}
          </div>
        ))}
      </div>
    );
  };

  const renderThreeMediaLayout = (mediaArray) => {
    return (
      <div className="media-grid-layout three-media">
        <div className="media-large">
          {renderMediaItem(mediaArray[0])}
        </div>
        <div className="media-small-column">
          {mediaArray.slice(1, 3).map((media, index) => (
            <div key={index} className="media-item">
              {renderMediaItem(media)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFourMediaLayout = (mediaArray) => {
    return (
      <div className="media-grid-layout four-media">
        {mediaArray.slice(0, 4).map((media, index) => (
          <div key={index} className="media-item">
            {renderMediaItem(media)}
          </div>
        ))}
      </div>
    );
  };

  const renderMediaGrid = (mediaArray) => {
    const displayCount = 6;
    const hasMore = mediaArray.length > displayCount;
    const displayMedia = mediaArray.slice(0, displayCount);

    return (
      <div className="media-grid-layout grid">
        {displayMedia.map((media, index) => (
          <div key={index} className="media-item">
            {index === displayCount - 1 && hasMore ? (
              <div 
                className="media-overlay show-more"
                onClick={() => navigate(`/post/${post._id}`)}
              >
                <span className="more-count">+{mediaArray.length - displayCount}</span>
                <span className="more-text">More</span>
              </div>
            ) : null}
            {renderMediaItem(media)}
          </div>
        ))}
      </div>
    );
  };

  const renderMediaItem = (media) => {
    const mediaUrl = getMediaUrl(media.url);
    const isVideo = media.type === 'video';

    if (isVideo) {
      return (
        <div className="media-item-content video">
          <div 
            className="video-thumbnail"
            onClick={() => {
              setCurrentMediaIndexFunc(post.mediaArray?.indexOf(media) || 0);
              setShowMediaCarousel(true);
            }}
          >
            <ReactPlayer
              url={mediaUrl}
              width="100%"
              height="100%"
              controls={false}
              light={true}
              playing={false}
            />
            <div className="play-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="media-item-content image">
        <img
          src={mediaUrl}
          alt="Post media"
          onClick={() => {
            setCurrentMediaIndexFunc(post.mediaArray?.indexOf(media) || 0);
            setShowMediaCarousel(true);
          }}
        />
      </div>
    );
  };

  // Media Carousel Modal Component
  const renderMediaCarousel = () => {
    if (!showMediaCarousel || !post.mediaArray || post.mediaArray.length === 0) {
      return null;
    }

    const currentMedia = post.mediaArray[currentMediaIndex];
    const mediaUrl = getMediaUrl(currentMedia.url);
    const isVideo = currentMedia.type === 'video';

    return (
      <Dialog
        open={showMediaCarousel}
        onClose={() => setShowMediaCarousel(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            background: '#000'
          }
        }}
      >
        <div className="carousel-container">
          <IconButton
            onClick={() => setShowMediaCarousel(false)}
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
          >
            <CloseIcon sx={{ color: '#fff' }} />
          </IconButton>

          <div className="carousel-main">
            {isVideo ? (
              <ReactPlayer
                url={mediaUrl}
                controls={true}
                width="100%"
                height="100%"
              />
            ) : (
              <img src={mediaUrl} alt="Post media" />
            )}
          </div>

          {post.mediaArray.length > 1 && (
            <>
              <IconButton
                onClick={() => setCurrentMediaIndexFunc((prev) => (prev - 1 + post.mediaArray.length) % post.mediaArray.length)}
                sx={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#fff' }}
              >
                <KeyboardArrowLeftIcon />
              </IconButton>

              <IconButton
                onClick={() => setCurrentMediaIndexFunc((prev) => (prev + 1) % post.mediaArray.length)}
                sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#fff' }}
              >
                <KeyboardArrowRightIcon />
              </IconButton>

              <div className="carousel-counter">
                {currentMediaIndex + 1} / {post.mediaArray.length}
              </div>

              <div className="carousel-thumbnails">
                {post.mediaArray.map((media, index) => (
                  <div
                    key={index}
                    className={`thumbnail ${index === currentMediaIndex ? 'active' : ''}`}
                    onClick={() => setCurrentMediaIndexFunc(index)}
                  >
                    <img src={getMediaUrl(media.url)} alt={`Thumbnail ${index + 1}`} />
                    {media.type === 'video' && (
                      <div className="video-badge">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Dialog>
    );
  };

  // --- FULLSCREEN/DETAILS ONLY ---
  if (showOnly === "details") {
    return (
      <div className={`post-details${fullScreen ? " post-fullscreen-details" : ""}`}>
        <div className="user">
          <div className="userInfo">
            <div className="avatar-container">
              {getAvatar()}
            </div>
            <div className="details">
              <span className="name">{post.user?.name || postUser?.name || post.name}</span>
              <span className="date">{new Date(post.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="content">
          {showDesc && <p>{post.desc}</p>}
        </div>
      </div>
    );
  }
  if (showOnly === "media") {
    return (
      <div className={`post-media${fullScreen ? " post-fullscreen-media" : ""}`}>
        {renderMedia()}
      </div>
    );
  }
  // --- END FULLSCREEN/DETAILS ONLY ---

  // --- MAIN POST RENDER ---
  return (
    <div className="post">
      <div className="container">
        <div className="user">
          <div className="userInfo">
            <div className="avatar-container">
              {getAvatar()}
            </div>
            <div className="details">
              <Link
                to={`/profile/${post.userId}`}
                state={{ isOwnProfile: currentUser.id === post.userId }}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className="name">{postUser?.name || post.user?.name || post.name || "Unknown User"}</span>
              </Link>
              <span className="date">{formatTimeAgo(post.createdAt)}</span>
            </div>
          </div>
          {currentUser.id === post.userId && (
            <div style={{ position: "relative" }}>
              <MoreHorizIcon onClick={handlePostMenuOpen} style={{ cursor: "pointer" }} />
              {Boolean(postMenuAnchor) && (
                <ClickAwayListener onClickAway={handlePostMenuClose}>
                  <div className="post-menu-dropdown">
                    <div
                      className="post-menu-item"
                      onClick={handleEditPost}
                    >
                      Edit Post
                    </div>
                    <div
                      className="post-menu-item post-menu-delete"
                      onClick={handleDeleteConfirmOpen}
                    >
                      Delete Post
                    </div>
                  </div>
                </ClickAwayListener>
              )}
            </div>
          )}
        </div>
        <div className="content">
          {post.sharedPost ? (
            <>
              <p className="shared-caption">{post.desc}</p>
              <SharedPost sharedPost={post.sharedPost} />
            </>
          ) : (
            <>
              <p>{post.desc}</p>
              {post.tags?.length > 0 && (
                <div className="post-tags">
                  <LocalOfferOutlinedIcon className="tag-icon" />
                  {post.tags.map((tag) => (
                    <span 
                      key={tag} 
                      className="tag"
                      onClick={() => navigate(`/explore/${encodeURIComponent(tag)}`)}
                      onContextMenu={(e) => handleTagContextMenu(e, tag)}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {((post.media || post.img) || (Array.isArray(post.mediaArray) && post.mediaArray.length > 0)) && renderMedia()}
            </>
          )}
        </div>
        <div className="engagement-metrics">
          {EngagementScore}
          <div className="metric">
            <span className="count">{engagementMetrics.views}</span>
            <span className="label">views</span>
          </div>
          <div className="metric">
            <span className="count">{engagementMetrics.shares}</span>
            <span className="label">shares</span>
          </div>
        </div>
        <div className="info">
          <div 
            className={`item ${liked ? 'liked' : ''} ${likeLoading ? 'loading' : ''}`}
            onClick={handleLike}
          >
            {liked ? (
              <FavoriteOutlinedIcon className="heart-icon filled" />
            ) : (
              <FavoriteBorderOutlinedIcon className="heart-icon" />
            )}
            <span>{likesCount} {likesCount === 1 ? 'Like' : 'Likes'}</span>
          </div>
          <div className="item" onClick={() => setCommentOpen(!commentOpen)}>
            <TextsmsOutlinedIcon />
            <span>{commentsCount} {commentsCount === 1 ? 'Comment' : 'Comments'}</span>
          </div>
          <div className="item" onClick={handleShare}>
            <ShareOutlinedIcon />
            <span>{engagementMetrics.shares} Shares</span>
          </div>
        </div>
        {commentOpen && (
          <Comments 
            postId={post._id} 
            onCommentUpdate={handleCommentUpdate}
            initialCount={commentsCount}
          />
        )}
        <Menu
          open={!!contextMenu}
          onClose={handleCloseContextMenu}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu?.position ? 
            { top: contextMenu.position.top, left: contextMenu.position.left } 
            : undefined
          }
        >
          <MenuItem onClick={handleFollowTag}>
            Follow #{contextMenu?.tag}
          </MenuItem>
          <MenuItem onClick={() => navigate(`/explore/${encodeURIComponent(contextMenu?.tag)}`)}>
            Explore #{contextMenu?.tag}
          </MenuItem>
          <MenuItem onClick={handleCloseContextMenu}>Cancel</MenuItem>
        </Menu>
        <ShareDialog
          open={shareDialogOpen}
          onClose={handleShareDialogClose}
          post={post}
          onShare={handleShareConfirm}
        />
        <EditDialog
          open={editDialogOpen}
          onClose={handleEditDialogClose}
          post={post}
          onEdit={handleEditSave}
        />
        <Dialog
          open={deleteConfirmOpen}
          onClose={handleDeleteConfirmClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '12px',
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            Delete Post
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: 'inherit', mt: 1 }}>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ padding: '16px', gap: '8px' }}>
            <Button
              onClick={handleDeleteConfirmClose}
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 600,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              variant="contained"
              color="error"
              sx={{
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 600,
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <MuiAlert
            elevation={6}
            variant="filled"
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </MuiAlert>
        </Snackbar>
        {renderMediaCarousel()}
      </div>
    </div>
  );
};

export default Post;

