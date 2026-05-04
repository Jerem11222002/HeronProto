# Admin Notification System - Developer Guide

## Overview

This guide explains how to integrate new features with the admin notification system, following the pattern established by the bug report notification fix.

## Architecture

### Components

1. **Backend Notification System** (`backend/routes/adminNotifications.js`)
   - Creates and manages admin notifications
   - Handles read/unread state
   - Provides role-based filtering (superadmin vs organization admin)

2. **Frontend Notification Bell** (`src/components/admin/AdminNotificationBell/`)
   - Displays unread count badge
   - Shows notification dropdown
   - Handles real-time updates via socket events

3. **Socket.IO Events** (Real-time communication)
   - `admin:notification:new` - New notification created
   - `admin:notification:read` - Notification marked as read
   - `admin:notifications:clear` - All notifications cleared

## How to Add Notifications to Your Feature

### Step 1: Import the Notification Creator

In your route file, import the `createAdminNotification` function:

```javascript
const { createAdminNotification } = require('./adminNotifications');
```

### Step 2: Create Notification When Event Occurs

When your feature triggers an event that admins should be notified about:

```javascript
// Example: New event registration
router.post('/register', authenticateToken, async (req, res) => {
  try {
    // Your feature logic here
    const registration = await EventRegistration.create({...});
    
    // Find relevant admins
    const admins = await User.find({
      isAdmin: true,
      adminOrganization: event.organization // or adminRole: 'super' for superadmins
    }).select('_id');
    
    // Create notification for each admin
    await Promise.all(
      admins.map(admin =>
        createAdminNotification({
          userId: admin._id.toString(),
          senderId: req.user._id.toString(),
          type: 'event_registration', // Unique type identifier
          message: `New registration for ${event.title}`,
          organization: event.organization, // null for system-wide
          data: {
            eventId: event._id,
            registrationId: registration._id,
            // Any additional data
          },
          priority: 'medium', // 'low', 'medium', 'high'
          category: 'event', // Categorize your notification
          actionUrl: `/admin/events/${event._id}/registrations`
        })
      )
    );
    
    // Emit socket event for real-time updates
    const { io } = require('../../server');
    if (io) {
      io.emit('admin:notification:new', {
        type: 'event_registration',
        eventId: event._id
      });
    }
    
    res.json({ success: true, registration });
  } catch (error) {
    // Error handling
  }
});
```

### Step 3: Notification Parameters Explained

```javascript
createAdminNotification({
  userId: String,        // Required: Admin user ID to receive notification
  senderId: String,      // Required: User who triggered the notification
  type: String,          // Required: Unique identifier for notification type
  message: String,       // Required: Human-readable notification message
  organization: String,  // Optional: Organization filter (null for system-wide)
  data: Object,          // Optional: Additional data for the notification
  priority: String,      // Optional: 'low', 'medium', 'high' (default: 'medium')
  category: String,      // Optional: Category for filtering (default: 'system')
  actionUrl: String      // Optional: URL to navigate when clicked
})
```

### Step 4: Socket Event Emission

Always emit a socket event after creating notifications for real-time updates:

```javascript
const { io } = require('../../server');
if (io) {
  io.emit('admin:notification:new', {
    type: 'your_notification_type',
    // Include any relevant data for the frontend
  });
}
```

## Notification Types

### System-Wide Notifications (Superadmin Only)

Use `organization: null` for notifications that should go to all superadmins:

```javascript
// Find all superadmins
const superadmins = await User.find({
  isAdmin: true,
  adminRole: 'super'
}).select('_id');

// Create notification for each
await Promise.all(
  superadmins.map(admin =>
    createAdminNotification({
      userId: admin._id.toString(),
      senderId: systemUserId,
      type: 'system_alert',
      message: 'Critical system event occurred',
      organization: null, // System-wide
      priority: 'high',
      category: 'security'
    })
  )
);
```

### Organization-Specific Notifications

Use `organization: 'OrganizationName'` for notifications specific to an organization:

```javascript
// Find admins for specific organization
const admins = await User.find({
  isAdmin: true,
  adminOrganization: 'ArtCenter'
}).select('_id');

await Promise.all(
  admins.map(admin =>
    createAdminNotification({
      userId: admin._id.toString(),
      senderId: req.user._id.toString(),
      type: 'organization_event',
      message: 'New event created for ArtCenter',
      organization: 'ArtCenter', // Organization-specific
      priority: 'medium',
      category: 'event'
    })
  )
);
```

## Priority Levels

Choose appropriate priority based on urgency:

- **`low`**: Informational updates, non-urgent changes
- **`medium`**: Standard notifications, regular updates (default)
- **`high`**: Critical issues, security alerts, urgent actions required

```javascript
// Example: Critical bug report
priority: bugReport.severity === 'critical' ? 'high' : 'medium'
```

## Categories

Use categories to organize notifications:

- `system` - System-wide events
- `security` - Security-related notifications
- `event` - Event-related notifications
- `bug_report` - Bug reports
- `user` - User-related notifications
- `permission` - Permission changes
- Custom categories as needed

## Best Practices

### 1. Error Handling

Always wrap notification creation in try-catch to prevent feature failures:

```javascript
try {
  // Create notifications
  await Promise.all(admins.map(admin => createAdminNotification({...})));
  console.log(`[YourFeature] Created ${admins.length} notifications`);
} catch (notifError) {
  console.error('[YourFeature] Error creating notifications:', notifError);
  // Don't fail the main operation if notification creation fails
}
```

### 2. Logging

Always log notification creation for debugging:

```javascript
console.log(`[YourFeature] Created ${admins.length} notifications for ${organization || 'system'}`);
```

### 3. Avoid Notification Spam

Don't create notifications for every minor action:

```javascript
// ❌ Bad: Too many notifications
await createAdminNotification({ message: 'User viewed page' });

// ✅ Good: Meaningful notifications only
await createAdminNotification({ message: 'New user registration requires approval' });
```

### 4. Meaningful Messages

Write clear, actionable messages:

```javascript
// ❌ Bad: Vague message
message: 'Something happened'

// ✅ Good: Clear and specific
message: `New ${severity} bug report: ${title}`
```

### 5. Include Action URLs

Always provide an actionUrl when possible:

```javascript
actionUrl: `/admin/bug-reports/${bugReportId}`
```

## Testing Your Integration

### 1. Unit Test Notification Creation

```javascript
describe('Feature Notifications', () => {
  it('should create notification for superadmins', async () => {
    const result = await yourFeatureFunction();
    
    const notifications = await Notification.find({
      type: 'your_notification_type'
    });
    
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].read).toBe(false);
  });
});
```

### 2. Manual Testing Checklist

- [ ] Notification appears in admin dropdown
- [ ] Badge count increases by correct amount
- [ ] Clicking notification navigates to correct URL
- [ ] Marking as read decrements count
- [ ] Real-time update works (socket event)
- [ ] Correct admins receive notification (role/org filtering)
- [ ] Notification persists after logout/login

### 3. Socket Event Testing

Open browser console and listen for events:

```javascript
socket.on('admin:notification:new', (data) => {
  console.log('New notification:', data);
});
```

## Common Patterns

### Pattern 1: Notify All Superadmins

```javascript
const superadmins = await User.find({
  isAdmin: true,
  adminRole: 'super'
}).select('_id');

await Promise.all(
  superadmins.map(admin =>
    createAdminNotification({
      userId: admin._id.toString(),
      senderId: req.user._id.toString(),
      type: 'your_type',
      message: 'Your message',
      organization: null,
      priority: 'medium'
    })
  )
);
```

### Pattern 2: Notify Organization Admins

```javascript
const admins = await User.find({
  isAdmin: true,
  adminOrganization: organizationName
}).select('_id');

await Promise.all(
  admins.map(admin =>
    createAdminNotification({
      userId: admin._id.toString(),
      senderId: req.user._id.toString(),
      type: 'your_type',
      message: 'Your message',
      organization: organizationName,
      priority: 'medium'
    })
  )
);
```

### Pattern 3: Conditional Priority

```javascript
const priority = condition === 'critical' ? 'high' : 'medium';

await createAdminNotification({
  userId: admin._id.toString(),
  senderId: req.user._id.toString(),
  type: 'your_type',
  message: 'Your message',
  priority: priority
});
```

## Troubleshooting

### Notifications Not Appearing

1. Check if `createAdminNotification` was called successfully
2. Verify admin user exists and has correct role
3. Check organization filtering (superadmin vs org admin)
4. Look for errors in server logs
5. Verify socket connection is active

### Badge Count Incorrect

1. Check if socket event was emitted
2. Verify notification was created with `read: false`
3. Check for duplicate notifications
4. Verify role-based filtering in queries

### Real-Time Updates Not Working

1. Check socket connection in browser console
2. Verify socket event name matches (`admin:notification:new`)
3. Check if socket.io server is running
4. Verify event emission in backend logs

## API Reference

### createAdminNotification(params)

Creates a new admin notification.

**Parameters:**
- `userId` (String, required): Admin user ID
- `senderId` (String, required): User who triggered notification
- `type` (String, required): Notification type identifier
- `message` (String, required): Notification message
- `organization` (String, optional): Organization filter
- `data` (Object, optional): Additional data
- `priority` (String, optional): 'low', 'medium', 'high'
- `category` (String, optional): Notification category
- `actionUrl` (String, optional): URL for navigation

**Returns:** Promise<Notification>

**Throws:** Error if creation fails

### Socket Events

**Emit:**
```javascript
io.emit('admin:notification:new', data);
```

**Listen (Frontend):**
```javascript
socket.on('admin:notification:new', (data) => {
  // Handle new notification
});
```

## Examples from Codebase

### Bug Reports
See: `backend/routes/bugReports.js`

### Event Registrations
See: `backend/routes/eventRegistration.js`

### Events
See: `backend/routes/events.js`

## Support

For questions or issues with the notification system:
1. Check this guide
2. Review existing implementations in the codebase
3. Check server logs for errors
4. Test with the provided test checklist

## Changelog

### v1.0.0 (Current)
- Initial notification system implementation
- Bug report integration
- Event registration integration
- Real-time socket updates
- Role-based filtering (superadmin/org admin)
