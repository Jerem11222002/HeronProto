const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true }
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'file'], required: true },
  name: { type: String }, // original filename
  size: { type: Number }  // in bytes
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String
  },
  attachments: [AttachmentSchema],
  reactions: [ReactionSchema],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  read: { // for backward compatibility (single chat)
    type: Boolean,
    default: false
  },
  edited: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'system'],
    default: 'text'
  }
}, { timestamps: true });

// CRITICAL INDEXES - Address message thread queries (very high volume)
MessageSchema.index({ conversationId: 1, createdAt: -1 }); // Get conversation messages (HIGHEST PRIORITY)
MessageSchema.index({ conversationId: 1, read: 1 });       // Unread message count
MessageSchema.index({ sender: 1, createdAt: -1 });         // User's sent messages

module.exports = mongoose.model('Message', MessageSchema);