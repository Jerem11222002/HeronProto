# Enhanced Logging & Debugging Guide

## Problem Identified
Your notifications endpoint was timing out after 65 seconds with minimal logging, making it impossible to debug what was happening. The issue was **insufficient diagnostic logging**.

## Changes Made

### 1. Enhanced Retry Logic Logging
**File:** `backend/utils/retryWithBackoff.js`

Added detailed timing and retry diagnostics:
```
[RETRY] Attempt 1/3 for: Notification metadata fetch...
[RETRY] ✅ Success on attempt 1 (1234ms): Notification metadata fetch
```

or

```
[RETRY] ❌ Attempt 1/3 failed (456ms): Notification metadata fetch
        Error: connection timed out
[RETRY] ⏳ Waiting 100ms before retry 2/3...
[RETRY] 💥 All 3 retries exhausted (65080ms total): Notification metadata fetch
        Last error: connection timed out
```

### 2. Detailed Query Logging - Notifications
**File:** `backend/routes/notifications.js`

Now logs each step with timing:
```
📋 [NOTIFICATIONS] GET /api/notifications start
   User: 6793ef4ae4a81372c442e051
   [COUNT] Fetching notification counts...
   [COUNT] 📦 Cache HIT
   [COUNT DONE] 234ms
   [PAGINATION] Fetching page 1, limit 20
   [PAGINATION] Starting aggregation...
   [PAGINATION] ✅ Aggregation complete (567ms): 15 docs returned
   [PAGINATION DONE] 589ms
✅ Found 15 notifications on page 1
📋 [NOTIFICATIONS] Complete (1145ms)
```

### 3. Detailed Query Logging - Messages
**File:** `backend/routes/messages.js`

Same detailed logging pattern:
```
📋 [MESSAGES] GET /messages/6840397aadc00a3ebc0c1058 start
   Page: 1, Limit: 30
   [COUNT] Fetching message count...
   [COUNT] ✅ DB query done (123ms): 45 messages total
   [COUNT DONE] 145ms
   [PAGINATION] Fetching messages page 1...
   [PAGINATION] Starting aggregation...
   [PAGINATION] ✅ Aggregation complete (234ms): 30 docs returned
   [PAGINATION DONE] 289ms
📋 [MESSAGES] Complete (567ms)
```

### 4. Diagnostic Endpoint
**File:** `backend/routes/notifications.js`

New endpoint to investigate specific user's notification issues:

```bash
# Get detailed notification stats for the currently logged-in user
GET http://localhost:5000/api/notifications/diagnostic/user-stats
Authorization: Bearer <your-token>
```

**Response example:**
```json
{
  "success": true,
  "userId": "6793ef4ae4a81372c442e051",
  "stats": {
    "totalNotifications": 45,
    "unreadCount": 12,
    "orphanedCount": 0,
    "byType": [
      { "_id": "follow", "count": 25 },
      { "_id": "registration", "count": 15 },
      { "_id": "comment", "count": 5 }
    ],
    "sampleNotifications": [
      {
        "id": "507f1f77bcf86cd799439011",
        "type": "follow",
        "senderId": "507f1f77bcf86cd799439012",
        "createdAt": "2026-04-20T05:30:00Z",
        "read": false
      }
    ]
  }
}
```

**Logs in server console:**
```
📊 [DIAGNOSTIC] Generating notification stats for user: 6793ef4ae4a81372c442e051
   Total notifications for user: 45
   Notifications by type: [{"_id":"follow","count":25}...]
   Unread notifications: 12
   Orphaned notifications (null sender): 0
   Last 5 notifications: [...]
📊 [DIAGNOSTIC] Complete (234ms)
```

## How to Debug Issues

### Scenario 1: Notifications Timing Out

1. **Check the server logs** for timing breakdown:
   ```
   [COUNT] 📦 Cache HIT or Cache MISS
   [COUNT DONE] XXms
   [PAGINATION] Starting aggregation...
   [PAGINATION] ✅ Aggregation complete (XXXms)
   ```

2. **Identify the slow part:**
   - If `[COUNT]` is slow (>5000ms): Count query is slow
   - If `[PAGINATION]` is slow (>10000ms): Main aggregation with $lookup is slow
   - If both are fast but total is slow: Network/MongoDB connection issue

3. **Run diagnostic endpoint:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:5000/api/notifications/diagnostic/user-stats
   ```

4. **Check output for clues:**
   - High `orphanedCount` → notifications with missing senders (deleted posts)
   - Large `totalNotifications` → query scans many documents
   - `byType` distribution → are certain notification types causing issues?

### Scenario 2: Message Loading Slow

1. **Check server logs for `[MESSAGES]` block** with timing details
2. **Look for slow operations:**
   - `[COUNT] 📊 DB query done (XXms)` - count aggregation time
   - `[PAGINATION] ✅ Aggregation complete (XXXms)` - pagination aggregation time

3. **If `[COUNT]` is slow:**
   - Conversation has many messages
   - May need better indexes on `conversationId`

4. **If `[PAGINATION]` is slow:**
   - $lookup to users or reply messages is expensive
   - Consider limiting lookups or adding indexes

### Scenario 3: Retries Happening

1. **Look for `[RETRY]` logs:**
   ```
   [RETRY] Attempt 1/3 for: Notification metadata fetch...
   [RETRY] ❌ Attempt 1/3 failed (5123ms): ...
   [RETRY] ⏳ Waiting 100ms before retry 2/3...
   ```

2. **This indicates:**
   - Connection pool issue
   - MongoDB temporarily unavailable
   - Network hiccup

3. **If retries succeed** (marked with ✅):
   - Issue was transient, retry worked
   - Monitor if happening frequently

4. **If all retries fail:**
   - Database connection problem
   - Check MongoDB server status
   - Increase connection pool size

## Key Timing Thresholds

| Operation | Expected Time | Warning | Critical |
|-----------|---|---|---|
| Notification count | <500ms | >1s | >5s |
| Notification pagination | <1s | >3s | >10s |
| Message count | <500ms | >1s | >5s |
| Message pagination | <2s | >5s | >15s |
| Diagnostic query | <1s | >2s | >5s |

## Server Log Locations

- **Console output:** Real-time logs visible in terminal
- **File:** Currently logs to console, add logging file if needed:
  ```bash
  node server.js > server.log 2>&1
  ```

## Next Steps If Still Slow

1. **Check MongoDB indexes:**
   - Server logs show: `✅ Created index: Notification (userId, createdAt)`
   - Verify MongoDB actually created them (may take time for large collections)

2. **Check notification data quality:**
   - Use diagnostic endpoint to check for orphaned notifications
   - If high count of deleted post notifications, consider cleanup

3. **Increase pool size** if retries are frequent:
   - Edit `backend/config/db.js`
   - Change `maxPoolSize: 50` to `maxPoolSize: 100`

4. **Monitor real-time:**
   - Watch server console while loading notifications
   - Note exact slow step from logs
   - Report timing data back for further optimization

## Files Modified
1. `backend/utils/retryWithBackoff.js` - Enhanced logging
2. `backend/routes/notifications.js` - Query timing + diagnostic endpoint
3. `backend/routes/messages.js` - Query timing + error logging

## Testing the Diagnostic Endpoint

```bash
# Get your token first (login), then:
curl -X GET \
  -H "Authorization: Bearer <YOUR_TOKEN_HERE>" \
  http://localhost:5000/api/notifications/diagnostic/user-stats | jq .
```

This will show exactly what's happening with your notifications without any slowness.
