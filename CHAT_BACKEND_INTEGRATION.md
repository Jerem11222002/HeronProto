# Chat GUI Implementation Guide - Backend Integration

## Overview
This document outlines the backend changes needed to support the enhanced Chat GUI features.

---

## Database Schema Updates

### Message Model Changes
```javascript
{
  _id: ObjectId,
  conversationId: ObjectId,
  sender: ObjectId,
  text: String,
  
  // NEW FIELDS
  isEdited: Boolean,           // Track if message was edited
  deliveryStatus: String,      // 'sending', 'sent', 'read', 'failed'
  readAt: Date,                // When message was read
  editedAt: Date,              // When message was last edited
  
  createdAt: Date,
  updatedAt: Date
}
```

### Conversation Model Addition
```javascript
{
  _id: ObjectId,
  participants: [ObjectId],
  
  // NEW FIELDS
  mutedBy: [ObjectId],         // Users who muted conversation
  pinnedBy: [ObjectId],        // Users who pinned conversation
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## API Endpoints Required

### 1. Edit Message
```
PUT /api/messages/:messageId
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  text: "Updated message text"
}

Response:
{
  _id: "...",
  text: "Updated message text",
  isEdited: true,
  editedAt: "2026-01-20T10:30:00Z"
}
```

### 2. Delete Message
```
DELETE /api/messages/:messageId
Authorization: Bearer <token>

Response:
{
  success: true,
  message: "Message deleted"
}
```

### 3. Mark Message as Read
```
POST /api/messages/:messageId/read
Authorization: Bearer <token>

Response:
{
  _id: "...",
  readAt: "2026-01-20T10:31:00Z",
  deliveryStatus: "read"
}
```

### 4. Get Conversation Messages (Enhanced)
```
GET /api/messages/conversations/:conversationId/messages?limit=50&offset=0
Authorization: Bearer <token>

Response:
[
  {
    _id: "...",
    sender: { _id: "...", name: "..." },
    text: "...",
    deliveryStatus: "read",
    isEdited: false,
    createdAt: "...",
    readAt: "..."
  }
]
```

---

## Socket Events Implementation

### Server-Side Implementation

```javascript
// server.js or socketHandlers.js

io.on('connection', (socket) => {
  // Join conversation room
  socket.on('join', (data) => {
    socket.join(`conversation:${data.conversationId}`);
  });

  // User typing indicator
  socket.on('user:typing', (data) => {
    const { conversationId, isTyping, userId } = data;
    socket.to(`conversation:${conversationId}`).emit('user:typing', {
      conversationId,
      userId,
      isTyping,
      timestamp: new Date()
    });
  });

  // Message edited
  socket.on('message:edit', async (data) => {
    const { conversationId, messageId, text } = data;
    
    // Update database
    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { text, isEdited: true, editedAt: new Date() },
      { new: true }
    );
    
    // Emit to all participants
    socket.to(`conversation:${conversationId}`).emit('message:edited', {
      conversationId,
      messageId,
      text,
      editedAt: updatedMessage.editedAt
    });
  });

  // Message deleted
  socket.on('message:delete', async (data) => {
    const { conversationId, messageId } = data;
    
    // Delete from database
    await Message.findByIdAndDelete(messageId);
    
    // Emit to all participants
    socket.to(`conversation:${conversationId}`).emit('message:deleted', {
      conversationId,
      messageId
    });
  });

  // Read receipt
  socket.on('message:read', async (data) => {
    const { conversationId, messageId } = data;
    
    // Update message
    const updated = await Message.findByIdAndUpdate(
      messageId,
      { 
        deliveryStatus: 'read',
        readAt: new Date()
      },
      { new: true }
    );
    
    // Emit to sender
    socket.to(`conversation:${conversationId}`).emit('message:read', {
      messageId,
      readAt: updated.readAt
    });
  });

  // Leave conversation
  socket.on('leave', (data) => {
    socket.leave(`conversation:${data.conversationId}`);
  });
});
```

---

## Controller Updates

### messagesController.js - Edit Message
```javascript
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    // Verify ownership
    const message = await Message.findById(messageId);
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Can only edit within 15 minutes
    const createdTime = new Date(message.createdAt);
    const now = new Date();
    if (now - createdTime > 15 * 60 * 1000) {
      return res.status(400).json({ error: 'Message too old to edit' });
    }

    const updated = await Message.findByIdAndUpdate(
      messageId,
      { 
        text, 
        isEdited: true, 
        editedAt: new Date() 
      },
      { new: true }
    ).populate('sender', 'name profilePic');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### messagesController.js - Delete Message
```javascript
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Verify ownership
    const message = await Message.findById(messageId);
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Message.findByIdAndDelete(messageId);
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### messagesController.js - Mark as Read
```javascript
exports.markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const updated = await Message.findByIdAndUpdate(
      messageId,
      {
        deliveryStatus: 'read',
        readAt: new Date()
      },
      { new: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Routes Updates

### routes/messages.js
```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../Middleware/authenticateToken');
const messagesController = require('../controllers/postsController');

// Existing routes
router.post('/start/:friendId', authenticateToken, messagesController.startConversation);
router.get('/conversations/:conversationId/messages', authenticateToken, messagesController.getMessages);
router.post('/conversations/:conversationId/messages', authenticateToken, messagesController.sendMessage);

// NEW ROUTES
router.put('/messages/:messageId', authenticateToken, messagesController.editMessage);
router.delete('/messages/:messageId', authenticateToken, messagesController.deleteMessage);
router.post('/messages/:messageId/read', authenticateToken, messagesController.markMessageAsRead);

module.exports = router;
```

---

## Migration Script

```javascript
// scripts/migrateMessagesSchema.js
const mongoose = require('mongoose');
const Message = require('../backend/models/message');
const Conversation = require('../backend/models/conversation');

async function migrateMessages() {
  try {
    console.log('Starting message schema migration...');

    // Add new fields to existing messages
    await Message.updateMany(
      {},
      {
        $set: {
          isEdited: false,
          deliveryStatus: 'sent',
          editedAt: null,
          readAt: null
        }
      }
    );

    console.log('✅ Message schema migration complete');

    // Add new fields to conversations
    await Conversation.updateMany(
      {},
      {
        $set: {
          mutedBy: [],
          pinnedBy: []
        }
      }
    );

    console.log('✅ Conversation schema migration complete');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run migration
migrateMessages();
```

---

## Testing Checklist

### Backend Tests
- [ ] Edit message endpoint works
- [ ] Can only edit own messages
- [ ] Delete message endpoint works
- [ ] Read receipt updates correctly
- [ ] Socket events emit correctly
- [ ] Unauthorized users blocked
- [ ] Database updates propagate

### Frontend Tests
- [ ] Edit UI appears and functions
- [ ] Delete with confirmation works
- [ ] Socket events received correctly
- [ ] UI updates in real-time
- [ ] Error messages display
- [ ] Offline queue operates
- [ ] Search filters correctly

### Integration Tests
- [ ] End-to-end message edit flow
- [ ] Typing indicator persistence
- [ ] Read receipts update both sides
- [ ] Delete removes from all clients
- [ ] Socket reconnection handles
- [ ] Network failures handled
- [ ] Rate limiting applied

---

## Deployment Steps

1. **Database Migration**
   ```bash
   node scripts/migrateMessagesSchema.js
   ```

2. **Backend Deployment**
   - Update routes
   - Add socket handlers
   - Deploy controllers
   - Verify endpoints

3. **Frontend Deployment**
   - Build React app
   - Deploy new components
   - Test in staging
   - Deploy to production

4. **Verification**
   - Check all features work
   - Monitor error logs
   - User acceptance testing
   - Performance monitoring

---

## Rate Limiting Recommendations

```javascript
// Add rate limiting for edit/delete
const rateLimit = require('express-rate-limit');

const messageEditLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many edit requests, please slow down'
});

router.put('/messages/:messageId', 
  authenticateToken, 
  messageEditLimiter, 
  messagesController.editMessage
);
```

---

## Error Codes

```
200 - Success
400 - Bad request
401 - Unauthorized (not authenticated)
403 - Forbidden (not message owner)
404 - Message not found
409 - Conflict (message too old to edit)
429 - Too many requests (rate limited)
500 - Server error
```

---

## Performance Optimization

1. **Indexing**
   ```javascript
   messageSchema.index({ conversationId: 1, createdAt: -1 });
   messageSchema.index({ sender: 1, createdAt: -1 });
   ```

2. **Query Optimization**
   - Use lean() for read-only queries
   - Select only needed fields
   - Implement pagination

3. **Caching**
   - Cache recent conversations
   - Cache user online status
   - Cache message count

---

**Document Version**: 1.0
**Last Updated**: January 20, 2026
**Status**: Ready for Implementation
