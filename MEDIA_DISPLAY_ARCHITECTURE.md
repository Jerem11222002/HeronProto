# Multiple Media Display Architecture

## Frontend Display Integration

### Current Post Component Structure
The Post component in `src/components/post/Post.jsx` uses a carousel preview system that needs to be updated to display all media from `mediaArray`.

### Display Strategy for Multiple Media

#### Option 1: Carousel/Slider (Recommended)
Show one media item at a time with navigation arrows:
```jsx
// Display logic for multiple media
const mediaToDisplay = post.mediaArray && post.mediaArray.length > 0 
  ? post.mediaArray 
  : (post.media ? [{ url: post.media, type: post.mediaType }] : []);

const renderMedia = () => {
  if (mediaToDisplay.length === 0) return null;
  
  const current = mediaToDisplay[currentIndex];
  
  return (
    <div className="media-carousel">
      {current.type === 'video' ? (
        <video controls src={current.url} />
      ) : (
        <img src={current.url} alt="Post media" />
      )}
      
      {mediaToDisplay.length > 1 && (
        <div className="carousel-nav">
          <button onClick={() => setCurrentIndex((i) => (i - 1 + mediaToDisplay.length) % mediaToDisplay.length)}>
            ←
          </button>
          <span>{currentIndex + 1} / {mediaToDisplay.length}</span>
          <button onClick={() => setCurrentIndex((i) => (i + 1) % mediaToDisplay.length)}>
            →
          </button>
        </div>
      )}
    </div>
  );
};
```

#### Option 2: Grid/Gallery
Show all media in a grid layout:
```jsx
const renderMediaGrid = () => {
  if (mediaToDisplay.length === 0) return null;
  
  return (
    <div className="media-grid">
      {mediaToDisplay.map((media, index) => (
        <div key={index} className="media-item">
          {media.type === 'video' ? (
            <video src={media.url} />
          ) : (
            <img src={media.url} alt={`Media ${index + 1}`} />
          )}
        </div>
      ))}
    </div>
  );
};
```

#### Option 3: Thumbnail Strip + Main Display
Show thumbnails below a larger main display:
```jsx
const renderMediaWithThumbnails = () => {
  if (mediaToDisplay.length === 0) return null;
  
  const current = mediaToDisplay[currentIndex];
  
  return (
    <div className="media-with-thumbnails">
      <div className="main-media">
        {current.type === 'video' ? (
          <video controls src={current.url} />
        ) : (
          <img src={current.url} alt="Post media" />
        )}
      </div>
      
      {mediaToDisplay.length > 1 && (
        <div className="thumbnail-strip">
          {mediaToDisplay.map((media, index) => (
            <div 
              key={index} 
              className={`thumbnail ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            >
              {media.type === 'video' ? (
                <video src={media.url} />
              ) : (
                <img src={media.url} alt={`Thumbnail ${index + 1}`} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Backend Data Structure

### Single Media (Backward Compatible)
```javascript
{
  media: "/uploads/image.jpg",
  mediaType: "image",
  mediaArray: [{ url: "/uploads/image.jpg", type: "image", size: 12345 }],
  mediaCount: 1
}
```

### Multiple Media (New Feature)
```javascript
{
  media: "/uploads/first-image.jpg",  // First file (for backward compatibility)
  mediaType: "image",  // Type of first file
  mediaArray: [
    { url: "/uploads/first-image.jpg", type: "image", size: 12345 },
    { url: "/uploads/second-image.jpg", type: "image", size: 54321 },
    { url: "/uploads/video.mp4", type: "video", size: 999999 }
  ],
  mediaCount: 3
}
```

## Migration Guide for Display Components

### Posts Component (src/components/posts/Posts.jsx)
Update to pass `mediaArray` to Post component:
```javascript
// Already done in current implementation
// Just needs to ensure mediaArray is passed through
<Post 
  post={{...postData, mediaArray: postData.mediaArray}}
  // ... other props
/>
```

### Post Component (src/components/post/Post.jsx)
Key updates needed:
1. Add state for current media index: `const [currentIndex, setCurrentIndex] = useState(0);`
2. Check for `mediaArray` first, fall back to single `media`
3. Update rendering logic to handle multiple media
4. Add navigation controls for carousel

### Post Display/Preview Areas
Update any place showing `post.img` or `post.media` to check `mediaArray`:

**Current Code**:
```jsx
<img src={post.media || post.img} alt="Post" />
```

**Updated Code**:
```jsx
const mediaToDisplay = post.mediaArray?.length > 0 
  ? post.mediaArray[0].url 
  : (post.media || post.img);

<img src={mediaToDisplay} alt="Post" />
```

## Video Handling in Carousel

### Video Display
```jsx
{current.type === 'video' ? (
  <video 
    controls 
    src={current.url}
    style={{ width: '100%', maxHeight: '500px' }}
  />
) : (
  <img 
    src={current.url} 
    alt="Post media"
    style={{ width: '100%', maxHeight: '500px' }}
  />
)}
```

### Video Thumbnail Generation
For grid/thumbnail views, use a still frame or custom thumbnail:
```jsx
{media.type === 'video' && (
  <div className="video-badge">
    <i className="play-icon"></i>
    {media.duration && `${Math.round(media.duration)}s`}
  </div>
)}
```

## Styling Considerations

### CSS Variables for Media Display
```scss
$media-max-width: 100%;
$media-max-height: 500px;
$carousel-nav-height: 40px;
$thumbnail-size: 80px;

.media-carousel {
  position: relative;
  width: 100%;
  background: #f0f0f0;
  border-radius: 8px;
  overflow: hidden;

  img, video {
    width: $media-max-width;
    max-height: $media-max-height;
    object-fit: cover;
    display: block;
  }

  .carousel-nav {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: $carousel-nav-height;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: white;

    button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 8px 12px;
      cursor: pointer;
      border-radius: 4px;

      &:hover {
        background: rgba(255, 255, 255, 0.4);
      }
    }
  }
}
```

## FullScreenPostPage Updates

The FullScreenPostPage component (`src/components/post/FullScreenPostPage.jsx`) should also be updated:

```jsx
const mediaArray = post.mediaArray && post.mediaArray.length > 0 
  ? post.mediaArray 
  : (post.media ? [{ url: post.media, type: post.mediaType }] : []);

// Add currentIndex state and navigation logic
const [currentIndex, setCurrentIndex] = useState(0);

// Update the media rendering in the fullscreen view
// to show carousel with all media items
```

## Performance Optimization

### Lazy Loading Thumbnails
```jsx
const ThumbnailPreview = ({ media, index, active, onClick }) => {
  return (
    <div 
      className={`thumbnail ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <img 
        src={media.url} 
        alt={`Thumbnail ${index}`}
        loading="lazy"
      />
    </div>
  );
};
```

### Image Optimization
- Use responsive images with `srcSet` for different screen sizes
- Compress videos before upload (handled by frontend validation)
- Consider WebP format for newer browsers (optional enhancement)

## Testing the Display

### Test Cases
1. Single image post
   - Should show image with no carousel controls
   
2. Multiple images post (3+ images)
   - Should show first image by default
   - Arrows should navigate between images
   - Counter should show "1 / 3", "2 / 3", etc.

3. Mixed media post (images + videos)
   - Should display correctly based on type
   - Videos should show play controls
   - All types should navigate properly

4. Mobile responsive
   - Media should fit screen width
   - Controls should be accessible
   - Thumbnails should not overflow

## Future Enhancements

1. **Auto-play carousel**: Auto-advance after X seconds on image-only posts
2. **Swipe support**: Mobile swipe gestures for navigation
3. **Lightbox/Modal**: Full-screen preview on click
4. **Lazy loading**: Load media only when visible in feed
5. **Video compression**: Auto-compress before upload on frontend
6. **Image effects**: Filters, zoom, pan on images
7. **Download button**: For individual media items

## Backward Compatibility Verification

All existing posts with single media still work because:
- `post.media` contains the URL (primary field)
- `post.mediaType` contains the type
- `post.mediaArray` will have 1 item (from migration or backend default)
- Frontend can check either field safely

This allows gradual rollout without breaking existing functionality.
