const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose"); // Add this import
const Post = require("../models/posts");
const User = require("../models/users");
const authenticate = require("../Middleware/authenticateToken");
const path = require("path");
const fs = require("fs");
const Comment = require("../models/comment"); // Add this import
const Event = require("../models/event");
const Notification = require("../models/notification");
const { spawn } = require('child_process');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const { RecommendationService, ORGANIZATION_CATEGORIES } = require('../services/recommendations');
const featuredArtistsCache = require('../services/featuredArtistsCache');
const feedCache = require('../services/feedCache');



const router = express.Router();

function formatMediaUrl(req, url) {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  // already absolute
  if (/^https?:\/\//i.test(url)) return url;
  // allow cloudinary full urls or already-starting-with-uploads
  if (url.startsWith('/uploads/') || url.startsWith('/assets/') || url.startsWith('/default')) {
    return `${req.protocol}://${req.get('host')}${url}`;
  }
  // fallback: assume it's a path or filename in /uploads
  const filename = url.split(/[/\\]/).pop();
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

router.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

const inferTagsFromContent = (text) => {
  if (!text) return [];
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  return [...new Set(
    tokens
      .filter(word => !stopWords.has(word))
      .filter(word => word.length > 2)
  )].slice(0, 5);
};

const migrateOldPost = async (  post) => {
  if (!post.tags || post.tags.length === 0) {
    let inferredTags = [];
    
    // Infer tags from description
    if (post.desc) {
      inferredTags = inferTagsFromContent(post.desc);
    }
    
    // Add media type as a tag
    if (post.mediaType) {
      inferredTags.push(post.mediaType);
    }
    
    // Update post with inferred tags if any were found
    if (inferredTags.length > 0) {
      try {
        await Post.findByIdAndUpdate(post._id, {
          $set: { 
            tags: inferredTags,
            isAutoTagged: true // Flag to indicate automatic tagging
          }
        });
        console.log(`Updated old post ${post._id} with tags:`, inferredTags);
      } catch (error) {
        console.error(`Failed to update tags for post ${post._id}:`, error);
      }
    }
    
    return inferredTags;
  }
  return post.tags;
};




// Constants
const VALID_GENDERS = ['male', 'female', 'prefer-not-to-say'];
const DEFAULT_GENDER = 'prefer-not-to-say';
const DEFAULT_AVATARS = {
  male: '/assets/person/Male.jpg',
  female: '/assets/person/Female.jpg',
  'prefer-not-to-say': '/assets/person/Default.jpg'
};

const ALLOWED_FILE_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/avif"],
  video: ["video/mp4", "video/quicktime", "video/x-msvideo"]
};





const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024 // Increased to 100MB for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [...ALLOWED_FILE_TYPES.image, ...ALLOWED_FILE_TYPES.video];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Supported formats: ${allowedTypes.join(', ')}`), false);
    }
    cb(null, true);
  },
}).array('media', 10); // Changed from .single('media') to .array('media', 10) to allow up to 10 files

const uploadMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          // Multer error (e.g. file too large)
          reject({ status: 400, message: err.message });
        } else {
          // Unknown error
          reject({ status: 500, message: err.message });
        }
      }
      resolve();
    });
  });
};






// Add after other helper functions



const getEventStatusBadge = (event) => {
  const now = new Date();
  const eventDate = new Date(event.date);
  const daysUntil = (eventDate - now) / (1000 * 60 * 60 * 24);

  if (event.status === 'cancelled') return null;
  
  switch (event.status) {
    case 'ongoing':
      return { 
        type: 'ongoing', 
        label: 'Happening Now!',
        color: 'green'
      };
    case 'upcoming':
      if (daysUntil <= 1) return { 
        type: 'urgent', 
        label: 'Starting Soon!',
        color: 'orange'
      };
      if (daysUntil <= 3) return { 
        type: 'near', 
        label: `In ${Math.ceil(daysUntil)} Days`,
        color: 'blue'
      };
      return { 
        type: 'upcoming', 
        label: 'Upcoming',
        color: 'purple'
      };
    case 'completed':
      return { 
        type: 'completed', 
        label: 'Event Ended',
        color: 'gray'
      };
    default:
      return null;
  }
};

const sortContent = (content, sortBy) => {
  switch (sortBy) {
    case 'recent':
      return content.sort((a, b) => 
        new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
      );
    case 'relevance':
      return content.sort((a, b) => b.finalScore - a.finalScore);
    case 'hybrid':
    default:
      return content.sort((a, b) => {
        const typeWeight = a.type === 'event' ? 1.2 : 1; // Boost events slightly
        return (b.finalScore * typeWeight) - (a.finalScore * typeWeight);
      });
  }
};

// Get all posts
router.get("/", authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Get basic post listing with pagination
    const posts = await Post.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
    .populate('userId', 'name profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    const formattedPosts = posts.map(post => ({
      _id: post._id.toString(),
      userId: post.userId?._id?.toString(),
      name: post.userId?.name,
      desc: post.desc,
      img: post.img ? `/uploads/${path.basename(post.img)}` : null,
      media: post.media ? `/uploads/${path.basename(post.media)}` : null,
      mediaType: post.mediaType,
      // Include mediaArray for carousel support
      mediaArray: Array.isArray(post.mediaArray) && post.mediaArray.length > 0
        ? post.mediaArray.map(mediaItem => ({
            url: `/uploads/${path.basename(mediaItem.url)}`,
            type: mediaItem.type,
            size: mediaItem.size || 0,
            duration: mediaItem.duration || 0,
            thumbnail: mediaItem.thumbnail ? `/uploads/${path.basename(mediaItem.thumbnail)}` : null
          }))
        : [],
      profilePic: post.userId?.profilePicture,
      likes: Array.isArray(post.likes) ? post.likes.map(id => id.toString()) : [],
      tags: Array.isArray(post.tags) ? post.tags : [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }));

    res.json(formattedPosts);

  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});


// Add the analyze-content endpoint
router.post("/analyze-content", authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: "No text provided" });
    }

    // Simple keyword extraction
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    const keywords = tokens
      .filter(word => !stopWords.has(word))
      .filter(word => word.length > 2);

    // Get unique keywords and limit to top 5
    const uniqueKeywords = [...new Set(keywords)].slice(0, 5);

    res.json({ 
      tags: uniqueKeywords,
      keywordCount: keywords.length
    });
  } catch (error) {
    console.error("Error analyzing content:", error);
    res.status(500).json({ message: "Failed to analyze content" });
  }
});

// Update the view tracking route
// ...existing code...

// Update the view tracking route
router.post("/:id/view", authenticate, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    console.log('📊 Processing view:', {
      postId,
      userId,
      timestamp: new Date().toISOString()
    });

    // Validate post ID
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format'
      });
    }

    // Find post and user in parallel
    const [post, user] = await Promise.all([
      Post.findById(postId),
      User.findById(userId).select('contentPreferences implicitPreferences')
    ]);

    // Validate post exists
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Initialize metrics if needed
    post.engagementMetrics = post.engagementMetrics || {
      views: 0,
      shares: 0,
      commentCount: 0,
      popularity: 0,
      recency: 1
    };

    // Initialize user preferences if needed
    user.contentPreferences = user.contentPreferences || {
      viewedPosts: [],
      likedPosts: [],
      sharedPosts: []
    };

    // Check if already viewed
    const alreadyViewed = user.contentPreferences.viewedPosts.includes(postId);
    if (alreadyViewed) {
      return res.json({
        success: true,
        message: 'Post already viewed',
        views: post.engagementMetrics.views,
        alreadyViewed: true
      });
    }

    // Update view count and save
    post.engagementMetrics.views++;
    post.markModified('engagementMetrics');

    // Update user preferences
    await Promise.all([
      // Add to viewed content
      User.findByIdAndUpdate(userId, {
        $addToSet: {
          'contentPreferences.viewedPosts': postId
        }
      }),
      // Update implicit preferences
      user.updateImplicitPreferences(post, 'view', 0.5),
      // Save post changes
      post.save()
    ]);

    // Emit real-time update
    req.io?.emit(`post:${postId}:viewed`, {
      postId,
      userId,
      views: post.engagementMetrics.views,
      engagementMetrics: post.engagementMetrics
    });

    console.log('✅ View tracked successfully:', {
      postId,
      userId,
      newViewCount: post.engagementMetrics.views
    });

    return res.json({
      success: true,
      message: 'View tracked successfully',
      views: post.engagementMetrics.views,
      engagementMetrics: post.engagementMetrics
    });

  } catch (error) {
    console.error('❌ View tracking error:', {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
      userId: req.user?._id
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to track view',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



// Debug route to verify data directly from MongoDB
router.get("/debug/:userId", authenticate, async (req, res) => {
  try {
    const userId = req.params.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Direct MongoDB query
    const db = mongoose.connection.db;
    const rawPosts = await db.collection('posts').find({ 
      userId: userObjectId 
    }).toArray();

    res.json({
      rawPostsCount: rawPosts.length,
      samplePost: rawPosts[0],
      userIdType: typeof userId,
      objectIdValue: userObjectId.toString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to determine media type
function determineMediaType(fileName) {
  if (!fileName) return null;
  const ext = path.extname(fileName).toLowerCase();
  const videoExts = ['.mp4', '.mov', '.avi'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.avif', '.webp'];
  
  if (videoExts.includes(ext)) return 'video';
  if (imageExts.includes(ext)) return 'image';
  return null;
}

// Create post
router.post("/", authenticate, async (req, res) => {
  try {
    // Handle file upload
    await uploadMiddleware(req, res);

    const { desc, tags } = req.body;
    
    console.log('Creating post:', {
      desc,
      files: req.files,
      tags
    });

    if (!desc && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: "Post must contain text or media" });
    }

    const user = await User.findById(req.user._id)
      .select("name profilePicture gender");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Process multiple files
    const mediaArray = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const mediaType = file.mimetype.startsWith("video/") ? "video" : "image";
        mediaArray.push({
          url: `/uploads/${file.filename}`,
          type: mediaType,
          size: file.size
        });
      });
    }

    const newPost = new Post({
      userId: user._id,
      name: user.name,
      desc,
      profilePic: user.profilePicture,
      media: mediaArray.length > 0 ? mediaArray[0].url : null, // Keep first media as primary for backward compatibility
      mediaArray: mediaArray.length > 0 ? mediaArray : [], // New field for multiple media
      mediaCount: mediaArray.length,
      mediaType: mediaArray.length > 0 ? mediaArray[0].type : null,
      tags: tags ? JSON.parse(tags) : []
    });

    // If it has videos, initialize videoMetadata
    if (mediaArray.some(m => m.type === "video")) {
      newPost.videoMetadata = {
        duration: 0,
        thumbnail: null,
        quality: "original",
        size: mediaArray.reduce((sum, m) => sum + m.size, 0)
      };
    }

    console.log('New post data:', newPost);

    const savedPost = await newPost.save();
    
    // Format the response
    const formattedPost = {
      ...savedPost.toObject(),
      img: savedPost.media // Add img field for backward compatibility
    };

    // INVALIDATE CACHE: Featured artists rankings change when new post is created
    featuredArtistsCache.invalidateOnNewPost();
    
    // INVALIDATE CACHE: Feed recommendations change when new post is created
    feedCache.invalidateAll();

    req.io.emit('post:created', formattedPost);
    res.status(201).json(formattedPost);

  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ 
      message: "Failed to create post",
      error: error.message
    });
  }
});

// Like/unlike post
// Update the like route
router.put("/:id/like", authenticate, async (req, res) => {
  try {
    // Parallel fetch of post and user with needed fields
    const [post, user] = await Promise.all([
      Post.findById(req.params.id),
      User.findById(req.user._id)
        .select('contentPreferences implicitPreferences')
    ]);

    if (!post || !user) {
      return res.status(404).json({ 
        message: !post ? "Post not found" : "User not found" 
      });
    }

    // Initialize required objects
    post.likes = post.likes || [];
    post.engagementMetrics = post.engagementMetrics || {
      views: 0,
      shares: 0,
      commentCount: 0,
      popularity: 0,
      recency: 1
    };
    user.contentPreferences = user.contentPreferences || {
      likedPosts: [],
      viewedPosts: [],
      sharedPosts: []
    };

    const userId = user._id;
    const isLiked = post.likes.some(id => id.equals(userId));

    // Handle unlike
    if (isLiked) {
      // Remove like from post
      post.likes = post.likes.filter(id => !id.equals(userId));
      post.engagementMetrics.popularity = Math.max(0, (post.engagementMetrics.popularity || 0) - 1);
      
      // Update user preferences
      await Promise.all([
        User.findByIdAndUpdate(userId, {
          $pull: {
            'contentPreferences.likedPosts': post._id
          }
        }),
        post.tags?.length > 0 ? 
          user.updateImplicitPreferences(post, 'unlike', -1) : 
          Promise.resolve()
      ]);
    } 
    // Handle like
    else {
      // Add like to post
      post.likes.push(userId);
      post.engagementMetrics.popularity = (post.engagementMetrics.popularity || 0) + 1;
      
      // Update user preferences
      await Promise.all([
        User.findByIdAndUpdate(userId, {
          $addToSet: {
            'contentPreferences.likedPosts': post._id
          }
        }),
        post.tags?.length > 0 ? 
          user.updateImplicitPreferences(post, 'like', 2) : 
          Promise.resolve()
      ]);

      // Create notification if not self-like
      if (!post.userId.equals(userId)) {
        try {
          const notification = await Notification.create({
            userId: post.userId,
            senderId: userId,
            type: 'like',
            postId: post._id,
            postImage: post.img || post.media,
            message: `liked your post`,
            createdAt: new Date()
          });

          req.io?.emit('notification:new', {
            userId: post.userId,
            notification: {
              ...notification.toObject(),
              isRead: false
            }
          });
        } catch (error) {
          console.error('Failed to create notification:', error);
        }
      }
    }

    // Mark modified fields and save post
    post.markModified('likes');
    post.markModified('engagementMetrics');
    await post.save();

    // Emit real-time update
    req.io?.emit(`post:${post._id}:liked`, {
      postId: post._id,
      userId: userId.toString(),
      likes: post.likes.map(id => id.toString()),
      likesCount: post.likes.length,
      engagementScore: post.engagementMetrics.popularity / Math.max(post.engagementMetrics.views || 1, 1),
      engagementMetrics: post.engagementMetrics
    });

    // Return updated data matching frontend expectations
    res.json({ 
      success: true,
      liked: !isLiked,
      likesCount: post.likes.length,
      engagementMetrics: post.engagementMetrics
    });

  } catch (error) {
    console.error("Error updating like:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
      userId: req.user?._id
    });
    
    res.status(500).json({ 
      message: "Failed to update like",
      error: error.message 
    });
  }
});

// Update post (description and tags only)
router.patch("/:id", authenticate, async (req, res) => {
  try {
    const { desc, tags } = req.body;
    const postId = req.params.id;

    // Validate input
    if (!desc || desc.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Description cannot be empty" 
      });
    }

    if (desc.length > 2000) {
      return res.status(400).json({ 
        success: false,
        message: "Description cannot exceed 2000 characters" 
      });
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: "Post not found" 
      });
    }

    // Check authorization - only post owner can edit
    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized to edit this post" 
      });
    }

    // Update description
    post.desc = desc.trim();

    // Update tags if provided
    if (Array.isArray(tags) && tags.length > 0) {
      // Validate and sanitize tags
      const validTags = tags
        .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim())
        .slice(0, 10); // Max 10 tags
      
      post.tags = validTags;
    } else if (tags && !Array.isArray(tags)) {
      return res.status(400).json({ 
        success: false,
        message: "Tags must be an array" 
      });
    }

    // Save the updated post
    await post.save();

    // Emit real-time update via socket
    req.io?.emit(`post:${post._id}:updated`, {
      postId: post._id,
      desc: post.desc,
      tags: post.tags,
      updatedAt: post.updatedAt
    });

    res.json({ 
      success: true,
      message: "Post updated successfully",
      post: {
        _id: post._id,
        desc: post.desc,
        tags: post.tags,
        updatedAt: post.updatedAt
      }
    });

  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update post",
      error: error.message 
    });
  }
});

// Delete post
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (post.img) {
      const mediaPath = path.join(__dirname, "../uploads", path.basename(post.img));
      if (fs.existsSync(mediaPath)) {
        fs.unlinkSync(mediaPath);
      }
    }

    await post.deleteOne();
    
    // INVALIDATE CACHE: Featured artists rankings change when post is deleted
    featuredArtistsCache.invalidateOnDelete();
    
    // INVALIDATE CACHE: Feed recommendations change when post is deleted
    feedCache.invalidateAll();
    
    req.io.emit('post:deleted', { 
      postId: post._id,
      mediaType: post.mediaType 
    });
    res.json({ success: true, message: "Post deleted" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

router.get("/:id/comments/count", authenticate, async (req, res) => {
  try {
    const postId = req.params.id;
    console.log("Fetching comment count for post:", postId);

    const count = await Comment.countDocuments({ postId });
    
    console.log(`Found ${count} comments for post ${postId}`);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching comment count:", error);
    res.status(500).json({ 
      message: "Failed to fetch comment count",
      error: error.message 
    });
  }
});


// ...existing code...

// ...existing code...

router.get("/feed", authenticate, async (req, res) => {
  try {
    const { 
      sortBy = 'hybrid',
      page = 1, 
      limit = 30,  // Reduced from 50 for faster initial load
      includeEvents = true,
      feedType = 'my-feed',  // NEW: 'my-feed' | 'friends' | 'following'
      maxPostsPerUser = 3  // NEW: limit posts from single user to avoid bias
    } = req.query;

    console.info(`[/feed] Request: feedType=${feedType}, page=${page}, limit=${limit}, user=${req.user._id}`);

    // Check cache first (CACHE HIT - instant response)
    const cachedFeed = feedCache.get(req.user._id, feedType, page);
    if (cachedFeed) {
      return res.json(cachedFeed.data);
    }

    if (!RecommendationService?.getHybridFeed) {
      throw new Error('Recommendation service not properly initialized');
    }

    // Fetch user with relationship data
    const user = await User.findById(req.user._id)
      .select('interests implicitPreferences following followers friends organizations interestsSelected interestsSkipped contentPreferences')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Route to appropriate feed method based on feedType
    let feed;
    console.info(`[/feed] Calling RecommendationService for feedType=${feedType}`);
    switch (feedType) {
      case 'friends':
        console.info(`[/feed] Routing to getFriendsFeed`);
        feed = await RecommendationService.getFriendsFeed(user, {
          page: parseInt(page),
          limit: parseInt(limit),
          maxPostsPerUser: parseInt(maxPostsPerUser)
        });
        console.info(`[/feed] getFriendsFeed returned ${feed.items.length} items`);
        break;

      case 'following':
        console.info(`[/feed] Routing to getFollowingFeed`);
        feed = await RecommendationService.getFollowingFeed(user, {
          page: parseInt(page),
          limit: parseInt(limit),
          maxPostsPerUser: parseInt(maxPostsPerUser)
        });
        console.info(`[/feed] getFollowingFeed returned ${feed.items.length} items`);
        break;

      case 'my-feed':
      default:
        console.info(`[/feed] Routing to getMyFeed`);
        feed = await RecommendationService.getMyFeed(user, {
          sortBy,
          page: parseInt(page),
          limit: parseInt(limit),
          maxPostsPerUser: parseInt(maxPostsPerUser),
          timeRange: req.query.timeRange || 'all',
          eventRatio: includeEvents ? 0.3 : 0
        });
        console.info(`[/feed] getMyFeed returned ${feed.items.length} items`);
        break;
    }

    // Validate feed response
    if (!feed || !Array.isArray(feed.items)) {
      console.error('[/feed] Invalid feed response:', {
        feedType,
        feedExists: !!feed,
        itemsIsArray: Array.isArray(feed?.items),
        itemsCount: feed?.items?.length
      });
      throw new Error('Invalid feed response structure');
    }

    console.info(`[/feed] Feed response validated: ${feed.items.length} items, totalCount: ${feed.pagination?.totalCount}`);

    if (!feed || !Array.isArray(feed.items)) {
      throw new Error('Invalid feed response structure');
    }

    // Get all unique user IDs from posts
    const userIds = [...new Set(feed.items
      .filter(item => item.type !== 'event')
      .map(item => item.userId)
      .filter(Boolean))];

    console.info(`[/feed] Fetching user data for ${userIds.length} unique users`);

    // Fetch all users data in one query
    const users = await User.find({ 
      _id: { $in: userIds }
    })
    .select('name profilePic gender profilePicture')
    .lean();

    console.info(`[/feed] Found ${users.length} users in database`);

    // Create users lookup map
    const usersMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user;
      return acc;
    }, {});

    // --- RECURSIVE SHARED POST POPULATION LOGIC ---
    // Helper to collect all nested sharedPost IDs
    function collectAllSharedPostIds(items, postsMap = {}) {
      const ids = new Set();
      const stack = [];

      items.forEach(item => {
        if (item.sharedPost) stack.push(item.sharedPost);
      });

      while (stack.length) {
        const id = typeof stack[stack.length - 1] === 'object'
          ? stack.pop().toString()
          : stack.pop();
        if (!ids.has(id)) {
          ids.add(id);
          const post = postsMap[id];
          if (post && post.sharedPost) stack.push(post.sharedPost);
        }
      }
      return Array.from(ids);
    }

    // First, collect direct sharedPost IDs
    let sharedPostIds = feed.items
      .filter(item => item.sharedPost)
      .map(item => {
        if (typeof item.sharedPost === 'object' && item.sharedPost._id) {
          return item.sharedPost._id.toString();
        }
        return item.sharedPost.toString();
      });

    // Fetch all shared posts (first level)
    let sharedPostsMap = {};
    let sharedUsersMap = {};
    if (sharedPostIds.length > 0) {
      let allSharedPosts = await Post.find({ _id: { $in: sharedPostIds } }).lean();
      sharedPostsMap = allSharedPosts.reduce((acc, post) => {
        acc[post._id.toString()] = post;
        return acc;
      }, {});

      // Recursively collect all nested sharedPost IDs
      let nestedIds = collectAllSharedPostIds(allSharedPosts, sharedPostsMap);
      // Remove already fetched IDs
      nestedIds = nestedIds.filter(id => !sharedPostsMap[id]);
      if (nestedIds.length > 0) {
        const nestedPosts = await Post.find({ _id: { $in: nestedIds } }).lean();
        nestedPosts.forEach(post => {
          sharedPostsMap[post._id.toString()] = post;
        });
      }

      // Now collect all userIds from all shared posts
      const allSharedUserIds = Object.values(sharedPostsMap)
        .map(p => p.userId?.toString())
        .filter(Boolean);
      if (allSharedUserIds.length > 0) {
        const sharedUsers = await User.find({ _id: { $in: allSharedUserIds } })
          .select('name profilePic gender profilePicture')
          .lean();
        sharedUsersMap = sharedUsers.reduce((acc, user) => {
          acc[user._id.toString()] = user;
          return acc;
        }, {});
      }
    }
    // --- END RECURSIVE SHARED POST POPULATION LOGIC ---

    const formattedFeed = feed.items.map(item => {
      if (item.type === 'event') {
        return {
          ...item,
          badge: getEventStatusBadge(item),
          image: item.image ? formatMediaUrl(req, item.image) : null,
          organization: {
            name: item.organization,
            ...ORGANIZATION_CATEGORIES[item.organization]
          }
        };
      }

      const userId = item.userId?.toString();
      const userData = usersMap[userId] || {};

      console.debug(`[/feed] Processing post ${item._id} from user ${userId}, userData:`, !!userData.name);

      // Get profile picture with fallbacks
      const profilePic = formatMediaUrl(
        req,
        userData.profilePic || 
        userData.profilePicture || 
        item.user?.profilePic || 
        item.profilePic
      );

      // Attach sharedPost object if present, with original poster info
      let sharedPostObj = null;
      if (item.sharedPost) {
        // Recursively get the deepest/original post for nested shares
        const sharedId = (typeof item.sharedPost === 'object' && (item.sharedPost._id || item.sharedPost.id))
          ? String(item.sharedPost._id || item.sharedPost.id)
          : String(item.sharedPost);
        let original = sharedPostsMap[sharedId] || null;
        while (original && original.sharedPost) {
          const nestedId = (typeof original.sharedPost === 'object' && (original.sharedPost._id || original.sharedPost.id))
            ? String(original.sharedPost._id || original.sharedPost.id)
            : String(original.sharedPost);
          if (!sharedPostsMap[nestedId]) break;
          original = sharedPostsMap[nestedId];
        }
        if (original) {
          const originalUser = sharedUsersMap[original.userId?.toString()] || {};
          // Defensive: check all possible fields for legacy posts
          const origRawMedia = original.media || original.img || original.image || null;
          sharedPostObj = {
            ...original,
            img: formatMediaUrl(req, original.img || original.media || original.image),
            media: formatMediaUrl(req, original.media || original.img || original.image),
            mediaType: original.mediaType || (origRawMedia && /\.(mp4|mov|webm|avi|mkv)$/i.test(origRawMedia) ? 'video' : 'image'),
            profilePic: formatMediaUrl(req, original.profilePic || originalUser.profilePic || originalUser.profilePicture),
            user: {
              _id: originalUser?._id?.toString() || '',
              name: originalUser?.name || original.name || '',
              profilePic: formatMediaUrl(req, originalUser?.profilePic || originalUser?.profilePicture),
              sex: originalUser?.gender || 'male'
            }
          };
        }
      }

      // Always include the sharing user data for all posts
      return {
        ...item,
        img: formatMediaUrl(req, item.img || item.media || item.image),
        media: formatMediaUrl(req, item.media || item.img || item.image),
        // Include mediaArray for carousel support
        mediaArray: Array.isArray(item.mediaArray) && item.mediaArray.length > 0
          ? item.mediaArray.map(mediaItem => ({
              url: formatMediaUrl(req, mediaItem.url),
              type: mediaItem.type,
              size: mediaItem.size || 0,
              duration: mediaItem.duration || 0,
              thumbnail: mediaItem.thumbnail ? formatMediaUrl(req, mediaItem.thumbnail) : null
            }))
          : [],
        // Add fallback for legacy posts with only 'image' field
        // If all are missing, both will be null
        user: {
          _id: userId,
          name: userData.name || item.user?.name || item.name,
          profilePic: profilePic,
          sex: userData.gender || item.user?.gender || 'male'
        },
        profilePic: profilePic,
        userId: userId,
        name: userData.name || item.user?.name || item.name,
        likes: Array.isArray(item.likes) ? item.likes.map(id => id.toString()) : [],
        fromFollowing: Boolean(item.fromFollowing),
        engagementMetrics: item.engagementMetrics || {
          views: 0,
          shares: 0,
          commentCount: 0,
          popularity: 0,
          recency: 1
        },
        sharedPost: sharedPostObj // <-- This ensures the full shared post object is attached
      };
    });

    res.json({
      feedType: feedType,
      items: formattedFeed,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount: feed.pagination?.totalCount || feed.total || formattedFeed.length,
        hasMore: feed.pagination?.hasMore !== undefined ? feed.pagination.hasMore : feed.hasMore
      },
      debug: feedType === 'my-feed' ? {
        ...feed.debug,
        usersFound: users.length,
        usersFetched: Object.keys(usersMap).length
      } : undefined
    });

    // Store in cache for next 2 minutes (CACHE STORAGE)
    const feedResponse = {
      feedType: feedType,
      items: formattedFeed,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount: feed.pagination?.totalCount || feed.total || formattedFeed.length,
        hasMore: feed.pagination?.hasMore !== undefined ? feed.pagination.hasMore : feed.hasMore
      },
      debug: feedType === 'my-feed' ? {
        ...feed.debug,
        usersFound: users.length,
        usersFetched: Object.keys(usersMap).length
      } : undefined
    };
    feedCache.set(req.user._id, feedType, page, feedResponse);

    console.info(`[/feed] Response sent: feedType=${feedType}, items=${formattedFeed.length}, totalCount=${feed.pagination?.totalCount}`);

  } catch (error) {
    console.error('❌ Feed error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?._id
    });
    res.status(500).json({ 
      message: "Failed to fetch feed content",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ...existing code...

router.post("/generate-thumbnail", authenticate, async (req, res) => {
  try {
    const { videoPath } = req.body;
    if (!videoPath) {
      return res.status(400).json({ message: "Video path is required" });
    }

    const fullPath = path.join(__dirname, "../uploads", path.basename(videoPath));
    const thumbnailPath = fullPath.replace(/\.[^/.]+$/, "_thumb.jpg");

    // Using ffmpeg to generate thumbnail
    const ffmpeg = spawn('ffmpeg', [
      '-i', fullPath,
      '-ss', '00:00:01',
      '-frames:v', '1',
      thumbnailPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        res.json({ 
          success: true, 
          thumbnail: `/uploads/${path.basename(thumbnailPath)}` 
        });
      } else {
        res.status(500).json({ message: "Failed to generate thumbnail" });
      }
    });

  } catch (error) {
    console.error("Error generating thumbnail:", error);
    res.status(500).json({ message: "Failed to generate thumbnail" });
  }
});



// Add after existing routes
router.get("/recommendations/test", authenticate, async (req, res) => {
  try {
    const { 
      filterType = 'all',
      sampleSize = 5,
      status,
      organization
    } = req.query;

    const user = await User.findById(req.user._id)
      .select('interests implicitPreferences following organizations')
      .lean();

    const results = await RecommendationService.testRecommendations(
      req.user._id,
      filterType,
      parseInt(sampleSize)
    );

    res.json({
      userProfile: {
        interestsCount: user.interests.length,
        hasImplicitPrefs: Boolean(user.implicitPreferences),
        topInterests: user.interests.slice(0, 5)
      },
      results,
      stats: {
        totalItems: results.length,
        averageScore: results.reduce((acc, item) => acc + item.scores.final, 0) / results.length,
        scoreDistribution: {
          high: results.filter(item => item.scores.final > 0.7).length,
          medium: results.filter(item => item.scores.final > 0.4 && item.scores.final <= 0.7).length,
          low: results.filter(item => item.scores.final <= 0.4).length
        }
      }
    });

  } catch (error) {
    console.error("Error testing recommendations:", error);
    res.status(500).json({ 
      message: "Failed to test recommendations",
      error: error.message 
    });
  }
});

router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    const userId = req.params.userId;

    // First, verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Query posts with both userId formats
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');

    const posts = await postsCollection.find({
      $or: [
        { userId: userId },
        { userId: userId.toString() },
        { userId: new mongoose.Types.ObjectId(userId) }
      ]
    }).toArray();

    // --- RECURSIVE SHARED POST POPULATION LOGIC (same as feed) ---
    // Helper to collect all nested sharedPost IDs
    function collectAllSharedPostIds(items, postsMap = {}) {
      const ids = new Set();
      const stack = [];

      items.forEach(item => {
        if (item.sharedPost) stack.push(item.sharedPost);
      });

      while (stack.length) {
        const id = typeof stack[stack.length - 1] === 'object'
          ? stack.pop().toString()
          : stack.pop();
        if (!ids.has(id)) {
          ids.add(id);
          const post = postsMap[id];
          if (post && post.sharedPost) stack.push(post.sharedPost);
        }
      }
      return Array.from(ids);
    }

    // Find all sharedPost IDs
    let sharedPostIds = posts
      .filter(post => post.sharedPost)
      .map(post => typeof post.sharedPost === 'object' ? post.sharedPost.toString() : post.sharedPost);

    // Fetch all shared posts (first level)
    let sharedPostsMap = {};
    let sharedUsersMap = {};
    if (sharedPostIds.length > 0) {
      let allSharedPosts = await Post.find({ _id: { $in: sharedPostIds } }).lean();
      sharedPostsMap = allSharedPosts.reduce((acc, post) => {
        acc[post._id.toString()] = post;
        return acc;
      }, {});

      // Recursively collect all nested sharedPost IDs
      let nestedIds = collectAllSharedPostIds(allSharedPosts, sharedPostsMap);
      // Remove already fetched IDs
      nestedIds = nestedIds.filter(id => !sharedPostsMap[id]);
      if (nestedIds.length > 0) {
        const nestedPosts = await Post.find({ _id: { $in: nestedIds } }).lean();
        nestedPosts.forEach(post => {
          sharedPostsMap[post._id.toString()] = post;
        });
      }

      // Now collect all userIds from all shared posts
      const allSharedUserIds = Object.values(sharedPostsMap)
        .map(p => p.userId?.toString())
        .filter(Boolean);
      if (allSharedUserIds.length > 0) {
        const sharedUsers = await User.find({ _id: { $in: allSharedUserIds } })
          .select('name profilePic gender profilePicture')
          .lean();
        sharedUsersMap = sharedUsers.reduce((acc, user) => {
          acc[user._id.toString()] = user;
          return acc;
        }, {});
      }
    }
    // --- END RECURSIVE SHARED POST POPULATION LOGIC ---

    // Format media URLs
    const formatMedia = (url) => {
      if (!url) return null;
      if (url.startsWith('http')) return url;
      if (url.startsWith('/uploads/')) return url;
      return `/uploads/${url}`;
    };

    // Format posts
    const formattedPosts = posts.map(post => {
      // Attach sharedPost object if present, with original poster info
      let sharedPostObj = null;
      if (post.sharedPost) {
        // Recursively get the deepest/original post for nested shares
        const sharedId = (typeof post.sharedPost === 'object' && (post.sharedPost._id || post.sharedPost.id))
          ? String(post.sharedPost._id || post.sharedPost.id)
          : String(post.sharedPost);
        let original = sharedPostsMap[sharedId] || null;
        while (original && original.sharedPost) {
          const nestedId = (typeof original.sharedPost === 'object' && (original.sharedPost._id || original.sharedPost.id))
            ? String(original.sharedPost._id || original.sharedPost.id)
            : String(original.sharedPost);
          if (!sharedPostsMap[nestedId]) break;
          original = sharedPostsMap[nestedId];
        }
        if (original) {
          const originalUser = sharedUsersMap[original.userId?.toString()] || {};
          sharedPostObj = {
            ...original,
            img: formatMedia(original.img || original.media),
            media: formatMedia(original.media || original.img),
            profilePic: formatMedia(original.profilePic || originalUser.profilePic || originalUser.profilePicture),
            user: {
              _id: originalUser?._id?.toString() || '',
              name: originalUser?.name || original.name || '',
              profilePic: formatMedia(originalUser?.profilePic || originalUser?.profilePicture),
              sex: originalUser?.gender || 'male'
            }
          };
        }
      }

      return {
        ...post,
        _id: post._id.toString(),
        userId: userId.toString(),
        name: post.name || user.name,
        desc: post.desc,
        img: formatMedia(post.img),
        media: formatMedia(post.media),
        profilePic: post.profilePic || user.profilePic || '/assets/person/noAvatar.png',
        likes: Array.isArray(post.likes) ? post.likes.map(id => id.toString()) : [],
        comments: Array.isArray(post.comments) ? post.comments : [],
        engagementMetrics: post.engagementMetrics || {},
        tags: post.tags || [],
        contentType: post.contentType || 'regular',
        visibility: post.visibility || 'public',
        sharedPost: sharedPostObj // Attach the full shared post object
      };
    });

    // Sort by date
    formattedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(formattedPosts);

  } catch (error) {
    console.error("❌ Error fetching user posts:", error);
    res.status(500).json({ 
      message: "Failed to fetch user posts",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ...existing code...

router.post("/:id/share", authenticate, async (req, res) => {
  try {
    const originalPostId = req.params.id;
    const { desc } = req.body;

    // Find the original post
    const originalPost = await Post.findById(originalPostId);
    if (!originalPost) {
      return res.status(404).json({ message: "Original post not found" });
    }

    // Get sharer info
    const user = await User.findById(req.user._id).select("name profilePicture gender");  
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only increment shares if NOT self-share
    if (originalPost.userId.toString() !== user._id.toString()) {
      originalPost.engagementMetrics = originalPost.engagementMetrics || {
        views: 0,
        shares: 0,
        commentCount: 0,
        popularity: 0,
        recency: 1
      };
      originalPost.engagementMetrics.shares = (originalPost.engagementMetrics.shares || 0) + 1;
      originalPost.shares = (originalPost.shares || 0) + 1;
      await originalPost.save();
    }

    // Use user caption if provided, otherwise use original post's desc
    const shareDesc = (desc && desc.trim()) ? desc : originalPost.desc;

    // Create the shared post
    const newPost = new Post({
      userId: user._id,
      name: user.name,
      desc: shareDesc,
      profilePic: user.profilePicture,
      sharedPost: originalPost._id, // not the whole object!
      media: null,
      mediaType: null,
      tags: [],
      isShared: true
    });

    const savedPost = await newPost.save();

    // --- Notify the original post's author if not sharing own post ---
    if (originalPost.userId.toString() !== user._id.toString()) {
      try {
        const notification = await Notification.create({
          userId: originalPost.userId,
          senderId: user._id,
          type: 'share',
          postId: originalPost._id,
          postImage: originalPost.img || originalPost.media,
          message: `${user.name} shared your post`,
          createdAt: new Date()
        });

        req.io?.emit('notification:new', {
          userId: originalPost.userId,
          notification: {
            ...notification.toObject(),
            isRead: false
          }
        });
      } catch (err) {
        console.error('Failed to create share notification:', err);
      }
    }

    // --- Populate the sharedPost field for the response ---
    const originalUser = await User.findById(originalPost.userId).select('name profilePic gender profilePicture');
    const formatMedia = (url) => {
      if (!url) return null;
      if (url.startsWith('http')) return url;
      if (url.startsWith('/uploads/')) return url;
      return `/uploads/${url}`;
    };

    const sharedPostObj = {
      ...originalPost.toObject(),
      img: formatMedia(originalPost.img || originalPost.media),
      media: formatMedia(originalPost.media || originalPost.img),
      profilePic: formatMedia(originalPost.profilePic || originalUser?.profilePic || originalUser?.profilePicture),
      user: {
        _id: originalUser?._id?.toString() || '',
        name: originalUser?.name || originalPost.name || '',
        profilePic: formatMedia(originalUser?.profilePic || originalUser?.profilePicture),
        sex: originalUser?.gender || 'male'
      }
    };

    const responsePost = {
      ...savedPost.toObject(),
      sharedPost: sharedPostObj
    };

    // INVALIDATE CACHE: Featured artists rankings change when post is shared
    featuredArtistsCache.invalidateOnShare();
    
    // INVALIDATE CACHE: Feed recommendations change when post is shared
    feedCache.invalidateAll();

    req.io?.emit('post:shared', responsePost);

    res.status(201).json(responsePost);
  } catch (error) {
    console.error("Error sharing post:", error);
    res.status(500).json({ message: "Failed to share post", error: error.message });
  }
});

// Generate/persist video thumbnail for a post
router.post('/:id/generate-thumbnail', authenticate, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // If thumbnail already exists return absolute URL
    if (post.videoMetadata?.thumbnailPath) {
      const url = `${req.protocol}://${req.get('host')}${post.videoMetadata.thumbnailPath}`;
      return res.json({ thumbnailUrl: url });
    }

    // Determine local video path
    const videoFilename = post.img || post.media;
    if (!videoFilename) return res.status(400).json({ message: 'No video source available' });

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const videoPath = videoFilename.startsWith('/') ? path.join(__dirname, '..', videoFilename) : path.join(uploadsDir, path.basename(videoFilename));

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ message: 'Video file not found on server' });
    }

    const thumbName = `thumb-${postId}-${Date.now()}.jpg`;
    const thumbPath = path.join(uploadsDir, thumbName);

    // Use ffmpeg to grab a frame at 1s (ensure ffmpeg present on server)
    const ff = spawn('ffmpeg', ['-y', '-ss', '00:00:01', '-i', videoPath, '-frames:v', '1', '-q:v', '2', thumbPath]);

    ff.on('error', (err) => {
      console.error('ffmpeg spawn error', err);
      return res.status(500).json({ message: 'Thumbnail generation error' });
    });

    ff.on('close', async (code) => {
      if (code !== 0 || !fs.existsSync(thumbPath)) {
        console.error('ffmpeg failed with code', code);
        return res.status(500).json({ message: 'Thumbnail generation failed' });
      }

      // Persist thumbnail path on post
      post.videoMetadata = post.videoMetadata || {};
      post.videoMetadata.thumbnailPath = `/uploads/${thumbName}`;
      await post.save();

      const url = `${req.protocol}://${req.get('host')}${post.videoMetadata.thumbnailPath}`;
      res.json({ thumbnailUrl: url });
    });
  } catch (err) {
    console.error('generate-thumbnail error:', err);
    res.status(500).json({ message: err.message || 'Failed to generate thumbnail' });
  }
});

// Replace the existing GET /:id handler with this improved version
router.get("/:id", authenticate, async (req, res) => {
  try {
    // populate sharedPost and its user to ensure frontend receives the full original post object
    const post = await Post.findById(req.params.id)
      .populate('userId', 'name profilePicture')
      .populate({
        path: 'sharedPost',
        populate: { path: 'userId', select: 'name profilePicture' }
      })
      .lean();

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // helper to build absolute media/profile urls
    const buildUrl = (val) => {
      if (!val) return null;
      if (typeof val !== 'string') return null;
      if (/^https?:\/\//i.test(val)) return val;
      if (val.startsWith('/')) return `${req.protocol}://${req.get('host')}${val}`;
      return `${req.protocol}://${req.get('host')}/uploads/${val.split(/[/\\]/).pop()}`;
    };

    // format main post
    const formattedPost = {
      _id: post._id.toString(),
      userId: post.userId?._id?.toString(),
      name: post.userId?.name || post.name,
      desc: post.desc,
      img: post.img ? buildUrl(post.img) : (post.media && post.mediaType === 'image' ? buildUrl(post.media) : null),
      media: post.media ? buildUrl(post.media) : null,
      mediaType: post.mediaType,
      // include mediaArray for carousel support in fullscreen view
      mediaArray: Array.isArray(post.mediaArray) && post.mediaArray.length > 0
        ? post.mediaArray.map(item => ({
            url: buildUrl(item.url),
            type: item.type,
            size: item.size || 0,
            duration: item.duration || 0,
            thumbnail: item.thumbnail ? buildUrl(item.thumbnail) : null
          }))
        : [],
      // prefer userId.profilePicture -> userId.profilePic -> post.profilePic
      profilePic: post.userId?.profilePicture ? buildUrl(post.userId.profilePicture)
                  : post.userId?.profilePic ? buildUrl(post.userId.profilePic)
                  : (post.profilePic ? buildUrl(post.profilePic) : null),
      // include normalized user object for frontend convenience
      user: {
        _id: post.userId?._id?.toString() || null,
        name: post.userId?.name || post.name || "",
        profilePic: post.userId?.profilePicture ? buildUrl(post.userId.profilePicture)
                    : post.userId?.profilePic ? buildUrl(post.userId.profilePic)
                    : (post.profilePic ? buildUrl(post.profilePic) : null)
      },
      likes: Array.isArray(post.likes) ? post.likes.map(id => id.toString()) : [],
      tags: Array.isArray(post.tags) ? post.tags : [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      comments: post.comments || [],
      engagementMetrics: post.engagementMetrics || {},
      shares: post.shares || 0
    };

    // if sharedPost is populated object, format it similarly and attach user info
    if (post.sharedPost && typeof post.sharedPost === 'object') {
      const sp = post.sharedPost;
      formattedPost.sharedPost = {
        _id: sp._id?.toString(),
        userId: sp.userId?._id?.toString(),
        name: sp.userId?.name || sp.name,
        desc: sp.desc,
        img: sp.img ? buildUrl(sp.img) : (sp.media && sp.mediaType === 'image' ? buildUrl(sp.media) : null),
        media: sp.media ? buildUrl(sp.media) : null,
        mediaType: sp.mediaType,
        // include mediaArray for shared post carousel support
        mediaArray: Array.isArray(sp.mediaArray) && sp.mediaArray.length > 0
          ? sp.mediaArray.map(item => ({
              url: buildUrl(item.url),
              type: item.type,
              size: item.size || 0,
              duration: item.duration || 0,
              thumbnail: item.thumbnail ? buildUrl(item.thumbnail) : null
            }))
          : [],
        // prefer user profilePicture -> user profilePic -> sp.profilePic
        profilePic: sp.userId?.profilePicture ? buildUrl(sp.userId.profilePicture)
                    : sp.userId?.profilePic ? buildUrl(sp.userId.profilePic)
                    : (sp.profilePic ? buildUrl(sp.profilePic) : null),
        // normalized user object for frontend
        user: {
          _id: sp.userId?._id?.toString() || '',
          name: sp.userId?.name || sp.name || '',
          profilePic: sp.userId?.profilePicture ? buildUrl(sp.userId.profilePicture)
                      : sp.userId?.profilePic ? buildUrl(sp.userId.profilePic)
                      : (sp.profilePic ? buildUrl(sp.profilePic) : null)
        },
        createdAt: sp.createdAt,
        likes: Array.isArray(sp.likes) ? sp.likes.map(id => id.toString()) : [],
        tags: Array.isArray(sp.tags) ? sp.tags : [],
      };
    } else {
      formattedPost.sharedPost = post.sharedPost || null;
    }

    res.json(formattedPost);
  } catch (error) {
    console.error("Failed to fetch post by id:", error);
    res.status(500).json({ message: "Failed to fetch post" });
  }
});



// TEMPORARY DEBUG: Test feed endpoints without authentication
router.get("/debug/test-feed/:feedType", async (req, res) => {
  try {
    const { feedType } = req.params;
    const page = req.query.page || 1;
    
    console.log(`[DEBUG] Testing ${feedType} feed`);
    
    // Get first user from database  
    const testUser = await User.findOne()
      .select('interests implicitPreferences following followers friends organizations interestsSelected interestsSkipped contentPreferences _id')
      .lean();
    
    if (!testUser) {
      return res.status(404).json({ error: 'No test user found' });
    }
    
    console.log(`[DEBUG] Using test user: ${testUser._id}`);
    
    let feed;
    switch (feedType) {
      case 'friends':
        console.log('[DEBUG] Calling getFriendsFeed');
        feed = await RecommendationService.getFriendsFeed(testUser, { page: parseInt(page), limit: 5 });
        break;
      case 'following':
        console.log('[DEBUG] Calling getFollowingFeed');
        feed = await RecommendationService.getFollowingFeed(testUser, { page: parseInt(page), limit: 5 });
        break;
      case 'my-feed':
        console.log('[DEBUG] Calling getMyFeed');
        feed = await RecommendationService.getMyFeed(testUser, { page: parseInt(page), limit: 5 });
        break;
      default:
        return res.status(400).json({ error: 'Unknown feedType' });
    }
    
    console.log(`[DEBUG] Feed returned ${feed.items.length} items`);
    
    res.json({
      status: 'success',
      feedType,
      itemsCount: feed.items.length,
      pagination: feed.pagination,
      testUserId: testUser._id,
      firstItemId: feed.items[0]?._id,
      debug: {
        following: testUser.following?.length || 0,
        followers: testUser.followers?.length || 0
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;