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

// Helper function to check if a post has valid media
const hasValidMedia = (post) => {
  if (!post) return false;
  
  // For shared posts, check if the shared post has media
  if (post.sharedPost && typeof post.sharedPost === 'object') {
    const sharedMedia = post.sharedPost.media || post.sharedPost.img;
    const sharedMediaType = post.sharedPost.mediaType;
    if (typeof sharedMedia !== 'string' || sharedMedia.trim().length === 0) return false;
    // Must have both media AND a valid mediaType
    return sharedMediaType && (sharedMediaType === 'image' || sharedMediaType === 'video');
  }
  
  // For regular posts, check the post's media AND mediaType
  const media = post.media || post.img;
  const mediaType = post.mediaType;
  
  if (typeof media !== 'string' || media.trim().length === 0) return false;
  
  // CRITICAL: Must have a valid mediaType (image or video)
  // Posts with media but no mediaType are orphaned/broken entries
  return mediaType && (mediaType === 'image' || mediaType === 'video');
};

// Shared Post Renderer
const SharedPost = ({ sharedPost }) => {
  if (!sharedPost) return null;
  const originalUser = sharedPost.user || {};
  const mediaUrl = getMediaUrl(sharedPost.media || sharedPost.img);

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
        {(sharedPost.media || sharedPost.img) && (
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

const Post = ({ post, onDeletePost, onAddSharedPost, showOnly, fullScreen, showDesc = true }) => {
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
    const mediaUrl = getMediaUrl(post.media || post.img);
    if (post.mediaType === 'video') {
      return (
        <div className="video-container">
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
      <div className="image-container">
        {imageLoading && <div className="image-loading">Loading...</div>}
        <img
          src={mediaUrl}
          alt="Post content"
          className={imageLoading ? 'loading' : 'loaded'}
          onLoad={() => {
            setImageLoading(false);
          }}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />
      </div>
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
              {(post.media || post.img) && renderMedia()}
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
          {/* Show Full Post Button - only if post has valid media */}
          {hasValidMedia(post) && (
            <Link
              to={`/post/${post._id}`}
              className="show-full-post-btn"
              aria-label="Show full post"
            >
              Show Full Post
            </Link>
          )}
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
      </div>
    </div>
  );
};

export default Post;

