const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function fetchCloudinaryImages() {
  console.log('\n📊 FETCHING ALL CLOUDINARY RESOURCES\n');
  
  try {
    console.log('🔍 Querying Cloudinary for all uploaded resources...');
    
    // Fetch all resources from Cloudinary
    const result = await cloudinary.api.resources({
      max_results: 500,
      resource_type: 'image'
    });

    console.log(`\n✅ Found ${result.resources.length} resources in Cloudinary\n`);
    console.log('════════════════════════════════════════════════════════════\n');

    // Display resources by folder
    const byFolder = {};
    result.resources.forEach(resource => {
      const folder = resource.folder || 'root';
      if (!byFolder[folder]) byFolder[folder] = [];
      byFolder[folder].push(resource);
    });

    for (const [folder, resources] of Object.entries(byFolder)) {
      console.log(`📁 Folder: ${folder || 'root'} (${resources.length} files)`);
      resources.slice(0, 5).forEach(resource => {
        console.log(`   - ${resource.public_id}`);
        console.log(`     URL: ${resource.secure_url}`);
        console.log(`     Uploaded: ${new Date(resource.created_at).toLocaleString()}`);
      });
      if (resources.length > 5) {
        console.log(`   ... and ${resources.length - 5} more`);
      }
      console.log('');
    }

    return result.resources;

  } catch (error) {
    console.error('❌ Error fetching Cloudinary resources:', error.message);
    return [];
  }
}

async function findMatchingPosts(cloudinaryResources) {
  console.log('\n🔄 MATCHING CLOUDINARY IMAGES TO POSTS\n');

  try {
    // Find old user posts with broken media
    const oldPosts = await Post.find({
      media: { $exists: true, $ne: null }
    }).limit(50);

    console.log(`Found ${oldPosts.length} posts with media field\n`);

    // Create map of Cloudinary resources by public_id
    const cloudinaryMap = {};
    cloudinaryResources.forEach(resource => {
      cloudinaryMap[resource.public_id] = resource.secure_url;
    });

    console.log(`📋 Available Cloudinary resources: ${Object.keys(cloudinaryMap).length}\n`);
    console.log('Sample Cloudinary public IDs:');
    Object.keys(cloudinaryMap).slice(0, 10).forEach(id => {
      console.log(`  - ${id}`);
    });

    console.log('\n════════════════════════════════════════════════════════════\n');
    console.log('Available Cloudinary folders and images:');
    console.log(JSON.stringify(Object.keys(cloudinaryMap), null, 2));

  } catch (error) {
    console.error('❌ Error matching posts:', error.message);
  }
}

async function main() {
  try {
    await connectDB();
    
    console.log('\n' + '═'.repeat(70));
    console.log('☁️  CLOUDINARY IMAGE RECOVERY SCRIPT');
    console.log('═'.repeat(70));
    
    const resources = await fetchCloudinaryImages();
    
    if (resources.length === 0) {
      console.log('\n⚠️  No resources found in Cloudinary');
      console.log('   Possible reasons:');
      console.log('   1. Images were never uploaded to Cloudinary');
      console.log('   2. Images were uploaded but to a different cloud account');
      console.log('   3. Cloudinary account credentials are incorrect\n');
    } else {
      await findMatchingPosts(resources);
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.\n');
  }
}

main();
