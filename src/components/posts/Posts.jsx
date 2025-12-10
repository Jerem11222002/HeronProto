import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import Post from "../post/Post";
import { AuthContext } from "../../context/authContext";
import "./posts.scss";
import logger from "../../utils/logger";

const API_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const getDefaultProfilePic = (sex) => {
  return sex === 'female' ? '/assets/person/Female.jpg' : '/assets/person/Male.jpg';
};

// Create axios instance with retry logic
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add retry interceptor
axiosInstance.interceptors.response.use(null, async error => {
  const { config } = error;
  if (!config || !config.retry) {
    return Promise.reject(error);
  }
  config.retry -= 1;
  const delayRetry = new Promise(resolve => setTimeout(resolve, config.retryDelay || 1000));
  await delayRetry;
  return axiosInstance(config);
});

const validateAndDeduplicatePosts = (posts) => {
  if (!Array.isArray(posts)) return [];
  const seen = new Set();
  return posts.filter(post => {
    if (!post?._id || seen.has(post._id)) return false;
    seen.add(post._id);
    return true;
  });
};

const formatMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`;
  return `${API_URL}/uploads/${url.split(/[/\\]/).pop()}`;
};

const formatProfilePic = (post, userData = null) => {
  if (post.user?.profilePic) {
    return formatMediaUrl(post.user.profilePic);
  }
  if (userData && post.userId === userData._id) {
    return userData.profilePic ? formatMediaUrl(userData.profilePic) : 
           getDefaultProfilePic(userData.sex);
  }
  return post.profilePic ? formatMediaUrl(post.profilePic) : 
         getDefaultProfilePic(post.user?.sex || post.userSex || 'male');
};

const resolveSharedPost = (raw) => {
  if (!raw) return null;
  // support shapes: raw.sharedPost (id/string), raw.post, raw.shared (wrapper), or already the original object
  let candidate = raw.post || raw.shared || raw.sharedPost || raw;
  // if wrapper contains nested 'post' or 'sharedPost' keep unwrapping a couple levels
  for (let i = 0; i < 3; i++) {
    if (!candidate) break;
    if (candidate.post && typeof candidate.post === 'object') candidate = candidate.post;
    else if (candidate.sharedPost && typeof candidate.sharedPost === 'object') candidate = candidate.sharedPost;
    else break;
  }
  return candidate;
};

const Posts = ({ userPosts, onPostUpdate, userId, userData = null, onAddSharedPost }) => {
  const { currentUser } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('hybrid');
  const [filters, setFilters] = useState({
    tags: [],
    timeRange: 'all'
  });

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        logger.debug('Posts.fetch.start', {
          userId,
          userPostsCount: Array.isArray(userPosts) ? userPosts.length : 0,
          hasToken: !!localStorage.getItem("token"),
          currentUserId: currentUser?._id
        });

        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Authentication token not found");
        }

        if (userId !== undefined) {
          setPosts([]);
        }

        if (userPosts && Array.isArray(userPosts)) {
          const processedPosts = userPosts.map(post => ({
            ...post,
            img: post.img ? formatMediaUrl(post.img) : null,
            media: post.media ? formatMediaUrl(post.media) : null,
            user: {
              _id: post.userId || post.user?._id,
              name: post.user?.name || post.name,
              profilePic: formatProfilePic(post, userData),
              sex: post.user?.sex || post.userSex || 'male'
            },
            profilePic: formatProfilePic(post, userData),
            name: post.user?.name || post.name
          }));

          logger.debug('Posts.processed', {
            count: processedPosts.length,
            sampleId: processedPosts[0]?._id || null
          });

          setPosts(validateAndDeduplicatePosts(processedPosts));
          setLoading(false);
          return;
        }

        const endpoint = userId 
          ? `${API_URL}/api/posts/user/${userId}`
          : `${API_URL}/api/posts/feed`;

        const config = {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            sortBy,
            ...filters,
            userId: userId || currentUser?._id
          }
        };

        const response = await axiosInstance.get(endpoint, config);
        
        const processedPosts = (userPosts && Array.isArray(userPosts) ? userPosts : response.data.items || response.data || [])
          .map(post => {
            const resolvedShared = resolveSharedPost(post.sharedPost || post.post || post.shared);
            const sharedPost = resolvedShared ? {
              ...resolvedShared,
              img: resolvedShared.img ? formatMediaUrl(resolvedShared.img) : null,
              media: resolvedShared.media ? formatMediaUrl(resolvedShared.media) : null,
              mediaType: resolvedShared.mediaType || (resolvedShared.media && /\.(mp4|mov|webm|avi|mkv)$/i.test(resolvedShared.media) ? 'video' : (resolvedShared.img ? 'image' : null)),
              user: {
                _id: resolvedShared.user?._id || resolvedShared.userId || resolvedShared._id || '',
                name: resolvedShared.user?.name || resolvedShared.name || '',
                profilePic: resolvedShared.user?.profilePic ? formatMediaUrl(resolvedShared.user.profilePic) : (resolvedShared.profilePic ? formatMediaUrl(resolvedShared.profilePic) : null),
                sex: resolvedShared.user?.sex || resolvedShared.sex || 'male'
              }
            } : null;

            return {
              ...post,
              img: post.img ? formatMediaUrl(post.img) : null,
              media: post.media ? formatMediaUrl(post.media) : null,
              user: {
                _id: post.userId || post.user?._id,
                name: post.user?.name || post.name,
                profilePic: formatProfilePic(post, userData),
                sex: post.user?.sex || post.userSex || 'male'
              },
              profilePic: formatProfilePic(post, userData),
              name: post.user?.name || post.name,
              sharedPost // normalized nested shared post
            };
          });

        setPosts(validateAndDeduplicatePosts(processedPosts));
        setError(null);

      } catch (error) {
        logger.error('Posts.fetch.error', { message: error?.message || String(error) });
        setError(error.message || "Failed to fetch posts");
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [userId, userPosts, sortBy, filters, currentUser?._id, userData]);

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  };

  if (loading) {
    return (
      <div className="posts-loading">
        <div className="loading-spinner"></div>
        <p>Loading posts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="posts-error">
        <p>Error loading posts: {error}</p>
        <button onClick={() => window.location.reload()} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="posts">
      {!userId && !userPosts && (
        <div className="posts-controls">
          <div className="sort-controls">
            <select 
              value={sortBy} 
              onChange={(e) => handleSortChange(e.target.value)}
              className="sort-select"
            >
              <option value="hybrid">For You</option>
              <option value="recent">Most Recent</option>
              <option value="trending">Trending</option>
            </select>
          </div>
          
          <div className="filter-controls">
            <select
              value={filters.timeRange}
              onChange={(e) => handleFilterChange({ timeRange: e.target.value })}
              className="time-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      )}

      <div className="posts-grid">
        {posts.length === 0 ? (
          <div className="posts-empty">
            <p>No posts to display.</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <Post 
              key={`${post._id}-${index}`} 
              post={post} 
              onPostUpdate={onPostUpdate}
              onAddSharedPost={onAddSharedPost} // <-- Pass the callback here
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Posts;
