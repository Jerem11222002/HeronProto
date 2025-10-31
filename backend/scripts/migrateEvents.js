const mongoose = require('mongoose');
const Event = require('../models/event');

async function migrateEvents() {
  try {
    await mongoose.connect('mongodb://localhost:27017/herondb');
    console.log('Starting events migration...');
    
    const events = await Event.find({});
    console.log(`Found ${events.length} events to migrate`);

    for (const event of events) {
      // Trigger the pre-save hook to generate tags and interests
      event.markModified('organization');
      await event.save();
      
      console.log(`Migrated event: ${event.title}`, {
        primaryInterest: event.primaryInterest,
        tags: event.tags,
        relatedInterests: event.relatedInterests
      });
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

migrateEvents();