# Toast Notification Fix - Socket Integration

## Problem

Badge count was working but toast notifications were not appearing when new bug reports were submitted.

## Root Cause

The `AdminNotificationBell` component was trying to access `window.socket`, but the socket is actually provided through the `SocketContext` using the `useSocket` hook.

### Before (Incorrect):
```javascript
const socket = window.socket;  // ❌ window.socket doesn't exist
if (socket) {
  socket.on('admin:notification:new', (data) => {
    // This never runs because socket is undefined
  });
}
```

### After (Correct):
```javascript
const { socket, isConnected } = useSocket();  // ✅ Get socket from context
if (socket && isConnected) {
  socket.on('admin:notification:new', (data) => {
    // This runs when socket is connected
  });
}
```

## Fix Applied

### File: `src/components/admin/AdminNotificationBell/AdminNotificationBell.jsx`

**1. Added useSocket import:**
```javascript
import { useSocket } from '../../../context/SocketContext';
```

**2. Get socket from context:**
```javascript
const { socket, isConnected } = useSocket();
```

**3. Updated socket event listeners:**
```javascript
useEffect(() => {
  console.log('[AdminNotificationBell] Socket setup:', {
    socketExists: !!socket,
    socketConnected: isConnected
  });
  
  if (!socket || !isConnected) {
    console.warn('[AdminNotificationBell] Socket not available or not connected');
    return;
  }

  const handleNewNotification = (data) => {
    console.log('[AdminNotificationBell] Received admin:notification:new event:', data);
    
    setUnreadCount(prev => prev + 1);
    
    // Show toast notification
    const notificationType = data?.type || 'notification';
    const severity = data?.severity || '';
    const title = data?.title || '';
    
    let message = 'New admin notification';
    if (notificationType === 'bug_report') {
      message = `New ${severity} bug report${title ? `: ${title}` : ''}`;
    } else if (notificationType === 'organization_registration') {
      message = 'New event registration';
    } else if (notificationType === 'organization_event') {
      message = 'New organization event';
    }
    
    console.log('[AdminNotificationBell] Showing toast:', message);
    
    toast.info(message, {
      position: 'top-right',
      autoClose: 4000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  socket.on('admin:notification:new', handleNewNotification);
  socket.on('admin:notification:read', handleNotificationRead);
  socket.on('admin:notifications:clear', handleNotificationsClear);

  return () => {
    socket.off('admin:notification:new', handleNewNotification);
    socket.off('admin:notification:read', handleNotificationRead);
    socket.off('admin:notifications:clear', handleNotificationsClear);
  };
}, [socket, isConnected]);  // ✅ Depend on socket and isConnected
```

**4. Added debug logging:**
- Logs when socket is set up
- Logs when events are received
- Logs when toast is shown
- Helps debug any future issues

## How It Works Now

### Complete Flow:

```
1. User submits bug report
   ↓
2. Backend creates notification in database
   ↓
3. Backend emits socket event: io.emit('admin:notification:new', {...})
   ↓
4. SocketContext receives event (socket is connected via useSocket)
   ↓
5. AdminNotificationBell receives event via socket.on('admin:notification:new')
   ↓
6. Badge count +1 ✅
   ↓
7. Toast notification appears ✅
   "New high bug report: login button not working on mobile"
   ↓
8. Toast auto-closes after 4 seconds ✅
```

## Testing

### Test Steps:

1. **Open browser console** (F12)
2. **Login as superadmin**
3. **Check console logs:**
   ```
   [AdminNotificationBell] Socket setup: { socketExists: true, socketConnected: true }
   ```
4. **Submit a bug report** (from another browser/user)
5. **Check console logs:**
   ```
   [AdminNotificationBell] Received admin:notification:new event: { type: 'bug_report', severity: 'high', title: '...' }
   [AdminNotificationBell] Showing toast: New high bug report: ...
   ```
6. **Verify:**
   - ✅ Badge count increases by 1
   - ✅ Toast appears in top-right corner
   - ✅ Toast shows correct message with severity and title
   - ✅ Toast auto-closes after 4 seconds

### Expected Console Output:

```
🔌 Initializing Socket.IO client
📍 Socket URL: http://localhost:5000
🔑 Token provided: true
🔌 Socket connected, id: abc123
✅ Connection established
[AdminNotificationBell] Socket setup: { socketExists: true, socketConnected: true }

// After bug report submission:
[AdminNotificationBell] Received admin:notification:new event: {
  type: 'bug_report',
  severity: 'high',
  title: 'login button not working on mobile'
}
[AdminNotificationBell] Showing toast: New high bug report: login button not working on mobile
```

## Toast Notification Examples

### Bug Report (High Severity):
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  New high bug report: login button not working      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                              [×]         │
└─────────────────────────────────────────────────────────┘
```

### Bug Report (Medium Severity):
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  New medium bug report: cant change password        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                              [×]         │
└─────────────────────────────────────────────────────────┘
```

### Event Registration:
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  New event registration                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                              [×]         │
└─────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Issue: Toast still not appearing

**Check 1: Socket Connection**
```javascript
// In browser console:
console.log('Socket:', window.socket);  // Should be undefined (we use context now)
```

**Check 2: SocketContext**
Open React DevTools → Components → Find SocketProvider → Check state:
- `isConnected` should be `true`
- `socket` should be an object

**Check 3: Console Logs**
Look for:
- `[AdminNotificationBell] Socket setup: { socketExists: true, socketConnected: true }`
- If `socketExists: false` or `socketConnected: false`, socket isn't working

**Check 4: Token**
```javascript
// In browser console:
console.log('Admin Token:', localStorage.getItem('adminToken'));
```
Should return a JWT token string.

**Check 5: ToastContainer**
Verify ToastContainer is in AdminLayout:
```javascript
// Should be in src/components/admin/Layout/AdminLayout.jsx
<ToastContainer
  position="top-right"
  autoClose={4000}
  // ...
/>
```

### Issue: Socket not connecting

**Solution 1: Check backend is running**
```bash
# Backend should be running on port 5000 (or your configured port)
```

**Solution 2: Check REACT_APP_API_URL**
```javascript
// In .env or .env.local
REACT_APP_API_URL=http://localhost:5000
```

**Solution 3: Restart frontend**
```bash
# Stop frontend (Ctrl+C)
# Clear cache and restart
npm start
```

## Files Modified

1. **`src/components/admin/AdminNotificationBell/AdminNotificationBell.jsx`**
   - Added `useSocket` import
   - Get socket from context instead of `window.socket`
   - Updated socket event listeners to use context socket
   - Added debug logging
   - Added dependency array `[socket, isConnected]` to useEffect

## Summary

The toast notifications weren't working because the component was looking for `window.socket` which doesn't exist. The socket is provided through React Context via the `useSocket` hook.

After this fix:
- ✅ Socket is properly accessed from context
- ✅ Event listeners are set up correctly
- ✅ Toast notifications appear when events are received
- ✅ Debug logging helps troubleshoot issues
- ✅ Badge count and toast both work together

**No server restart needed - this is a frontend-only change!**

Just refresh the browser and test by submitting a new bug report.
