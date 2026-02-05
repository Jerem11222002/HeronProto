# Multi-Media Gallery - Quick Reference Card

## Layout Selection Logic

```javascript
mediaArray.length → Layout
0         → (hidden)
1         → renderSingleMedia()      [Full width]
2         → renderTwoMediaLayout()   [50% - 50%]
3         → renderThreeMediaLayout() [60% - 40%]
4         → renderFourMediaLayout()  [2x2 grid]
5+        → renderMediaGrid()        [3 columns]
```

## Layout Specifications

| Layout | Columns | Min Height | Aspect | Gap | Use Case |
|--------|---------|-----------|--------|-----|----------|
| Single | 1 | N/A | As-is | N/A | Single photo |
| Two | 2 equal | 350px | 1:1 | 2px | Before/after |
| Three | 1 large (60%) + 2 (40%) | 380px | 1.4:1 + 1:1 | 2px | Portfolio |
| Four | 2x2 | 380px | 1:1 | 2px | Gallery |
| Grid | 3 | Variable | 1:1 | 2px | Collections |

## Component State

```javascript
// State variables in Post component
const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
const [showMediaCarousel, setShowMediaCarousel] = useState(false);
```

## Key Functions

### Main Entry Point
```javascript
renderMedia() 
  ↓ Determines layout based on mediaArray.length
```

### Layout Renderers
```javascript
renderSingleMedia(media)
renderTwoMediaLayout(mediaArray)
renderThreeMediaLayout(mediaArray)
renderFourMediaLayout(mediaArray)
renderMediaGrid(mediaArray)
```

### Helper
```javascript
renderMediaItem(media)        // Individual item
renderMediaCarousel()         // Modal carousel
```

## Carousel Features

| Feature | Shortcut | Trigger |
|---------|----------|---------|
| Next Item | `→` Arrow | Click right arrow / arrow key |
| Previous Item | `←` Arrow | Click left arrow / arrow key |
| Jump to Item | Click | Thumbnail click |
| Close | `ESC` | ESC key or close button |
| Scroll Thumbnails | Scroll | Mouse wheel / touch scroll |

## Responsive Breakpoints

```
Desktop (1200px+)          Tablet (768-1199px)      Mobile (480-767px)      Ultra-Small (<480px)
├─ Full features          ├─ Adjusted spacing      ├─ Vertical layout       ├─ Compact
├─ All layouts            ├─ Some shrinking        ├─ Stacked items         ├─ Minimal
├─ Large tooltips         ├─ Touch-friendly        ├─ Full-width            └─ Essential only
└─ Hover effects          └─ Medium gaps           └─ Mobile optimized
```

## CSS Classes

### Main Container
- `.media-grid-layout` - Main container
- `.media-grid-layout.single-media` - Single
- `.media-grid-layout.two-media` - Two columns
- `.media-grid-layout.three-media` - Asymmetric
- `.media-grid-layout.four-media` - 2x2 grid
- `.media-grid-layout.grid` - 3+ columns

### Items
- `.media-item` - Individual item
- `.media-item-content` - Content wrapper
- `.media-item-content.video` - Video variant
- `.media-item-content.image` - Image variant

### Carousel
- `.carousel-container` - Main modal
- `.carousel-main` - Display area
- `.carousel-counter` - Position counter
- `.carousel-thumbnails` - Thumbnail strip
- `.thumbnail` - Individual thumbnail
- `.thumbnail.active` - Active state

## Color Tokens (Light Theme)

```scss
$bg: #FFFFFF
$bg-soft: #F5F5F5
$border: #E0E0E0
$text: #333333
$text-soft: #999999
$primary: #1976D2 (active)
$carousel-bg: #000000
```

## Color Tokens (Dark Theme)

```scss
$bg: #1E1E1E
$bg-soft: #2A2A2A
$border: #404040
$text: #CCCCCC
$text-soft: #999999
$primary: #42A5F5 (active)
$carousel-bg: #000000
```

## Animation Timings

```javascript
Hover effects   : 0.2s ease
Fade transitions: 0.2s-0.3s ease
Scroll smoothly : auto smooth
Transforms     : GPU-accelerated
```

## Data Structure

```javascript
// Post with mediaArray
{
  _id: "...",
  mediaArray: [
    {
      url: "/uploads/img1.jpg",
      type: "image",
      size: 12345
    },
    {
      url: "/uploads/video.mp4",
      type: "video",
      size: 999999
    }
  ],
  mediaCount: 2,
  media: "/uploads/img1.jpg",      // First item (backward compat)
  mediaType: "image"                // Type of first item
}
```

## Common Interactions

### Opening Carousel
```
Click media item
  → setCurrentMediaIndex(index)
  → setShowMediaCarousel(true)
  → Dialog opens
```

### Navigate Right
```
Click right arrow
  → index = (index + 1) % total
  → Main display updates
  → Thumbnail highlights
```

### Select Thumbnail
```
Click thumbnail
  → setCurrentMediaIndex(thumb_index)
  → Jump to item instantly
  → Update active state
```

### Close
```
Click X or press ESC
  → setShowMediaCarousel(false)
  → Dialog closes
  → Return to feed
```

## Media Types

```javascript
type: "image"  // JPEG, PNG, GIF
type: "video"  // MP4, MOV, AVI
```

## Special Elements

### Play Button (Video)
```
Width:  52px
Height: 52px
Color:  rgba(255,255,255,0.85)
Icon:   Play symbol (center +3px)
Hover:  Scale 1.15 + brightness 0.95
```

### Video Badge (Thumbnail)
```
Position: Bottom-right corner
Size:     24px circle
Color:    rgba(0,0,0,0.8)
Icon:     White play symbol
Display:  Video thumbnails only
```

### "+X More" Overlay
```
Position: Absolute on 7th item
Color:    rgba(0,0,0,0.6)
Text:     "+3" (large) + "MORE" (small)
Hover:    Darken to 0.75 + scale up
Click:    Navigate to /post/{postId}
```

### Active Thumbnail
```
Border:   2px #1976D2 (light) / #42A5F5 (dark)
Shadow:   0 0 12px rgba(25,118,210,0.5)
Scale:    1.05 on hover
Color:    Highlight effect
```

## Common Props

### renderMedia()
```javascript
// Accesses post.mediaArray or post.media
// No parameters needed
// Returns: JSX of appropriate layout
```

### renderMediaItem(media)
```javascript
media = {
  url: "/uploads/...",
  type: "image" | "video"
}
// Returns: JSX of single item
```

## Browser Support

✅ Chrome (latest 2)
✅ Firefox (latest 2)
✅ Safari (latest 2)
✅ Edge (latest 2)
✅ Mobile browsers (iOS/Android)

❌ IE 11 or older

## Dependencies

- React 18+
- Material-UI (Dialog, IconButton, etc.)
- ReactPlayer (video playback)
- SCSS (post.scss)

## Performance Tips

1. **Image Optimization**
   - Use Next/Image for optimization
   - Implement lazy loading
   - Use WebP format where supported

2. **Video Optimization**
   - Stream vs download
   - Use appropriate bitrate
   - Provide poster image

3. **Carousel Performance**
   - Virtualize thumbnails if 100+
   - Preload adjacent items
   - Unload on close

## Testing Quick Checks

```bash
✓ 1 media  → Full width          [visible: no carousel yet]
✓ 2 media  → Side-by-side        [click to open carousel]
✓ 3 media  → Asymmetric (60-40)  [click to open carousel]
✓ 4 media  → 2x2 grid            [click to open carousel]
✓ 5 media  → 3-column grid       ["+1 MORE" on 6th]
✓ Arrows   → Navigate carousel   [left/right work]
✓ Thumbs   → Jump in carousel    [click thumbnail]
✓ ESC      → Close carousel      [press ESC]
✓ Mobile   → Responsive          [check mobile view]
```

## Debugging Tips

### Media Not Showing
1. Check `post.mediaArray` exists
2. Verify URLs start with `/uploads/`
3. Check network tab for 404s
4. Inspect React DevTools

### Carousel Issues
1. Check `showMediaCarousel` state
2. Verify `currentMediaIndex` valid
3. Check Dialog rendered
4. Inspect console for errors

### Layout Wrong
1. Check CSS loaded (F12)
2. Verify media counts
3. Test all breakpoints
4. Clear browser cache

### Video Not Playing
1. Check video format (MP4/MOV/AVI)
2. Test URL directly
3. Check CORS headers
4. Verify ReactPlayer version

## Common Customizations

### Change Grid Columns
```scss
.media-grid-layout.grid {
  grid-template-columns: repeat(4, 1fr); // 4 columns instead of 3
}
```

### Adjust Gap
```scss
.media-grid-layout {
  gap: 4px; // Larger gap
}
```

### Modify Carousel Height
```scss
.carousel-container {
  height: 80vh; // Shorter carousel
}
```

### Change Play Button Size
```scss
.play-icon {
  width: 64px; // Larger button
  height: 64px;
}
```

---

**For Complete Details**: See MULTI_MEDIA_GALLERY_GUIDE.md
**For Visual Examples**: See MULTI_MEDIA_GALLERY_VISUAL_GUIDE.md
**Status**: ✅ Production Ready
