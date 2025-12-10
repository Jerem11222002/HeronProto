import { useState, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import "./featured.scss";
import axios from "axios";
import CircularProgress from "@mui/material/CircularProgress";
import { useContext } from "react";
import { AuthContext } from "../../context/authContext";
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
  if (u.startsWith('/uploads/') || u.startsWith('/assets/')) return `${API_BASE}${u}`;
  return `${API_BASE}/uploads/${u.split(/[\/]/).pop()}`;
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

const TimeFilter = memo(({ currentFilter, onFilterChange }) => {
  const filters = [
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' }
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
});

const PostPreview = memo(({ post, artistName, index }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
            {thumbnailUrl ? (
              <>
                <img 
                  src={thumbnailUrl}
                  alt={`${artistName}'s video post ${index + 1}`}
                  loading="lazy"
                  onError={(e) => {
                    console.error('Error loading thumbnail');
                    e.target.src = DEFAULT_VIDEO_THUMBNAIL;
                  }}
                />
                <div className="video-indicator">
                  <span>â–¶ï¸</span>
                </div>
                {error && (
                  <div className="error-overlay">
                    <span>{error}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="loading-preview">
                <CircularProgress size={20} />
              </div>
            )}
          </div>
        ) : (
          <img 
            src={getMediaPath(post.img)}
            alt={`${artistName}'s post ${index + 1}`}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('no-preview');
            }}
          />
        )
      ) : (
        <div className="no-preview">
          <span>No preview available</span>
        </div>
      )}
      <div className="post-stats-overlay">
        <div className="stats">
          <span title="Likes">â¤ï¸ {post.likes?.toLocaleString() || 0}</span>
          <span title="Comments">ðŸ’¬ {post.comments?.toLocaleString() || 0}</span>
          {typeof post.views === "number" && (
            <span title="Views">ðŸ‘ï¸ {post.views?.toLocaleString() || 0}</span>
          )}
          {typeof post.shares === "number" && (
            <span title="Shares">ðŸ”„ {post.shares?.toLocaleString() || 0}</span>
          )}
          {isVideo && post.videoMetadata?.duration && (
            <span title="Duration">â±ï¸ {Math.round(post.videoMetadata.duration)}s</span>
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
  const followers = artist.followers || 0;
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
const ArtistItem = memo(({ artist, rank }) => {
  // show up to 3 previews, always-expanded card
  const postsToShow = Array.isArray(artist.topPosts) ? artist.topPosts.slice(0, 3) : [];

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
            {artist.email && <span className="email">Â· {artist.email}</span>}
            <span className="username">@{artist.username}</span>
          </div>
        </div>

        <div className="compact-stats" aria-hidden="false">
          <span className="engagement" title="Engagement score">
            <span className="icon" aria-hidden="true">ðŸ”¥</span>
            <span className="count">{artist.engagement?.toLocaleString() || 0}</span>
          </span>
          <span className="likes" title="Total likes">
            <span className="icon" aria-hidden="true">â¤ï¸</span>
            <span className="count">{artist.totalLikes?.toLocaleString() || 0}</span>
          </span>
          <span className="followers" title="Followers">
            <span className="icon" aria-hidden="true">ðŸ‘¥</span>
            <span className="count">{artist.followers?.toLocaleString() || 0}</span>
          </span>
        </div>

        {artist.bio && <div className="bio">{artist.bio}</div>}

        <div className="stats" aria-hidden="false">
          <span className="comments" title={`${artist.totalComments} total comments`}>
            <span className="icon" aria-hidden="true">ðŸ’¬</span>
            <span className="count">{artist.totalComments?.toLocaleString() || 0}</span>
          </span>
          <span className="views" title={`${artist.totalViews} total views`}>
            <span className="icon" aria-hidden="true">ðŸ‘ï¸</span>
            <span className="count">{artist.totalViews?.toLocaleString() || 0}</span>
          </span>
          <span className="shares" title={`${artist.totalShares} total shares`}>
            <span className="icon" aria-hidden="true">ðŸ”„</span>
            <span className="count">{artist.totalShares?.toLocaleString() || 0}</span>
          </span>
          <span className="posts" title={`${artist.postCount} posts`}>
            <span className="icon" aria-hidden="true">ðŸ“</span>
            <span className="count">{artist.postCount || 0}</span>
          </span>
        </div>

        <div className="engagement-score" title="Engagement score is based on shares, likes, comments, posts, views, and followers">
          <strong>Engagement:</strong> {artist.engagement?.toLocaleString() || 0}
        </div>
      </div>
    </div>
  );
});
 
const Featured = () => {
  const { currentUser } = useContext(AuthContext);
  const [topArtists, setTopArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('week');

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
              <span>No featured artists for this time period</span>
              <small>Try a different time filter</small>
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
