import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useEvents } from "../../context/EventsContext";
import FeaturedArtists from "../../components/featuredArtists/featured";
import FeaturedTitle from "../../components/featuredArtists/FeaturedTitle";
import Posts from "../../components/posts/Posts";
import Share from "../../components/share/Share";
import EventCard from "../../components/evenCard/EventCard";
import { useAuth } from "../../context/authContext";
import { useInView } from 'react-intersection-observer';
import useEventCounts from "../../hooks/useEventCounts";
import "./home.scss";

const INTEREST_MAPPINGS = {
  'music': ['musical', 'singing', 'song', 'choir', 'band', 'opera', 'concert'],
  'cultural': ['traditional', 'folk', 'heritage', 'customs'],
  'performance': ['performing', 'stage', 'theatre', 'drama', 'show'],
  'visual-arts': ['art', 'painting', 'drawing', 'sculpture', 'design'],
  'theatre': ['drama', 'acting', 'stage-performance', 'theatrical'],
  'dance': ['dance', 'choreography', 'movement', 'ballet'],
  'vocal-arts': ['singing', 'choir', 'voice', 'musical', 'song', 'vocal', 'vocals'],
  'modern-music': ['contemporary', 'band', 'popular', 'modern', 'pop', 'current'],
  'traditional-arts': ['cultural', 'folk', 'heritage', 'traditional', 'indigenous', 'ethnic'],
  'technical-production': ['production', 'technical', 'multimedia', 'audio', 'visual', 'stage'],
  'multimedia': ['digital', 'media', 'audio', 'visual', 'production', 'technical'],
  'band': ['music', 'instrument', 'orchestra', 'ensemble', 'group', 'performance'],
  'instruments': ['musical', 'orchestra', 'band', 'music', 'performance'],
  'drama': ['theatre', 'acting', 'performance', 'stage', 'dramatic'],
  'cultural-arts': ['traditional', 'heritage', 'folk', 'cultural-arts', 'indigenous'],
  'choir': ['vocal', 'singing', 'voice', 'music', 'ensemble'],
  'creative': ['art', 'design', 'visual', 'artistic', 'creative-arts'],
  'digital-art': ['multimedia', 'technical', 'digital-art', 'visual', 'technology'],
  'performing': ['performance', 'stage', 'live', 'show', 'act']
};

const DEFAULT_EVENT_TAGS = ['performance', 'music', 'cultural', 'visual-arts', 'dance'];

// --- add helper to normalize media URLs for feed items (handles absolute and relative paths) ---
const normalizeMediaPath = (p) => {
  if (!p) return null;
  if (typeof p !== 'string') return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  if (p.startsWith('/')) return `${base}${p}`;
  return `${base}/uploads/${p.split(/[\\/]/).pop()}`;
};

const distributeContent = (events, posts) => {
  const result = [];
  const usedIds = new Set();
  let eventIndex = 0;
  let postIndex = 0;
  let postsUntilNextEvent = Math.floor(Math.random() * 2) + 2;

  const addItem = (item) => {
    const itemId = `${item.type}-${item._id}`;
    if (!usedIds.has(itemId)) {
      result.push(item);
      usedIds.add(itemId);
      return true;
    }
    return false;
  };

  while (postIndex < posts.length && postsUntilNextEvent > 0) {
    if (addItem(posts[postIndex])) {
      postsUntilNextEvent--;
    }
    postIndex++;
  }

  while (postIndex < posts.length || eventIndex < events.length) {
    if (eventIndex < events.length && postsUntilNextEvent <= 0) {
      if (addItem(events[eventIndex])) {
        postsUntilNextEvent = Math.floor(Math.random() * 2) + 2;
      }
      eventIndex++;
      continue;
    }

    if (postIndex < posts.length) {
      if (addItem(posts[postIndex])) {
        postsUntilNextEvent--;
      }
      postIndex++;
    } else if (eventIndex < events.length) {
      addItem(events[eventIndex]);
      eventIndex++;
    }
  }

  return result;
};

const filterContent = (content, userPreferences) => {
  const { 
    interests: rawInterests = [], 
    organizations = [], 
    contentPreferences = {} 
  } = userPreferences || {};

  const interests = Array.isArray(rawInterests) ? rawInterests : [];

  return content.map(item => {
    let score = 0.5;
    const itemTags = (item.tags || []).map(tag => tag.toLowerCase());

    const directMatches = interests.filter(interest => 
      itemTags.includes(interest.toLowerCase())
    );

    const relatedMatches = interests.filter(interest => {
      if (!interest) return false;
      const mappings = INTEREST_MAPPINGS[interest] || [];
      return itemTags.some(tag =>
        mappings.some(mapping => tag.includes(mapping.toLowerCase()))
      );
    });

    if (directMatches.length > 0) {
      score += 0.4 * (directMatches.length / interests.length);
    }

    if (relatedMatches.length > 0) {
      score += 0.2 * (relatedMatches.length / interests.length);
    }

    if (interests.length === 0 && itemTags.some(tag => 
      DEFAULT_EVENT_TAGS.includes(tag.toLowerCase())
    )) {
      score += 0.1;
    }

    if (item.organization && organizations.includes(item.organization)) {
      score += 0.15;
    }

    if (contentPreferences) {
      if (Array.isArray(contentPreferences.likedContent) && 
          contentPreferences.likedContent.includes(item._id)) {
        score *= 1.2;
      }
      if (Array.isArray(contentPreferences.savedContent) && 
          contentPreferences.savedContent.includes(item._id)) {
        score *= 1.15;
      }
      if (Array.isArray(contentPreferences.sharedContent) && 
          contentPreferences.sharedContent.includes(item._id)) {
        score *= 1.25;
      }
    }

    if (item.type === 'event') {
      // Event scoring logged (debug can be enabled if needed)
    }

    return {
      ...item,
      score: Math.min(score, 1),
      matchingInterests: [...new Set([...directMatches, ...relatedMatches])],
      directMatchCount: directMatches.length,
      relatedMatchCount: relatedMatches.length
    };
  }).sort((a, b) => {
    if (a.directMatchCount !== b.directMatchCount) {
      return b.directMatchCount - a.directMatchCount;
    }
    return b.score - a.score;
  });
};

const LoadingSpinner = () => (
  <div className="loading-spinner" role="alert" aria-busy="true">
    <div className="spinner"></div>
    <span className="sr-only">Loading content...</span>
  </div>
);

// === OPTIMIZATION: Debug logging disabled by default ===
const DEBUG = false;
const debugLog = (...args) => DEBUG && console.log(...args);
const debugError = (...args) => DEBUG && console.error(...args);

const Home = () => {
  const { currentUser, isAdmin } = useAuth();
  const { events, getUpcomingEvents, markEventInterest } = useEvents();
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requiresInterests, setRequiresInterests] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('my-feed'); // NEW: tab state
  const navigate = useNavigate();
  const fetchRequestRef = useRef({});
  const renderCount = useRef(0);
  const lastLoadMoreTimeRef = useRef(0);  // Track last time we requested more

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.5,
    triggerOnce: false,
    delay: 500  // Delay before triggering to avoid rapid successive calls
  });

  const handleAddSharedPost = useCallback((sharedPost) => {
    setFeedItems(prev => [sharedPost, ...prev]);
  }, []);

  const fetchCombinedFeed = useCallback(async () => {
    if (!currentUser?._id) return;

    debugLog(`[Home] fetchCombinedFeed: activeTab=${activeTab}, page=${page}`);

    const requestKey = `${currentUser._id}-${page}-${activeTab}`;
    if (fetchRequestRef.current[requestKey]) {
      debugLog(`[Home] Request already in flight for: ${requestKey}`);
      return fetchRequestRef.current[requestKey];
    }

    try {
      setLoading(true);
      setError(null);

      const promise = new Promise(async (resolve, reject) => {
        if (!process.env.REACT_APP_API_URL) {
          debugError('[Home] API URL not configured');
          reject(new Error('API URL not configured'));
          return;
        }

        // Build query params
        const params = new URLSearchParams({
          page: page.toString(),
          feedType: activeTab
        });
        debugLog(`[Home] Built params: ${params.toString()}`);

        const url = `${process.env.REACT_APP_API_URL}/api/posts/feed?${params}`;
        debugLog(`[Home] Fetching: ${url}`);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        debugLog(`[Home] Response status: ${response.status}`);

        if (!response.ok) {
          const errorData = await response.text();
          debugError(`[Home] Server error: ${response.status} - ${errorData.substring(0, 200)}`);
          reject(new Error(`Server error: ${response.status} - ${errorData}`));
          return;
        }

        const postsData = await response.json();
        debugLog(`[Home] Parsed response: ${postsData.items?.length} items, totalCount=${postsData.pagination?.totalCount}`);
        
        // Indicate to UI when backend thinks this is a cold-start user (my-feed only)
        if (activeTab === 'my-feed') {
          setRequiresInterests(Boolean(postsData.requiresInterests));
          if (postsData.requiresInterests) {
            console.debug('Cold-start feed served — prompting user to set interests while showing fallback content.');
          }
        }

        if (!postsData.items || !Array.isArray(postsData.items)) {
          debugError('[Home] Invalid response format:', { hasItems: !!postsData.items, isArray: Array.isArray(postsData.items) });
          reject(new Error('Invalid response format from server'));
          return;
        }

        debugLog(`[Home] Valid response with ${postsData.items.length} items for ${activeTab}`);

        // For non-my-feed tabs, items are pure posts, so just format them
        let combinedItems = postsData.items;
        
        if (activeTab === 'my-feed') {
          // My Feed can include events, so may need additional processing
          const upcomingEvents = getUpcomingEvents();
          const relevantEvents = upcomingEvents.filter(event => {
            const userInterests = Array.isArray(currentUser.interests) ? currentUser.interests : [];
            const userOrgs = currentUser.organizations || [];
            const eventTags = (event.tags || []).map(tag => tag.toLowerCase());

            if (userInterests.length === 0) {
              return eventTags.some(tag => DEFAULT_EVENT_TAGS.includes(tag.toLowerCase()));
            }

            const hasMatchingInterest = eventTags.some(tag =>
              userInterests.some(interest => {
                const mappings = INTEREST_MAPPINGS[interest] || [];
                return mappings.some(mapping => tag.includes(mapping.toLowerCase()));
              })
            );

            const isFromUserOrg = Boolean(event.organization && userOrgs.includes(event.organization));
            const contentText = `${event.title} ${event.description || ''}`.toLowerCase();
            const hasMatchingContent = userInterests.some(interest => {
              const mappings = INTEREST_MAPPINGS[interest] || [];
              return mappings.some(mapping => contentText.includes(mapping.toLowerCase()));
            });

            return hasMatchingInterest || hasMatchingContent || isFromUserOrg;
          });

          const processedEvents = relevantEvents
            .filter(event => {
              const eventDate = new Date(event.date);
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              eventDate.setHours(0, 0, 0, 0);
              return !isNaN(eventDate.getTime()) && (eventDate >= now || event.status === 'ongoing');
            })
            .map(event => ({
              ...event,
              type: 'event',
              isUpcoming: true
            }));
          
          const processedPosts = postsData.items
            .filter(post => Boolean(post))
            .map(post => {
              const safeUser = post.user || {};
              if (!safeUser._id && post.userId) safeUser._id = post.userId;
              if (!safeUser.name || typeof safeUser.name !== 'string' || safeUser.name.trim() === '') {
                safeUser.name = 'User';
              }
              return { ...post, user: safeUser };
            });

          const backendHasEvents = Array.isArray(postsData.items) && postsData.items.some(i => i && i.type === 'event');
          
          if (backendHasEvents) {
            const normalizedBackendItems = postsData.items.map(it => ({
              ...it,
              type: it.type || (it.date || it.status ? 'event' : 'post')
            }));

            const existingEventIds = new Set(normalizedBackendItems.filter(i => i.type === 'event').map(e => String(e._id)));
            const extraEvents = processedEvents.filter(e => !existingEventIds.has(String(e._id)));

            combinedItems = [...normalizedBackendItems, ...extraEvents];
          } else {
            combinedItems = distributeContent(
              filterContent(processedEvents, {
                interests: currentUser.interests || [],
                organizations: currentUser.organizations || [],
                contentPreferences: currentUser.contentPreferences || {}
              }),
              filterContent(processedPosts, {
                interests: currentUser.interests || [],
                organizations: currentUser.organizations || [],
                contentPreferences: currentUser.contentPreferences || {}
              })
            );
          }
        } else {
          // Friends/Following tabs: just format posts
          debugLog(`[Home] Formatting ${postsData.items.length} posts for ${activeTab} tab`);
          combinedItems = postsData.items
            .filter(post => Boolean(post))
            .map(post => {
              const safeUser = post.user || {};
              if (!safeUser._id && post.userId) safeUser._id = post.userId;
              if (!safeUser.name || typeof safeUser.name !== 'string' || safeUser.name.trim() === '') {
                safeUser.name = 'User';
              }
              return { ...post, user: safeUser };
            });
          debugLog(`[Home] Formatted ${combinedItems.length} items`);
        }

        debugLog(`[Home] Resolving promise with ${combinedItems.length} items`);
        resolve({ 
          combinedItems, 
          hasMore: postsData.pagination?.hasMore || postsData.hasMore 
        });
      });

      fetchRequestRef.current[requestKey] = promise;
      const result = await promise;
      delete fetchRequestRef.current[requestKey];

      debugLog(`[Home] Promise resolved with ${result.combinedItems.length} items`);

      // On initial load (page 1), replace entire feed
      if (page === 1) {
        debugLog('[Home] Initial load - setting feed');
        setFeedItems(result.combinedItems);
        setIsInitialLoad(false);
      } else {
        // On pagination, only append to bottom
        debugLog('[Home] Pagination - appending to feed');
        setFeedItems(prev => [...prev, ...result.combinedItems]);
      }
      
      setHasMore(result.hasMore);
      debugLog('[Home] Feed state updated');
    } catch (err) {
      debugError('[Home] Fetch error:', err.message, err);
      setError(err.message);
      if (page === 1) setFeedItems([]);
    } finally {
      debugLog('[Home] Clearing loading');
      setLoading(false);
    }
  }, [currentUser?._id, page, getUpcomingEvents, activeTab]);
  
  // Only fetch on explicit triggers: page change or filter reset
  useEffect(() => {
    if (!currentUser?._id) return;
    if (page === 1 && isInitialLoad) {
      // Initial load on mount or tab change
      debugLog('[Home] useEffect triggered - calling fetchCombinedFeed for tab:', activeTab);
      fetchCombinedFeed();
    }
  }, [currentUser?._id, activeTab, page, isInitialLoad, fetchCombinedFeed]);

  // Fetch when page changes (infinite scroll)
  useEffect(() => {
    if (!currentUser?._id || page === 1 || isInitialLoad) return;
    // Page changed due to scroll, fetch more
    fetchCombinedFeed();
  }, [page, currentUser?._id, isInitialLoad, fetchCombinedFeed]);

  // NEW: Handle tab changes
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    setPage(1);
    setFeedItems([]);
    setHasMore(true);
    setError(null);
    setIsInitialLoad(true);
    setNewPostsCount(0);
  }, []);

  const handlePostUpdate = useCallback(updatedItem => {
    setFeedItems(prev => prev.map(item => (item._id === updatedItem._id ? updatedItem : item)));
  }, []);

  const handleDeletePost = useCallback((postId) => {
    setFeedItems(prev => prev.filter(item => item.type === 'event' || String(item._id) !== String(postId)));
  }, []);

  const handleEventInteraction = useCallback(
    async (event, action) => {
      try {
        if (action === 'join') {
          await markEventInterest(event._id);
          // Refresh feed after joining event
          setPage(1);
          setIsInitialLoad(true);
        }
      } catch (error) {
        console.error('Event interaction failed:', error);
      }
    },
    [markEventInterest]
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const now = Date.now();
      // Prevent rapid successive requests (minimum 1 second between requests)
      if (now - lastLoadMoreTimeRef.current > 1000) {
        lastLoadMoreTimeRef.current = now;
        setPage(prev => prev + 1);
      }
    }
  }, [loading, hasMore]);

  useEffect(() => {
    if (inView && !loading && hasMore) {
      loadMore();
    }
  }, [inView, loading, hasMore, loadMore]);

  // Calculate event IDs for participant tracking
  const eventIds = useMemo(() => {
    return feedItems
      .filter(item => item.type === 'event')
      .map(event => event._id)
      .filter(Boolean);
  }, [feedItems]);

  // Fetch participant counts for all events in feed
  const counts = useEventCounts(eventIds);

  // --- Render Posts for all posts (including shared) ---
  const memoizedFeedItems = useMemo(() => {
    // Backend handles sorting/filtering now, just render items as-is
    return feedItems.map(item => (
      <div key={`${item.type}-${item._id}`} className="feed-item">
        {item.type === 'event' ? (
          <EventCard
            event={item}
            isAdmin={isAdmin}
            isHomePage={true}
            currentUserInterests={currentUser?.interests}
            matchingInterests={item.matchingInterests}
            contentPreferences={currentUser?.contentPreferences}
            onJoin={() => handleEventInteraction(item, 'join')}
            participantData={counts[item._id] ?? { count: 0, maxParticipants: item.maxParticipants ?? null }}
          />
        ) : (
          // Wrap post in a stable container with fixed shape to prevent re-renders
          <Posts 
            key={`post-${item._id}`}
            userPosts={[{
              _id: item._id,
              title: item.title,
              desc: item.desc,
              img: item.img,
              media: item.media,
              mediaArray: item.mediaArray,
              mediaType: item.mediaType,
              likes: item.likes,
              comments: item.comments,
              shares: item.shares,
              userId: item.userId || item.user?._id,
              user: {
                _id: item.userId || item.user?._id,
                profilePic: item.profilePic,
                sex: item.userSex || item.user?.sex || 'male',
                name: item.name || item.user?.name
              },
              createdAt: item.createdAt,
              sharedPost: item.sharedPost,
              shared: item.shared
            }]} 
            onPostUpdate={handlePostUpdate}
            onAddSharedPost={handleAddSharedPost}
            onDeletePost={handleDeletePost}
          />
        )}
      </div>
    ));
  }, [feedItems, counts, isAdmin, currentUser?.interests, handleEventInteraction, handlePostUpdate, handleAddSharedPost, handleDeletePost]);

  return (
    <div className="home">
      <div className="home-container">
        <div className="left">
          <FeaturedTitle />
          <FeaturedArtists />
          <Share />

          {requiresInterests && (
            <div className="cold-start-banner" role="region" aria-live="polite">
              <p>
                See more relevant events and posts by updating your interests.
              </p>
              <button 
                onClick={() => navigate('/settings')} 
                className="update-interests-btn"
                aria-label="Update your interests"
              >
                Update Interests
              </button>
            </div>
          )}

          {/* TAB NAVIGATION */}
          <div className="feed-tabs-container">
            <div className="feed-tabs" role="tablist">
              <button 
                role="tab"
                className={`tab-button ${activeTab === 'my-feed' ? 'active' : ''}`}
                onClick={() => handleTabChange('my-feed')}
                aria-selected={activeTab === 'my-feed'}
                aria-controls="my-feed-panel"
              >
                My Feed
              </button>
              
              <button 
                role="tab"
                className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
                onClick={() => handleTabChange('friends')}
                aria-selected={activeTab === 'friends'}
                aria-controls="friends-panel"
              >
                Friends
              </button>
              
              <button 
                role="tab"
                className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
                onClick={() => handleTabChange('following')}
                aria-selected={activeTab === 'following'}
                aria-controls="following-panel"
              >
                Following
              </button>
            </div>
          </div>

          {/* New posts notification banner - appears when feed updates available */}
          {newPostsCount > 0 && !isInitialLoad && (
            <div className="new-posts-banner" role="region" aria-live="polite">
              <button 
                onClick={() => {
                  setPage(1);
                  setIsInitialLoad(true);
                  setNewPostsCount(0);
                  setFeedItems([]);  // Clear feed to show loading
                }}
                className="new-posts-btn"
              >
                {newPostsCount === 1 ? '1 new post' : `${newPostsCount} new posts`}
              </button>
            </div>
          )}

          <div 
            className="feed-content" 
            role="feed" 
            aria-busy={loading}
            aria-live="polite"
          >
            {loading && page === 1 ? (
              <LoadingSpinner />
            ) : error ? (
              <div className="error" role="alert">
                <p>Error: {error}</p>
                <button 
                  onClick={() => setPage(1)}
                  aria-label="Retry loading content"
                >
                  Retry
                </button>
              </div>
            ) : feedItems.length === 0 ? (
              <div 
                className="empty-feed" 
                role="status"
                aria-label="No content found"
              >
                <p>
                  {activeTab === 'my-feed' 
                    ? (currentUser?.interests?.length === 0
                        ? 'Update your interests to see more relevant events and posts!'
                        : 'No matching content found. Try following more users or different interests!')
                    : (activeTab === 'friends'
                        ? 'You haven\'t connected with anyone yet. Follow more artists to see their posts!'
                        : 'You are not following anyone yet. Follow more artists to see their posts!')}
                </p>
                {activeTab === 'my-feed' && (
                  <button 
                    onClick={() => navigate('/settings')} 
                    className="update-interests-btn"
                    aria-label="Update your interests"
                  >
                    Update Interests
                  </button>
                )}
              </div>
            ) : (
              <>
                {memoizedFeedItems}
                
                {/* PAGINATION EXHAUSTED MESSAGE */}
                {!hasMore && feedItems.length > 0 && (
                  <div className="pagination-exhausted" role="status">
                    <p>
                      {activeTab === 'my-feed' 
                        ? 'You are all caught up! Follow more artists for new updates.'
                        : 'You are all caught up! Follow more artists for new updates.'}
                    </p>
                  </div>
                )}
                
                {/* Infinite scroll trigger */}
                <div 
                  ref={loadMoreRef}
                  className="scroll-trigger"
                  aria-hidden="true"
                >
                  {/* Only show loading on initial load, not on pagination */}
                  {loading && page === 1 && hasMore && <LoadingSpinner />}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
