  import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/authContext";
import Post from "./Post";
import Comments from "../comments/Comments";
import ShareDialog from "./sharedialog";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import FileCopyOutlinedIcon from "@mui/icons-material/FileCopyOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { getDefaultAvatar, getImageUrl } from "../../utils/imageUtils";
import "./FullScreenPostPage.scss";

export default function FullScreenPostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [avatarError, setAvatarError] = useState(false);
  const [postUser, setPostUser] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const mediaRef = useRef(null);

  useEffect(() => {
    async function fetchPost() {
      setLoading(true);
      try {
        const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem("token");
        const res = await fetch(`${baseURL}/api/posts/${postId}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        if (!res.ok) throw new Error("Failed to fetch post");
        const data = await res.json();
        setPost(data);
        
        // Set initial comment count
        if (Array.isArray(data.comments)) {
          setCommentCount(data.comments.length);
        }
        
        // Fetch the user separately for better avatar data (like Post.jsx does)
        if (data.userId) {
          try {
            const userRes = await fetch(`${baseURL}/api/users/${data.userId}`, {
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              }
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              const userObj = userData?.data ?? userData;
              setPostUser(userObj);
            }
          } catch (e) {
            console.log("Could not fetch user data separately");
          }
        }
      } catch (e) {
        setPost(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [postId]);

  // keyboard: Esc to go back
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") navigate(-1);
      // optionally: other shortcuts here
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (loading) {
    return (
      <div className="fullscreen-post-root">
        <div className="fullscreen-post-header">
          <div className="header-left">
            <Link to="/" className="fullscreen-post-back">&larr; Back</Link>
            <span className="fullscreen-post-title">Post</span>
          </div>
          <div className="header-actions">
            <div className="skeleton-btn" />
            <div className="skeleton-btn short" />
          </div>
        </div>
        <div className="fullscreen-post-main">
          <div className="fullscreen-post-media">
            <div className="fullscreen-post-media-inner skeleton-media" />
          </div>
          <div className="fullscreen-post-comments">
            <div className="fullscreen-post-details skeleton-details" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) return <div className="fullscreen-post-error">Post not found.</div>;

  const isShared = !!post.sharedPost && typeof post.sharedPost === "object";
  const originalPost = isShared ? (function getOriginalPost(p){ let cur=p; for(let i=0;i<6&&cur;i++){ if(cur.sharedPost && typeof cur.sharedPost==='object') cur = cur.sharedPost; else break;} return cur;})(post) : post;

  // build a details object that guarantees a `user` object for Post.details (so avatar uses original poster)
  const detailsPost = (() => {
    const u = originalPost.user || {};
    const normalizedUser = {
      _id: u._id || originalPost.userId || null,
      name: u.name || originalPost.name || "",
      profilePic: u.profilePic || u.profilePicture || originalPost.profilePic || originalPost.profilePicture || null,
      profilePicture: u.profilePicture || u.profilePic || originalPost.profilePicture || originalPost.profilePic || null,
      gender: u.gender || u.sex || null
    };
    return { ...originalPost, user: normalizedUser };
  })();

  // Render avatar with fallback - use the normalized detailsPost data
  const renderAvatar = () => {
    // Check all possible locations (same as Post.jsx logic)
    let avatarSrc = null;
    let userName = "";
    let userGender = null;

    // Primary: user object from post (fully populated)
    if (post.user) {
      avatarSrc = post.user.profilePic || post.user.profilePicture || null;
      userGender = post.user.gender;
      userName = post.user.name;
    } 
    // Secondary: direct properties on post
    else if (post.profilePic || post.profilePicture) {
      avatarSrc = post.profilePic || post.profilePicture;
      userGender = post.gender || post.sex;
      userName = post.name;
    } 
    // Tertiary: separately fetched user (most reliable for full user data)
    else if (postUser?.profilePic || postUser?.profilePicture) {
      avatarSrc = postUser.profilePic || postUser.profilePicture;
      userGender = postUser.gender;
      userName = postUser.name;
    }

    // If we have avatar source and no error, display it
    if (avatarSrc && !avatarError) {
      return (
        <img
          src={getImageUrl(avatarSrc)}
          alt={userName || "User"}
          className="avatar"
          onError={() => setAvatarError(true)}
        />
      );
    }

    // Fallback with gender-based avatar
    if (userGender) {
      return (
        <img
          src={getDefaultAvatar(userGender)}
          alt={userName || "User"}
          className="avatar default-avatar"
        />
      );
    }

    // Final fallback: generic SVG avatar
    return (
      <div className="avatar default-avatar-container">
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="20" fill="#e6e6e6"/>
          <circle cx="20" cy="15" r="7" fill="#bdbdbd"/>
          <ellipse cx="20" cy="29" rx="10" ry="6" fill="#bdbdbd"/>
        </svg>
      </div>
    );
  };
  
  // header actions
  const copyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSnackbar({ open: true, message: "Link copied to clipboard!", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Failed to copy link", severity: "error" });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCommentCountUpdate = (updateFn) => {
    setCommentCount(prev => {
      if (typeof updateFn === 'function') {
        return updateFn(prev);
      }
      return updateFn;
    });
  };

  const openOriginalInNewTab = () => {
    const targetId = originalPost._id || post._id;
    window.open(`${window.location.origin}/post/${targetId}`, "_blank");
  };

  const openMediaFullscreen = () => {
    // try to open media url in new tab
    const media = originalPost.media || originalPost.img;
    if (!media) return;
    const url = media.startsWith("http") ? media : `${window.location.origin}${media}`;
    window.open(url, "_blank");
  };

  const downloadMedia = () => {
    const media = originalPost.media || originalPost.img;
    if (!media) return;
    const url = media.startsWith("http") ? media : `${window.location.origin}${media}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() || "media";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSave = () => {
    setSnackbar({ open: true, message: "Post saved to your collection", severity: "success" });
    handleMenuClose();
  };

  const handleReport = () => {
    setSnackbar({ open: true, message: "Post reported. Thank you for your feedback.", severity: "info" });
    handleMenuClose();
  };

  const handleShareDialogClose = () => {
    setShareDialogOpen(false);
  };

  const handleShareConfirm = async (caption) => {
    try {
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem("token");
      
      await fetch(`${baseURL}/api/posts`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          desc: caption,
          sharedPost: post._id
        })
      });
      
      setSnackbar({ open: true, message: "Post shared successfully!", severity: "success" });
      setShareDialogOpen(false);
    } catch (error) {
      setSnackbar({ open: true, message: "Failed to share post", severity: "error" });
    }
  };

  return (
    <div className="fullscreen-post-root" role="dialog" aria-label="Full screen post">
      <div className="fullscreen-post-header">
        <div className="header-left">
          <button className="link-like back-btn" onClick={() => navigate(-1)}>&larr; Back to Feed</button>
          <span className="fullscreen-post-title">Post</span>
        </div>

        <div className="header-actions" aria-hidden={false}>
          <button className="primary-action-btn" onClick={() => setShareDialogOpen(true)} title="Share this post">
            <ShareOutlinedIcon fontSize="small" />
            <span>Share</span>
          </button>
          <button className="secondary-action-btn" onClick={handleSave} title="Save post">
            <BookmarkBorderIcon fontSize="small" />
            <span>Save</span>
          </button>
          <button className="icon-btn more-btn" onClick={handleMenuOpen} title="More options" aria-label="More actions">
            <MoreHorizIcon fontSize="small" />
          </button>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            className="fullscreen-more-menu"
            slotProps={{
              paper: {
                sx: {
                  borderRadius: "12px",
                  marginTop: "8px"
                }
              }
            }}
          >
            <MenuItem onClick={() => { copyPermalink(); handleMenuClose(); }} className="menu-item">
              <FileCopyOutlinedIcon fontSize="small" />
              <span>Copy Link</span>
            </MenuItem>
            <MenuItem onClick={() => { openMediaFullscreen(); handleMenuClose(); }} className="menu-item">
              <FullscreenIcon fontSize="small" />
              <span>View Media</span>
            </MenuItem>
            <MenuItem onClick={() => { downloadMedia(); handleMenuClose(); }} className="menu-item">
              <FileDownloadIcon fontSize="small" />
              <span>Download</span>
            </MenuItem>
            <MenuItem onClick={() => { openOriginalInNewTab(); handleMenuClose(); }} className="menu-item">
              <OpenInNewIcon fontSize="small" />
              <span>Open Original</span>
            </MenuItem>
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.12)", margin: "4px 0" }} />
            <MenuItem onClick={handleReport} className="menu-item danger">
              <span>Report Post</span>
            </MenuItem>
          </Menu>
        </div>
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <ShareDialog
        open={shareDialogOpen}
        onClose={handleShareDialogClose}
        post={post}
        onShare={handleShareConfirm}
        currentUser={currentUser}
      />

      <div className="fullscreen-post-main">
        <div className="fullscreen-post-media" ref={mediaRef}>
          <div className="fullscreen-post-media-inner">
            <Post post={originalPost} showOnly="media" fullScreen />
          </div>
        </div>

        <div className="fullscreen-post-comments">
          <div className="fullscreen-post-details">
            <div className="userInfo">
              <div className="avatar-container">
                {renderAvatar()}
              </div>
              <div className="details">
                <span className="name">{detailsPost.user?.name || detailsPost.name}</span>
                <span className="date">{new Date(detailsPost.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="content">
              <p>{detailsPost.desc}</p>
              {detailsPost.tags?.length > 0 && (
                <div className="post-tags">
                  <LocalOfferOutlinedIcon className="tag-icon" />
                  {detailsPost.tags.map((tag) => (
                    <span key={tag} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Engagement Metrics */}
            <div className="engagement-row">
              <div className="engagement-stat">
                <span className="stat-count">{post?.likes?.length || 0}</span>
                <span className="stat-label">Likes</span>
              </div>
              <div className="engagement-stat">
                <span className="stat-count">{commentCount}</span>
                <span className="stat-label">Comments</span>
              </div>
              <div className="engagement-stat">
                <span className="stat-count">{post?.engagementMetrics?.shares || 0}</span>
                <span className="stat-label">Shares</span>
              </div>
              <div className="engagement-stat">
                <span className="stat-count">{post?.engagementMetrics?.views || 0}</span>
                <span className="stat-label">Views</span>
              </div>
            </div>
          </div>

          <div className="comments-area" role="region" aria-label="Comments">
            <Comments postId={originalPost._id} onCommentUpdate={handleCommentCountUpdate} />
          </div>
        </div>
      </div>
    </div>
  );
}