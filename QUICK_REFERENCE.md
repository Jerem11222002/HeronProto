# Quick Reference: Multiple Media Upload Fix

## Problem
❌ "500 Internal Server Error: Unexpected field" when creating posts with media

## Root Cause
- Frontend sends multiple files: `formData.append("media", file)` in loop
- Backend expects single file: `.single('media')`
- Multer rejects unexpected "media" fields

## Solution Applied
### 1. Backend Multer Config (posts.js:133)
```javascript
// BEFORE:
.single('media')

// AFTER:
.array('media', 10)  // ✅ Now accepts up to 10 files
```

### 2. Backend Route Handler (posts.js:446-511)
```javascript
// BEFORE:
const media = req.file;

// AFTER:
const mediaArray = [];
if (req.files && req.files.length > 0) {
  req.files.forEach((file) => {
    const mediaType = file.mimetype.startsWith("video/") ? "video" : "image";
    mediaArray.push({
      url: `/uploads/${file.filename}`,
      type: mediaType,
      size: file.size
    });
  });
}
```

### 3. Post Model Schema (posts.js)
```javascript
// ADDED:
mediaArray: [{
  url: String,
  type: { enum: ['image', 'video'] },
  size: Number,
  duration: Number,
  thumbnail: String
}],
mediaCount: { type: Number, min: 0, max: 10 }
```

## Files Modified
1. ✅ `backend/routes/posts.js` - 2 changes
2. ✅ `backend/models/posts.js` - 1 addition

## Files NOT Modified
- ✅ `src/components/share/Share.jsx` - Already correct
- ✅ All frontend components - No changes needed
- ✅ Database - No migration needed

## Test Commands
```bash
# Single file
curl -X POST http://localhost:5000/api/posts/ \
  -H "Authorization: Bearer TOKEN" \
  -F "desc=Test" \
  -F "media=@image.jpg"

# Multiple files
curl -X POST http://localhost:5000/api/posts/ \
  -H "Authorization: Bearer TOKEN" \
  -F "desc=Test" \
  -F "media=@image1.jpg" \
  -F "media=@image2.jpg"
```

## API Response
```json
{
  "media": "/uploads/first-file.jpg",
  "mediaArray": [
    { "url": "/uploads/first-file.jpg", "type": "image", "size": 12345 },
    { "url": "/uploads/second-file.jpg", "type": "image", "size": 54321 }
  ],
  "mediaCount": 2,
  "mediaType": "image"
}
```

## Key Features
- ✅ Up to 10 files per post
- ✅ Images + videos in same post
- ✅ 100MB per file limit
- ✅ Backward compatible (old posts still work)
- ✅ Automatic type detection
- ✅ File validation

## Status
🟢 **READY FOR PRODUCTION**

## Deployment
1. Copy updated files to production
2. Restart Node.js server
3. Test via API or UI
4. Monitor logs

## Rollback
- Restore original posts.js
- Restart server
- No data loss (backward compatible)

## Next Phase
Frontend display updates:
- Post.jsx carousel for mediaArray
- FullScreenPostPage gallery view
- Thumbnail strip navigation

See: `MEDIA_DISPLAY_ARCHITECTURE.md`

## Documentation
- **Full Details**: `MULTIPLE_MEDIA_UPLOAD_FIX.md`
- **Deployment**: `DEPLOYMENT_CHECKLIST.md`
- **Display**: `MEDIA_DISPLAY_ARCHITECTURE.md`
- **Tests**: `tests/test-posts.rest`
- **Status**: `IMPLEMENTATION_COMPLETE.md`
