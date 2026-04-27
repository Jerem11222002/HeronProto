const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }]
}, { timestamps: true });

// CRITICAL INDEXES - Address messaging queries (high volume)
ConversationSchema.index({ participants: 1 });              // Get user's conversations
ConversationSchema.index({ updatedAt: -1 });                // Sort by last activity
ConversationSchema.index({ participants: 1, updatedAt: -1 }); // User conversations sorted

module.exports = mongoose.model('Conversation', ConversationSchema);