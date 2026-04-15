/**
 * Event Seeding Script
 * Generates 10 sample events (5 audition + 5 watch-only) with:
 * - Realistic titles, descriptions, and locations
 * - Proper tags aligned with event content and organization
 * - Valid interests matching the event theme
 * - All required fields from the Event model
 * 
 * Usage:
 *   node backend/scripts/seedEvents.js
 * 
 * Features:
 * - Connects to MongoDB via MONGODB_URI env variable
 * - Creates events with proper organization assignments
 * - Tags are semantically related to event descriptions
 * - Different engagement metrics for variety
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/users');
const Event = require('../models/event');

// Sample image URLs (using placeholder/icon URLs)
const IMAGE_URLS = {
  music: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&h=900&fit=crop',
  dance: 'https://images.unsplash.com/photo-1504270997368-361684dae4e0?w=1600&h=900&fit=crop',
  theatre: 'https://images.unsplash.com/photo-1514306688772-aadcf2b2dc0d?w=1600&h=900&fit=crop',
  visual: 'https://images.unsplash.com/photo-1578321272176-e6b0b1e0c904?w=1600&h=900&fit=crop',
  cultural: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&h=900&fit=crop',
  performance: 'https://images.unsplash.com/photo-1501928891033-37046b43cd51?w=1600&h=900&fit=crop'
};

// Event templates with tag alignment
const AUDITION_EVENTS = [
  {
    title: 'UMAK Chorale Spring Auditions 2026',
    description: 'Join our prestigious university chorale group! We are seeking passionate singers for our spring season. No prior experience necessary. Come showcase your vocal talents and become part of our award-winning choir. Auditions will include sight-reading and performance pieces.',
    organization: 'UMAK Chorale',
    location: 'Music Building, Room 201',
    category: 'music',
    tags: ['music', 'vocal', 'choir', 'audition', 'singing', 'ensemble', 'performance', 'vocal-arts'],
    primaryInterest: 'music',
    relatedInterests: ['vocal', 'choir'],
    eventType: 'audition',
    image: IMAGE_URLS.music,
    requirements: {
      videoRequired: false,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'Prepare one song in any genre',
      maxParticipants: 30
    },
    ticketing: {
      isPaid: false,
      price: 0,
      availableSeats: 50
    },
    engagementMetrics: {
      views: 245,
      shares: 18,
      interested: 32,
      registrations: 14,
      completionRate: 0.65,
      avgRating: 4.5
    }
  },
  {
    title: 'UMAK Dance Extreme Contemporary Dance Auditions',
    description: 'UMAK Dance Extreme is recruiting fresh talent for our contemporary dance company. Whether you are a trained dancer or someone with natural rhythm and passion, we welcome you! Learn cutting-edge choreography from award-winning instructors. Show us your movement potential.',
    organization: 'UMAK Dance Extreme',
    location: 'Dance Studio A, Ground Floor',
    category: 'dance',
    tags: ['dance', 'contemporary', 'choreography', 'audition', 'performance', 'modern-dance', 'movement'],
    primaryInterest: 'dance',
    relatedInterests: ['contemporary', 'performance'],
    eventType: 'audition',
    image: IMAGE_URLS.dance,
    requirements: {
      videoRequired: true,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'Submit a 30-second video of your best dance move or freestyle',
      maxParticipants: 50
    },
    ticketing: {
      isPaid: false,
      price: 0,
      availableSeats: 60
    },
    engagementMetrics: {
      views: 412,
      shares: 45,
      interested: 67,
      registrations: 28,
      completionRate: 0.72,
      avgRating: 4.7
    }
  },
  {
    title: 'CAST Theatre Production Auditions - "A Midsummer Night\'s Dream"',
    description: 'CAST (College of Arts and Social Transformation) is hosting auditions for our spring theatrical production. We are casting for various roles including leads, ensemble, and technical crew positions. This is a great opportunity to be part of professional-level theatre production at the university.',
    organization: 'CAST',
    location: 'Theatre Building, Auditorium',
    category: 'theatre',
    tags: ['theatre', 'drama', 'acting', 'audition', 'performance', 'stage', 'production', 'performing-arts'],
    primaryInterest: 'performance',
    relatedInterests: ['performance', 'workshop'],
    eventType: 'audition',
    image: IMAGE_URLS.theatre,
    requirements: {
      videoRequired: false,
      photoRequired: true,
      experienceRequired: false,
      additionalRequirements: 'Prepare a 1-2 minute monologue (dramatic or comedic)',
      maxParticipants: 80
    },
    ticketing: {
      isPaid: false,
      price: 0,
      availableSeats: 100
    },
    engagementMetrics: {
      views: 356,
      shares: 52,
      interested: 89,
      registrations: 41,
      completionRate: 0.68,
      avgRating: 4.6
    }
  },
  {
    title: 'UTPC Digital Art & Multimedia Auditions',
    description: 'UTPC (University Technical Production Crew) is seeking talented digital artists and multimedia creators. If you are passionate about visual effects, digital design, animation, or multimedia production, this is your chance to showcase your portfolio and join our creative team. Work on real university events and productions.',
    organization: 'UTPC',
    location: 'Digital Lab, Level 3',
    category: 'visual-arts',
    tags: ['visual-arts', 'digital-art', 'multimedia', 'design', 'audition', 'animation', 'graphics', 'technical-production'],
    primaryInterest: 'visual-arts',
    relatedInterests: ['digital-art', 'multimedia', 'design'],
    eventType: 'audition',
    image: IMAGE_URLS.visual,
    requirements: {
      videoRequired: false,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'Bring portfolio samples (digital or printed)',
      maxParticipants: 25
    },
    ticketing: {
      isPaid: false,
      price: 0,
      availableSeats: 40
    },
    engagementMetrics: {
      views: 178,
      shares: 22,
      interested: 34,
      registrations: 16,
      completionRate: 0.75,
      avgRating: 4.8
    }
  },
  {
    title: 'UMAK Brass Band Instrumentalist Auditions',
    description: 'Join UMAK Brass Band and be part of our dynamic instrumental ensemble. We are looking for skilled brass and woodwind musicians to perform in university concerts and inter-university competitions. Professional-level training and mentorship provided.',
    organization: 'UMAK Brass Band',
    location: 'Concert Hall, Band Room',
    category: 'music',
    tags: ['music', 'band', 'instrumental', 'orchestra', 'audition', 'instruments', 'ensemble', 'performance'],
    primaryInterest: 'music',
    relatedInterests: ['band', 'instrumental'],
    eventType: 'audition',
    image: IMAGE_URLS.music,
    requirements: {
      videoRequired: true,
      photoRequired: false,
      experienceRequired: true,
      additionalRequirements: 'Must have 3+ years playing experience. Submit audition video performing a classical piece.',
      maxParticipants: 35
    },
    ticketing: {
      isPaid: false,
      price: 0,
      availableSeats: 50
    },
    engagementMetrics: {
      views: 289,
      shares: 31,
      interested: 42,
      registrations: 19,
      completionRate: 0.71,
      avgRating: 4.5
    }
  }
];

const WATCH_ONLY_EVENTS = [
  {
    title: 'CULTURA Heritage Festival - Opening Ceremony',
    description: 'Experience the vibrant traditions of our university through CULTURA\'s Heritage Festival opening ceremony. Enjoy traditional dances, music, and cultural performances from various Philippine ethnic groups. This is a spectacular showcase of our rich cultural heritage with live performances, traditional costumes, and interactive cultural booths.',
    organization: 'CULTURA',
    location: 'University Gymnasium',
    category: 'cultural-arts',
    tags: ['cultural', 'traditional-arts', 'dance', 'music', 'performance', 'heritage', 'folk-dance', 'cultural-arts'],
    primaryInterest: 'cultural-arts',
    relatedInterests: ['traditional-arts', 'dance', 'performance'],
    eventType: 'watch-only',
    image: IMAGE_URLS.cultural,
    requirements: {
      videoRequired: false,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'General audience event',
      maxParticipants: null
    },
    ticketing: {
      isPaid: false,
      price: 0,
      availableSeats: 500
    },
    engagementMetrics: {
      views: 1250,
      shares: 187,
      interested: 523,
      registrations: 312,
      completionRate: 0.88,
      avgRating: 4.9
    }
  },
  {
    title: 'CAST Theatre Spring Presentation - "The Tempest"',
    description: 'Witness an unforgettable theatrical experience as CAST presents a modern adaptation of Shakespeare\'s "The Tempest." Our talented cast brings Shakespeare to life with innovative staging and contemporary interpretations. Perfect for theatre lovers and those seeking quality entertainment.',
    organization: 'CAST',
    location: 'Main Theatre, Auditorium',
    category: 'theatre',
    tags: ['theatre', 'drama', 'performance', 'stage', 'acting', 'shakespeare', 'play', 'performing-arts'],
    primaryInterest: 'theatre',
    relatedInterests: ['performance', 'exhibition'],
    eventType: 'watch-only',
    image: IMAGE_URLS.theatre,
    requirements: {
      videoRequired: false,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'General audience event',
      maxParticipants: null
    },
    ticketing: {
      isPaid: true,
      price: 150,
      availableSeats: 400
    },
    engagementMetrics: {
      views: 2340,
      shares: 412,
      interested: 876,
      registrations: 645,
      completionRate: 0.92,
      avgRating: 4.8
    }
  },
  {
    title: 'UMAK Chorale Concert - Symphony of Voices',
    description: 'Join us for an evening of exquisite choral music as UMAK Chorale presents their annual concert "Symphony of Voices." Featuring classical, contemporary, and local compositions performed by our award-winning choir. A moving and uplifting musical experience.',
    organization: 'UMAK Chorale',
    location: 'Concert Hall, Main Stage',
    category: 'music',
    tags: ['music', 'vocal', 'choir', 'concert', 'performance', 'singing', 'ensemble', 'classical'],
    primaryInterest: 'music',
    relatedInterests: ['vocal', 'choir', 'performance'],
    eventType: 'watch-only',
    image: IMAGE_URLS.music,
    requirements: {
      videoRequired: false,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'General audience event',
      maxParticipants: null
    },
    ticketing: {
      isPaid: true,
      price: 200,
      availableSeats: 350
    },
    engagementMetrics: {
      views: 1876,
      shares: 298,
      interested: 615,
      registrations: 492,
      completionRate: 0.89,
      avgRating: 4.7
    }
  },
  {
    title: 'UTPC Visual Arts Exhibition - "Digital Horizons"',
    description: 'Immerse yourself in cutting-edge digital art at UTPC\'s annual exhibition "Digital Horizons." Featuring stunning visual installations, digital photography, multimedia projects, and animations from our talented student artists. A testament to creativity and technological innovation.',
    organization: 'UTPC',
    location: 'Arts Building, Exhibition Hall',
    category: 'visual-arts',
    tags: ['visual-arts', 'digital-art', 'exhibition', 'multimedia', 'photography', 'design', 'animation', 'artwork'],
    primaryInterest: 'visual-arts',
    relatedInterests: ['digital-art', 'multimedia', 'design'],
    eventType: 'watch-only',
    image: IMAGE_URLS.visual,
    requirements: {
      videoRequired: false,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'General audience event - Free admission',
      maxParticipants: null
    },
    ticketing: {
      isPaid: false,
      price: 0,
      availableSeats: null
    },
    engagementMetrics: {
      views: 1542,
      shares: 234,
      interested: 489,
      registrations: 367,
      completionRate: 0.85,
      avgRating: 4.6
    }
  },
  {
    title: 'UMAK Dance Extreme Performance - "Movement Revolution"',
    description: 'Experience the pulse-pounding energy of UMAK Dance Extreme as they present "Movement Revolution" - a high-octane contemporary dance show featuring original choreography and stunning visuals. Perfect for anyone who loves dynamic, expressive movement and world-class performance.',
    organization: 'UMAK Dance Extreme',
    location: 'Sports Complex, Main Hall',
    category: 'dance',
    tags: ['dance', 'contemporary', 'performance', 'choreography', 'modern-dance', 'movement', 'theatrical', 'show'],
    primaryInterest: 'dance',
    relatedInterests: ['contemporary', 'performance'],
    eventType: 'watch-only',
    image: IMAGE_URLS.dance,
    requirements: {
      videoRequired: false,
      photoRequired: false,
      experienceRequired: false,
      additionalRequirements: 'General audience event',
      maxParticipants: null
    },
    ticketing: {
      isPaid: true,
      price: 180,
      availableSeats: 600
    },
    engagementMetrics: {
      views: 3120,
      shares: 567,
      interested: 1245,
      registrations: 892,
      completionRate: 0.93,
      avgRating: 4.9
    }
  }
];

async function seedEvents() {
  try {
    console.log('🌱 Event Seeding Script Started');
    console.log('================================\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error(
        'Missing database connection string!\n' +
        'Set MONGO_URI or MONGODB_URI in your .env file\n' +
        'Example: MONGO_URI=mongodb://localhost:27017/heron-db'
      );
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get an admin user to assign as event creator (or use the first user)
    let adminUser = await User.findOne({});
    if (!adminUser) {
      throw new Error('No users found in database. Please create at least one user first.');
    }
    console.log(`📝 Using user as event creator: ${adminUser.username || adminUser.email}\n`);

    // Clear existing events (optional - comment out if you want to keep existing)
    const existingCount = await Event.countDocuments({});
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing events. Keeping them...`);
      console.log('   (uncomment the clear line in the script to remove them)\n');
      // Uncomment below to clear:
      // await Event.deleteMany({});
      // console.log('   Cleared all existing events\n');
    }

    // Prepare events with createdBy field
    const allEvents = [
      ...AUDITION_EVENTS.map(e => ({ ...e, createdBy: adminUser._id })),
      ...WATCH_ONLY_EVENTS.map(e => ({ ...e, createdBy: adminUser._id }))
    ];

    // Set future dates (spread across next 60 days)
    const eventsWithDates = allEvents.map((event, index) => {
      const daysFromNow = index * 7 + Math.floor(Math.random() * 5); // Spread over 60+ days
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + daysFromNow);
      eventDate.setHours(Math.floor(Math.random() * 8) + 10, 0, 0, 0); // 10 AM - 6 PM
      return { ...event, date: eventDate };
    });

    // Create events
    const createdEvents = await Event.insertMany(eventsWithDates);
    console.log(`✨ Successfully created ${createdEvents.length} events!\n`);

    // Summary
    console.log('📊 Event Summary:');
    console.log('================');
    console.log(`✓ Audition Events: ${AUDITION_EVENTS.length}`);
    console.log(`✓ Watch-Only Events: ${WATCH_ONLY_EVENTS.length}`);
    console.log(`✓ Total Events: ${createdEvents.length}\n`);

    // Organization breakdown
    console.log('🏢 Events by Organization:');
    const orgCounts = {};
    createdEvents.forEach(event => {
      orgCounts[event.organization] = (orgCounts[event.organization] || 0) + 1;
    });
    Object.entries(orgCounts).forEach(([org, count]) => {
      console.log(`   ${org}: ${count}`);
    });

    console.log('\n📌 Tag Distribution:');
    const tagCounts = {};
    createdEvents.forEach(event => {
      event.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        console.log(`   ${tag}: ${count}`);
      });

    console.log('\n✅ Database seeding complete!');
    console.log('================================');
    console.log('Events are ready for testing the hybrid filtering algorithm.\n');

    // Display sample event for verification
    console.log('📋 Sample Event (first created):');
    console.log('--------------------------------');
    const sample = createdEvents[0];
    console.log(`Title: ${sample.title}`);
    console.log(`Organization: ${sample.organization}`);
    console.log(`Event Type: ${sample.eventType}`);
    console.log(`Category: ${sample.category}`);
    console.log(`Primary Interest: ${sample.primaryInterest}`);
    console.log(`Tags: ${sample.tags.join(', ')}`);
    console.log(`Date: ${sample.date.toLocaleDateString()} ${sample.date.toLocaleTimeString()}`);
    console.log(`Location: ${sample.location}\n`);

  } catch (error) {
    console.error('❌ Error seeding events:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

// Run the seed script
seedEvents();
