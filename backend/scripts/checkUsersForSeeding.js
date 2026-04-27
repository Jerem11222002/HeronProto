const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    const totalUsers = await User.countDocuments();
    const seedUsers = await User.countDocuments({ email: { $regex: '@seed\\.local$' } });
    const legacyUsers = totalUsers - seedUsers;
    
    console.log('📊 Total users:', totalUsers);
    console.log('📊 Seed users:', seedUsers);
    console.log('📊 Legacy users:', legacyUsers);
    console.log('\n✅ Ready to seed posts!');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
