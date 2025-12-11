import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDefaultAvatar, getImageUrl } from "../../utils/imageUtils";
import "./sharedpost.scss";

const DEFAULT_GENDER = 'male';

const validateGender = (gender) => {
  const normalizedGender = gender?.toLowerCase()?.trim();
  return ['male', 'female'].includes(normalizedGender) ? normalizedGender : DEFAULT_GENDER;
};

const GenderAvatar = ({ gender, name, onError }) => (
  <div className={`default-avatar-container ${validateGender(gender)}`}>
    <img 
      src={getDefaultAvatar(gender)}
      alt={`${name}'s Avatar`}
      className="default-avatar"
      onError={onError}
    />
  </div>
);

const getMediaUrl = (media, img) => {
  const path = media || img;
  if (!path) return null;
  if (typeof path !== 'string') return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/uploads/${path.split(/[/\\]/).pop()}`;
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

// Helper to unwrap the deepest/original post (handles nested shares)
const getOriginalPost = (post) => {
  let current = post;
  for (let i = 0; i < 5 && current; i++) {
    if (current.sharedPost && typeof current.sharedPost === 'object') {
      current = current.sharedPost;
    } else if (current.post && typeof current.post === 'object') {
      current = current.post;
    } else {
      break;
    }
  }
  return current;
};

const SharedPostComponent = ({ sharedPost }) => {
  const navigate = useNavigate();
  const [avatarError, setAvatarError] = useState(false);

  // Always unwrap to the original post
  const original = getOriginalPost(sharedPost);
  if (!original) return null;

  const originalUser = original.user || (original.userId ? {
    _id: original.userId,
    name: original.name || '',
    profilePic: original.profilePic || original.profilePicture || null,
    sex: original.sex || original.gender || null
  } : { _id: '', name: original.name || 'Unknown User', profilePic: null });

  const originalUserId = originalUser._id || original.userId || "";
  const originalName = originalUser.name || original.name || "Unknown User";
  const originalProfilePic = originalUser.profilePic || original.profilePic || original.profilePicture || "/assets/person/noAvatar.png";
  const originalGender = originalUser.sex || original.gender || DEFAULT_GENDER;
  const originalDate = original.createdAt || original.date;
  const originalDesc = original.desc || original.description || "";
  const originalTags = original.tags || [];
  const mediaUrl = getMediaUrl(original.media || original.img || original.image);
  const isVideo = (original.mediaType === 'video') || /\.(mp4|mov|webm|avi|mkv)$/i.test(mediaUrl || '');

  return (
    <div className="shared-post">
      <div className="shared-header">
        <span className="shared-label">Shared Post</span>
        <Link
          to={`/profile/${originalUserId}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <span className="shared-user">
            {originalProfilePic && !avatarError ? (
              <img
                src={getImageUrl(originalProfilePic)}
                alt={originalName}
                className="shared-profile-pic"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <GenderAvatar gender={originalGender} name={originalName} />
            )}
            <span className="shared-name">{originalName}</span>
          </span>
        </Link>
      </div>
      <div className="original-post-card">
        <div className="user original-user">
          <div className="userInfo">
            <div className="avatar-container">
              {originalProfilePic && !avatarError ? (
                <img
                  src={getImageUrl(originalProfilePic)}
                  alt={originalName}
                  className="profile-pic"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <GenderAvatar gender={originalGender} name={originalName} />
              )}
            </div>
            <div className="details">
              <Link
                to={`/profile/${originalUserId}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className="name">{originalName}</span>
              </Link>
              <span className="date">{formatTimeAgo(originalDate)}</span>
            </div>
          </div>
        </div>
        <div className="content">
          <p>{originalDesc}</p>
          {originalTags.length > 0 && (
            <div className="post-tags">
              {originalTags.map((tag) => (
                <span 
                  key={tag} 
                  className="tag"
                  onClick={() => navigate(`/explore/${encodeURIComponent(tag)}`)}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {mediaUrl ? (
            <div className={isVideo ? "video-container" : "image-container"}>
              {isVideo ? (
                <video controls src={mediaUrl} className="original-media-video" />
              ) : (
                <img src={mediaUrl} alt="shared media" className="original-media-img" />
              )}
            </div>
          ) : (
            <div className="placeholder">No media available</div>
          )}
        </div>
      </div>
    </div>  
  );
};

export default SharedPostComponent;
