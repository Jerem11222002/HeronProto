# Notification System Flow Diagram

## Bug Report Notification Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER SUBMITS BUG REPORT                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POST /api/bug-reports                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. Validate input (title, description, category, severity)    │  │
│  │ 2. Get user session info                                      │  │
│  │ 3. Create bug report in database                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FIND ALL SUPERADMINS                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ User.find({ isAdmin: true, adminRole: 'super' })              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CREATE NOTIFICATION FOR EACH SUPERADMIN                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ createAdminNotification({                                      │  │
│  │   userId: superadmin._id,                                      │  │
│  │   senderId: user._id,                                          │  │
│  │   type: 'bug_report',                                          │  │
│  │   message: 'New [severity] bug report: [title]',              │  │
│  │   organization: null,                                          │  │
│  │   priority: severity === 'critical' ? 'high' : 'medium',      │  │
│  │   category: 'bug_report',                                      │  │
│  │   actionUrl: '/admin/bug-reports',                            │  │
│  │   read: false  ← IMPORTANT: Unread by default                 │  │
│  │ })                                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   EMIT SOCKET EVENT          │  │   SAVE TO DATABASE           │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ io.emit(               │  │  │  │ Notification.create({  │  │
│  │   'admin:notification: │  │  │  │   ...                  │  │
│  │   new',                │  │  │  │   read: false          │  │
│  │   { type, severity }   │  │  │  │ })                     │  │
│  │ )                      │  │  │  └────────────────────────┘  │
│  └────────────────────────┘  │  └──────────────────────────────┘
└──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND RECEIVES EVENT                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ socket.on('admin:notification:new', () => {                   │  │
│  │   setUnreadCount(prev => prev + 1);  ← INCREMENT BY 1         │  │
│  │ });                                                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BADGE COUNT UPDATES                               │
│                         [Badge: +1]                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Mark as Read Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                  SUPERADMIN CLICKS NOTIFICATION                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              POST /api/admin/notifications/:id/read                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. Find notification by ID                                     │  │
│  │ 2. Verify admin has permission to read it                      │  │
│  │ 3. Update: { read: true, readAt: new Date() }                 │  │
│  │ 4. Count remaining unread notifications                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RETURN UPDATED COUNT                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ res.json({                                                     │  │
│  │   success: true,                                               │  │
│  │   notification: {...},                                         │  │
│  │   unreadCount: X  ← NEW COUNT                                  │  │
│  │ })                                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND UPDATES BADGE                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ setUnreadCount(response.data.unreadCount);  ← SET TO NEW VALUE│  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BADGE COUNT UPDATES                               │
│                         [Badge: -1]                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Database State Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATIONS TABLE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Notification 1                                              │    │
│  │ ├─ userId: superadmin1_id                                   │    │
│  │ ├─ type: 'bug_report'                                       │    │
│  │ ├─ message: 'New medium bug report: Login Issue'           │    │
│  │ ├─ read: false  ← UNREAD                                    │    │
│  │ ├─ isAdminNotification: true                                │    │
│  │ ├─ organization: null                                       │    │
│  │ └─ createdAt: 2026-05-05T10:00:00Z                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Notification 2                                              │    │
│  │ ├─ userId: superadmin1_id                                   │    │
│  │ ├─ type: 'bug_report'                                       │    │
│  │ ├─ message: 'New high bug report: Payment Failed'          │    │
│  │ ├─ read: false  ← UNREAD                                    │    │
│  │ ├─ isAdminNotification: true                                │    │
│  │ ├─ organization: null                                       │    │
│  │ └─ createdAt: 2026-05-05T11:00:00Z                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Notification 3                                              │    │
│  │ ├─ userId: superadmin1_id                                   │    │
│  │ ├─ type: 'event_registration'                               │    │
│  │ ├─ message: 'New registration for Art Workshop'            │    │
│  │ ├─ read: true   ← READ                                      │    │
│  │ ├─ readAt: 2026-05-05T11:30:00Z                            │    │
│  │ ├─ isAdminNotification: true                                │    │
│  │ ├─ organization: 'ArtCenter'                                │    │
│  │ └─ createdAt: 2026-05-05T09:00:00Z                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

UNREAD COUNT QUERY:
Notification.countDocuments({
  isAdminNotification: true,
  read: false,
  // Role-based filtering applied here
})

RESULT: 2 (Notifications 1 and 2)
```

## Role-Based Filtering

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPERADMIN VIEW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Query: { isAdminNotification: true, read: false }                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ✅ Bug Report Notifications (organization: null)            │    │
│  │ ✅ Event Notifications (all organizations)                  │    │
│  │ ✅ Permission Updates (all organizations)                   │    │
│  │ ✅ System Alerts (organization: null)                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Badge Count: ALL unread admin notifications                         │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    ORGANIZATION ADMIN VIEW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Query: {                                                             │
│    isAdminNotification: true,                                         │
│    read: false,                                                       │
│    $or: [                                                             │
│      { organization: 'ArtCenter' },                                   │
│      { userId: admin._id }                                            │
│    ]                                                                  │
│  }                                                                    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ❌ Bug Report Notifications (organization: null)            │    │
│  │ ✅ Event Notifications (organization: 'ArtCenter')          │    │
│  │ ✅ Permission Updates (organization: 'ArtCenter')           │    │
│  │ ❌ System Alerts (organization: null)                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Badge Count: Only organization-specific notifications               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Comparison: Before vs After

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BEFORE (INCORRECT)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Fetch ALL bug reports from database                              │
│  2. Get bugReportSeenAt from localStorage                            │
│  3. Filter reports: createdAt > bugReportSeenAt                      │
│  4. Count filtered reports                                           │
│  5. Display count                                                    │
│                                                                       │
│  Problems:                                                           │
│  ❌ Recounts all historical reports                                  │
│  ❌ Depends on localStorage (can be cleared)                         │
│  ❌ Timestamp comparison can drift                                   │
│  ❌ Separate from notification system                                │
│  ❌ No real-time updates                                             │
│  ❌ Inefficient (fetches all reports)                                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          AFTER (CORRECT)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Query: Notification.countDocuments({ read: false })              │
│  2. Display count                                                    │
│                                                                       │
│  Benefits:                                                           │
│  ✅ Accurate incremental counting (+1/-1)                            │
│  ✅ Database-backed (persistent)                                     │
│  ✅ No timestamp comparisons                                         │
│  ✅ Integrated with notification system                              │
│  ✅ Real-time updates via socket events                              │
│  ✅ Efficient (single count query)                                   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Real-Time Update Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser A  │         │    Server    │         │   Browser B  │
│  (Superadmin)│         │              │         │  (Superadmin)│
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  Connected via Socket  │  Connected via Socket  │
       │◄──────────────────────►│◄──────────────────────►│
       │                        │                        │
       │                        │                        │
       │                   Bug Report                    │
       │                   Submitted                     │
       │                        │                        │
       │                        ▼                        │
       │              Create Notification                │
       │                        │                        │
       │                        ▼                        │
       │         Emit: admin:notification:new            │
       │                        │                        │
       │◄───────────────────────┼───────────────────────►│
       │                        │                        │
       ▼                        │                        ▼
  Badge: +1                     │                   Badge: +1
       │                        │                        │
       │                        │                        │
       │  Click Notification    │                        │
       ├───────────────────────►│                        │
       │                        │                        │
       │                        ▼                        │
       │              Mark as Read                       │
       │                        │                        │
       │◄───────────────────────┤                        │
       │   Return: unreadCount  │                        │
       │                        │                        │
       ▼                        │                        │
  Badge: -1                     │                        │
       │                        │                        │
       │                        │   Refresh Page         │
       │                        │◄───────────────────────┤
       │                        │                        │
       │                        ├───────────────────────►│
       │                        │   Return: unreadCount  │
       │                        │                        │
       │                        │                        ▼
       │                        │                   Badge: -1
       │                        │                        │
```

## Summary

### Key Points:

1. **Incremental Updates**: +1 for new, -1 for read
2. **Database-Backed**: Single source of truth
3. **Real-Time**: Socket events for instant updates
4. **Role-Based**: Superadmins see all, org admins see their org
5. **Persistent**: Survives logout/login cycles
6. **Efficient**: Single count query, no filtering

### The Fix in One Sentence:

Bug reports now create admin notifications (like events and other features), so the unread count is tracked accurately in the database instead of being recalculated from timestamps.
