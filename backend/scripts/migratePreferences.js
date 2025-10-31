const mongoose = require('mongoose');
const User = require('../models/users');

async function migrateImplicitPreferences() {
  try {
    await mongoose.connect('mongodb://localhost:27017/herondb');
    
    console.log('Starting preference migration...');
    
    const users = await User.find({});
    console.log(`Found ${users.length} total users`);
    let migrated = 0;

    for (const user of users) {
      // Debug current preferences
      console.log(`Processing user ${user._id}:`, {
        prefsType: typeof user.implicitPreferences,
        isMap: user.implicitPreferences instanceof Map,
        currentPrefs: user.implicitPreferences
      });

      // Convert to object format regardless of current type
      const prefsObject = user.implicitPreferences instanceof Map ? 
        Object.fromEntries(user.implicitPreferences) :
        (typeof user.implicitPreferences === 'object' ? 
          user.implicitPreferences : {});

      // Add default preferences if empty
      if (Object.keys(prefsObject).length === 0) {
        prefsObject.music = 0.5;
        prefsObject.dance = 0.5;
        prefsObject.theatre = 0.5;
        prefsObject.performance = 0.5;
        prefsObject.arts = 0.5;
      }

      // Update user
      await User.findByIdAndUpdate(user._id, {
        $set: { implicitPreferences: prefsObject }
      });
      
      migrated++;
      console.log(`Migrated preferences for user ${user._id}:`, prefsObject);
    }

    console.log(`\nMigration Summary:`);
    console.log(`Total users: ${users.length}`);
    console.log(`Migrated users: ${migrated}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run migration
migrateImplicitPreferences();