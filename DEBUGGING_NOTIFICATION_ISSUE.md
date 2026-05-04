# Debugging Notification Issue

## Problem
- Badge count not showing
- Toast notifications not appearing
- Bug reports appear in dropdown but no notifications created

## Root Cause
The `createAdminNotification` function was being required dynamically inside the route handler, which may have caused issues. Additionally, the User model was also being required dynamically.

## Fix Applied

### Changed: `backend/routes/bugReports.js`

**Before:**
```javascript
// At top of file
const express = require('express');
const router = express.Router();
const BugReport = require('../models/bugReport');
// ... other imports, but NOT User or createAdminNotification

// Inside route handler
try {
  const User = require('../models/users');  // Dynamic require
  const { createAdminNotification } = require('./adminNotifications');  // Dynamic require
  
  const superadmins = await User.find({...});
  // ...
}
```

**After:**
```javascript
// At top of file
const express = require('express');
const router = express.Router();
const BugReport = require('../models/bugReport');
const UserSession = require('../models/userSession');
const User = require('../models/users');  // ✅ Static require
const authenticateToken = require('../Middleware/authenticateToken');
const { adminAuthMiddleware } = require('../Middleware/adminAuthMiddleware');
const { getClientIP } = require('../utils/geoipService');
const { createAdminNotification } = require('./adminNotifications');  // ✅ Static require

// Inside route handler
try {
  // No dynamic requires needed
  const superadmins = await User.find({...});
  // ...
}
```

### Added Logging

Added more detailed logging to help debug:

```javascript
console.log(`[BugReports] Found ${superadmins.length} superadmins`);

if (superadmins.length > 0) {
  // Create notifications...
  console.log(`[BugReports] Created ${superadmins.length} notifications for superadmins`);
} else {
  console.log('[BugReports] No superadmins found to notify');
}
```

And enhanced error logging:

```javascript
catch (notifError) {
  console.error('[BugReports] Error creating superadmin notifications:', notifError);
  console.error('[BugReports] Error stack:', notifError.stack);
}
```

## How to Test

### Step 1: Restart Backend Server
```bash
# Stop the backend server
# Restart it to load the new code
```

### Step 2: Check Server Logs
When you submit a bug report, you should see:
```
[BugReports] Found X superadmins
[BugReports] Created X notifications for superadmins
[ADMIN NOTIFICATION] Created bug_report notification for user XXXXX
```

If you see errors, they will be logged with full stack trace.

### Step 3: Submit Test Bug Report
1. Login as regular user
2. Go to Settings → Bug Reports
3. Submit a bug report
4. Check server console for logs

### Step 4: Check Admin Panel
1. Login as superadmin
2. Check notification bell badge (should show +1)
3. Check for toast notification (should appear in top-right)
4. Open dropdown (should see notification in notifications section)

## Debugging Checklist

### Backend Checks

- [ ] Server restarted after code changes
- [ ] No errors in server console
- [ ] Log shows: `[BugReports] Found X superadmins` (X > 0)
- [ ] Log shows: `[BugReports] Created X notifications`
- [ ] Log shows: `[ADMIN NOTIFICATION] Created bug_report notification`

### Database Checks

Check if notifications are being created:

```javascript
// In MongoDB shell or Compass
db.notifications.find({ 
  type: 'bug_report',
  isAdminNotification: true 
}).sort({ createdAt: -1 }).limit(5)
```

Should return recent bug report notifications.

### Frontend Checks

- [ ] Browser console shows no errors
- [ ] Socket connection established (check Network tab → WS)
- [ ] Socket event received (check console for socket logs)
- [ ] ToastContainer is rendered in DOM
- [ ] Badge component is rendered

## Common Issues

### Issue 1: No Superadmins Found

**Symptom:** Log shows `[BugReports] Found 0 superadmins`

**Solution:** Check database for superadmin users:
```javascript
db.users.find({ isAdmin: true, adminRole: 'super' })
```

If none exist, create one or update existing admin:
```javascript
db.users.updateOne(
  { email: 'admin@example.com' },
  { $set: { isAdmin: true, adminRole: 'super' } }
)
```

### Issue 2: Module Not Found Error

**Symptom:** Error: `Cannot find module './adminNotifications'`

**Solution:** Check file path. The adminNotifications.js file should be in the same directory as bugReports.js:
```
backend/routes/
  ├── adminNotifications.js
  └── bugReports.js
```

### Issue 3: createAdminNotification is not a function

**Symptom:** TypeError: `createAdminNotification is not a function`

**Solution:** Check exports in adminNotifications.js:
```javascript
// Should be at end of file
module.exports = {
  router,
  createAdminNotification,
  // ... other exports
};
```

### Issue 4: Socket Not Connected

**Symptom:** No toast notifications, badge doesn't update in real-time

**Solution:** 
1. Check if socket.io server is running
2. Check browser console for socket connection errors
3. Verify socket is available: `console.log(window.socket)`
4. Check Network tab for WebSocket connection

### Issue 5: Toast Not Appearing

**Symptom:** Badge updates but no toast

**Solution:**
1. Check if ToastContainer is in AdminLayout
2. Check browser console for toast errors
3. Verify react-toastify is installed: `npm list react-toastify`
4. Check if toast CSS is imported

## Manual Testing Script

Run this in browser console while logged in as superadmin:

```javascript
// Test socket connection
console.log('Socket connected:', !!window.socket);

// Test socket event manually
if (window.socket) {
  window.socket.emit('admin:notification:new', {
    type: 'bug_report',
    severity: 'medium',
    title: 'Test Bug'
  });
}

// Check if toast library is available
console.log('Toast available:', typeof toast !== 'undefined');
```

## Expected Flow

### Complete Flow Diagram

```
1. User submits bug report
   ↓
2. POST /api/bug-reports
   ↓
3. Create bug report in database
   ↓
4. Find superadmins
   ↓ (Should log: "Found X superadmins")
5. Create notification for each superadmin
   ↓ (Should log: "Created X notifications")
6. Emit socket event: admin:notification:new
   ↓
7. Frontend receives socket event
   ↓
8. Badge count +1
   ↓
9. Toast appears
   ↓
10. Notification visible in dropdown
```

### What to Check at Each Step

**Step 4:** Check server logs for superadmin count
**Step 5:** Check server logs for notification creation
**Step 6:** Check server logs for socket emission
**Step 7:** Check browser console for socket event
**Step 8:** Check badge in UI
**Step 9:** Check for toast in top-right
**Step 10:** Open dropdown and verify notification

## Server Restart Required

⚠️ **IMPORTANT:** After making these changes, you MUST restart the backend server for the changes to take effect.

```bash
# If using nodemon, it should auto-restart
# If not, manually stop and start the server

# Stop server (Ctrl+C)
# Start server
npm run server
# or
node server.js
```

## Verification Commands

### Check if notifications exist in database
```bash
# Using MongoDB shell
mongo
use your_database_name
db.notifications.countDocuments({ type: 'bug_report', isAdminNotification: true })
```

### Check server logs
```bash
# Tail server logs
tail -f server.log

# Or check console output
# Look for [BugReports] and [ADMIN NOTIFICATION] logs
```

### Check if superadmins exist
```bash
# Using MongoDB shell
db.users.find({ isAdmin: true, adminRole: 'super' }).count()
```

## Next Steps

1. **Restart backend server** ← MOST IMPORTANT
2. Submit a test bug report
3. Check server logs for the logging messages
4. Check if badge count increases
5. Check if toast appears
6. Report back with:
   - Server log output
   - Any errors in browser console
   - Whether badge/toast appeared

## Additional Debugging

If issues persist after restart, add this temporary debug endpoint:

```javascript
// In backend/routes/bugReports.js
router.get('/debug/notifications', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const User = require('../models/users');
    const Notification = require('../models/notification');
    
    const superadmins = await User.find({
      isAdmin: true,
      adminRole: 'super'
    }).select('_id username email adminRole');
    
    const bugReportNotifications = await Notification.find({
      type: 'bug_report',
      isAdminNotification: true
    }).sort({ createdAt: -1 }).limit(10);
    
    res.json({
      success: true,
      superadmins,
      superadminCount: superadmins.length,
      recentNotifications: bugReportNotifications,
      notificationCount: bugReportNotifications.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Then visit: `http://localhost:PORT/api/bug-reports/debug/notifications`

This will show you:
- How many superadmins exist
- Recent bug report notifications
- Whether notifications are being created

## Summary

The fix moves the `require` statements to the top of the file (static imports) instead of inside the route handler (dynamic imports). This ensures the modules are loaded correctly when the server starts.

**After applying this fix and restarting the server, notifications should be created properly, and both the badge count and toast notifications should work.**
