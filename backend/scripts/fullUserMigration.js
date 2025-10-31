const path = require('path');
require('dotenv').config({ 
  path: path.resolve(__dirname, '../../.env') 
});
const mongoose = require('mongoose');
const User = require('../models/users');

// Valid interests pool for random assignment
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

// Interest groups for more realistic random assignment
const INTEREST_GROUPS = [
  ['music', 'performance', 'band'],
  ['dance', 'choreography', 'performance'],
  ['theatre', 'drama', 'performance'],
  ['visual-arts', 'painting', 'artwork'],
  ['digital-art', 'technical-production', 'multimedia'],
  ['design', 'graphics', 'multimedia'],
  ['cultural-arts', 'traditional-arts', 'performance'],
  ['vocal-arts', 'modern-music', 'performance'],
  ['instruments', 'band', 'music']
];

// Function to get random interests
function getRandomInterests() {
  // 70% chance to use interest groups, 30% chance for completely random
  const useGroups = Math.random() < 0.7;
  
  if (useGroups) {
    // Pick a random group
    const group = INTEREST_GROUPS[Math.floor(Math.random() * INTEREST_GROUPS.length)];
    // Take 2-3 interests from the group
    const count = Math.random() < 0.5 ? 2 : 3;
    return group.slice(0, count);
  } else {
    // Get 2-3 random interests
    const count = Math.random() < 0.5 ? 2 : 3;
    const shuffled = [...VALID_INTERESTS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}

async function migrateAllUsers() {
  try {
    console.log('� Starting full user migration...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    // Find users with empty or missing interests
    const users = await User.find({
      $or: [
        { interests: { $exists: false } },
        { interests: { $size: 0 } },
        { interests: null }
      ]
    });

    console.log(`📊 Found ${users.length} users with empty interests to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        console.log(`\n🔄 Processing user: ${user.username}`);

        // Generate random interests
        const newInterests = getRandomInterests();

        // Create implicit preferences with random scores
        const implicitPreferences = newInterests.reduce((acc, interest) => {
          // Random score between 2 and 4
          acc[interest] = 2 + Math.floor(Math.random() * 3);
          return acc;
        }, {});

        // Perform the update
        const result = await User.findByIdAndUpdate(
          user._id,
          {
            $set: {
              interests: newInterests,
              interestsSelected: true,
              interestsSkipped: false,
              implicitPreferences,
              profileSetup: true
            }
          },
          { 
            new: true,
            runValidators: false
          }
        );

        if (!result) {
          throw new Error('User not found after update');
        }

        console.log(`✅ Updated user ${user.username}:`, {
          newInterests,
          implicitPreferences
        });

        successCount++;

      } catch (error) {
        console.error(`❌ Error updating user ${user.username}:`, error.message);
        errorCount++;
      }
    }

    // Migration summary
    console.log('\n✨ Migration Summary:');
    console.log(`Total users with empty interests: ${users.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed updates: ${errorCount}`);

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

// Run migration
migrateAllUsers();