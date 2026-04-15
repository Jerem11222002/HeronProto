# Event Seeding Script - Quick Start Guide

## What This Script Does
Generates 10 sample events (5 auditions + 5 watch-only) with:
- ✅ Proper tags aligned to event descriptions
- ✅ Valid organization assignments
- ✅ All required Event model fields
- ✅ Realistic engagement metrics
- ✅ Future event dates spread across 60 days

## Prerequisites
1. MongoDB is running and `MONGODB_URI` is set in `.env`
2. At least one user exists in the database (script uses first user as creator)
3. Node.js environment is set up

## How to Run

### Option 1: Direct Node Execution
```bash
cd backend
node scripts/seedEvents.js
```

### Option 2: Using npm Script (if available)
First, add to `package.json`:
```json
{
  "scripts": {
    "seed:events": "node backend/scripts/seedEvents.js"
  }
}
```

Then run:
```bash
npm run seed:events
```

## Example Output
```
🌱 Event Seeding Script Started
================================

✅ Connected to MongoDB

📝 Using user as event creator: admin@university.edu

✨ Successfully created 10 events!

📊 Event Summary:
================
✓ Audition Events: 5
✓ Watch-Only Events: 5
✓ Total Events: 10

🏢 Events by Organization:
   UMAK Chorale: 2
   UMAK Dance Extreme: 2
   CAST: 2
   UTPC: 2
   UMAK Brass Band: 1
   CULTURA: 1

📌 Tag Distribution:
   performance: 10
   music: 5
   dance: 4
   vocal: 3
   ...

✅ Database seeding complete!
```

## Events Created

### Audition Events (5)
1. **UMAK Chorale Spring Auditions 2026** - Vocal/Choir auditions
2. **UMAK Dance Extreme Contemporary Dance Auditions** - Dance auditions
3. **CAST Theatre Production Auditions** - Theatre auditions
4. **UTPC Digital Art & Multimedia Auditions** - Design/multimedia auditions
5. **UMAK Brass Band Instrumentalist Auditions** - Music/instrumental auditions

### Watch-Only Events (5)
1. **CULTURA Heritage Festival - Opening Ceremony** - Cultural performance
2. **CAST Theatre Spring Presentation** - Theatre performance
3. **UMAK Chorale Concert** - Vocal concert
4. **UTPC Visual Arts Exhibition** - Digital arts exhibition
5. **UMAK Dance Extreme Performance** - Dance performance

## What Tags Are Included?

Event tags are categorized as:

**Primary Tags** (main focus)
- music, dance, theatre, visual-arts, cultural-arts, performance

**Specific Subtags** (detailed categories)
- vocal, choir, instrumental, band, contemporary, modern-dance, digital-art, multimedia, design, traditional-arts, folk-dance, drama, acting, stage

**Event-Type Tags**
- audition, concert, exhibition, performance, show, festival, ceremony

**Context Tags**
- ensemble, performance, production, workshop, competition, achievement

This diversified tagging ensures the recommendation algorithm can:
- Match user interests to content
- Identify relevant events for different interest profiles
- Test tag-based filtering accuracy
- Validate metrics calculations

## Testing the Recommendations

After seeding, test the hybrid filtering:

```javascript
// In your test/admin code:
const { RecommendationService } = require('./services/recommendations');

// Test for a user with music interests
const recommendations = await RecommendationService.getHybridFeed(userId, { limit: 10 });

// Check algorithm identifies seeded events
console.log('Recommended events:', recommendations.length);
recommendations.forEach(item => {
  console.log(`- ${item.title} (tags: ${item.tags.join(', ')})`);
});
```

## Troubleshooting

### Error: "MONGODB_URI environment variable is not set"
**Solution:** Add to `.env` file:
```
MONGODB_URI=mongodb://localhost:27017/heron-db
```

### Error: "No users found in database"
**Solution:** Create at least one user first:
```bash
# In another terminal, create a test user through your signup endpoint
# Or add directly to MongoDB:
# db.users.insertOne({ username: "admin", email: "admin@test.com", ... })
```

### Events not showing in database
**Solution:** 
1. Check MongoDB connection: `mongo $MONGODB_URI`
2. Verify script completed: look for "✅ Database seeding complete!"
3. Query events: `db.events.find({ created_by: ObjectId("...") }).count()`

## Next Steps

1. **Run the script:**
   ```bash
   node backend/scripts/seedEvents.js
   ```

2. **Verify in database:**
   ```bash
   # Check event count
   db.events.countDocuments()
   
   # View sample event
   db.events.findOne()
   ```

3. **Test recommendation algorithm:**
   - Log in as a user
   - View your recommendations
   - Check that algorithm returns the seeded events
   - Verify tags are considered in matching

4. **Evaluate metrics:**
   - Check RecommendationModal performance metrics
   - Compare cosine similarity calculations
   - Validate RMSE/MAE accuracy
   - Measure MRR ranking quality

## Modifying the Script

To customize events:

1. **Add more events:**
   - Duplicate an event object in `AUDITION_EVENTS` or `WATCH_ONLY_EVENTS` array
   - Update title, description, tags, organization

2. **Change tags:**
   - Edit the `tags` array in any event object
   - Ensure tags match the event description

3. **Adjust engagement metrics:**
   - Modify `engagementMetrics` values
   - Higher views/shares = more "popular" in recommendations

4. **Change organizations:**
   - Update `organization` field
   - Choose from: CAST, CULTURA, UMAK Jammers, UMAK Chorale, UMAK Dance Extreme, UMAK Siglahi, UMAK Brass Band, UTPC

---

**Script Location:** `backend/scripts/seedEvents.js`  
**Status:** Ready to use ✅  
**Last Updated:** April 2026
