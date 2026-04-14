const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Event = require('./backend/models/event');

async function updateEventsToUpcoming() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    const future = new Date();
    future.setDate(future.getDate() + 30); // 30 days in the future
    
    const result = await Event.updateMany(
      {},
      { 
        status: 'upcoming',
        date: future
      }
    );
    
    console.log('✅ Updated events:');
    console.log(`   Total updated: ${result.modifiedCount}`);
    console.log(`   New status: upcoming`);
    console.log(`   New date: ${future.toLocaleDateString()}`);
    
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    mongoose.connection.close();
  }
}

updateEventsToUpcoming();
