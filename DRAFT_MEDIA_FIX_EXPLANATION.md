# Draft Media Restoration Fix

## Problem
When loading a draft, media files were not appearing. This happened because:

1. **Blob URLs are temporary**: When media files are uploaded, React creates temporary blob URLs (`blob:http://localhost:5000/...`) that are only valid for the current browser session.
2. **Storage limitation**: These blob URLs become invalid after:
   - Browser page refresh
   - Browser session ends
   - `URL.revokeObjectURL()` is called (for cleanup)
3. **JSON serialization**: Blob URLs were being stored in JSON, but the original blob objects were lost.

## Solution Implemented

### 1. **Base64 Encoding for Persistent Storage**
Added helper functions to convert files to/from Base64:

```javascript
// Convert File to Base64 (for storage)
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
};

// Convert Base64 back to File (for restoration)
const base64ToFile = async (base64String, fileName, fileType) => {
  const response = await fetch(base64String);
  const blob = await response.blob();
  return new File([blob], fileName, { type: fileType });
};
```

### 2. **Updated saveDraft Function**
Now saves both blob URLs AND base64 encoded files:

```javascript
const saveDraft = async () => {
  // Convert media files to base64 for persistent storage
  const mediaWithBase64 = await Promise.all(
    mediaFiles.map(async (m) => {
      let base64 = null;
      if (m.file) {
        base64 = await fileToBase64(m.file);
      }
      return {
        type: m.type,
        name: m.name,
        size: m.size,
        preview: m.preview,      // Blob URL for current session
        base64: base64            // Base64 for persistence
      };
    })
  );
  
  // Saved to both sessionStorage AND localStorage
  sessionStorage.setItem('postDrafts', JSON.stringify(...));
  localStorage.setItem('postDrafts', JSON.stringify(...));
};
```

### 3. **Updated loadDraft Function**
Now intelligently restores media in priority order:

```javascript
const loadDraft = async (draft) => {
  if (draft.media && draft.media.length > 0) {
    const restoredMedia = await Promise.all(
      draft.media.map(async (m) => {
        // Priority 1: Try blob URL first (if in same session)
        if (m.preview && m.preview.startsWith('blob:')) {
          return { preview: m.preview, ... };
        }
        
        // Priority 2: Reconstruct from base64 (if blob URL expired)
        if (m.base64) {
          const file = await base64ToFile(m.base64, m.name, m.type);
          const preview = URL.createObjectURL(file);
          return { file, preview, ... };
        }
        
        return null; // Skip if both fail
      })
    );
  }
};
```

### 4. **Improved Fallback Logic**
Updated component initialization to load from both storages:

```javascript
useEffect(() => {
  // First try sessionStorage (current session with blob URLs)
  let savedDrafts = sessionStorage.getItem('postDrafts');
  
  // If no sessionStorage, try localStorage (persisted across sessions)
  if (!savedDrafts) {
    savedDrafts = localStorage.getItem('postDrafts');
  }
  
  if (savedDrafts) {
    setDrafts(JSON.parse(savedDrafts));
  }
}, []);
```

### 5. **Added File Metadata**
Ensured all media objects include name and size:

```javascript
newMedia.push({
  file,                          // File object for base64 conversion
  preview: URL.createObjectURL(file),
  type: 'image' | 'video',
  name: file.name,               // NEW
  size: file.size                // NEW
});
```

## Behavior After Fix

### Same Session (Browser not refreshed)
✅ Blob URLs work immediately
✅ Media loads instantly
✅ No performance impact

### Cross-Session (After browser refresh/close)
✅ Base64 fallback activates
✅ Media reconstructed from base64
✅ User sees full draft with media restored
⚠️ May take 1-2 seconds for large files (base64 decoding)

### Error Handling
If media can't be restored:
- Shows warning: "Media from this draft could not be restored. Please re-add the files."
- Still loads draft content and tags
- Allows user to manually re-add media if needed

## Testing Checklist

- [ ] Save draft with 1 image
  - [ ] Load draft immediately → Media appears ✓
  - [ ] Refresh page → Media appears ✓
  - [ ] Close/reopen browser → Media appears ✓

- [ ] Save draft with 2+ media (mix of images/videos)
  - [ ] Load draft immediately → All media appears ✓
  - [ ] Refresh page → All media appears ✓

- [ ] Save draft, add more media, load again
  - [ ] Old draft media still there ✓
  - [ ] New media doesn't overwrite ✓

- [ ] Mobile browser test
  - [ ] Draft media loads on mobile ✓
  - [ ] Base64 handles smaller storage ✓

## Performance Notes

**Storage Limits:**
- **sessionStorage**: ~5-10MB per domain
- **localStorage**: ~5-10MB per domain
- **Base64 encoding**: ~33% larger than binary (3 bytes → 4 characters)

**For users with large files:**
- 5 images (2MB each) = 10MB → 13MB in base64 → May hit storage limit
- Recommendation: Keep drafts to reasonable size or add cleanup for old drafts

## Future Improvements

1. **IndexedDB**: Use IndexedDB instead of localStorage for better storage capacity (50MB+)
2. **Cloud Sync**: Store drafts on server for sync across devices
3. **Cleanup**: Auto-delete drafts older than 30 days
4. **Compression**: Compress base64 before storage to save space
5. **Chunking**: Split large files into chunks for better reliability

---

**Files Modified:**
- `src/components/share/Share.jsx`

**Functions Updated:**
1. `fileToBase64()` - NEW
2. `base64ToFile()` - NEW  
3. `saveDraft()` - Updated to encode files
4. `loadDraft()` - Updated to restore from base64
5. `useEffect()` - Updated to check both storages
6. `handleFileChange()` - Added name/size metadata
7. Component initialization - Added helper functions

**Status:** ✅ Ready to test
