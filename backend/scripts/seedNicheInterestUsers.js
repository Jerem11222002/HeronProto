/**
 * Smart Interest-Based Seeding
 * 1. Creates users with niche interests (photogrammetry, animation, sculpture, film)
 * 2. Seeds posts FOR those users only
 * 3. Ensures posts match the poster's interests
 * 4. Creates realistic relationships between users and content
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';
const PICSUM_BASE = 'https://picsum.photos';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

function generatePicsumUrl(width, height, seed) {
  return `${PICSUM_BASE}/${width}/${height}.jpg?random=${seed}`;
}

const NICHE_INTEREST_DATA = {
  photogrammetry: {
    interests: ['photogrammetry', 'photography', '3D modeling', 'visual-arts'],
    postTemplates: [
      "Photogrammetry project results 📸 - scanned this interesting object today, 45 photos processed",
      "Exploring photogrammetry: 3D scanning techniques - this is my first attempt",
      "Reality capture: Building a 3D model from photographs using photogrammetry",
      "Photogrammetry workflow breakdown - from capture to final model",
      "New photogrammetry study - testing different lighting conditions",
      "Photogrammetry project update - processing 100+ images for 3D reconstruction",
      "Advanced photogrammetry techniques - exploring point cloud generation"
    ],
    creators: [
      { name: 'Alex Chen', title: 'Digital Sculptor & Photogrammetry Specialist' },
      { name: 'Maya Patel', title: '3D Asset Creator' },
      { name: 'Jordan Ross', title: 'Reality Capture Enthusiast' }
    ]
  },
  animation: {
    interests: ['animation', 'performance', 'film', 'visual-arts'],
    postTemplates: [
      "Working on a new animation sequence 🎬 - frame by frame progress",
      "Animation study: exploring motion and timing principles today",
      "Character animation project in progress - this took forever to rig",
      "Attempting a complex animation technique - walk cycle breakdown",
      "Animation breakdown of my latest piece - 2D to 3D workflow",
      "Short animation test - experimenting with cloth simulation",
      "Animation challenge: recreating realistic human movement"
    ],
    creators: [
      { name: 'Casey Williams', title: 'Animator & Motion Designer' },
      { name: 'Sam Liu', title: 'VFX & Animation Artist' },
      { name: 'Riley Thompson', title: 'Stop Motion Enthusiast' }
    ]
  },
  sculpture: {
    interests: ['sculpture', 'visual-arts', 'performance', 'cultural-arts'],
    postTemplates: [
      "New sculpture piece completed 🗿 - working with mixed materials",
      "Sculpture workshop: exploring form and space - clay study",
      "Working with different sculptural materials - comparing techniques",
      "Abstract sculpture study - exploring negative space",
      "Contemporary sculpture experimentation - modern interpretation of classic forms",
      "Large-scale sculpture project - from concept to installation",
      "Sculpture process video - from clay to finished piece"
    ],
    creators: [
      { name: 'Morgan Blake', title: 'Contemporary Sculptor' },
      { name: 'Kenji Nakamura', title: 'Installation Artist' },
      { name: 'Sophie Laurent', title: 'Digital Sculptor' }
    ]
  },
  film: {
    interests: ['film', 'performance', 'photography', 'visual-arts'],
    postTemplates: [
      "Film project update 🎥 - just wrapped filming this scene",
      "Cinematography studies and techniques - exploring color grading",
      "Short film production insights - lessons learned on set",
      "Exploring film narrative and composition - shot breakdown",
      "Behind the scenes: film production - lighting setup for tomorrow",
      "Documentary exploration - capturing authentic moments",
      "Film analysis: cinematographic techniques in modern cinema"
    ],
    creators: [
      { name: 'Emma Rodriguez', title: 'Filmmaker & Director' },
      { name: 'Aditya Kumar', title: 'Cinematographer' },
      { name: 'Grace Morrison', title: 'Film Producer & Editor' }
    ]
  }
};

async function createUserWithInterests(name, title, interestsList) {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      console.log(`    ℹ️  User ${name} already exists, skipping creation`);
      return existingUser._id;
    }

    const newUser = new User({
      name: name,
      username: name.toLowerCase().replace(/\s+/g, '.') + Date.now(),
      email: `${name.toLowerCase().replace(/\s+/g, '.')}+${Date.now()}@niche.local`,
      password: 'hashed_password_here',
      studentId: `NICHE${Date.now()}${Math.floor(Math.random() * 1000)}`, // Add required studentId
      profilePicture: generatePicsumUrl(200, 200, Math.floor(Math.random() * 10000)),
      interests: interestsList,
      bio: title,
      following: [],
      followers: [],
      organizations: [],
      contentPreferences: {
        likedContent: [],
        savedContent: [],
        sharedContent: [],
        interestedEvents: [],
        registeredEvents: []
      }
    });

    const savedUser = await newUser.save();
    console.log(`    ✅ Created user: ${name} (${interestsList.join(', ')})`);
    return savedUser._id;
  } catch (error) {
    console.error(`    ❌ Error creating user ${name}:`, error.message);
    return null;
  }
}

async function createPostsForUser(userId, userName, interests, interestCategory) {
  try {
    const templateData = NICHE_INTEREST_DATA[interestCategory];
    if (!templateData) {
      console.log(`    ⚠️  No template data for ${interestCategory}`);
      return 0;
    }

    // Create 3-4 posts per user
    const numPosts = Math.floor(Math.random() * 2) + 3;
    let postsCreated = 0;

    for (let i = 0; i < numPosts; i++) {
      const desc = templateData.postTemplates[
        Math.floor(Math.random() * templateData.postTemplates.length)
      ];

      // Create 2-3 media items per post
      const numImages = Math.floor(Math.random() * 2) + 2;
      const mediaArray = [];

      for (let j = 0; j < numImages; j++) {
        const seed = Math.floor(Math.random() * 10000) + (j * 1000);
        const mediaUrl = generatePicsumUrl(600, 400, seed);
        mediaArray.push({
          url: mediaUrl,
          type: 'image',
          size: Math.floor(Math.random() * 500000) + 200000,
          duration: 0,
          thumbnail: generatePicsumUrl(300, 200, seed)
        });
      }

      // Create post with proper tags matching the user's interests
      const newPost = new Post({
        userId: userId,
        name: userName,
        desc: desc,
        mediaArray: mediaArray,
        // Note: media and mediaType fields are omitted to avoid validation issues with external URLs
        // mediaArray contains all the media information needed
        mediaCount: mediaArray.length,
        tags: [interestCategory, ...interests.slice(0, 2)], // Primary + secondary interests
        contentType: 'regular',
        visibility: 'public',
        likes: [],
        comments: [],
        engagementMetrics: {
          views: Math.floor(Math.random() * 500) + 20,
          shares: Math.floor(Math.random() * 20),
          commentCount: Math.floor(Math.random() * 15),
          popularity: Math.random() * 0.8 + 0.2,
          recency: 1
        },
        createdAt: new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000) // Recent: 2-6 hours ago
      });

      await newPost.save();
      postsCreated++;
    }

    console.log(`    ✓ Created ${postsCreated} posts for ${userName}`);
    return postsCreated;
  } catch (error) {
    console.error(`    ❌ Error creating posts for ${userName}:`, error.message);
    return 0;
  }
}

async function seedNicheInterestContent() {
  console.log('🎨 SMART INTEREST-BASED SEEDING\n');
  console.log('This script will:');
  console.log('  1. Create users with niche interests');
  console.log('  2. Generate posts matching their interests');
  console.log('  3. Ensure content authenticity\n');

  try {
    let totalUsersCreated = 0;
    let totalPostsCreated = 0;

    // Process each niche interest
    for (const [interestKey, interestData] of Object.entries(NICHE_INTEREST_DATA)) {
      console.log(`\n📌 Processing: ${interestKey.toUpperCase()}`);
      console.log(`   Creating creators with interests: ${interestData.interests.join(', ')}\n`);

      // Create 3 users per interest category
      for (const creator of interestData.creators) {
        const userId = await createUserWithInterests(
          creator.name,
          creator.title,
          interestData.interests
        );

        if (userId) {
          totalUsersCreated++;

          // Create posts for this user
          const postsForThisUser = await createPostsForUser(
            userId,
            creator.name,
            interestData.interests,
            interestKey
          );
          totalPostsCreated += postsForThisUser;
        }
      }
    }

    // Verify the seeding
    console.log('\n\n📊 SEEDING VERIFICATION:\n');

    for (const interestKey of Object.keys(NICHE_INTEREST_DATA)) {
      const usersCount = await User.countDocuments({
        interests: interestKey
      });

      const postsCount = await Post.countDocuments({
        tags: interestKey
      });

      console.log(`  ${interestKey.toUpperCase()}:`);
      console.log(`    • Users with this interest: ${usersCount}`);
      console.log(`    • Posts tagged with this: ${postsCount}`);
    }

    console.log(`\n\n✅ SEEDING COMPLETE:`);
    console.log(`  ✓ Total users created: ${totalUsersCreated}`);
    console.log(`  ✓ Total posts created: ${totalPostsCreated}`);
    console.log(`  ✓ Average posts per user: ${(totalPostsCreated / totalUsersCreated).toFixed(1)}`);
    console.log(`\n🎯 RESULT: kyliea. should now see recommendations from:`);
    console.log(`   • Users interested in photogrammetry, animation, sculpture, and film`);
    console.log(`   • Posts actually created BY people with these interests`);
    console.log(`   • Content that authentically matches the interests, not mismatched posts\n`);

  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => seedNicheInterestContent());
