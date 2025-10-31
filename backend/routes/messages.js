const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/message');
const Conversation = require('../models/conversation');
const User = require('../models/users');
const authenticateToken = require('../Middleware/authenticateToken');

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

// Get all conversations for the current user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate('participants', 'name profilePic')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

// Get all messages for a conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId
    })
      .populate('sender', 'name profilePic')
      .populate('replyTo')
      .populate('forwardedFrom')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch messages' });
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
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('sender', 'name profilePic')
      .populate('replyTo')
      .populate('forwardedFrom');

    // Update conversation's updatedAt
    await Conversation.findByIdAndUpdate(req.params.conversationId, { updatedAt: new Date() });

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
    ).populate('reactions.user', 'name profilePic');

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
    ).populate('reactions.user', 'name profilePic');

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
    const userId = req.user._id.toString();
    const conversations = await Conversation.find({ participants: userId });
    const perFriend = {};
    let total = 0;

    for (const convo of conversations) {
      const friendId = convo.participants.find(
        id => id.toString() !== userId
      );
      if (!friendId) continue;

      const messages = await Message.find({
        conversationId: convo._id,
        deleted: { $ne: true }
      }).select('readBy sender');

      const unread = messages.filter(
        msg =>
          msg.sender.toString() !== userId && // Only messages from others
          !(msg.readBy || []).map(id => id.toString()).includes(userId)
      ).length;

      perFriend[friendId] = unread;
      total += unread;
    }

    res.json({ total, perFriend });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch unread counts' });
  }
});

module.exports = router;