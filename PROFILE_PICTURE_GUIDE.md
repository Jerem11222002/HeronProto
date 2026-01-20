# Profile Picture Implementation Guide

## Overview
All chat components now use a centralized image URL helper for consistent profile picture handling across the application.

---

## How It Works

### Image Sources Supported
The system automatically handles all these image sources:

1. **Default Avatar** - When no picture is provided
   ```
   '/assets/person/Default.jpg'
   ```

2. **Data URLs** - Inline embedded images
   ```
   'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
   ```

3. **Full URLs** - External URLs
   ```
   'https://cdn.example.com/pic.jpg'
   'http://localhost:5000/uploads/pic.jpg'
   ```

4. **Server Uploads** - Relative paths (recommended)
   ```
   'profile123.jpg'  → Auto-converts to 'http://localhost:5000/uploads/profile123.jpg'
   ```

---

## Usage in Components

### Simple Usage
```javascript
import { getUserProfilePicUrl } from '../../utils/imageUrlHelper';

// In your component
<img 
  src={getUserProfilePicUrl(friend)} 
  alt={friend.name}
  onError={(e) => e.target.src = '/assets/person/Default.jpg'}
/>
```

### With Custom API URL
```javascript
const imageUrl = getUserProfilePicUrl(friend, 'https://api.example.com');
```

### Advanced Usage
```javascript
import { getImageUrl, getUserProfilePic } from '../../utils/imageUrlHelper';

// Get just the profile picture property (handles multiple property names)
const pic = getUserProfilePic(friend);
// Returns: user.profilePicture || user.profilePic || user.avatar || ...

// Get full URL with custom base
const url = getImageUrl('picture.jpg', 'https://custom-api.com');
```

---

## Components Using Profile Pictures

### ChatPopup.jsx
- **Location**: Header avatar circle
- **Shows**: Friend's profile picture
- **Fallback**: Default avatar

### ConversationInfo.jsx
- **Location**: Profile section (larger image)
- **Shows**: Friend's full profile picture with border
- **Fallback**: Default avatar

### Message.jsx (Ready for future use)
- **Location**: Sender avatar (if needed)
- **Shows**: Sender's profile picture
- **Fallback**: Default avatar

---

## Database Field Names Supported

The utility automatically checks these property names in order:

```javascript
user.profilePicture  // Preferred
user.profilePic
user.avatar
user.photo
user.picture
```

So you can use any of these in your backend, and it will work!

---

## Error Handling

All image tags include error handling:

```javascript
<img 
  src={getUserProfilePicUrl(friend)} 
  alt={friend.name}
  onError={(e) => {
    e.target.src = '/assets/person/Default.jpg';
  }}
/>
```

This ensures:
- ✅ If image fails to load, default avatar is shown
- ✅ No broken image icons
- ✅ Graceful degradation

---

## Backend Setup

### File Upload Structure
```
server/
├── uploads/
│   ├── profile123.jpg
│   ├── profile456.png
│   └── avatar789.jpeg
└── routes/
    └── upload.js
```

### Upload Endpoint
```javascript
// POST /api/upload
// Returns: { filename: 'profile123.jpg' }

// Then store in database:
user.profilePicture = 'profile123.jpg';
```

### Image URL Resolution
```
Stored in DB:  'profile123.jpg'
↓
Utility converts to: 'http://localhost:5000/uploads/profile123.jpg'
↓
Browser fetches from server
```

---

## Testing

### Test Different Sources
```javascript
// Test with server upload
<img src={getUserProfilePicUrl({ profilePicture: 'user123.jpg' })} />
// → http://localhost:5000/uploads/user123.jpg

// Test with full URL
<img src={getUserProfilePicUrl({ avatar: 'https://cdn.example.com/pic.jpg' })} />
// → https://cdn.example.com/pic.jpg (unchanged)

// Test with data URL
<img src={getUserProfilePicUrl({ photo: 'data:image/jpeg;...' })} />
// → data:image/jpeg;... (unchanged)

// Test with null/undefined
<img src={getUserProfilePicUrl(null)} />
// → /assets/person/Default.jpg (fallback)
```

---

## Best Practices

1. **Always use `getUserProfilePicUrl()`** instead of hardcoding URLs
2. **Include error handlers** for all profile images
3. **Store filename only** in database (`'profile123.jpg'` not full URL)
4. **Use consistent property name** - recommend `profilePicture` across app
5. **Test with multiple image sources** during development

---

## Configuration

### Custom API URL
Set in your `.env` file:
```
REACT_APP_API_URL=https://api.yourapp.com
```

The utility will automatically use this instead of the default `http://localhost:5000`.

---

## File Locations

- **Utility Function**: [src/utils/imageUrlHelper.js](src/utils/imageUrlHelper.js)
- **Used in ChatPopup**: [src/components/chat/ChatPopup.jsx](src/components/chat/ChatPopup.jsx)
- **Used in ConversationInfo**: [src/components/chat/ConversationInfo.jsx](src/components/chat/ConversationInfo.jsx)
- **Default Avatar**: `/public/assets/person/Default.jpg`

---

**Updated**: January 20, 2026
**Status**: ✅ Production Ready
