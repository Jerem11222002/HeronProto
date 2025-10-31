const path = require('path');
require('dotenv').config({ 
  path: path.resolve(__dirname, '../../.env') 
});
const mongoose = require('mongoose');
const User = require('../models/users');

// Define interest mapping with more comprehensive mappings
const INTEREST_MAPPING = {
  1: ['music', 'performance'],
  2: ['dance', 'choreography'],
  3: ['theatre', 'drama'],
  4: ['visual-arts', 'painting'],
  5: ['digital-art', 'technical-production'],
  6: ['cultural-arts', 'traditional-arts'],
  7: ['vocal-arts', 'modern-music'],
  8: ['instruments', 'band'],
  9: ['multimedia', 'design'],
  10: ['graphics', 'creatives']
};

// List of valid interests from User schema
const VALID_INTERESTS = [
  'music', 
  'dance', 
  'theatre', 
  'cultural-arts',
  'vocal-arts', 
  'modern-music', 
  'traditional-arts', 
  'instruments',
  'visual-arts',
  'painting',
  'digital-art',
  'technical-production',
  'multimedia',
  'design',
  'graphics',
  'performance',
  'choreography',
  'drama',
  'band',
  'creatives'
];

// Enhanced interest relationships for better matching
const INTEREST_RELATIONSHIPS = {
  'music': ['performance', 'vocal-arts', 'band', 'modern-music', 'instruments'],
  'theatre': ['drama', 'performance', 'stage-performance'],
  'dance': ['choreography', 'performance', 'modern-dance', 'cultural'],
  'visual-arts': ['painting', 'digital-art', 'multimedia', 'design', 'graphics'],
  'cultural-arts': ['traditional-arts', 'performance', 'folk-dance', 'dance'],
  'performance': ['music', 'dance', 'theatre', 'drama', 'choreography'],
  'technical-production': ['multimedia', 'digital-art', 'design'],
  'drama': ['theatre', 'performance', 'stage-performance']
};

function convertNumericInterests(interests) {
  if (!Array.isArray(interests)) return [];

  const convertedInterests = interests.reduce((acc, interest) => {
    // Handle numeric strings and numbers
    const numericInterest = parseInt(interest, 10);
    
    if (!isNaN(numericInterest) && INTEREST_MAPPING[numericInterest]) {
      const mappedInterests = INTEREST_MAPPING[numericInterest];
      return [...acc, ...mappedInterests.filter(i => VALID_INTERESTS.includes(i))];
    }
    
    // Handle direct string interests
    if (typeof interest === 'string' && VALID_INTERESTS.includes(interest)) {
      return [...acc, interest];
    }
    
    return acc;
  }, []);

  // Remove duplicates and ensure at least one interest
  const uniqueInterests = [...new Set(convertedInterests)];
  return uniqueInterests.length > 0 ? uniqueInterests.slice(0, 3) : ['general'];
}

function generateImplicitPreferences(interests) {
  const preferences = {};
  
  // Set base preferences for selected interests
  interests.forEach(interest => {
    preferences[interest] = 3;
    
    // Add related interests with lower weights
    if (INTEREST_RELATIONSHIPS[interest]) {
      INTEREST_RELATIONSHIPS[interest].forEach(relatedInterest => {
        if (!preferences[relatedInterest]) {
          preferences[relatedInterest] = 2;
        }
      });
    }
  });
  
  // Ensure minimum preferences
  if (Object.keys(preferences).length === 0) {
    preferences['general'] = 1;
  }
  
  return preferences;
}

function verifyUserFields(user) {
  return {
    hasInterests: Array.isArray(user.interests) && user.interests.length > 0,
    hasImplicitPrefs: user.implicitPreferences && Object.keys(user.implicitPreferences).length > 0,
    hasContentPrefs: user.contentPreferences && typeof user.contentPreferences === 'object',
    interestsSelected: user.interestsSelected === true,
    interestsSkipped: user.interestsSkipped === false
  };
}

async function migrateUsers() {
  try {
    console.log('🚀 Starting migration...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MongoDB connection string not found in environment variables');
    }
    console.log('📝 Environment checks passed');

    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    // Enhanced query to catch all cases
    const users = await User.find({
      $or: [
        { contentPreferences: { $exists: false } },
        { contentPreferences: null },
        { interestsSkipped: { $exists: false } },
        { implicitPreferences: { $exists: false } },
        { implicitPreferences: {} },
        { interests: { $exists: true } },
        { interestsSelected: { $exists: false } }
      ]
    });

    console.log(`📊 Found ${users.length} users to update`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      try {
        console.log(`\n🔄 Processing user: ${user.username}`);

        // Verify current state
        const beforeState = verifyUserFields(user);
        console.log('Current state:', beforeState);

        // Handle different interest formats
        let currentInterests = Array.isArray(user.interests) 
          ? user.interests 
          : [];

        // Convert and validate interests
        const newInterests = convertNumericInterests(currentInterests);
        
        // Generate comprehensive preferences
        const implicitPrefs = generateImplicitPreferences(newInterests);

        // Complete update object
        const updateData = {
          $set: {
            interests: newInterests,
            interestsSelected: true,
            interestsSkipped: false,
            organizations: user.organizations || [],
            implicitPreferences: {
              ...implicitPrefs,
              ...(user.implicitPreferences || {})
            },
            contentPreferences: {
              likedContent: [],
              savedContent: [],
              sharedContent: [],
              interestedEvents: [],
              registeredEvents: [],
              sharedEvents: [],
              ...(user.contentPreferences || {})
            },
            lastUpdated: new Date()
          }
        };

        // Perform update
        const result = await User.findByIdAndUpdate(
          user._id,
          updateData,
          { 
            new: true,
            runValidators: false,
            upsert: false
          }
        );

        if (!result) {
          throw new Error('User not found after update');
        }

        // Verify update success
        const afterState = verifyUserFields(result);
        const updateSuccess = 
          afterState.hasInterests &&
          afterState.hasImplicitPrefs &&
          afterState.hasContentPrefs &&
          afterState.interestsSelected;

        if (!updateSuccess) {
          throw new Error('Update verification failed');
        }

        console.log(`✅ Updated user ${user.username}:`, {
          oldInterests: currentInterests,
          newInterests: result.interests,
          implicitPreferencesCount: Object.keys(result.implicitPreferences || {}).length,
          contentPreferencesInitialized: !!result.contentPreferences,
          verificationPassed: updateSuccess,
          beforeState,
          afterState
        });

        successCount++;

      } catch (error) {
        console.error(`❌ Error updating user ${user.username}:`, {
          userId: user._id,
          error: error.message,
          interests: user.interests
        });
        errorCount++;
      }
    }

    // Migration summary
    console.log('\n✨ Migration Summary:');
    console.log(`Total processed: ${users.length}`);
    console.log(`Successful updates: ${successCount}`);
    console.log(`Failed updates: ${errorCount}`);
    console.log(`Skipped (no valid interests): ${skippedCount}`);

    await mongoose.connection.close();
    console.log('\n👋 Migration completed. Database connection closed.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Error handlers
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled rejection:', error.message);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught exception:', error.message);
  process.exit(1);
});

// Run migration
migrateUsers();