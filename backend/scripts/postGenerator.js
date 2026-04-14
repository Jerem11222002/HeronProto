const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

const INTERESTS_TO_FILL = {
  'writing': {
    priority: 'critical', // 0% coverage
    targetCount: 8,
    topics: [
      'Creative Writing Workshop: Exploring Fiction Techniques',
      'Poetry Slam Event - Open Mic for Emerging Poets',
      'Short Story Publishing Guide for New Authors',
      'Character Development in Modern Literature',
      'Writing Critique Circle - Weekly Feedback Sessions',
      'Journaling as an Art Form: Personal Expression',
      'Screenwriting Basics: From Idea to Script',
      'Narrative Poetry Reading and Discussion'
    ]
  },
  'fashion': {
    priority: 'critical',
    targetCount: 7,
    topics: [
      'Sustainable Fashion: Eco-Friendly Clothing Design',
      'Fashion Week Highlights - Designer Showcase',
      'DIY Fashion: Upcycling Old Clothes',
      'Color Theory in Fashion: Seasonal Palettes',
      'Street Style Photography from Local Events',
      'Fashion History: Evolution of Modern Trends',
      'Costume Design for Theatrical Productions'
    ]
  },
  'film': {
    priority: 'critical',
    targetCount: 7,
    topics: [
      'Independent Film Festival - Call for Submissions',
      'Cinematography Masterclass: Lighting Techniques',
      'Film Analysis: Visual Storytelling Workshop',
      'Documentary Screening and Discussion Panel',
      'Animation Workshop: Basic Frame-by-Frame Techniques',
      'Script Analysis: Breaking Down Famous Films',
      'Short Film Production: From Concept to Screen'
    ]
  },
  'photogrammetry': {
    priority: 'critical',
    targetCount: 6,
    topics: [
      'Introduction to 3D Photogrammetry Technology',
      'Scanning Techniques for Digital Preservation',
      'Architectural Photogrammetry: Building Documentation',
      'Cultural Heritage Digitization Project',
      'Photogrammetry in Virtual Reality Creation',
      'Hands-On Workshop: 3D Model Creation'
    ]
  },
  'sculpture': {
    priority: 'critical',
    targetCount: 6,
    topics: [
      'Sculpture Studio Open House - See Artists at Work',
      'Stone Carving Workshop for Beginners',
      'Contemporary Sculpture Exhibition Opening',
      'Material Exploration: Clay, Wood, and Metal',
      'Public Art Installation Project Launch',
      'Sculpture Techniques: From Concept to Completion'
    ]
  },
  'music': {
    priority: 'boost',
    targetCount: 5, // Already at 1.6%, boost to ~4%
    topics: [
      'Jazz Ensemble Performance - Live at the Theater',
      'Music Production Workshop: Recording Basics',
      'Acoustic Session with Emerging Musicians',
      'Music Theory for Songwriters',
      'Instrument Maintenance and Care Guide'
    ]
  },
  'theatre': {
    priority: 'boost',
    targetCount: 5,
    topics: [
      'Improv Comedy Workshop - Build Stage Confidence',
      'Classical Shakespeare Reading Group',
      'Stage Combat Training for Theater Productions',
      'Play Reading Series - Community Participation',
      'Theater Lighting Design Fundamentals'
    ]
  },
  'dance': {
    priority: 'boost',
    targetCount: 4, // Already at 8.1%, targeted boost
    topics: [
      'Contemporary Dance Fusion Workshop',
      'Hip-Hop Dance Choreography Session',
      'Ballet Technique Refresher for Dancers',
      'Dance Film Screening and Artist Talk'
    ]
  },
  'photography': {
    priority: 'boost',
    targetCount: 4,
    topics: [
      'Portrait Photography Lighting Techniques',
      'Photography Walk: Urban Exploration',
      'Photo Editing Workflow Masterclass',
      'Exhibition Opening: Local Photographer Showcase'
    ]
  },
  'cultural-arts': {
    priority: 'boost',
    targetCount: 4,
    topics: [
      'Indigenous Art Forms Exhibition',
      'Traditional Crafts Workshop',
      'Cultural Storytelling Evening',
      'World Music and Dance Festival'
    ]
  },
  'performance': {
    priority: 'maintain',
    targetCount: 3, // Already strong at 27.4%, just add some variety
    topics: [
      'Live Performance Workshop: Stage Presence',
      'Monologue Performance Series',
      'Experimental Performance Art Showcase'
    ]
  },
  'visual-arts': {
    priority: 'maintain',
    targetCount: 3, // Already strong at 26.6%
    topics: [
      'Mixed Media Art Techniques',
      'Gallery Opening: Contemporary Paintings',
      'Drawing from Life: Figure Study Session'
    ]
  },
  'digital-art': {
    priority: 'new',
    targetCount: 3,
    topics: [
      'Digital Illustration Techniques',
      'Motion Graphics Workshop',
      'UI/UX Design for Creative Projects'
    ]
  }
};

const POST_DESCRIPTIONS = {
  'writing': [
    'Join us for an intensive workshop exploring fiction techniques including character development, plot structure, and dialogue. Perfect for writers of all levels.',
    'Open mic poetry slam featuring emerging poets from our community. Share your work or enjoy listening to powerful verses from fellow artists.',
    'Complete guide to self-publishing your short stories. Learn about formatting, platforms, and marketing strategies.',
    'Develop compelling characters that readers will remember. This session covers backstory, motivation, and character arcs.',
    'Join our weekly critique circle where writers give constructive feedback on each other\'s work. Supportive environment for growth.',
    'Discover how journaling can become an art form. Explore techniques for personal expression and creative exploration.',
    'Learn the fundamentals of screenwriting from industry professionals. Transform your ideas into screenplay format.',
    'Explore how narrative poetry combines storytelling with poetic devices. Reading and discussion of contemporary narrative poets.'
  ],
  'fashion': [
    'Designing sustainable and eco-friendly clothing that respects both people and the planet. Learn about ethical fashion practices.',
    'Highlights from the latest fashion week showcasing innovative designers and emerging trends.',
    'Creative workshop on transforming old clothing into stylish new pieces. Learn basic sewing and design principles.',
    'Understanding color theory and seasonal color palettes in fashion design. Create cohesive collections.',
    'Photography project capturing authentic street style from our local community. See fashion in everyday life.',
    'Journey through fashion history from the 1920s to modern day. How trends evolve and what influences them.',
    'Designing stunning costumes for stage and screen. Explore fabrication, silhouette, and character expression through clothing.'
  ],
  'film': [
    'Annual independent film festival seeking submissions. Celebrate diverse cinematic voices and innovative storytelling.',
    'Master the art of cinematography. Learn camera techniques, lighting setups, and composition for visual storytelling.',
    'Analyze how films use visual language to tell stories. Discuss composition, color, and movement in cinema.',
    'Screening of award-winning documentaries followed by discussion with filmmakers about their creative process.',
    'Introduction to animation techniques. Learn frame-by-frame animation, storyboarding, and bring your ideas to life.',
    'Breaking down scripts and visual storytelling techniques from acclaimed films. What makes them work?',
    'Production workshop: Take your film idea from concept through post-production. Hands-on learning with equipment.'
  ],
  'photogrammetry': [
    'Introduction to 3D photogrammetry and how this technology revolutionizes digital documentation and visualization.',
    'Learn professional scanning techniques used to create 3D digital records of cultural and historical artifacts.',
    'Explore how photogrammetry documents architectural heritage and creates precise building records.',
    'Participatory project digitizing cultural heritage for preservation. Help create 3D archives of community artifacts.',
    'Discover how photogrammetry enhances virtual reality experiences creating immersive digital environments.',
    'Hands-on workshop: Create 3D models from photographs. Learn software fundamentals and workflow.'
  ],
  'sculpture': [
    'Open studio event showcasing working sculptors. Watch artists in their creative process and ask questions.',
    'Beginner-friendly stone carving workshop. Learn basic techniques, safety, and material properties.',
    'Opening night celebrating contemporary sculpture artists. New works in diverse materials and styles.',
    'Explore different materials for sculpture including clay, wood, metal, and mixed media. Understand their properties and techniques.',
    'Join our public art installation project. Collaborate with artists to transform community spaces.',
    'Complete process of sculpture creation from conceptual sketches to finished piece. Multiple techniques demonstrated.'
  ],
  'music': [
    'Live jazz ensemble performance featuring improvisation and collaborative musicianship. Experience the spontaneity of jazz.',
    'Music production basics: Learn recording, mixing, and mastering techniques for your own music.',
    'Intimate acoustic performances by emerging musicians. Singer-songwriters sharing original compositions.',
    'Understanding music theory concepts essential for songwriting: chord progressions, key signatures, and song structure.',
    'Learn how to maintain and care for your instruments properly to ensure longevity and optimal sound.'
  ],
  'theatre': [
    'Improv workshop building comedy skills and stage confidence. Games, exercises, and live performances.',
    'Small group reading of Shakespeare plays. Explore language, character, and performance interpretation.',
    'Learn theatrical stage combat techniques safely and effectively. Essential for action scenes and dramatic moments.',
    'Community members invited to participate in curated play readings. No experience necessary, just enthusiasm.',
    'Introduction to theatrical lighting design. How light creates mood, focus, and visual atmosphere.'
  ],
  'dance': [
    'Fusion workshop blending contemporary dance with other movement styles. Explore new creative possibilities.',
    'Hip-hop dance choreography session learning current moves and creating group pieces to popular music.',
    'Refresher class for ballet dancers. Technique review and exercises to maintain skills.',
    'Screening of innovative dance films followed by conversation with choreographers and filmmakers.'
  ],
  'photography': [
    'Master portrait lighting techniques to create compelling character photos. Studio and natural light approaches.',
    'Guided photography walk through urban environments. Discover compelling compositions and perspectives.',
    'Efficient photo editing workflow using professional software. Organize, edit, and prepare photos for exhibition.',
    'Exhibition opening featuring stunning photographs by celebrated local photographer. Meet the artist and view portfolio.'
  ],
  'cultural-arts': [
    'Exhibition celebrating indigenous art forms, traditional techniques, and contemporary indigenous artists.',
    'Learn traditional crafts from cultures around the world. Hands-on experience creating authentic work.',
    'Evening of cultural storytelling from diverse communities. hear narratives, histories, and wisdom traditions.',
    'Multi-day festival celebrating world music and dance traditions. Performances and workshops from various cultures.'
  ],
  'performance': [
    'Workshop focused on developing confidence and stage presence. Techniques for commanding attention and connecting with audience.',
    'Series of powerful solo monologues performed by community artists. Diverse characters and compelling narratives.',
    'Experimental performance art exploring unconventional forms and audience interaction. Innovative and thought-provoking.'
  ],
  'visual-arts': [
    'Explore mixed media techniques combining paint, collage, and found objects. Create unique layered compositions.',
    'Gallery opening featuring contemporary paintings in various styles. Meet the artists and discover new work.',
    'Life drawing session capturing human form through sustained observation. Techniques for accuracy and expression.'
  ],
  'digital-art': [
    'Digital illustration techniques using tablet and software. Learn brushes, layers, and creating polished digital paintings.',
    'Motion graphics workshop: Bring static designs to life using animation. Software fundamentals and creative techniques.',
    'User interface and user experience design for creative projects. Balancing aesthetics with functionality for digital products.'
  ]
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function getOrCreateSeedUsers() {
  // Get existing users or create seed users for posts attribution
  const seedUsersData = [
    { name: 'Artist Studio 1', email: 'studio1@seed.local', username: 'studio1seed' },
    { name: 'Artist Studio 2', email: 'studio2@seed.local', username: 'studio2seed' },
    { name: 'Creative Collective', email: 'collective@seed.local', username: 'collectiveseed' },
    { name: 'Cultural Center', email: 'center@seed.local', username: 'centerseed' },
    { name: 'Community Arts', email: 'community@seed.local', username: 'communityseed' }
  ];

  const users = [];
  for (const data of seedUsersData) {
    let user = await User.findOne({ email: data.email });
    if (!user) {
      user = await User.create({
        email: data.email,
        name: data.name,
        username: data.username,
        studentId: `seed-${Date.now()}-${Math.random()}`, // Unique ID for each seed user
        password: 'seeduser123', // placeholder
        gender: 'prefer-not-to-say',
        isVerified: true,
        interests: Object.keys(INTERESTS_TO_FILL)
      });
      console.log(`  Created seed user: ${data.name}`);
    }
    users.push(user);
  }
  return users;
}

/**
 * Generate deterministic Picsum URL based on post index
 * Uses a stable hash to ensure same image every time, not random on refresh
 */
function generateDeterministicImageUrl(interest, postIndex) {
  const PICSUM_BASE = 'https://picsum.photos';
  
  // Map interests to seed ranges (different seeds = different style of images)
  const INTEREST_SEEDS = {
    'writing': { base: 1, range: 20 },
    'fashion': { base: 21, range: 20 },
    'film': { base: 41, range: 20 },
    'photogrammetry': { base: 61, range: 20 },
    'sculpture': { base: 81, range: 20 },
    'music': { base: 101, range: 20 },
    'theatre': { base: 121, range: 20 },
    'dance': { base: 141, range: 20 },
    'photography': { base: 161, range: 20 },
    'cultural-arts': { base: 181, range: 20 },
    'performance': { base: 201, range: 20 },
    'visual-arts': { base: 221, range: 20 },
    'digital-art': { base: 241, range: 20 }
  };
  
  const seedConfig = INTEREST_SEEDS[interest] || INTEREST_SEEDS['performance'];
  // Use deterministic seed: base + postIndex ensures variety within interest
  const seed = seedConfig.base + (postIndex % seedConfig.range);
  
  return `${PICSUM_BASE}/600/400.jpg?random=${seed}`;
}

async function generatePosts() {
  console.log('\n🎬 POST GENERATOR - Filling Content Gaps\n');

  const seedUsers = await getOrCreateSeedUsers();
  console.log(`\n📝 Found/created ${seedUsers.length} seed users for post attribution\n`);

  let totalGenerated = 0;
  const generatedByInterest = {};

  for (const [interest, config] of Object.entries(INTERESTS_TO_FILL)) {
    console.log(`\n${config.priority === 'critical' ? '⚠️ ' : '✅ '} ${interest.toUpperCase()} (${config.priority})`);
    
    const topics = config.topics;
    const postsToCreate = Math.min(config.targetCount, topics.length);
    
    for (let i = 0; i < postsToCreate; i++) {
      try {
        const randomUser = seedUsers[Math.floor(Math.random() * seedUsers.length)];
        const topic = topics[i];
        const description = POST_DESCRIPTIONS[interest][i];

        // Determine related tags for this post (some posts match multiple interests)
        let tags = [interest];
        
        // Add related tags based on semantic connections
        const relatedMappings = {
          'writing': ['creative', 'literature', 'storytelling'],
          'fashion': ['design', 'visual-arts', 'creative'],
          'film': ['video', 'visual-arts', 'performance'],
          'photogrammetry': ['digital-art', 'technology', 'visual-arts'],
          'sculpture': ['visual-arts', 'creative', 'performance'],
          'music': ['performance', 'vocal-arts', 'cultural-arts'],
          'theatre': ['drama', 'performance', 'cultural-arts'],
          'dance': ['performance', 'movement', 'cultural-arts'],
          'photography': ['visual-arts', 'digital-art', 'creative'],
          'cultural-arts': ['performance', 'traditional', 'heritage'],
          'performance': ['theatre', 'dance', 'cultural-arts'],
          'visual-arts': ['creative', 'design', 'digital-art'],
          'digital-art': ['technology', 'visual-arts', 'creative']
        };

        if (relatedMappings[interest]) {
          // 60% chance to add 1-2 related tags
          if (Math.random() < 0.6) {
            const relatedTags = relatedMappings[interest];
            const numRelated = Math.random() < 0.5 ? 1 : 2;
            for (let j = 0; j < numRelated && j < relatedTags.length; j++) {
              if (!tags.includes(relatedTags[j])) {
                tags.push(relatedTags[j]);
              }
            }
          }
        }

        // Generate 1-2 deterministic images for this post
        const numImages = (i % 3) + 1; // Cycles 1, 2, 3, 1, 2, 3...
        const mediaArray = [];
        
        for (let imgIdx = 0; imgIdx < numImages; imgIdx++) {
          const imageUrl = generateDeterministicImageUrl(interest, i + imgIdx);
          mediaArray.push({
            url: imageUrl,
            type: 'image',
            size: Math.floor(Math.random() * 500000) + 100000, // 100KB - 600KB
            duration: 0,
            thumbnail: imageUrl
          });
        }

        const post = await Post.create({
          userId: randomUser._id,
          name: randomUser.name,
          title: topic,
          desc: description,
          tags: tags.slice(0, 5), // Limit to 5 tags max
          likes: [], // Start with no likes
          comments: [],
          shares: Math.floor(Math.random() * 3),
          mediaArray: mediaArray, // Include deterministic media
          mediaCount: mediaArray.length,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random past 30 days
          contentType: 'regular',
          visibility: 'public'
        });

        console.log(`  ✓ "${topic.substring(0, 40)}..." [tags: ${tags.join(', ')}] [${numImages} image(s)]`);
        totalGenerated++;
        generatedByInterest[interest] = (generatedByInterest[interest] || 0) + 1;
      } catch (error) {
        console.error(`  ✗ Error creating post for ${interest}: ${error.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 GENERATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal posts generated: ${totalGenerated}`);
  console.log('\nBreakdown by interest:');
  for (const [interest, count] of Object.entries(generatedByInterest)) {
    const priority = INTERESTS_TO_FILL[interest].priority;
    console.log(`  • ${interest.padEnd(20)} ${count.toString().padStart(2)} posts (${priority})`);
  }

  // Count total posts in database
  const totalPosts = await Post.countDocuments();
  console.log(`\n📈 Total posts in database: ${totalPosts}`);

  console.log('\n✅ Post generation complete!\n');
}

async function main() {
  try {
    await connectDB();
    await generatePosts();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.\n');
  }
}

main();
