# Multiple Media Upload Backend Fix - Complete Summary

## Issue
When users attempted to create posts with multiple media files, they received a "500 Internal Server Error" with the message "Unexpected field". This prevented any posts from being created through the Share component.

## Root Cause Analysis
The error "Unexpected field" is thrown by the multer middleware when it receives a field name that doesn't match its configuration. The issue was:

1. **Frontend**: Sending multiple files via `FormData.append("media", file)` in a loop
   - This creates multiple entries with the same field name "media"
   - Multer treats this as an array when configured with `.array()`

2. **Backend (Before Fix)**: Configured to accept single file with `.single('media')`
   - Multer `.single()` expects exactly ONE file and rejects additional fields
   - Any additional "media" fields cause the "Unexpected field" error
   - This happens in multer middleware BEFORE the route handler executes

## Solutions Implemented

### 1. Updated Multer Configuration
**File**: `backend/routes/posts.js` (Line 121-133)

```javascript
const upload = multer({
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [...ALLOWED_FILE_TYPES.image, ...ALLOWED_FILE_TYPES.video];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type...`), false);
    }
    cb(null, true);
  },
}).array('media', 10); // CHANGED: from .single('media')
```

**Change**: `.single('media')` → `.array('media', 10)`
- Now accepts up to 10 files under the "media" field
- Files available in `req.files` array instead of `req.file` object

### 2. Refactored POST "/" Route Handler
**File**: `backend/routes/posts.js` (Line 446-511)

**Key Changes**:
- Check `req.files` (plural array) instead of `req.file` (singular object)
- Process all files in a loop to build `mediaArray`
- Detect file type for each file: `file.mimetype.startsWith("video/")` → "video" or "image"
- Store each file with url, type, and size

**New Code**:
```javascript
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

const newPost = new Post({
  userId: user._id,
  name: user.name,
  desc,
  profilePic: user.profilePicture,
  media: mediaArray.length > 0 ? mediaArray[0].url : null, // Backward compatibility
  mediaArray: mediaArray.length > 0 ? mediaArray : [], // NEW: Array of all files
  mediaCount: mediaArray.length,
  mediaType: mediaArray.length > 0 ? mediaArray[0].type : null,
  tags: tags ? JSON.parse(tags) : []
});
```

### 3. Updated Post Model Schema
**File**: `backend/models/posts.js` (After "media" field)

Added new fields to support multiple media:

```javascript
mediaArray: {
  type: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    size: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0
    },
    thumbnail: {
      type: String,
      default: null
    }
  }],
  default: []
},
mediaCount: {
  type: Number,
  default: 0,
  min: 0,
  max: 10
}
```

## Frontend - No Changes Needed
The Share.jsx component was already correctly implemented:
- Properly appends multiple files to FormData: `formData.append("media", media.file)`
- Validates file sizes and types before upload
- Shows drag-and-drop modal with file preview grid
- Displays plus button for adding more files

## Testing Recommendations

### Test 1: Single File Upload (Backward Compatibility)
```bash
curl -X POST http://localhost:5000/api/posts/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "desc=Single file test" \
  -F "media=@image.jpg"
```

**Expected Response**:
```json
{
  "_id": "...",
  "desc": "Single file test",
  "media": "/uploads/filename.jpg",
  "mediaArray": [
    { "url": "/uploads/filename.jpg", "type": "image", "size": 12345 }
  ],
  "mediaCount": 1,
  "mediaType": "image"
}
```

### Test 2: Multiple File Upload (New Feature)
```bash
curl -X POST http://localhost:5000/api/posts/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "desc=Multiple files test" \
  -F "media=@image1.jpg" \
  -F "media=@image2.jpg" \
  -F "media=@video.mp4"
```

**Expected Response**:
```json
{
  "_id": "...",
  "desc": "Multiple files test",
  "media": "/uploads/filename1.jpg",
  "mediaArray": [
    { "url": "/uploads/filename1.jpg", "type": "image", "size": 12345 },
    { "url": "/uploads/filename2.jpg", "type": "image", "size": 54321 },
    { "url": "/uploads/filename3.mp4", "type": "video", "size": 999999 }
  ],
  "mediaCount": 3,
  "mediaType": "image"
}
```

### Test 3: Text-Only Post
```bash
curl -X POST http://localhost:5000/api/posts/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"desc": "Text only post"}'
```

**Expected Response**: 201 with post object, mediaArray: [], mediaCount: 0

## Backward Compatibility
- `media` field still contains the first file URL (for backward compatibility)
- `mediaType` still reflects the type of the first file
- `mediaArray` contains all files with full metadata
- Old code reading `post.media` will continue to work
- New code can use `post.mediaArray` for carousel/gallery displays

## Error Handling
- If no files uploaded and no description: "Post must contain text or media"
- Video files are initialized with `videoMetadata` for duration tracking
- All file sizes validated before processing (100MB limit per file)
- File types validated (images: JPEG, PNG, GIF; videos: MP4, MOV, AVI)

## Performance Considerations
- File upload timeout: 300 seconds (5 minutes) for large videos
- Maximum 10 files per post (configurable in multer `.array('media', 10)`)
- Maximum 100MB per file (configurable in multer `limits`)
- Frontend validation prevents unnecessary uploads
- Server-side validation ensures data integrity

## Files Modified
1. ✅ `backend/routes/posts.js` - Multer config and route handler
2. ✅ `backend/models/posts.js` - Schema for mediaArray and mediaCount
3. ✅ `tests/test-posts.rest` - Test cases for verification

## Files NOT Modified (Already Correct)
1. ✅ `src/components/share/Share.jsx` - Frontend working correctly
2. ✅ `src/components/share/share.scss` - Styling complete
3. ✅ All other components - No changes needed

## Verification Checklist
- [x] Multer configuration changed from `.single()` to `.array()`
- [x] POST route handler refactored to process req.files array
- [x] Post model schema includes mediaArray and mediaCount fields
- [x] Backward compatibility maintained (media field preserved)
- [x] Video metadata initialization for multiple files
- [x] Frontend properly sends multiple files
- [ ] Manual testing with single file upload
- [ ] Manual testing with multiple file uploads
- [ ] Manual testing with mixed image/video uploads

## Next Steps
1. Start backend server: `node server.js`
2. Run test cases from `tests/test-posts.rest` 
3. Test through UI: Use Share component to upload single and multiple files
4. Verify mediaArray is populated in returned post objects
5. Check that carousel/gallery displays all media files
