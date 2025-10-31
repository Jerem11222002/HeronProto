const Comment = require('../models/comment');
const Post = require('../models/posts');

const commentHandlers = (io, socket) => {
  // Room management
  socket.on('comment:subscribe', (postId) => {
    socket.join(`post:${postId}:comments`);
    console.log(`User subscribed to comments: ${postId}`);
  });

  socket.on('comment:unsubscribe', (postId) => {
    socket.leave(`post:${postId}:comments`);
    console.log(`User unsubscribed from comments: ${postId}`);
  });

  // Comment count tracking
  socket.on('comment:getCount', async (postId) => {
    try {
      const commentsCount = await Comment.countDocuments({ 
        postId,
        parentId: null 
      });
      
      const repliesCount = await Comment.countDocuments({ 
        postId,
        parentId: { $ne: null } 
      });

      const totalCount = commentsCount + repliesCount;

      // Update post's comment count
      await Post.findByIdAndUpdate(postId, { commentCount: totalCount });

      io.to(`post:${postId}:comments`).emit('comment:count:updated', {
        postId,
        totalCount,
        commentsCount,
        repliesCount
      });
    } catch (error) {
      console.error('Error getting comment count:', error);
      socket.emit('comment:error', 'Failed to get comment count');
    }
  });

  // Comment events
  socket.on('comment:create', async (data) => {
    try {
      const { postId, commentId } = data;
      io.to(`post:${postId}:comments`).emit('comment:created', {
        postId,
        commentId
      });
      
      // Update counts
      socket.emit('comment:getCount', postId);
    } catch (error) {
      console.error('Error handling comment creation:', error);
      socket.emit('comment:error', 'Failed to handle comment creation');
    }
  });

  socket.on('comment:update', async (data) => {
    try {
      const { postId, commentId } = data;
      io.to(`post:${postId}:comments`).emit('comment:updated', {
        postId,
        commentId
      });
    } catch (error) {
      console.error('Error handling comment update:', error);
      socket.emit('comment:error', 'Failed to handle comment update');
    }
  });

  socket.on('comment:delete', async (data) => {
    try {
      const { postId, commentId } = data;
      io.to(`post:${postId}:comments`).emit('comment:deleted', {
        postId,
        commentId
      });
      
      // Update counts
      socket.emit('comment:getCount', postId);
    } catch (error) {
      console.error('Error handling comment deletion:', error);
      socket.emit('comment:error', 'Failed to handle comment deletion');
    }
  });

  // Like events
  socket.on('comment:like', async (data) => {
    try {
      const { postId, commentId, userId } = data;
      io.to(`post:${postId}:comments`).emit('comment:liked', {
        postId,
        commentId,
        userId
      });
    } catch (error) {
      console.error('Error handling comment like:', error);
      socket.emit('comment:error', 'Failed to handle comment like');
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected from comment handlers');
  });
};

module.exports = commentHandlers;