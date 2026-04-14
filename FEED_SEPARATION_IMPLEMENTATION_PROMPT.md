# Feed Separation Feature - Detailed Implementation Prompt

## 📋 Executive Summary

Refactor the homepage feed from a single mixed stream into three distinct, organized sections accessible via tab navigation. This separates algorithmic recommendations from social connections, improving UX clarity and reducing cognitive load.

---

## 🎯 Feature Requirements

### Tab Structure

#### **1. My Feed Tab** (Default/Primary)
- **Content Sources:** 
  - Algorithm-recommended posts (based on user interests)
  - Upcoming/ongoing events (matching user interests)
  - Fallback posts ensure tab is never empty
- **Sorting Options:**
  - "Best Match" (Hybrid - relevance + recency)
  - "Most Recent" (chronological descending)
  - "Most Relevant" (score-based)
- **Filtering:**
  - Time Range: All Time, Today, This Week, This Month
- **Key Behavior:**
  - Display sort/filter dropdowns
  - Never shows empty state (fallback content always available)
  - Infinite scroll with pagination

#### **2. Friends Tab**
- **Content Sources:** 
  - Posts from users where relationship is **mutual** (both following each other OR in friends list)
  - Chronological sorting ONLY (no complex scoring)
- **Sorting Options:**
  - "Newest First" (chronological descending - default and only option)
- **Filtering:** None (no sort/time range dropdowns)
- **Empty State Message:** 
  - ```
    "You haven't connected with anyone yet. 
     Follow more artists to see their posts!"
    ```
- **Pagination Exhausted Message:**
  - ```
    "You are all caught up! 
     Follow more artists for new updates."
    ```
- **Infinite Scroll:** Yes, pagination supported

#### **3. Following Tab**
- **Content Sources:** 
  - Posts from users you follow (one-way relationship, no reciprocal requirement)
  - Chronological sorting ONLY
- **Sorting Options:**
  - "Newest First" (chronological descending - default and only option)
- **Filtering:** None
- **Empty State Message:**
  - ```
    "You are not following anyone yet. 
     Follow more artists to see their posts!"
    ```
- **Pagination Exhausted Message:**
  - ```
    "You are all caught up! 
     Follow more artists for new updates."
    ```
- **Infinite Scroll:** Yes, pagination supported

---

## 🏗️ Current Architecture Analysis

### Frontend Data Flow (Home.jsx)
```
Home Component State:
├── feedItems (all items)
├── sortBy (hybrid|recent|relevance)
├── timeRange (all|today|week|month)
├── page (for pagination)
└── loading/error flags

fetch: fetchCombinedFeed()
├── GET /posts/feed
├── Receives: mixed posts + events
├── Processes: distributeContent() → mixed items
└── Sets: feedItems state

Render: memoizedFeedItems
├── Filter by timeRange
├── Sort by sortBy option
└── Map to EventCard or Posts component
```

### Backend Data Flow (posts.js)
```
GET /posts/feed
├── Calls: RecommendationService.getHybridFeed()
├── Returns: {
│   ├── events (filtered/scored)
│   ├── posts (recommended + friend posts mixed)
│   └── pagination data
│ }
└── Formats: media URLs, counts, etc.

RecommendationService.getHybridFeed()
├── Fetches: relevant posts
├── Fetches: relevant events
├── Calls: calculateFinalScore() for each item
├── Calls: distributeContent() to interleave posts/events
└── Returns: scored + distributed items
```

### Problem with Current Design
- ❌ Friend posts mixed with algorithmic recommendations
- ❌ Events and posts in single stream (can't distinguish)
- ❌ Single sorting/filtering logic for all content
- ❌ Unclear which content drives engagement

---

## 🛠️ Implementation Plan

### Phase 1: Backend Refactoring (recommendations.js)

#### New Methods Required

**1. `getFriendsFeed(user, options = {})`**
```javascript
/**
 * Fetch posts from mutual friends only
 * @param {Object} user - User document with following/followers arrays
 * @param {Object} options - { page, limit, sortBy }
 * @returns {Promise<Array>} Posts from friends, sorted newest-first
 */
static async getFriendsFeed(user, options = {}) {
  const { page = 1, limit = 20 } = options;
  
  // Get mutual friends: users where relationship is mutual
  // Logic: followers who are also in user.following OR in user.friends list
  
  // Fetch posts from these mutual friends
  // Sort: createdAt descending (newest first)
  // Return: formatted posts with pagination
}
```

**2. `getFollowingFeed(user, options = {})`**
```javascript
/**
 * Fetch posts from users you follow
 * @param {Object} user - User document with following array
 * @param {Object} options - { page, limit }
 * @returns {Promise<Array>} Posts from following, sorted newest-first
 */
static async getFollowingFeed(user, options = {}) {
  const { page = 1, limit = 20 } = options;
  
  // Query: posts from userId in user.following array
  // Sort: createdAt descending (newest first)
  // Return: formatted posts with pagination
}
```

**3. `getMyFeed(user, options = {})`** (Refactored from getHybridFeed)
```javascript
/**
 * Fetch My Feed: algorithm-recommended posts + events
 * NO friend posts included
 * @param {Object} user - User document
 * @param {Object} options - { page, limit, sortBy, timeRange }
 * @returns {Promise<Object>} { items, pagination, metrics }
 */
static async getMyFeed(user, options = {}) {
  const { page = 1, limit = 20, sortBy = 'hybrid', timeRange = 'all' } = options;
  
  // Current getHybridFeed() behavior BUT
  // EXCLUDE posts from user.following
  // INCLUDE events
  // Apply sorting/filtering as before
  // Return: with fallback posts to ensure never empty
}
```

#### Modifications to Existing Methods

**Update `getHybridFeed()`:**
- Rename internally or deprecate
- Remove friend post inclusion
- Use `getMyFeed()` logic instead
- Keep for backward compatibility if needed

### Phase 2: Backend Endpoint Updates (posts.js)

#### Update GET `/posts/feed` Route
```javascript
router.get("/feed", authenticate, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'hybrid',
      timeRange = 'all',
      feedType = 'my-feed' // NEW PARAM: my-feed | friends | following
    } = req.query;

    const user = await User.findById(req.user._id).populate(['following', 'followers', 'friends']);

    let result;
    
    switch(feedType) {
      case 'my-feed':
        result = await RecommendationService.getMyFeed(user, { 
          page, limit, sortBy, timeRange 
        });
        break;
      
      case 'friends':
        result = await RecommendationService.getFriendsFeed(user, { 
          page, limit 
        });
        break;
      
      case 'following':
        result = await RecommendationService.getFollowingFeed(user, { 
          page, limit 
        });
        break;
      
      default:
        return res.status(400).json({ message: "Invalid feedType" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error fetching feed:", error);
    res.status(500).json({ message: "Failed to fetch feed" });
  }
});
```

**Response Format (All Feeds):**
```javascript
{
  feedType: "my-feed" | "friends" | "following",
  items: [
    {
      type: "event" | "post",
      _id: ObjectId,
      // ... event or post data
      source: "recommendation" | "friend" | "following", // optional for debugging
      createdAt: Date
    }
  ],
  pagination: {
    page: number,
    limit: number,
    totalCount: number,
    hasMore: boolean
  }
}
```

---

### Phase 3: Frontend Refactoring (Home.jsx)

#### New State Variables
```javascript
const [activeTab, setActiveTab] = useState('my-feed'); // 'my-feed' | 'friends' | 'following'
// Keep existing: feedItems, sortBy, timeRange, page, loading, error, etc.
```

#### Unified Fetch Function
```javascript
const fetchFeed = useCallback(async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      page,
      limit: 20,
      feedType: activeTab
    });
    
    // Add sort/time filters only for my-feed tab
    if (activeTab === 'my-feed') {
      params.append('sortBy', sortBy);
      params.append('timeRange', timeRange);
    }

    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/posts/feed?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const data = await response.json();
    
    if (page === 1) {
      setFeedItems(data.items);
    } else {
      setFeedItems(prev => [...prev, ...data.items]);
    }
    
    setHasMore(data.pagination.hasMore);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}, [activeTab, page, sortBy, timeRange]); // sortBy/timeRange not used for friends/following
```

#### Tab Switch Handlers
```javascript
const handleTabChange = useCallback((newTab) => {
  setActiveTab(newTab);
  setPage(1);
  setFeedItems([]);
  setHasMore(true);
  setError(null);
}, []);

const handleSortChange = useCallback(e => {
  setSortBy(e.target.value);
  setPage(1);
  setFeedItems([]);
}, []);

const handleTimeRangeChange = useCallback(e => {
  setTimeRange(e.target.value);
  setPage(1);
  setFeedItems([]);
}, []);
```

#### Effect Hooks
```javascript
// Fetch when tab changes, page changes, or filters change
useEffect(() => {
  if (!currentUser?._id) return;
  fetchFeed();
}, [activeTab, page, currentUser?._id, sortBy, timeRange, fetchFeed]);
```

#### Render Logic Outline
```jsx
<div className="home">
  <div className="home-container">
    <div className="left">
      <FeaturedTitle />
      <FeaturedArtists />
      <Share />

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

      {/* FILTERS - ONLY FOR MY FEED TAB */}
      {activeTab === 'my-feed' && (
        <div className="feed-filters" role="region">
          <select value={sortBy} onChange={handleSortChange} aria-label="Sort feed by">
            <option value="hybrid">Best Match</option>
            <option value="recent">Most Recent</option>
            <option value="relevance">Most Relevant</option>
          </select>
          
          <select value={timeRange} onChange={handleTimeRangeChange} aria-label="Filter by time range">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      )}

      {/* FEED CONTENT */}
      <div className="feed-content" role="feed">
        {loading && page === 1 ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="error">
            <p>Error: {error}</p>
            <button onClick={() => setPage(1)}>Retry</button>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="empty-feed">
            {activeTab === 'my-feed' ? (
              <p>No matching content found. Update your interests or follow more artists!</p>
            ) : (
              <p>You haven't connected with anyone yet. Follow more artists to see their posts!</p>
            )}
            <button onClick={() => navigate('/settings')}>
              Update Interests
            </button>
          </div>
        ) : (
          <>
            {memoizedFeedItems}
            
            {/* PAGINATION EXHAUSTED MESSAGE */}
            {!hasMore && feedItems.length > 0 && (
              <div className="pagination-exhausted" role="status">
                <p>You are all caught up! Follow more artists for new updates.</p>
              </div>
            )}
            
            {/* INFINITE SCROLL TRIGGER */}
            <div ref={loadMoreRef} className="scroll-trigger" aria-hidden="true">
              {loading && page > 1 && hasMore && <LoadingSpinner />}
            </div>
          </>
        )}
      </div>
    </div>
  </div>
</div>
```

---

### Phase 4: Styling (home.scss)

#### New Classes for Tabs
```scss
.feed-tabs-container {
  background-color: themed("bg");
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 2px 8px themed("shadow");
  margin-bottom: 20px;
  
  .feed-tabs {
    display: flex;
    gap: 8px;
    align-items: center;
    
    @include mobile {
      gap: 4px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding: 0 8px;
    }
    
    .tab-button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background-color: themed("bgSoft");
      color: themed("textColorSoft");
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      
      &:hover {
        background-color: themed("border");
        color: themed("textColor");
      }
      
      &.active {
        background-color: themed("primary");
        color: white;
        font-weight: 600;
      }
      
      @include mobile {
        padding: 8px 16px;
        font-size: 13px;
      }
    }
  }
}

.pagination-exhausted {
  background-color: themed("bgSoft");
  border:1px solid themed("border");
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  margin: 20px 0;
  
  p {
    color: themed("textColorSoft");
    font-size: 15px;
    margin: 0;
    line-height: 1.5;
  }
}
```

---

## 📊 Data Structure Requirements

### User Model (Backend)
Must include:
- `following: [userId]` - Array of user IDs being followed
- `followers: [userId]` - Array of followers
- `friends: [userId]` (optional) - Mutual friends list

### Post Model (Backend)
Must include:
- `userId` - Post creator
- `createdAt` - For sorting
- `tags` - For My Feed recommendation
- `visibility` - Public/private filtering

### Response Structure (All Feeds)
```javascript
{
  feedType: "my-feed" | "friends" | "following",
  items: Array<{
    _id: ObjectId,
    type: "post" | "event",
    // ... content
    createdAt: ISO8601,
    // Additional fields based on type
  }>,
  pagination: {
    page: number,
    limit: number,
    totalCount: number,
    hasMore: boolean
  }
}
```

---

## 🧪 Testing Scenarios

1. **Tab Switching:**
   - Switch between My Feed → Friends → Following
   - Verify filters disappear for Friends/Following
   - Verify page resets to 1
   - Verify feedItems are cleared

2. **My Feed:**
   - Verify events appear
   - Verify sorting works (hybrid, recent, relevance)
   - Verify time range filter works
   - Never shows empty state

3. **Friends Tab:**
   - Verify only mutual friends' posts appear
   - Verify chronological sorting
   - Test empty state ("Follow more artists...")
   - Test pagination exhausted message

4. **Following Tab:**
   - Verify only followed users' posts appear (one-way)
   - Verify chronological sorting
   - Test empty state
   - Test pagination exhausted message

5. **Infinite Scroll:**
   - Verify page increments correctly
   - Verify items append (not replace)
   - Verify hasMore flag works
   - Test end-of-feed behavior

---

## 🎨 UI/UX Considerations

- **Active Tab Indication:** Clear visual state (color, underline, or fill)
- **Tab Accessibility:** ARIA labels, keyboard navigation, semantic HTML
- **Mobile Responsiveness:** Tabs may scroll horizontally on small screens
- **Empty States:** Distinct messages guide users to follow artists
- **Pagination Message:** Position at end of feed, encourage engagement
- **Filter Visibility:** Only show for My Feed tab

---

## 📝 File Modifications Summary

| File | Changes | Priority |
|------|---------|----------|
| `backend/services/recommendations.js` | Add `getFriendsFeed()`, `getFollowingFeed()`, `getMyFeed()` | HIGH |
| `backend/routes/posts.js` | Update `/feed` GET endpoint with feedType param handler | HIGH |
| `src/pages/home/Home.jsx` | Add `activeTab` state, new fetch logic, tab buttons, conditional filters | HIGH |
| `src/pages/home/home.scss` | Add `.feed-tabs-container`, `.tab-button`, `.pagination-exhausted` styles | HIGH |
| User Model (verify) | Confirm `following`, `followers` arrays exist | MEDIUM |

---

## ✅ Acceptance Criteria

- [ ] Three tabs render correctly with active state styling
- [ ] My Feed tab shows sort/filter dropdowns; Friends/Following do not
- [ ] My Feed never empty (fallback posts present)
- [ ] Friends tab shows only mutual friends' posts, sorted newest-first
- [ ] Following tab shows only followed users' posts, sorted newest-first
- [ ] Tab switch clears feedItems and resets page
- [ ] Pagination works for all tabs
- [ ] End-of-feed message displays when hasMore is false
- [ ] Empty state shows correct message per tab
- [ ] Responsive design on mobile (tabs may scroll)
- [ ] Accessibility: ARIA labels, keyboard navigation

---

## 🚀 Rollout Notes

- Consider A/B testing tab layout vs. old filter dropdowns
- Monitor engagement: Which tab gets most traffic?
- Track "Follow more artists" click-through rate
- Gather user feedback on separation vs. mixed feed

