# Notification Unread Count Fix - Test Checklist

## Pre-Testing Setup
- [ ] Ensure backend server is running
- [ ] Ensure frontend development server is running
- [ ] Clear browser cache and localStorage
- [ ] Have at least one superadmin account
- [ ] Have at least one regular user account
- [ ] Have at least one organization admin account (optional)

## Test Suite 1: Basic Functionality

### Test 1.1: New Bug Report Creates Notification
**Steps:**
1. Login as regular user
2. Navigate to Settings → Bug Reports
3. Submit a new bug report with:
   - Title: "Test Bug Report"
   - Category: "Bug"
   - Severity: "Medium"
   - Description: "Testing notification system"
4. Logout
5. Login as superadmin
6. Check notification bell badge

**Expected Result:**
- ✅ Badge count increases by 1
- ✅ Notification appears in dropdown
- ✅ Notification message shows: "New medium bug report: Test Bug Report"
- ✅ Clicking notification navigates to `/admin/bug-reports`

**Status:** [ ] Pass [ ] Fail

---

### Test 1.2: Multiple Bug Reports Increment Count
**Steps:**
1. Submit 3 bug reports from regular user account
2. Login as superadmin
3. Check badge count

**Expected Result:**
- ✅ Badge shows +3 from previous count
- ✅ All 3 notifications appear in dropdown
- ✅ Notifications are ordered by newest first

**Status:** [ ] Pass [ ] Fail

---

### Test 1.3: Marking Notification as Read Decrements Count
**Steps:**
1. With unread bug report notifications visible
2. Click on one notification
3. Check badge count

**Expected Result:**
- ✅ Badge count decreases by 1
- ✅ Clicked notification is marked as read (visual indicator)
- ✅ Count persists after page refresh

**Status:** [ ] Pass [ ] Fail

---

### Test 1.4: Mark All as Read
**Steps:**
1. Have multiple unread bug report notifications
2. Click "Mark all as read" button in dropdown
3. Check badge count

**Expected Result:**
- ✅ Badge count becomes 0
- ✅ All notifications show as read
- ✅ Count remains 0 after page refresh

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 2: Real-Time Updates

### Test 2.1: Socket Event Updates Badge
**Steps:**
1. Open admin panel in Browser Window A
2. Open user account in Browser Window B
3. Submit bug report from Window B
4. Observe Window A (do not refresh)

**Expected Result:**
- ✅ Badge count in Window A increases immediately
- ✅ No page refresh required
- ✅ New notification appears in dropdown when opened

**Status:** [ ] Pass [ ] Fail

---

### Test 2.2: Multiple Windows Sync
**Steps:**
1. Open admin panel in two browser windows (A and B)
2. Submit bug report from third window
3. Mark as read in Window A
4. Refresh Window B

**Expected Result:**
- ✅ Both windows show increased count initially
- ✅ Window B shows decreased count after refresh
- ✅ Notification shows as read in both windows

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 3: Persistence and State Management

### Test 3.1: Count Persists Across Sessions
**Steps:**
1. Login as superadmin
2. Note current unread count (e.g., 5)
3. Logout
4. Login again as same superadmin
5. Check badge count

**Expected Result:**
- ✅ Badge shows same count as before logout
- ✅ No reset or recount occurred
- ✅ Same notifications appear in dropdown

**Status:** [ ] Pass [ ] Fail

---

### Test 3.2: Partial Read State Persists
**Steps:**
1. Have 5 unread bug report notifications
2. Mark 2 as read
3. Logout
4. Login again
5. Check badge count

**Expected Result:**
- ✅ Badge shows 3 (not 5 or 0)
- ✅ Previously read notifications remain read
- ✅ Unread notifications remain unread

**Status:** [ ] Pass [ ] Fail

---

### Test 3.3: No Historical Recount
**Steps:**
1. Create 10 bug reports over time
2. Mark all as read
3. Create 2 new bug reports
4. Check badge count

**Expected Result:**
- ✅ Badge shows 2 (not 12)
- ✅ Only new reports appear as unread
- ✅ Old reports remain marked as read

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 4: Role-Based Access

### Test 4.1: Superadmin Sees All Bug Reports
**Steps:**
1. Submit bug reports from multiple users
2. Login as superadmin
3. Check notifications

**Expected Result:**
- ✅ All bug reports visible
- ✅ Badge count includes all bug reports
- ✅ Can access all bug report details

**Status:** [ ] Pass [ ] Fail

---

### Test 4.2: Organization Admin Does NOT See Bug Reports
**Steps:**
1. Submit bug report from regular user
2. Login as organization admin (not superadmin)
3. Check notifications

**Expected Result:**
- ✅ Bug report notifications NOT visible
- ✅ Badge count does NOT include bug reports
- ✅ Only organization-specific notifications appear

**Status:** [ ] Pass [ ] Fail

---

### Test 4.3: Regular User Cannot Access Admin Notifications
**Steps:**
1. Login as regular user
2. Try to access admin notification endpoints directly

**Expected Result:**
- ✅ 401/403 error returned
- ✅ No admin notifications visible
- ✅ Regular user notifications work normally

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 5: Edge Cases

### Test 5.1: Critical Severity Bug Reports
**Steps:**
1. Submit bug report with severity "Critical"
2. Login as superadmin
3. Check notification

**Expected Result:**
- ✅ Notification created successfully
- ✅ Priority set to "high"
- ✅ Message includes "critical" severity indicator

**Status:** [ ] Pass [ ] Fail

---

### Test 5.2: Rapid Submissions
**Steps:**
1. Submit 5 bug reports in quick succession (< 10 seconds)
2. Login as superadmin
3. Check badge count

**Expected Result:**
- ✅ Badge shows +5
- ✅ All 5 notifications created
- ✅ No duplicates or missing notifications

**Status:** [ ] Pass [ ] Fail

---

### Test 5.3: No Superadmins Available
**Steps:**
1. Temporarily remove all superadmin roles (test environment only)
2. Submit bug report
3. Check logs

**Expected Result:**
- ✅ Bug report created successfully
- ✅ No error thrown
- ✅ Log shows "Created 0 notifications for superadmins"

**Status:** [ ] Pass [ ] Fail

---

### Test 5.4: Socket Connection Lost
**Steps:**
1. Open admin panel
2. Disconnect network/socket
3. Submit bug report from another device
4. Reconnect network
5. Refresh page

**Expected Result:**
- ✅ Badge count updates after refresh
- ✅ No duplicate notifications
- ✅ Correct unread count displayed

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 6: Integration Tests

### Test 6.1: Bug Report Notification with Other Notifications
**Steps:**
1. Create various admin notifications (events, permissions, etc.)
2. Submit bug report
3. Check notification dropdown

**Expected Result:**
- ✅ Bug report notification appears alongside others
- ✅ Total badge count includes all notification types
- ✅ Notifications properly sorted by date

**Status:** [ ] Pass [ ] Fail

---

### Test 6.2: Notification Deletion
**Steps:**
1. Have unread bug report notification
2. Delete the notification
3. Check badge count

**Expected Result:**
- ✅ Badge count decreases by 1
- ✅ Notification removed from dropdown
- ✅ Count persists after refresh

**Status:** [ ] Pass [ ] Fail

---

### Test 6.3: Bug Report Status Change
**Steps:**
1. Submit bug report (creates notification)
2. Admin marks bug report as "resolved"
3. Check if additional notification created

**Expected Result:**
- ✅ Original notification remains
- ✅ Status change does NOT create duplicate notification
- ✅ Badge count remains accurate

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 7: Performance Tests

### Test 7.1: Large Number of Notifications
**Steps:**
1. Create 50+ bug reports
2. Login as superadmin
3. Open notification dropdown
4. Measure load time

**Expected Result:**
- ✅ Dropdown loads in < 2 seconds
- ✅ Badge count accurate
- ✅ Pagination works correctly

**Status:** [ ] Pass [ ] Fail

---

### Test 7.2: Concurrent Submissions
**Steps:**
1. Have 5 users submit bug reports simultaneously
2. Login as superadmin
3. Check badge count

**Expected Result:**
- ✅ All notifications created
- ✅ Badge count accurate (no race conditions)
- ✅ No duplicate notifications

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 8: Backward Compatibility

### Test 8.1: Existing Bug Reports
**Steps:**
1. Check existing bug reports in database (created before fix)
2. Login as superadmin
3. Verify old reports don't create new notifications

**Expected Result:**
- ✅ Old bug reports remain accessible
- ✅ No retroactive notifications created
- ✅ Only new submissions create notifications

**Status:** [ ] Pass [ ] Fail

---

### Test 8.2: Old localStorage Keys
**Steps:**
1. Manually set `adminBugReportSeenAt` in localStorage
2. Login as superadmin
3. Check if it affects badge count

**Expected Result:**
- ✅ Old localStorage key ignored
- ✅ Badge count based on database only
- ✅ No errors in console

**Status:** [ ] Pass [ ] Fail

---

## Summary

**Total Tests:** 23
**Passed:** ___
**Failed:** ___
**Skipped:** ___

**Critical Issues Found:**
- [ ] None
- [ ] List issues here

**Non-Critical Issues Found:**
- [ ] None
- [ ] List issues here

**Tested By:** _______________
**Date:** _______________
**Environment:** [ ] Development [ ] Staging [ ] Production

## Notes

Add any additional observations or comments here:

---

## Sign-Off

- [ ] All critical tests passed
- [ ] All issues documented
- [ ] Ready for deployment

**Tester Signature:** _______________
**Date:** _______________
