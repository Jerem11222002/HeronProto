const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Event = require('./backend/models/event');

async function checkEvents() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    const totalEvents = await Event.countDocuments();
    console.log('📊 TOTAL EVENTS:', totalEvents);
    
    const statusBreakdown = await Event.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('\n📌 EVENTS BY STATUS:');
    statusBreakdown.forEach(s => console.log(`   ${s._id}: ${s.count}`));
    
    const upcomingEvents = await Event.find({ status: 'upcoming' })
      .select('title status date organization tags')
      .limit(10)
      .lean();
    
    console.log('\n⏰ UPCOMING EVENTS (first 10):');
    if (upcomingEvents.length === 0) {
      console.log('   ❌ No upcoming events found');
    } else {
      upcomingEvents.forEach((e, i) => {
        console.log(`\n${i+1}. ${e.title}`);
        console.log(`   Status: ${e.status}`);
        console.log(`   Date: ${new Date(e.date).toLocaleDateString()}`);
        console.log(`   Org: ${e.organization}`);
        console.log(`   Tags: ${e.tags?.join(', ') || 'none'}`);
      });
    }

    // Check for date-related issues
    console.log('\n📅 DATE ANALYSIS:');
    const now = new Date();
    const futureEvents = await Event.countDocuments({ date: { $gt: now } });
    const pastEvents = await Event.countDocuments({ date: { $lt: now } });
    console.log(`   Events with future dates: ${futureEvents}`);
    console.log(`   Events with past dates: ${pastEvents}`);
    
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    mongoose.connection.close();
  }
}

checkEvents();
