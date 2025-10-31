const router = require('express').Router();
const User = require('../models/users');
const auth = require('../Middleware/authenticateToken');
const logger = require('../utils/logger');

// helper to escape user input for regex
function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/test', auth, (req, res) => {
    res.json({ message: 'Search routes working', userId: req.user.id });
  });
  
  router.get('/users', auth, async (req, res) => {
  try {
    const searchQuery = req.query.q?.trim();
    logger.debug('Search query received', { searchQuery });

    if (!searchQuery) {
      return res.status(200).json({
        users: [],
        totalCount: 0,
        hasMore: false
      });
    }

    // Always allow partial email matches so keystroke suggestions return results
    // e.g. typing "meka" will find "meka@example.com"
    const emailCriteria = { email: { $regex: escapeRegex(searchQuery), $options: 'i' } };
    
    const searchCriteria = {
      $and: [
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { username: { $regex: searchQuery, $options: 'i' } },
            emailCriteria
          ]
        },
        { _id: { $ne: req.user.id } }
      ]
    };

    const [users, totalCount] = await Promise.all([
      User.find(searchCriteria)
        .select('_id name username profilePic gender email')
        .sort({ name: 1 })
        .limit(10)
        .lean(),
      User.countDocuments(searchCriteria)
    ]).catch(err => {
      logger.error('Database query error', err);
      throw err;
    });

    logger.debug('Found users', { query: searchQuery, count: users.length });

    return res.status(200).json({
      users,
      totalCount,
      hasMore: totalCount > users.length
    });

  } catch (error) {
    logger.error('Search error', error);
    return res.status(500).json({
      message: 'An error occurred while searching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Search users endpoint
router.get('/search', auth, async (req, res) => {
  try {
    const searchQuery = req.query.q?.trim();
    console.log('Received search query:', searchQuery);

    if (!searchQuery) {
      return res.status(200).json({
        users: [],
        totalCount: 0,
        hasMore: false
      });
    }

    const emailCriteria = { email: { $regex: escapeRegex(searchQuery), $options: 'i' } };

    const searchCriteria = {
      $and: [
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { username: { $regex: searchQuery, $options: 'i' } },
            emailCriteria
          ]
        },
        { _id: { $ne: req.user.id } }
      ]
    };

    const [users, totalCount] = await Promise.all([
      User.find(searchCriteria)
        .select('_id name username profilePic gender email')
        .sort({ name: 1 })
        .limit(10)
        .lean(),
      User.countDocuments(searchCriteria)
    ]);

    console.log('Search results:', { totalCount, resultsCount: users.length });

    return res.status(200).json({
      users,
      totalCount,
      hasMore: false
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      message: 'An error occurred while searching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user suggestions
router.get('/suggestions', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Find users excluding current user and already followed users
    const suggestions = await User.find({
      _id: { $ne: req.user.id },
      followers: { $nin: [req.user.id] }
    })
      .select('_id name username profilePic gender')
      .sort({ followers: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json(suggestions);
  } catch (error) {
    console.error('User suggestions error:', error);
    res.status(500).json({
      message: 'An error occurred while fetching user suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get trending users
router.get('/trending', auth, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '7d'; // Default to 7 days
    const limit = parseInt(req.query.limit) || 5;

    // Calculate date range
    const dateRange = new Date();
    switch (timeframe) {
      case '24h':
        dateRange.setDate(dateRange.getDate() - 1);
        break;
      case '7d':
        dateRange.setDate(dateRange.getDate() - 7);
        break;
      case '30d':
        dateRange.setDate(dateRange.getDate() - 30);
        break;
      default:
        dateRange.setDate(dateRange.getDate() - 7);
    }

    // Find trending users based on recent activity
    const trendingUsers = await User.aggregate([
      {
        $match: {
          _id: { $ne: req.user.id },
          updatedAt: { $gte: dateRange }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $size: '$followers' },
              { $multiply: [{ $size: '$posts' }, 0.5] }
            ]
          }
        }
      },
      {
        $sort: { score: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 1,
          name: 1,
          username: 1,
          profilePic: 1,
          gender: 1,
          followersCount: { $size: '$followers' }
        }
      }
    ]);

    res.status(200).json(trendingUsers);
  } catch (error) {
    console.error('Trending users error:', error);
    res.status(500).json({
      message: 'An error occurred while fetching trending users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;