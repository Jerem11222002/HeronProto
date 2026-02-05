# Backend Multiple Media Upload - Deployment Checklist

## ✅ Code Changes Complete

### Backend Routes (`backend/routes/posts.js`)
- [x] Multer configuration: `.array('media', 10)` (Line 133)
  - Accepts up to 10 files
  - Size limit: 100MB per file
  - Supports images and videos
  
- [x] POST "/" route handler (Lines 446-511)
  - Checks `req.files` (array) instead of `req.file` (single)
  - Loops through all files to build mediaArray
  - Detects file type for each: image or video
  - Initializes videoMetadata for videos
  - Maintains backward compatibility with `media` field

### Post Model (`backend/models/posts.js`)
- [x] Added `mediaArray` field (Line 35-59)
  - Array of objects with url, type, size, duration, thumbnail
  - Default: empty array
  
- [x] Added `mediaCount` field (Line 61-65)
  - Tracks number of media files
  - Range: 0-10
  - Default: 0

### Frontend (Already Complete)
- [x] Share.jsx properly sends multiple files
- [x] FormData.append("media", file) in loop
- [x] Media preview with grid and carousel
- [x] Drag-and-drop support
- [x] Plus button for adding files

## 📋 What to Test

### Test Suite Available
- Location: `tests/test-posts.rest`
- Contains curl command examples for manual testing

### Manual Testing Steps

1. **Single File Upload (Backward Compatibility)**
   - Upload 1 image
   - Verify: `media` field populated, `mediaArray` has 1 item, `mediaCount` = 1

2. **Multiple File Upload (New Feature)**
   - Upload 2 images + 1 video
   - Verify: `mediaArray` has 3 items with correct types, `mediaCount` = 3

3. **Text-Only Post**
   - Post without media
   - Verify: `mediaArray` empty, `mediaCount` = 0

4. **UI Testing**
   - Use Share component to test drag-drop
   - Verify modal shows file grid with thumbnails
   - Verify plus button appears and works
   - Test upload and successful post creation

## 🚀 Deployment Instructions

### Before Deploying
1. Backup current database (mongodb backup)
2. Stop the application server
3. Deploy code changes
4. Database migration: No migration needed (new fields are optional)

### Deployment Steps
1. Copy updated files:
   - `backend/routes/posts.js`
   - `backend/models/posts.js`

2. Restart application:
   ```bash
   node server.js
   # or
   npm start
   ```

3. Verify in logs:
   - Should NOT see any errors starting up
   - Check for any console warnings

### Post-Deployment Verification
1. Create a test post with single file via UI
2. Create a test post with multiple files via UI
3. Check response contains both `media` and `mediaArray`
4. Verify `mediaCount` matches number of files uploaded

## 🔄 Rollback Plan (If Needed)

If issues occur:
1. Keep backup of previous `backend/routes/posts.js` and `backend/models/posts.js`
2. Restore from backup
3. Restart server
4. Old posts will still work (backward compatible)
5. No data migration needed

## 📊 Expected Behavior

### API Response Format
```json
{
  "_id": "...",
  "userId": "...",
  "name": "User Name",
  "desc": "Post description",
  "media": "/uploads/first-file.jpg",
  "mediaArray": [
    { 
      "url": "/uploads/first-file.jpg", 
      "type": "image", 
      "size": 12345 
    },
    { 
      "url": "/uploads/second-file.jpg", 
      "type": "image", 
      "size": 54321 
    }
  ],
  "mediaCount": 2,
  "mediaType": "image",
  "tags": [],
  "createdAt": "2024-01-15T...",
  "updatedAt": "2024-01-15T..."
}
```

## ⚠️ Known Limitations

- Maximum 10 files per post (configurable)
- Maximum 100MB per file (configurable)
- Supported formats: 
  - Images: JPEG, PNG, GIF
  - Videos: MP4, MOV, AVI
- Video duration extraction requires ffmpeg (should already be installed)

## 📝 Notes

- Frontend Share.jsx was already correctly implemented
- No database migration needed (fields optional on existing posts)
- Backward compatibility maintained (old posts still work)
- All existing API consumers unaffected

## ✅ Sign-Off

- [x] Code changes reviewed
- [x] Database schema compatible
- [x] Frontend properly formatted
- [x] Error handling in place
- [x] Backward compatibility maintained
- [ ] Tested in staging environment
- [ ] Tested in production (after deployment)
