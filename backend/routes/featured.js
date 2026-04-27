const express = require('express');
const router = express.Router();
const User = require('../models/users');
const Post = require('../models/posts');
const authenticate = require('../Middleware/authenticateToken');
const path = require('path');
const mongoose = require('mongoose');
const featuredArtistsCache = require('../services/featuredArtistsCache');

// Utility function to get date range based on filter
const getDateRange = (timeFilter) => {
  const now = new Date();
  switch (timeFilter) {
    case 'day':
      return new Date(now.setDate(now.getDate() - 1));
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case 'all':
      return new Date(0);
    default:
      return new Date(now.setDate(now.getDate() - 7));
  }
};

// Debug route
router.get('/test', authenticate, (req, res) => {
  res.json({ message: 'Featured route is working' });
});

// Get top artists with time filter, excluding self-shares
router.get('/top-artists/:timeFilter', authenticate, async (req, res) => {
  try {
    const { timeFilter } = req.params;
    // whitelist time filters
    const allowed = new Set(['day','week','month','year','all']);
    const tf = allowed.has(timeFilter) ? timeFilter : 'week';

    // CHECK CACHE FIRST
    const cachedResult = featuredArtistsCache.get(tf);
    if (cachedResult && !cachedResult.expired) {
      console.log(`📦 [CACHE HIT] Featured artists for "${tf}"`);
      return res.json(cachedResult.data);
    }

    console.log(`🔄 [CACHE MISS] Querying database for featured artists "${tf}"`);
    const startDate = getDateRange(tf);

    // Pipeline: Exclude self-shared posts from engagement and shares
    const topArtists = await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      // Lookup original post for shared posts
      {
        $lookup: {
          from: 'posts',
          localField: 'sharedPost',
          foreignField: '_id',
          as: 'originalPost'
        }
      },
      // Add isSelfShare field
      {
        $addFields: {
          isSelfShare: {
            $cond: [
              {
                $and: [
                  { $ne: ['$sharedPost', null] },
                  { $eq: ['$userId', { $arrayElemAt: ['$originalPost.userId', 0] }] }
                ]
              },
              true,
              false
            ]
          }
        }
      },
      // Exclude self-shared posts from engagement and shares
      {
        $match: {
          isSelfShare: { $ne: true }
        }
      },
      // Group by userId
      {
        $group: {
          _id: '$userId',
          totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
          postCount: { $sum: 1 },
          totalComments: { 
            $sum: { 
              $cond: [
                { $isArray: "$comments" },
                { $size: "$comments" },
                0
              ]
            }
          },
          totalViews: { $sum: { $ifNull: ['$views', 0] } },
          totalShares: { $sum: { $ifNull: ['$shares', 0] } }
        }
      },
      {
        $match: {
          postCount: { $gt: 0 }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { 
                  $eq: ['$_id', { $toObjectId: '$$userId' }]
                }
              }
            }
          ],
          as: 'userDetails'
        }
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: false
        }
      },
      // Lookup top posts, excluding self-shares
      {
        $lookup: {
          from: 'posts',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userId', '$$userId'] },
                createdAt: { $gte: startDate }
              }
            },
            // Lookup original post for shared posts
            {
              $lookup: {
                from: 'posts',
                localField: 'sharedPost',
                foreignField: '_id',
                as: 'originalPost'
              }
            },
            // Add isSelfShare field
            {
              $addFields: {
                isSelfShare: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$sharedPost', null] },
                        { $eq: ['$userId', { $arrayElemAt: ['$originalPost.userId', 0] }] }
                      ]
                    },
                    true,
                    false
                  ]
                }
              }
            },
            // Exclude self-shared posts
            { $match: { isSelfShare: { $ne: true } } },
            // Sort by engagement (shares*5 + likes*3 + comments*2 + views*1)
            {
              $addFields: {
                engagement: {
                  $add: [
                    { $multiply: [ { $ifNull: ['$shares', 0] }, 5 ] },
                    { $multiply: [ { $size: { $ifNull: ['$likes', []] } }, 3 ] },
                    { $multiply: [
                        { $cond: [
                          { $isArray: "$comments" },
                          { $size: "$comments" },
                          0
                        ] }, 2
                      ]
                    },
                    { $multiply: [ { $ifNull: ['$views', 0] }, 1 ] }
                  ]
                }
              }
            },
            { $sort: { engagement: -1, createdAt: -1 } },
            { $limit: 3 },
            {
              $project: {
                _id: 1,
                img: 1,
                createdAt: 1,
                likes: { $size: { $ifNull: ['$likes', []] } },
                comments: { 
                  $cond: [
                    { $isArray: "$comments" },
                    { $size: "$comments" },
                    0
                  ]
                },
                views: 1,
                shares: 1
              }
            }
          ],
          as: 'topPosts'
        }
      },
      // Update engagement formula to match frontend
      {
        $addFields: {
          engagement: {
            $add: [
              { $multiply: ['$totalShares', 5] },
              { $multiply: ['$totalLikes', 3] },
              { $multiply: ['$totalComments', 2] },
              { $multiply: ['$totalViews', 1] },
              { $multiply: [{ $size: { $ifNull: ['$userDetails.followers', []] } }, 1] },
              { $multiply: ['$postCount', 1] }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: '$userDetails.name',
          username: '$userDetails.username',
          profilePic: '$userDetails.profilePic',
          bio: '$userDetails.bio',
          followers: '$userDetails.followers',
          followersCount: { $size: { $ifNull: ['$userDetails.followers', []] } },
          totalLikes: 1,
          totalComments: 1,
          totalViews: 1,
          totalShares: 1,
          postCount: 1,
          topPosts: 1,
          engagement: 1
        }
      },
      {
        $sort: { 
          engagement: -1,
          totalLikes: -1
        }
      },
      {
        $limit: 5
      }
    ]);

    // Build absolute URL helper
    const toAbsolute = (val) => {
      if (!val) return null;
      if (typeof val !== 'string') return null;
      if (val.startsWith('http')) return val;
      if (val.startsWith('/uploads/') || val.startsWith('/assets/')) {
        return `${req.protocol}://${req.get('host')}${val}`;
      }
      return `${req.protocol}://${req.get('host')}/uploads/${path.basename(val)}`;
    };

    const viewerId = req.user?._id?.toString();
    const formattedArtists = topArtists
      .filter(a => a && a._id && a._id.toString() !== viewerId) // server-side exclude viewer
      .map((artist, index) => ({
        ...artist,
        rank: index + 1,
        profilePic: artist.profilePic ? toAbsolute(artist.profilePic) : null,
        topPosts: (artist.topPosts || []).map(post => ({
          ...post,
          img: post.img ? toAbsolute(post.img) : null,
          likes: typeof post.likes === 'number' ? post.likes : (post.likes || 0),
          comments: typeof post.comments === 'number' ? post.comments : (post.comments || 0),
          views: typeof post.views === 'number' ? post.views : (post.views || 0),
          createdAt: post.createdAt || new Date()
        }))
      }));

    // STORE IN CACHE
    featuredArtistsCache.set(tf, formattedArtists);

    res.json(formattedArtists);
  } catch (error) {
    console.error('❌ Error fetching top artists:', error);
    res.status(500).json({ 
      message: 'Failed to fetch top artists',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Debug routes
router.get('/debug/date-ranges', authenticate, (req, res) => {
  const now = new Date();
  const ranges = {
    day: getDateRange('day'),
    week: getDateRange('week'),
    month: getDateRange('month'),
    year: getDateRange('year'),
    all: getDateRange('all')
  };
  res.json({
    currentTime: now,
    ranges
  });
});

router.get('/debug/posts/:timeFilter', authenticate, async (req, res) => {
  try {
    const { timeFilter } = req.params;
    const startDate = getDateRange(timeFilter);
    
    const posts = await Post.find({
      createdAt: { $gte: startDate }
    })
    .select('userId createdAt likes comments')
    .lean();

    const userIds = [...new Set(posts.map(post => post.userId))];
    const users = await User.find({
      _id: { $in: userIds.map(id => mongoose.Types.ObjectId(id)) }
    })
    .select('name username')
    .lean();

    const userMap = users.reduce((acc, user) => {
      acc[user._id] = user;
      return acc;
    }, {});

    res.json({
      timeFilter,
      startDate,
      currentDate: new Date(),
      totalPosts: posts.length,
      uniqueUsers: userIds.length,
      posts: posts.map(post => ({
        _id: post._id,
        userId: post.userId,
        user: userMap[post.userId],
        createdAt: post.createdAt,
        likesCount: post.likes?.length || 0,
        commentsCount: post.comments?.length || 0
      }))
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;