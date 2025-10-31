
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { RecommendationService } = require('../services/recommendations');

async function debugUserEvents(userId) {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB successfully');

    // Run debug function
    console.log('\nRunning event visibility debug...');
    const results = await RecommendationService.debugUserEventVisibility(userId);
    
    // Log results
    console.log('\nResults:', {
      eventsFound: results.length,
      matchingEvents: results.map(event => ({
        title: event.title,
        organization: event.organization,
        tags: event.tags,
        status: event.status,
        date: event.date
      }))
    });

    // Close connection
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');

  } catch (error) {
    console.error('Debug Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Run debug for specific user
const userId = '674b9dc89ed5aeb9650f3df3';
debugUserEvents(userId);