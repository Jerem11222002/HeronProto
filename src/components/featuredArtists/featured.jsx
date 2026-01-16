import { useState, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import "./featured.scss";
import axios from "axios";
import CircularProgress from "@mui/material/CircularProgress";
import { useContext } from "react";
import { AuthContext } from "../../context/authContext";
import { useLanguage } from "../../hooks/useLanguage";
import ErrorBoundary from "./ErrorBoundary";
import path from 'path-browserify';
 
// API base + helper axios instance (ensure consistent baseURL & auth header)
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
 
// Normalize URLs returned by backend (absolute or relative)
const normalizeUrl = (u) => {
  if (!u) return null;
  if (typeof u !== 'string') return null;
  if (u.startsWith('http')) return u;
  // Handle both /uploads and /assets paths
  if (u.startsWith('/uploads/')) return `${API_BASE}${u}`;
  if (u.startsWith('/assets/')) return `${API_BASE}${u}`;
  // For relative paths, assume uploads folder
  if (!u.startsWith('/')) return `${API_BASE}/uploads/${u}`;
  return `${API_BASE}${u}`;
};
 
// Constants for default avatars and images
const DEFAULT_AVATARS = {
  male: '/assets/person/Male.jpg',
  female: '/assets/person/Female.jpg',
  default: '/assets/person/default-avatar.png'
};
const DEFAULT_VIDEO_THUMBNAIL = '/assets/post/video-placeholder.png';

// Helper functions
const getDefaultAvatar = (gender = 'male') => {
  const normalizedGender = gender?.toLowerCase()?.trim();
  return DEFAULT_AVATARS[normalizedGender] || DEFAULT_AVATARS.default;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const TimeFilter = ({ currentFilter, onFilterChange }) => {
  const { t } = useLanguage();
  const filters = [
    { value: 'day', label: t('today') },
    { value: 'week', label: t('this-week') },
    { value: 'month', label: t('this-month') },
    { value: 'year', label: t('this-year') },
    { value: 'all', label: t('all-time') }
  ];

  return (
    <div className="time-filter">
      {filters.map(filter => (
        <button
          key={filter.value}
          className={`filter-btn ${currentFilter === filter.value ? 'active' : ''}`}
          onClick={() => onFilterChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};

const PostPreview = memo(({ post, artistName, index }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Helper to get correct media path
  const getMediaPath = (media) => normalizeUrl(media);

  // Determine if the post is a video
  const isVideo = !!(post.img && post.img.toString().toLowerCase().match(/\.(mp4|webm|ogg)(\?|$)/i));

  // Replace thumbnail generation useEffect in PostPreview with server call:
  useEffect(() => {
    if (!isVideo || !post.img) return;

    setIsLoading(true);
    setError(null);

    if (post.videoMetadata?.thumbnailBlob) {
      setThumbnailUrl(post.videoMetadata.thumbnailBlob);
      setIsLoading(false);
      return;
    }

    api.post(`/api/posts/${post._id}/generate-thumbnail`, {})
      .then(resp => {
        setThumbnailUrl(resp.data?.thumbnailUrl ? normalizeUrl(resp.data.thumbnailUrl) : DEFAULT_VIDEO_THUMBNAIL);
      }).catch(err => {
        console.error('Thumbnail generation failed:', err);
        setThumbnailUrl(DEFAULT_VIDEO_THUMBNAIL);
        setError('Failed to load preview');
      }).finally(() => setIsLoading(false));
  }, [post, isVideo]);

  return (
    <div 
      className={`post-preview ${isVideo ? 'video-post' : ''} ${isLoading ? 'loading' : ''} ${error ? 'error' : ''}`} 
      title={`Posted ${formatDate(post.createdAt)}`}
    >
      {post.img ? (
        isVideo ? (
          <div className="video-preview">
            {thumbnailUrl && !imageError ? (
              <>
                <img 
                  src={thumbnailUrl}
                  alt={`${artistName}'s video post ${index + 1}`}
                  loading="lazy"
                  onError={(e) => {
                    console.error('Error loading thumbnail');
                    setImageError(true);
                    e.currentTarget.src = DEFAULT_VIDEO_THUMBNAIL;
                  }}
                />
                <div className="video-indicator">
                  <span>▶️</span>
                </div>
              </>
            ) : isLoading ? (
              <div className="loading-preview">
                <CircularProgress size={20} />
              </div>
            ) : (
              <div className="loading-preview" style={{backgroundColor: '#f3f4f6'}}>
                <span style={{fontSize: '12px', color: '#9ca3af'}}>Failed to load</span>
              </div>
            )}
          </div>
        ) : !imageError ? (
          <img 
            src={getMediaPath(post.img)}
            alt={`${artistName}'s post ${index + 1}`}
            loading="lazy"
            onError={(e) => {
              console.error('Image load error:', e);
              setImageError(true);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null
      ) : null}
      {!post.img || imageError ? (
        <div className="no-preview">
          <span>📷</span>
          <small>No preview</small>
        </div>
      ) : null}
      <div className="post-stats-overlay">
        <div className="stats">
          <span title="Likes">❤️ {post.likes?.toLocaleString() || 0}</span>
          <span title="Comments">💬 {post.comments?.toLocaleString() || 0}</span>
          {typeof post.views === "number" && (
            <span title="Views">👁️ {post.views?.toLocaleString() || 0}</span>
          )}
          {typeof post.shares === "number" && (
            <span title="Shares">🔄 {post.shares?.toLocaleString() || 0}</span>
          )}
          {isVideo && post.videoMetadata?.duration && (
            <span title="Duration">⏱️ {Math.round(post.videoMetadata.duration)}s</span>
          )}
        </div>
        <div className="date" title={`Posted on ${formatDate(post.createdAt)}`}>
          {formatDate(post.createdAt)}
        </div>
      </div>
    </div>
  );
});

// Engagement calculation: shares highest weight
const calculateEngagement = (artist) => {
  // Assign weights: shares highest, then likes, comments, views, followers, posts
  const shares = artist.totalShares || 0;
  const likes = artist.totalLikes || 0;
  const comments = artist.totalComments || 0;
  const views = artist.totalViews || 0;
  const followers = artist.followersCount || (Array.isArray(artist.followers) ? artist.followers.length : 0);
  const posts = artist.postCount || 0;

  // Example weights: shares=5, likes=3, comments=2, views=1, followers=1, posts=1
  return (
    shares * 5 +
    likes * 3 +
    comments * 2 +
    views * 1 +
    followers * 1 +
    posts * 1
  );
};

// Compact, expandable artist card
const ArtistItem = memo(({ artist, rank, currentUserId, currentUser, userRelationships }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutualFriend, setIsMutualFriend] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  // show up to 3 previews, always-expanded card
  const postsToShow = Array.isArray(artist.topPosts) ? artist.topPosts.slice(0, 3) : [];

  // Check if current user already follows this artist and if it's mutual
  useEffect(() => {
    if (!artist?._id || !currentUser?._id) {
      setIsFollowing(false);
      setIsMutualFriend(false);
      return;
    }
    
    const artistId = String(artist._id);
    
    // Check if user is in mutual friends list
    const isMutual = Array.isArray(userRelationships?.mutualFriends)
      ? userRelationships.mutualFriends.some(f => String(f._id || f.id) === artistId)
      : false;
    
    // Check if user is in following list
    const isAlreadyFollowing = Array.isArray(userRelationships?.following)
      ? userRelationships.following.some(f => String(f._id || f.id) === artistId)
      : false;
    
    setIsMutualFriend(isMutual);
    setIsFollowing(isAlreadyFollowing || isMutual);
  }, [artist._id, userRelationships?.following, userRelationships?.mutualFriends, currentUser?._id]);

  const handleFollowToggle = async () => {
    if (!currentUserId) {
      console.error('User not authenticated');
      return;
    }

    setIsFollowLoading(true);
    const previousFollowingState = isFollowing;
    const previousMutualState = isMutualFriend;
    
    try {
      const endpoint = isFollowing 
        ? `/api/users/unfollow/${artist._id}`
        : `/api/users/follow/${artist._id}`;
      
      const response = await api.post(endpoint);
      
      if (response.status === 200 || response.status === 201) {
        setIsFollowing(!isFollowing);
        // When unfollowing, also update mutual friend state
        if (isMutualFriend) {
          setIsMutualFriend(false);
        }
        console.log(`${isFollowing ? 'Unfollowed' : 'Followed'} ${artist.name}`);
      } else {
        throw new Error('Unexpected response status');
      }
    } catch (err) {
      console.error('Follow error:', err);
      // Revert state on error
      setIsFollowing(previousFollowingState);
      setIsMutualFriend(previousMutualState);
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <div className="featured-item" role="article" aria-label={`${artist.name} card`}>
      <div className="rank-badge">#{rank}</div>

      <div className="artist-preview" aria-hidden="false">
        <div className="artist-avatar">
          <Link to={`/profile/${artist._id}`} aria-label={`${artist.name} profile`}>
            <img
              src={artist.profilePic || getDefaultAvatar(artist.gender)}
              alt={`${artist.name}'s profile`}
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = getDefaultAvatar(artist.gender);
              }}
            />
          </Link>
        </div>

        <div className="recent-posts-container" aria-hidden={postsToShow.length === 0}>
          <div className="recent-posts">
            {postsToShow.map((post, index) => (
              <PostPreview
                key={post?._id || index}
                post={post}
                artistName={artist.name}
                index={index}
              />
            ))}
          </div>

          {postsToShow.length === 0 && <div className="no-posts">No top posts</div>}
        </div>
      </div>

      <div className="artist-info">
        <div className="info-header">
          <div className="info-left">
            <Link to={`/profile/${artist._id}`} className="name-link" aria-label={`${artist.name} profile`}>
              <span className="name">{artist.name}</span>
            </Link>
          </div>
          <button
            className={`follow-btn ${isFollowing ? 'following' : ''} ${isMutualFriend ? 'friends' : ''}`}
            onClick={handleFollowToggle}
            disabled={isFollowLoading}
            title={isMutualFriend ? 'Friends' : isFollowing ? 'Unfollow' : 'Follow'}
          >
            {isMutualFriend ? '👯 Friends' : isFollowing ? '✓ Following' : '+ Follow'}
          </button>
        </div>

        <span className="username">@{artist.username}</span>

        {artist.bio && <div className="bio">{artist.bio}</div>}

        <div className="key-metrics">
          <div className="metric-item">
            <div className="metric-label">Engagement</div>
            <div className="metric-value-large">🔥 {(artist.engagement / 1000 > 1 ? (artist.engagement / 1000).toFixed(1) + 'k' : artist.engagement)}</div>
            <div className="metric-bar">
              <div className="metric-fill" style={{width: '75%'}}></div>
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Followers</div>
            <div className="metric-value-large">👥 {((artist.followersCount || artist.followers?.length || 0) / 1000 > 1 ? ((artist.followersCount || artist.followers?.length || 0) / 1000).toFixed(1) + 'k' : (artist.followersCount || artist.followers?.length || 0))}</div>
            <div className="metric-bar">
              <div className="metric-fill" style={{width: '60%'}}></div>
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Likes</div>
            <div className="metric-value-large">❤️ {(artist.totalLikes / 1000 > 1 ? (artist.totalLikes / 1000).toFixed(1) + 'k' : artist.totalLikes)}</div>
            <div className="metric-bar">
              <div className="metric-fill" style={{width: '65%'}}></div>
            </div>
          </div>
        </div>

        <div className="all-stats">
          <div className="stat-group">
            <span className="stat">
              <span className="icon">💬</span>
              <span className="label">Comments</span>
              <span className="value">{artist.totalComments?.toLocaleString() || 0}</span>
            </span>
            <span className="stat">
              <span className="icon">👁️</span>
              <span className="label">Views</span>
              <span className="value">{artist.totalViews?.toLocaleString() || 0}</span>
            </span>
            <span className="stat">
              <span className="icon">🔄</span>
              <span className="label">Shares</span>
              <span className="value">{artist.totalShares?.toLocaleString() || 0}</span>
            </span>
            <span className="stat">
              <span className="icon">📝</span>
              <span className="label">Posts</span>
              <span className="value">{artist.postCount || 0}</span>
            </span>
          </div>
        </div>

        <div className="card-actions">
          <Link to={`/profile/${artist._id}`} className="view-profile-btn">
            View Profile →
          </Link>
        </div>
      </div>
    </div>
  );
});
 
const Featured = () => {
  const { currentUser, userRelationships } = useContext(AuthContext);
  const { t } = useLanguage();
  const [topArtists, setTopArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('week');
  const currentUserId = currentUser?._id || currentUser?.id;

  const fetchTopArtists = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    try {
      const res = await axios.get(`/api/featured/top-artists/${timeFilter}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          'Content-Type': 'application/json'
        },
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
      });

      // Exclude current user's own card (client-side quick guard)
      const filtered = (res.data || []).filter(a => {
        return a._id?.toString() !== currentUser._id?.toString();
      });

      setTopArtists(filtered);
    } catch (error) {
      console.error("Error fetching top artists:", error);
      setError(
        error.response?.data?.message || 
        "Failed to load top artists. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser, timeFilter]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchTopArtists();
  }, [fetchTopArtists, timeFilter]);

  const handleFilterChange = (filter) => {
    setTimeFilter(filter);
  };

  const getTimeframeLabel = () => {
    switch (timeFilter) {
      case 'day': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      case 'all': return 'All Time';
      default: return 'This Week';
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="featured loading" aria-busy="true">
          <CircularProgress size={24} />
          <span>Loading top artists...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="featured error" role="alert">
          <span>{error}</span>
          <button onClick={fetchTopArtists}>
            Try Again
          </button>
        </div>
      );
    }

    // Recalculate engagement with shares as highest weight and sort
    const artistsWithEngagement = topArtists.map(artist => ({
      ...artist,
      engagement: calculateEngagement(artist)
    })).sort((a, b) => b.engagement - a.engagement);

    // Remove duplicate users by _id
    const uniqueArtists = [];
    const seenIds = new Set();
    for (const artist of artistsWithEngagement) {
      const id = artist._id?.toString();
      if (id && !seenIds.has(id)) {
        uniqueArtists.push(artist);
        seenIds.add(id);
      }
    }

    return (
      <>
        <div className="featured-header">
          <h3>Top Artists - {getTimeframeLabel()}</h3>
          <TimeFilter 
            currentFilter={timeFilter}
            onFilterChange={handleFilterChange}
          />
          {uniqueArtists.length ? (
            <small>{uniqueArtists.length} artists featured</small>
          ) : (
            <div className="featured empty">
              <span>{t('no-featured-artists')}</span>
              <small>{t('try-different-filter')}</small>
            </div>
          )}
        </div>
        
        {uniqueArtists.length > 0 && (
          <div className="featured-list">
            {uniqueArtists.map((artist, index) => (
              <ArtistItem 
                key={artist._id} 
                artist={artist} 
                rank={index + 1}
                currentUserId={currentUserId}
                currentUser={currentUser}
                userRelationships={userRelationships}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <ErrorBoundary>
      <div className="featured">
        {renderContent()}
      </div>
    </ErrorBoundary>
  );
};

export default memo(Featured);