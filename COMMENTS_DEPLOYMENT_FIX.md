# Comments Not Displaying on Deployment - Fixed

## Problem
Comments were displaying correctly during local testing but not showing on the deployment environment. The comment section showed "No comments yet" even though comments existed in the database.

## Root Cause
The `Comments.jsx` component was making axios requests **without explicitly specifying a `baseURL`**. This caused issues in deployment where:
1. The environment variable `REACT_APP_API_URL` wasn't being used
2. Requests might fail silently or be routed incorrectly
3. CORS issues could occur if the API URL wasn't properly resolved

## Solution
Added `baseURL` configuration to all axios calls in [src/components/comments/Comments.jsx](src/components/comments/Comments.jsx):

### Changes Made:

1. **GET Comments (fetchComments)** - Line ~240
   - Added: `baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'`
   - Applied to initial comments load

2. **POST Comment (submitComment)** - Line ~295
   - Added `baseURL` to axios.post config

3. **PATCH Comment (handleEdit)** - Line ~405
   - Added `baseURL` to axios.patch config

4. **DELETE Comment (handleDelete)** - Line ~420
   - Added `baseURL` to axios.delete config

5. **GET Replies (fetchRepliesForParent)** - Line ~437
   - Added `baseURL` to axios.get config

6. **POST Reply (submitReply)** - Line ~491
   - Added `baseURL` to axios.post config

7. **POST Like (handleLike)** - Line ~552
   - Added `baseURL` to axios.post config
   - Added `baseURL` to rollback GET call

## Testing
After deployment, verify that:
1. ✅ Comments load when visiting a post
2. ✅ New comments can be posted
3. ✅ Replies work correctly
4. ✅ Editing comments functions
5. ✅ Deleting comments works
6. ✅ Liking/unliking comments works
7. ✅ Nested replies expand/collapse

## Environment Variables
Ensure `.env` or deployment platform has:
```
REACT_APP_API_URL=https://your-backend-domain.com
```

For local development:
```
REACT_APP_API_URL=http://localhost:5000
```

## Additional Notes
- This fix ensures consistency with other components like `Posts.jsx`, `settings/Settings.jsx`, etc., which already use `baseURL`
- The fix maintains backward compatibility with existing configurations
- Authorization headers are preserved where needed (all authenticated endpoints)
