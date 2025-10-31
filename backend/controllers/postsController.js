const Post = require("../models/Post");
const User = require("../models/User");
const Event = require("../models/event"); // Add this
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Define organization categories for scoring
const ORGANIZATION_CATEGORIES = {
  'CAST': {
    primaryCategory: 'theatre',
    tags: ['drama', 'acting', 'stage-performance']
  },
  'CULTURA': {
    primaryCategory: 'cultural-arts',
    tags: ['dance', 'music']
  },
  'UMAK Jammers': {
    primaryCategory: 'music',
    tags: ['band', 'modern-music']
  },
  'UMAK Chorale': {
    primaryCategory: 'music',
    tags: ['choir', 'vocal-arts']
  },
  'UMAK Dance Extreme': {
    primaryCategory: 'dance',
    tags: ['modern-dance', 'choreography']
  },
  'UMAK Siglahi': {
    primaryCategory: 'dance',
    tags: ['folk-dance', 'traditional-arts']
  },
  'UMAK Brass Band': {
    primaryCategory: 'music',
    tags: ['instruments', 'band']
  }
};

// Update engagement score calculation to handle both posts and events
const calculateEngagementScore = (content) => {
  if (content.type === 'post') {
    const views = content.views || 0;
    const likes = content.likes?.length || 0;
    const comments = content.comments?.length || 0;
    const shares = content.shares || 0;
    return (views * 0.2) + (likes * 0.4) + (comments * 0.3) + (shares * 0.1);
  } else if (content.type === 'event') {
    const registrations = content.registrations?.length || 0;
    const views = content.views || 0;
    return (registrations * 0.6) + (views * 0.4);
  }
  return 0;
};

// Update recency score calculation
const calculateRecencyScore = (content) => {
  const now = new Date();
  const contentDate = new Date(content.createdAt || content.date);
  const hoursSinceContent = (now - contentDate) / (1000 * 60 * 60);
  return Math.exp(-hoursSinceContent / 168); // 168 hours = 1 week
};

// Add new helper function for interest-based scoring
const calculateInterestScore = (content, userInterests) => {
  let score = 0;
  
  // Score based on matching tags
  content.tags?.forEach(tag => {
    if (userInterests.includes(tag)) {
      score += 1;
    }
  });

  // Additional score for events from relevant organizations
  if (content.type === 'event') {
    const orgInfo = ORGANIZATION_CATEGORIES[content.organization];
    if (orgInfo && userInterests.includes(orgInfo.primaryCategory)) {
      score += 2; // Higher weight for matching organization category
    }
  }

  return score;
};

// Controller methods
const postController = {
  // Get all posts for feed with filtering
    // Update the getFeedPosts method
  getFeedPosts: async (req, res) => {
      try {
          const { userId, sortBy = 'hybrid', timeRange = 'all' } = req.query;
          console.log('Feed request:', { userId, sortBy, timeRange });
  
          const user = await User.findById(userId);
          if (!user) {
              return res.status(404).json({ message: "User not found" });
          }
  
          // Get user interests
          const userInterests = new Set([
              ...(user.interests || []),
              ...(await Post.find({ 'likes': userId }).distinct('tags'))
          ]);
  
          console.log('User interests:', Array.from(userInterests));
  
          // Build date filter for events
          const eventDateFilter = {
              status: { $in: ['upcoming', 'ongoing'] },
              date: { $gte: new Date() }
          };
  
          // Debug: Log event query
          console.log('Event query:', eventDateFilter);
  
          // Fetch both posts and events
          const [posts, events] = await Promise.all([
              Post.find()
                  .populate('userId', 'name profilePicture gender')
                  .sort({ createdAt: -1 })
                  .lean(),
              Event.find(eventDateFilter)
                  .populate('organizerId', 'name profilePicture')
                  .sort({ date: 1 })
                  .lean()
          ]);
  
          // Debug: Log fetched content
          console.log('Fetched content:', {
              postsCount: posts.length,
              eventsCount: events.length,
              sampleEvent: events[0]
          });
  
          // Combine and format content
          let combinedContent = [
              ...posts.map(post => ({
                  ...post,
                  type: 'post',
                  contentType: 'post'
              })),
              ...events.map(event => {
                  const orgInfo = ORGANIZATION_CATEGORIES[event.organization];
                  return {
                      ...event,
                      type: 'event',
                      contentType: 'event',
                      tags: [...(event.tags || []), ...(orgInfo?.tags || [])],
                      // Add required fields for consistency
                      img: event.media,
                      desc: event.description,
                      name: event.organizerId?.name || 'Unknown Organizer',
                      profilePic: event.organizerId?.profilePicture
                  };
              })
          ];
  
          // Debug: Log combined content
          console.log('Combined content:', {
              totalItems: combinedContent.length,
              posts: combinedContent.filter(item => item.type === 'post').length,
              events: combinedContent.filter(item => item.type === 'event').length
          });
  
          // Calculate scores
          combinedContent = combinedContent.map(item => ({
              ...item,
              engagementScore: calculateEngagementScore(item),
              recencyScore: calculateRecencyScore(item),
              interestScore: calculateInterestScore(item, Array.from(userInterests))
          }));
  
          // Apply sorting strategy
          switch (sortBy) {
              case 'recent':
                  combinedContent.sort((a, b) => 
                      new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
                  );
                  break;
              
              case 'trending':
                  combinedContent.sort((a, b) => b.engagementScore - a.engagementScore);
                  break;
              
              case 'hybrid':
              default:
                  combinedContent.sort((a, b) => {
                      const scoreA = (a.engagementScore * 0.4) + 
                                   (a.recencyScore * 0.3) + 
                                   (a.interestScore * 0.3);
                      const scoreB = (b.engagementScore * 0.4) + 
                                   (b.recencyScore * 0.3) + 
                                   (b.interestScore * 0.3);
                      return scoreB - scoreA;
                  });
          }
  
          // Debug: Log final sorted content
          console.log('Final content:', {
              totalItems: combinedContent.length,
              firstItem: combinedContent[0]?.type,
              lastItem: combinedContent[combinedContent.length - 1]?.type
          });
  
          res.status(200).json(combinedContent);
      } catch (error) {
          console.error('Error in getFeedPosts:', error);
          res.status(500).json({ 
              status: 'error',
              message: "Failed to fetch feed content",
              details: error.message 
          });
      }
  },


  // Create a new post
  createPost: async (req, res) => {
    try {
        const { desc, tags } = req.body;
        const media = req.file;

        if (!desc && !media) {
            return res.status(400).json({ 
                message: "Post must contain text or media" 
            });
        }

        // Determine media type and handle video processing
        let mediaType = null;
        let videoMetadata = null;
        let mediaPath = null;

        if (media) {
            mediaType = media.mimetype.startsWith('video/') ? 'video' : 'image';
            mediaPath = `/uploads/${media.filename}`;

            if (mediaType === 'video') {
                try {
                    const metadata = await new Promise((resolve, reject) => {
                        ffmpeg.ffprobe(media.path, (err, metadata) => {
                            if (err) reject(err);
                            else resolve(metadata);
                        });
                    });

                    // Generate thumbnail
                    const thumbnailName = `${path.parse(media.filename).name}_thumb.jpg`;
                    const thumbnailPath = path.join('uploads', thumbnailName);
                    
                    await new Promise((resolve, reject) => {
                        ffmpeg(media.path)
                            .screenshots({
                                timestamps: ['1%'],
                                filename: thumbnailName,
                                folder: 'uploads',
                                size: '320x240'
                            })
                            .on('end', resolve)
                            .on('error', reject);
                    });

                    videoMetadata = {
                        duration: metadata.format.duration,
                        thumbnail: `/uploads/${thumbnailName}`,
                        quality: `${metadata.streams[0].height}p`,
                        size: media.size
                    };
                } catch (error) {
                    console.error('Video processing error:', error);
                    return res.status(500).json({
                        message: "Failed to process video"
                    });
                }
            }
        }

        const newPost = new Post({
            userId: req.user.id,
            desc,
            media: mediaPath,
            mediaType,
            videoMetadata,
            tags: tags ? JSON.parse(tags) : [],
            engagementMetrics: {
                views: 0,
                shares: 0,
                popularity: 0,
                recency: 1
            }
        });

        const savedPost = await newPost.save();
        const populatedPost = await Post.findById(savedPost._id)
            .populate('userId', 'name profilePicture gender');

        // Emit realtime update
        req.io.emit('post:created', populatedPost);

        res.status(201).json(populatedPost);
    } catch (error) {
        console.error('Error in createPost:', error);
        res.status(500).json({
            status: 'error',
            message: "Failed to create post",
            details: error.message
        });
    }
},

generateVideoThumbnail: async (req, res) => {
    try {
        const { videoId } = req.params;
        const post = await Post.findById(videoId);

        if (!post || post.mediaType !== 'video') {
            return res.status(404).json({ 
                message: "Video not found" 
            });
        }

        const videoPath = path.join(__dirname, '..', post.media);
        const thumbnailName = `${path.parse(post.media).name}_thumb.jpg`;
        const thumbnailPath = path.join('uploads', thumbnailName);

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: ['1%'],
                    filename: thumbnailName,
                    folder: 'uploads',
                    size: '320x240'
                })
                .on('end', resolve)
                .on('error', reject);
        });

        post.videoMetadata.thumbnail = `/uploads/${thumbnailName}`;
        await post.save();

        res.json({ 
            success: true, 
            thumbnail: post.videoMetadata.thumbnail 
        });

    } catch (error) {
        console.error('Error generating thumbnail:', error);
        res.status(500).json({
            message: "Failed to generate thumbnail",
            error: error.message
        });
    }
},

  // Get user's posts
  getUserPosts: async (req, res) => {
    try {
      const posts = await Post.find({ userId: req.params.userId })
        .populate('userId', 'name profilePicture gender')
        .sort({ createdAt: -1 });

      res.status(200).json(posts);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: "Failed to fetch user posts",
        details: error.message
      });
    }
  }
};

module.exports = postController;