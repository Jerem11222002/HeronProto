const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Event = require('../models/event');

async function fixEvents() {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    // Debug environment loading
    console.log('Environment Check:');
    console.log('- .env path:', path.resolve(__dirname, '../../.env'));
    console.log('- MONGO_URI exists:', !!mongoUri);

    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in the environment variables');
    }

    await mongoose.connect(mongoUri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB');

    const events = await Event.find({});
    console.log(`Found ${events.length} events to update`);
    
    for (const event of events) {
      // Force tag regeneration
      event.markModified('organization');
      await event.save();
      
      console.log(`Updated event: ${event.title}`, {
        organization: event.organization,
        tags: event.tags,
        visibility: event.visibility
      });
    }

    console.log('All events updated');
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

fixEvents();