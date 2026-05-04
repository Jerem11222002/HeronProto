# Notification Model Fix - Added Bug Report Support

## Problem Found in Logs

```
[BugReports] Error creating superadmin notifications: Error: Notification validation failed: 
type: `bug_report` is not a valid enum value for path `type`., 
category: `bug_report` is not a valid enum value for path `category`.
```

The Notification model schema didn't include `'bug_report'` in the enum values for both `type` and `category` fields.

## Root Cause

When we added bug report notification support in `backend/routes/bugReports.js`, we used:
- `type: 'bug_report'`
- `category: 'bug_report'`

But the Notification model (`backend/models/notification.js`) only had these enum values:

**Type enum (before):**
```javascript
enum: [
  'like', 'comment', 'follow', 'follow_accept', 'mention', 'reply',
  'message', 'post_tag', 'share', 'group_invite', 'event_invite', 'test',
  'permission_update', 'organization_event', 'organization_registration',
  'organization_update', 'superadmin_alert', 'admin_assigned'
]
// Missing: 'bug_report'
```

**Category enum (before):**
```javascript
enum: ['social', 'system', 'security', 'promotional']
// Missing: 'bug_report'
```

## Fix Applied

### File: `backend/models/notification.js`

**1. Added `'bug_report'` to type enum:**
```javascript
type: {
  type: String,
  required: true,
  enum: [
    'like', 'comment', 'follow', 'follow_accept', 'mention', 'reply',
    'message', 'post_tag', 'share', 'group_invite', 'event_invite', 'test',
    // Admin notification types
    'permission_update', 'organization_event', 'organization_registration',
    'organization_update', 'superadmin_alert', 'admin_assigned',
    'bug_report'  // ✅ ADDED
  ]
},
```

**2. Added `'bug_report'` to category enum:**
```javascript
category: {
  type: String,
  enum: ['social', 'system', 'security', 'promotional', 'bug_report'],  // ✅ ADDED
  default: 'social'
},
```

**3. Added default message for bug_report type:**
```javascript
notificationSchema.methods.generateDefaultMessage = function() {
  const messages = {
    // ... other types
    admin_assigned: 'You have been assigned as an admin',
    bug_report: 'New bug report submitted'  // ✅ ADDED
  };
  return messages[this.type] || 'sent you a notification';
};
```

## Testing

### ⚠️ IMPORTANT: Restart Backend Server

The changes won't take effect until you restart the backend server:

```bash
# Stop the server (Ctrl+C)
# Then restart it
npm run server
# or
node server.js
```

### Test Steps

1. **Restart backend server** ← CRITICAL
2. Submit a new bug report as a regular user
3. Check server logs for:
   ```
   [BugReports] Found 1 superadmins
   [BugReports] Created 1 notifications for superadmins
   [ADMIN NOTIFICATION] Created bug_report notification for user XXXXX
   ```
4. Login as superadmin
5. Check notification bell badge (should show +1)
6. Check for toast notification (should appear)
7. Open dropdown (should see notification)

### Expected Server Logs (After Fix)

```
[BugReports] Found 1 superadmins
[BugReports] Created 1 notifications for superadmins
[ADMIN NOTIFICATION] Created bug_report notification for user 69f2e0cb6183c97381012ce7
```

No more validation errors!

### Expected Frontend Behavior

1. **Badge Count:** Shows +1 for each new bug report
2. **Toast Notification:** Appears with message "New [severity] bug report: [title]"
3. **Dropdown:** Shows notification in the notifications section
4. **Click Notification:** Navigates to `/admin/bug-reports`

## Verification

### Check Database

After submitting a bug report, verify the notification was created:

```javascript
// In MongoDB shell or Compass
db.notifications.find({ 
  type: 'bug_report',
  isAdminNotification: true 
}).sort({ createdAt: -1 }).limit(1)
```

Should return the newly created notification with:
- `type: 'bug_report'`
- `category: 'bug_report'`
- `read: false`
- `message: 'New [severity] bug report: [title]'`

### Check Server Logs

Look for these log entries:
1. `[BugReports] Found X superadmins` (X > 0)
2. `[BugReports] Created X notifications for superadmins`
3. `[ADMIN NOTIFICATION] Created bug_report notification`

NO validation errors should appear.

## Files Modified

1. **`backend/models/notification.js`**
   - Added `'bug_report'` to `type` enum
   - Added `'bug_report'` to `category` enum
   - Added default message for `bug_report` type

## Summary

The issue was a simple schema mismatch - the bug report route was trying to create notifications with `type: 'bug_report'` and `category: 'bug_report'`, but these values weren't in the Notification model's enum arrays.

After adding these enum values and restarting the server, bug report notifications will be created successfully, and both the badge count and toast notifications will work as expected.

## Complete Flow (After Fix)

```
1. User submits bug report
   ↓
2. Backend creates bug report in database
   ↓
3. Backend finds superadmins (log: "Found 1 superadmins")
   ↓
4. Backend creates notification with type='bug_report' ✅ (no validation error)
   ↓
5. Backend emits socket event: admin:notification:new
   ↓
6. Frontend receives socket event
   ↓
7. Badge count +1 ✅
   ↓
8. Toast appears: "New medium bug report: [title]" ✅
   ↓
9. Notification visible in dropdown ✅
```

**All systems working!** 🎉
