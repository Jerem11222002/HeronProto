const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');

async function checkPostCount() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    const count = await Post.countDocuments();
    console.log('📊 Total posts in database:', count);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkPostCount();
