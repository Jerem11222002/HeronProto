const express = require("express");
const router = express.Router();
const Comment = require("../models/comment");
const Post = require("../models/posts");
const Notification = require("../models/notification");
const authenticateToken = require("../Middleware/authenticateToken");

// Helper: build a full nested comment tree for a post
async function buildCommentsTree(postId) {
  // fetch all non-deleted comments for the post, oldest first so tree ordering is stable
  const all = await Comment.find({ postId, isDeleted: false }).sort({ createdAt: 1 }).lean();

  // map by id and normalize replyTo to string
  const map = {};
  all.forEach(c => {
    const id = String(c._id);
    c._id = id;
    if (c.replyTo) c.replyTo = String(c.replyTo);
    c.replies = [];
    map[id] = c;
  });

  // attach children to parents
  const roots = [];
  for (const id in map) {
    const node = map[id];
    if (node.replyTo && map[node.replyTo]) {
      map[node.replyTo].replies.push(node);
    } else {
      // top-level (or orphan)
      roots.push(node);
    }
  }

  // compute repliesCount recursively
  const computeRepliesCount = (node) => {
    if (!node.replies || node.replies.length === 0) {
      node.repliesCount = 0;
      return 0;
    }
    let total = node.replies.length;
    node.replies.forEach(r => {
      total += computeRepliesCount(r);
    });
    node.repliesCount = total;
    return total;
  };
  roots.forEach(r => computeRepliesCount(r));

  // sort roots newest first (frontend expects newest top-level first)
  roots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return roots;
}

// --- Compatibility: legacy GET /api/comments?postId=... returns nested tree ---
router.get("/", async (req, res) => {
  try {
    const postId = req.query.postId;
    if (!postId) return res.status(400).json({ error: "postId query parameter is required" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const tree = await buildCommentsTree(postId);
    return res.status(200).json(tree);
  } catch (err) {
    console.error("Compatibility GET /api/comments error:", err);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/comments  (body: { postId, body | text, replyTo? })
router.post("/", authenticateToken, async (req, res) => {
  try {
    const postId = req.body.postId;
    const text = (req.body.text || req.body.body || "").trim();
    const replyTo = req.body.replyTo || null;

    if (!postId) return res.status(400).json({ error: "postId is required" });
    if (!text) return res.status(400).json({ error: "Comment text is required" });
    if (text.length > 500) return res.status(400).json({ error: "Comment exceeds 500 characters." });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    let depth = 0;
    let parentUserId = null;
    if (replyTo) {
      const parentComment = await Comment.findById(replyTo);
      if (!parentComment) return res.status(404).json({ error: "Parent comment not found." });
      depth = parentComment.depth + 1;
      parentUserId = parentComment.userId;
    }

    const newComment = new Comment({
      postId,
      userId: req.user._id,
      name: req.user.name,
      profilePicture: req.user.profilePicture,
      text,
      replyTo,
      depth
    });

    const savedComment = await newComment.save();
    await Post.findByIdAndUpdate(postId, { $push: { comments: savedComment._id } });

    // notifications
    if (post.userId.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        userId: post.userId,
        senderId: req.user._id,
        type: 'comment',
        postId: post._id,
        commentId: savedComment._id,
        postImage: post.img,
        message: `commented: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        category: 'social'
      });
      const io = req.app.get('io');
      if (io) io.emit('notification:new', { userId: post.userId, notification });
    }

    if (replyTo && parentUserId && parentUserId.toString() !== req.user._id.toString()) {
      const replyNotification = await Notification.create({
        userId: parentUserId,
        senderId: req.user._id,
        type: 'reply',
        postId: post._id,
        commentId: savedComment._id,
        postImage: post.img,
        message: `replied to your comment: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        category: 'social'
      });
      const io = req.app.get('io');
      if (io) io.emit('notification:new', { userId: parentUserId, notification: replyNotification });
    }

    return res.status(201).json(savedComment);
  } catch (err) {
    console.error("Compatibility POST /api/comments error:", err);
    return res.status(500).json({ error: "Failed to post comment." });
  }
});

// Middleware to check if post exists
const checkPostExists = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    req.post = post;
    next();
  } catch (error) {
    res.status(500).json({ error: "Error checking post existence" });
  }
};

// Return full nested tree for a post (new API)
router.get("/posts/:postId/comments", checkPostExists, async (req, res) => {
  try {
    const tree = await buildCommentsTree(req.params.postId);
    res.status(200).json(tree);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments." });
  }
});

// Create comment (new API)
router.post("/posts/:postId/comments", authenticateToken, checkPostExists, async (req, res) => {
  try {
    const { text, replyTo } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text is required." });
    if (text.length > 500) return res.status(400).json({ error: "Comment exceeds 500 characters." });

    let depth = 0;
    let parentUserId = null;
    if (replyTo) {
      const parentComment = await Comment.findById(replyTo);
      if (!parentComment) return res.status(404).json({ error: "Parent comment not found." });
      depth = parentComment.depth + 1;
      parentUserId = parentComment.userId;
    }

    const newComment = new Comment({
      postId: req.params.postId,
      userId: req.user._id,
      name: req.user.name,
      profilePicture: req.user.profilePicture,
      text: text.trim(),
      replyTo,
      depth
    });

    const savedComment = await newComment.save();
    await Post.findByIdAndUpdate(req.params.postId, { $push: { comments: savedComment._id } });

    // notifications (same as above)
    if (req.post.userId.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        userId: req.post.userId,
        senderId: req.user._id,
        type: 'comment',
        postId: req.post._id,
        commentId: savedComment._id,
        postImage: req.post.img,
        message: `commented: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        category: 'social'
      });
      const io = req.app.get('io');
      if (io) io.emit('notification:new', { userId: req.post.userId, notification });
    }

    if (replyTo && parentUserId && parentUserId.toString() !== req.user._id.toString()) {
      const replyNotification = await Notification.create({
        userId: parentUserId,
        senderId: req.user._id,
        type: 'reply',
        postId: req.post._id,
        commentId: savedComment._id,
        postImage: req.post.img,
        message: `replied to your comment: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        category: 'social'
      });
      const io = req.app.get('io');
      if (io) io.emit('notification:new', { userId: parentUserId, notification: replyNotification });
    }

    // return saved comment document
    res.status(201).json(savedComment);
  } catch (error) {
    console.error("Error posting comment:", error);
    res.status(500).json({ error: "Failed to post comment." });
  }
});

// Like/Unlike a comment
router.post("/comments/:commentId/like", authenticateToken, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found." });

    const userId = String(req.user._id || req.user.id);
    const isLiked = (comment.likes || []).includes(userId);

    if (isLiked) {
      comment.likes = comment.likes.filter(id => id !== userId);
    } else {
      comment.likes = [...(comment.likes || []), userId];
    }

    comment.likeCount = comment.likes.length;
    await comment.save();
    return res.json(comment);
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ error: "Failed to toggle like." });
  }
});

// Recursive replies endpoint (unchanged)
async function getRepliesTree(parentId) {
  const replies = await Comment.find({ replyTo: parentId, isDeleted: false }).sort({ createdAt: 1 }).lean();
  for (let reply of replies) {
    reply.replies = await getRepliesTree(reply._id);
  }
  return replies;
}

router.get("/comments/:commentId/replies", async (req, res) => {
  try {
    const repliesTree = await getRepliesTree(req.params.commentId);
    res.json(repliesTree);
  } catch (error) {
    console.error("Error fetching replies recursively:", error);
    res.status(500).json({ error: "Failed to fetch replies." });
  }
});

// Update, patch, delete endpoints (unchanged)
router.patch("/comments/:commentId", authenticateToken, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found." });
    if (comment.userId.toString() !== req.user._id.toString()) return res.status(403).json({ error: "Not authorized to edit this comment." });
    if (!req.body.text?.trim()) return res.status(400).json({ error: "Comment text is required." });

    comment.text = req.body.text.trim();
    comment.edited = true;
    await comment.save();

    res.json(comment);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Failed to update comment." });
  }
});

router.delete("/comments/:commentId", authenticateToken, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found." });
    if (comment.userId.toString() !== req.user._id.toString()) return res.status(403).json({ error: "Not authorized to delete this comment." });

    comment.isDeleted = true;
    comment.text = "[deleted]";
    await comment.save();

    res.json({ message: "Comment deleted successfully." });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment." });
  }
});

module.exports = router;