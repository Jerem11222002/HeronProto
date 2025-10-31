const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/herondb';

async function fixInterestsStatus() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    const User = require('../models/users');

    // Log initial state
    const beforeUser = await User.findOne({ username: 'mich' });
    console.log('Before update:', {
      username: beforeUser.username,
      interestsSelected: beforeUser.interestsSelected,
      interestsSkipped: beforeUser.interestsSkipped
    });
    
    // Update users with more specific conditions
    const result = await User.updateMany(
      {
        $or: [
          // Users with no interests and interestsSelected false
          { 
            interests: { $size: 0 }, 
            interestsSelected: false 
          },
          // Specifically target user "mich"
          { 
            username: 'mich',
            interestsSelected: false
          }
        ]
      },
      {
        $set: {
          interestsSelected: true,
          interestsSkipped: true
        }
      }
    );

    // Log results
    console.log('Migration results:', {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    // Verify the update
    const afterUser = await User.findOne({ username: 'mich' });
    console.log('After update:', {
      username: afterUser.username,
      interestsSelected: afterUser.interestsSelected,
      interestsSkipped: afterUser.interestsSkipped
    });

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

module.exports = { fixInterestsStatus };