const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/message');
const Conversation = require('../models/conversation');
const User = require('../models/users');
const authenticateToken = require('../Middleware/authenticateToken');
const messageCache = require('../services/messageCache');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

// Create or get a conversation between two users
router.post('/start/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const friendId = req.params.userId;

    if (userId.toString() === friendId) {
      return res.status(400).json({ message: "Cannot start a chat with yourself." });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [userId, friendId], $size: 2 }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [userId, friendId]
      });
      await conversation.save();
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to start conversation' });
  }
});

// Get all conversations for the current user with pagination
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Max 50
    const skip = (page - 1) * limit;

    // Get total count with retry (fast, no lookups)
    const totalCount = await retryWithBackoff(
      async () => {
        return await Conversation.countDocuments({ 
          participants: new mongoose.Types.ObjectId(userId) 
        }).maxTimeMS(10000); // 10 second timeout for count
      },
      2,
      50,
      `Conversation count for user ${userId}`
    );

    // Get paginated conversations with lookups (only paginated results, not all) - WITH RETRY
    console.log(`🔍 Fetching paginated conversations: page ${page}, limit ${limit}, userId: ${userId}`);
    const paginatedConversations = await retryWithBackoff(
      async () => {
        return await Conversation.aggregate([
          { $match: { participants: new mongoose.Types.ObjectId(userId) } },
          { $sort: { updatedAt: -1 } },
          // CRITICAL: Paginate BEFORE lookups (only lookup paginated results)
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              let: { participantIds: '$participants' },
              pipeline: [
                { $match: { $expr: { $in: ['$_id', '$$participantIds'] } } },
                { $project: { _id: 1, name: 1, profilePic: 1, username: 1 } }
              ],
              as: 'participants'
            }
          }
        ]);
      },
      3,
      100,
      `Conversation pagination for user ${userId} page ${page}`
    );

    res.json({
      conversations: paginatedConversations,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

// Get all messages for a conversation with pagination
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  const queryStartTime = Date.now();
  try {
    const conversationId = req.params.conversationId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100); // Max 100 messages
    const skip = (page - 1) * limit;

    console.log(`\n📌 [MESSAGES] GET /messages/${conversationId} start`);
    console.log(`   Page: ${page}, Limit: ${limit}`);

    // Validate conversationId
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      console.warn(`[MESSAGES] ❌ Invalid conversationId: ${conversationId}`);
      return res.status(400).json({ message: 'Invalid conversationId' });
    }

    // Get total count with retry (fast, no lookups)
    console.log(`   [COUNT] Fetching message count...`);
    const countStartTime = Date.now();
    
    const totalCount = await retryWithBackoff(
      async () => {
        const countStart = Date.now();
        const result = await Message.countDocuments({ 
          conversationId: new mongoose.Types.ObjectId(conversationId) 
        });
        const countDuration = Date.now() - countStart;
        console.log(`   [COUNT] ✅ DB query done (${countDuration}ms): ${result} messages total`);
        return result;
      },
      2,
      50,
      `Message count for conversation ${conversationId}`
    );
    const countDuration = Date.now() - countStartTime;
    console.log(`   [COUNT DONE] ${countDuration}ms`);

    // Get paginated messages with lookups (only paginated results, not all) - WITH RETRY
    console.log(`   [PAGINATION] Fetching messages page ${page}...`);
    const paginationStartTime = Date.now();
    
    const paginatedMessages = await retryWithBackoff(
      async () => {
        const aggregateStart = Date.now();
        console.log(`   [PAGINATION] Starting aggregation...`);
        
        const result = await Message.aggregate([
          { $match: { conversationId: new mongoose.Types.ObjectId(conversationId) } },
          { $sort: { createdAt: -1 } },
          // CRITICAL: Paginate BEFORE lookups (only lookup paginated results)
          // NOTE: Sorting by -1 (newest first) to ensure latest messages load when page 1 is requested
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              let: { senderId: '$sender' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$senderId'] } } },
                { $project: { _id: 1, name: 1, profilePic: 1, username: 1 } }
              ],
              as: 'sender'
            }
          },
          {
            $lookup: {
              from: 'messages',
              let: { replyToId: '$replyTo' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$replyToId'] } } },
                { $project: { _id: 1, text: 1, sender: 1, createdAt: 1 } }
              ],
              as: 'replyTo'
            }
          },
          {
            $addFields: {
              sender: { $arrayElemAt: ['$sender', 0] },
              replyTo: { $arrayElemAt: ['$replyTo', 0] }
            }
          },
          {
            $project: {
              _id: 1,
              conversationId: 1,
              sender: 1,
              text: 1,
              attachments: 1,
              reactions: 1,
              replyTo: 1,
              messageType: 1,
              read: 1,
              edited: 1,
              createdAt: 1,
              updatedAt: 1
            }
          }
        ]);
        
        const aggregateDuration = Date.now() - aggregateStart;
        console.log(`   [PAGINATION] ✅ Aggregation complete (${aggregateDuration}ms): ${result.length} docs returned`);
        return result;
      },
      3,
      150,
      `Message pagination for conversation ${conversationId} page ${page}`
    );
    
    const paginationDuration = Date.now() - paginationStartTime;
    console.log(`   [PAGINATION DONE] ${paginationDuration}ms`);
    
    const totalDuration = Date.now() - queryStartTime;
    console.log(`📌 [MESSAGES] Complete (${totalDuration}ms)\n`);

    res.json({
      messages: paginatedMessages,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    const totalDuration = Date.now() - queryStartTime;
    console.error(`\n❌ [MESSAGES] ERROR (${totalDuration}ms):`);
    console.error(`   Message: ${err.message}`);
    console.error(`   Type: ${err.name}`);
    console.error(`   Stack: ${err.stack}\n`);
    res.status(500).json({ message: 'Failed to fetch messages', error: err.message });
  }
});

// Send a new message (supports attachments, reply, forward, messageType)
router.post('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversationId' });
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const {
      text,
      attachments = [],
      replyTo,
      forwardedFrom,
      messageType = 'text'
    } = req.body;

    if (!text && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: 'Message text or attachment required' });
    }

    const newMessage = new Message({
      conversationId: req.params.conversationId,
      sender: req.user._id,
      text,
      attachments,
      replyTo,
      forwardedFrom,
      messageType
    });

    const savedMessage = await newMessage.save();
    
    // Use aggregation pipeline instead of .populate()
    const populatedMessage = (await Message.aggregate([
      { $match: { _id: savedMessage._id } },
      {
        $lookup: {
          from: 'users',
          let: { senderId: '$sender' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$senderId'] } } },
            { $project: { _id: 1, name: 1, profilePic: 1, username: 1 } }
          ],
          as: 'sender'
        }
      },
      {
        $addFields: {
          sender: { $arrayElemAt: ['$sender', 0] }
        }
      }
    ]))[0];

    // Update conversation's updatedAt and invalidate cache
    await Conversation.findByIdAndUpdate(req.params.conversationId, { updatedAt: new Date() });
    messageCache.invalidate(req.params.conversationId);
    messageCache.invalidateConversations();

    // Emit real-time message via Socket.io
    const io = req.app.get('io') || req.app.get('socketio');
    if (io) {
      // Emit to conversation room (for open popups)
      io.to(req.params.conversationId).emit('chat:message', {
        conversationId: req.params.conversationId,
        message: populatedMessage
      });

      // Emit to recipient's user room for notification and auto-popup
      const recipientId = conversation.participants.find(
        id => id.toString() !== req.user._id.toString()
      );
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('chat:message', {
          conversationId: req.params.conversationId,
          message: populatedMessage
        });
      }
    }

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error('Failed to send message:', err);
    res.status(500).json({ message: 'Failed to send message', error: err.message });
  }
});

// Add a reaction to a message
router.post('/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'Emoji required' });

    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { $addToSet: { reactions: { user: req.user._id, emoji } } },
      { new: true }
    );
    
    // Invalidate conversation cache when reaction is added
    if (message) {
      messageCache.invalidate(message.conversationId);
    }

    // Emit reaction event
    const io = req.app.get('io') || req.app.get('socketio');
    if (io && message) {
      io.to(message.conversationId.toString()).emit('chat:reaction', {
        messageId: message._id,
        reactions: message.reactions
      });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add reaction' });
  }
});

// Remove a reaction from a message
router.delete('/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'Emoji required' });
    
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { $pull: { reactions: { user: req.user._id, emoji } } },
      { new: true }
    );
    
    // Invalidate conversation cache when reaction is removed
    if (message) {
      messageCache.invalidate(message.conversationId);
    }

    // Emit reaction removal event
    const io = req.app.get('io') || req.app.get('socketio');
    if (io && message) {
      io.to(message.conversationId.toString()).emit('chat:reaction', {
        messageId: message._id,
        reactions: message.reactions
      });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove reaction' });
  }
});

// Edit a message (soft edit)
router.put('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    message.text = text;
    message.edited = true;
    await message.save();

    // Emit edit event
    const io = req.app.get('io') || req.app.get('socketio');
    if (io) {
      io.to(message.conversationId.toString()).emit('chat:edit', {
        messageId: message._id,
        text: message.text,
        edited: true
      });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Failed to edit message' });
  }
});

// Soft delete a message
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    message.deleted = true;
    await message.save();

    // Emit delete event
    const io = req.app.get('io') || req.app.get('socketio');
    if (io) {
      io.to(message.conversationId.toString()).emit('chat:delete', {
        messageId: message._id,
        conversationId: message.conversationId
      });
    }

    res.json({ message: 'Message deleted (soft)' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

// Mark all messages as read in a conversation (per-user read receipts)
router.put('/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        sender: { $ne: userId },
        readBy: { $ne: userId }
      },
      { $addToSet: { readBy: userId } }
    );

    // Emit read event
    const io = req.app.get('io') || req.app.get('socketio');
    if (io) {
      io.to(req.params.conversationId).emit('chat:read', {
        conversationId: req.params.conversationId,
        userId: req.user._id
      });
    }

    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
});

// Get last message (preview) for a conversation with a friend
router.get('/conversations/:friendId/preview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const friendId = req.params.friendId;

    // Find the conversation between the two users
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, friendId], $size: 2 }
    });
    if (!conversation) return res.json({ messages: [] });

    // Get the latest message
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(1)
      .populate('sender', 'name profilePic')
      .lean();

    // Mark read status for the current user
    const messagesWithRead = messages.map(msg => {
      // Handle both populated and unpopulated sender
      const senderId = msg.sender && msg.sender._id ? msg.sender._id.toString() : msg.sender.toString();
      return {
        ...msg,
        read:
          senderId === userId
            ? true
            : (msg.readBy || []).map(id => id.toString()).includes(userId)
      };
    });

    res.json({ messages: messagesWithRead });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch message preview' });
  }
});

// Get unread message counts for the current user
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // Optimized: Single aggregation pipeline instead of N+1 queries
    const results = await Message.aggregate([
      // Match messages in conversations with this user
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation'
        }
      },
      { $unwind: '$conversation' },
      {
        $match: {
          'conversation.participants': userId,
          deleted: { $ne: true },
          sender: { $ne: userId }
        }
      },
      // Check if message is unread for this user
      {
        $addFields: {
          isUnread: {
            $not: {
              $in: [userId, { $ifNull: ['$readBy', []] }]
            }
          }
        }
      },
      { $match: { isUnread: true } },
      // Group by conversation to get per-friend unread counts
      {
        $group: {
          _id: '$conversationId',
          friendId: { $first: { $arrayElemAt: ['$conversation.participants', 0] } },
          count: { $sum: 1 }
        }
      },
      // Transform to get all friend IDs
      {
        $addFields: {
          friendId: {
            $cond: [
              { $eq: ['$friendId', userId] },
              { $arrayElemAt: ['$conversation.participants', 1] },
              '$friendId'
            ]
          }
        }
      }
    ]);

    // Build response object
    const perFriend = {};
    let total = 0;
    
    results.forEach(result => {
      const friendId = result.friendId?.toString() || '';
      if (friendId && friendId !== userId.toString()) {
        perFriend[friendId] = result.count;
        total += result.count;
      }
    });

    res.json({ total, perFriend });
  } catch (err) {
    console.error('Error fetching unread counts:', err);
    res.status(500).json({ message: 'Failed to fetch unread counts' });
  }
});

module.exports = router;