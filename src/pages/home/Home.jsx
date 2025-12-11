import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useEvents } from "../../context/EventsContext";
import FeaturedArtists from "../../components/featuredArtists/featured";
import FeaturedTitle from "../../components/featuredArtists/FeaturedTitle";
import Posts from "../../components/posts/Posts";
import Share from "../../components/share/Share";
import EventCard from "../../components/evenCard/EventCard";
// import SharedPost from "../../components/sharedposts/SharedPost"; // <-- Remove this import
import { useAuth } from "../../context/authContext";
import { debounce } from "../../utils/debounce";
import { useInView } from 'react-intersection-observer';
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
  const base = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5000';
  if (p.startsWith('/')) return `${base}${p}`;
  return `${base}/uploads/${p.split(/[\/\\]/).pop()}`;
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
      console.log('Event scoring:', {
        title: item.title,
        tags: itemTags,
        directMatches,
        relatedMatches,
        score: Math.min(score, 1),
        interests
      });
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

const Home = () => {
  const { currentUser, isAdmin } = useAuth();
  const { events, getUpcomingEvents, markEventInterest } = useEvents();
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requiresInterests, setRequiresInterests] = useState(false);
  const [sortBy, setSortBy] = useState('hybrid');
  const [timeRange, setTimeRange] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  const fetchRequestRef = useRef({});
  const renderCount = useRef(0);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.5,
    triggerOnce: false
  });

  const handleAddSharedPost = useCallback((sharedPost) => {
    setFeedItems(prev => [sharedPost, ...prev]);
  }, []);

  const fetchCombinedFeed = useCallback(async () => {
    if (!currentUser?._id) return;

    const requestKey = `${currentUser._id}-${page}-${sortBy}-${timeRange}`;
    if (fetchRequestRef.current[requestKey]) {
      return fetchRequestRef.current[requestKey];
    }

    try {
      setLoading(true);
      setError(null);

      const promise = new Promise(async (resolve, reject) => {
        if (!process.env.REACT_APP_API_URL) {
          reject(new Error('API URL not configured'));
          return;
        }

        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/posts/feed?${new URLSearchParams({
            userId: currentUser._id,
            sortBy,
            timeRange,
            page: page.toString()
          })}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          }
        );

        if (!response.ok) {
          const errorData = await response.text();
          reject(new Error(`Server error: ${response.status} - ${errorData}`));
          return;
        }

        const postsData = await response.json();
        // Indicate to UI when backend thinks this is a cold-start user
        setRequiresInterests(Boolean(postsData.requiresInterests));
        if (postsData.requiresInterests) {
          // keep content shown, but optionally log/debug
          console.debug('Cold-start feed served — prompting user to set interests while showing fallback content.');
        }

        if (!postsData.items || !Array.isArray(postsData.items)) {
          reject(new Error('Invalid response format from server'));
          return;
        }

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
            // ensure a user object exists for legacy posts
            const safeUser = post.user || {};
            if (!safeUser._id && post.userId) safeUser._id = post.userId;
            if (!safeUser.name || typeof safeUser.name !== 'string' || safeUser.name.trim() === '') {
              safeUser.name = 'User';
            }
            return { ...post, user: safeUser };
          });

        // If backend already included events in postsData.items, respect backend distribution.
        const backendHasEvents = Array.isArray(postsData.items) && postsData.items.some(i => i && i.type === 'event');
        
        let combinedItems;
        if (backendHasEvents) {
          // Ensure each item has a type (backend should supply this) and normalize minimal shapes
          const normalizedBackendItems = postsData.items.map(it => ({
            ...it,
            type: it.type || (it.date || it.status ? 'event' : 'post')
          }));

          // Avoid duplicating events: only append client-side upcoming events that aren't already present
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

        resolve({ combinedItems, hasMore: postsData.hasMore });
      });

      fetchRequestRef.current[requestKey] = promise;
      const result = await promise;
      delete fetchRequestRef.current[requestKey];

      setFeedItems(prev => (page === 1 ? result.combinedItems : [...prev, ...result.combinedItems]));
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err.message);
      if (page === 1) setFeedItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?._id, sortBy, timeRange, page, getUpcomingEvents]);
  
  const debouncedFetch = useMemo(() => debounce(fetchCombinedFeed, 500), [fetchCombinedFeed]);

  useEffect(() => {
    let isSubscribed = true;

    const fetchData = async () => {
      if (!currentUser?._id || !isSubscribed) return;

      try {
        await debouncedFetch();
      } catch (error) {
        console.error('Fetch error:', error);
      }
    };

    fetchData();

    return () => {
      isSubscribed = false;
      debouncedFetch.cancel?.();
    };
  }, [debouncedFetch, currentUser?._id]);

  const handlePostUpdate = useCallback(updatedItem => {
    setFeedItems(prev => prev.map(item => (item._id === updatedItem._id ? updatedItem : item)));
  }, []);

  const handleEventInteraction = useCallback(
    async (event, action) => {
      try {
        if (action === 'join') {
          await markEventInterest(event._id);
          debouncedFetch();
        }
      } catch (error) {
        console.error('Event interaction failed:', error);
      }
    },
    [markEventInterest, debouncedFetch]
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  useEffect(() => {
    if (inView && !loading && hasMore) {
      loadMore();
    }
  }, [inView, loading, hasMore, loadMore]);

  const handleSortChange = useCallback(e => {
    setSortBy(e.target.value);
    setPage(1);
  }, []);

  const handleTimeRangeChange = useCallback(e => {
    setTimeRange(e.target.value);
    setPage(1);
  }, []);

  // --- UPDATED: Always render Posts for all posts (including shared) ---
  const memoizedFeedItems = useMemo(
    () =>
      feedItems.map(item => (
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
            />
          ) : (
            <Posts 
              userPosts={[{
                ...item,
                user: item.user || {
                  _id: item.userId,
                  profilePic: item.profilePic,
                  sex: item.userSex || 'male',
                  name: item.name
                }
              }]} 
              onPostUpdate={handlePostUpdate}
              onAddSharedPost={handleAddSharedPost}
            />
          )}
        </div>
      )),
    [feedItems, isAdmin, currentUser?.interests, handleEventInteraction, handlePostUpdate, handleAddSharedPost]
  );

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

          <div className="feed-filters" role="region" aria-label="Feed filters">
            <select 
              value={sortBy} 
              onChange={handleSortChange} 
              className="filter-select"
              aria-label="Sort feed by"
            >
              <option value="hybrid">Best Match</option>
              <option value="recent">Most Recent</option>
              <option value="relevance">Most Relevant</option>
            </select>

            <select 
              value={timeRange} 
              onChange={handleTimeRangeChange} 
              className="filter-select"
              aria-label="Filter by time range"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

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
                  {currentUser?.interests?.length === 0
                    ? 'Update your interests to see more relevant events and posts!'
                    : 'No matching content found. Try following more users or different interests!'}
                </p>
                <button 
                  onClick={() => navigate('/settings')} 
                  className="update-interests-btn"
                  aria-label="Update your interests"
                >
                  Update Interests
                </button>
              </div>
            ) : (
              <>
                {memoizedFeedItems}
                
                {/* Infinite scroll trigger */}
                <div 
                  ref={loadMoreRef}
                  className="scroll-trigger"
                  aria-hidden="true"
                >
                  {loading && hasMore && <LoadingSpinner />}
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
