# Improved Event Seeding Prompt

## OBJECTIVE
Create a comprehensive database seeding script that generates sample events for testing the hybrid filtering recommendation algorithm and evaluating metrics accuracy.

---

## REQUIREMENTS

### 1. **Event Structure**
- **Total Events:** 10 events minimum
- **Distribution:** 5 audition events + 5 watch-only events
- **Data Completeness:** All required fields per Event model (title, description, date, image, organization, location, category, tags, etc.)

### 2. **Audition Events (5)**
These events should have:
- Event type: `audition`
- Requirements for participation (video submission, portfolio, experience level, etc.)
- Realistic audition descriptions
- Specific audition guidelines
- Limited participant capacity

**Categories:**
1. **UMAK Chorale** - Vocal auditions for choir ensemble
2. **UMAK Dance Extreme** - Contemporary dance auditions
3. **CAST** - Theatre production auditions
4. **UTPC** - Digital art & multimedia auditions
5. **UMAK Brass Band** - Instrumentalist auditions

### 3. **Watch-Only Events (5)**
These events should have:
- Event type: `watch-only`
- No participation requirements
- Ticketed or free attendance
- Larger audience capacity
- Performance/exhibition focus

**Categories:**
1. **CULTURA** - Heritage festival performance
2. **CAST** - Theatre presentation
3. **UMAK Chorale** - Concert performance
4. **UTPC** - Visual arts exhibition
5. **UMAK Dance Extreme** - Dance performance show

### 4. **Tag Alignment** (Critical for Algorithm Testing)
Each event must have semantically relevant tags that:
- **Match the event description** - Tags should accurately represent the event content
- **Align with organization** - Use tags from the organization's typical categories
- **Support interest-based filtering** - Include 6-10 tags per event
- **Enable scoring validation** - Tags should allow the algorithm to identify relevant recommendations

**Tag Strategy:**
- Primary tag(s): Main focus area (e.g., `dance`, `music`, `theatre`)
- Secondary tags: Specific sub-categories (e.g., `contemporary`, `vocal`, `performance`)
- Contextual tags: Event type and audience relevance (e.g., `audition`, `concert`, `exhibition`)

**Example:**
```
Event: "UMAK Chorale Spring Auditions"
Tags: ['music', 'vocal', 'choir', 'audition', 'singing', 'ensemble', 'performance', 'vocal-arts']
                ↑          ↑          ↑        ↑        ↑        ↑           ↑
            Primary    Primary    Primary   Type    Detail   Ensemble    Interest
```

### 5. **Organization Assignment**
Each event must be assigned to a valid organization:
- `CAST` - Theatre/Drama productions
- `CULTURA` - Cultural and traditional arts
- `UMAK Jammers` - Contemporary music band
- `UMAK Chorale` - Vocal ensemble/choir
- `UMAK Dance Extreme` - Contemporary dance
- `UMAK Siglahi` - Folk dance and cultural performances
- `UMAK Brass Band` - Instrumental ensemble
- `UTPC` - Visual arts, technical production, multimedia

### 6. **Metadata Requirements**
Each event must include:
- **title** - Clear, descriptive event name
- **description** - 2-3 sentences explaining the event
- **date** - Future dates spread across testing period
- **location** - Realistic venue/building on campus
- **category** - One from: music, dance, theatre, visual-arts, cultural-arts, workshop, competition, exhibition
- **image** - Valid image URL (can use Unsplash placeholders)
- **primaryInterest** - Primary interest category matching tags
- **relatedInterests** - 2-3 related interest tags
- **engagementMetrics** - Realistic view/share/interest counts (for testing popularity signals)
  - views: 100-3000
  - shares: 10-600
  - interested: 30-1250
  - registrations: 10-900
  - completionRate: 0.6-0.95
  - avgRating: 4.0-4.9

---

## IMPLEMENTATION DETAILS

### File Location
```
backend/scripts/seedEvents.js
```

### Usage
```bash
node backend/scripts/seedEvents.js
```

### Database Connection
- Uses `MONGODB_URI` environment variable
- Automatically connects and disconnects
- Error handling for missing database/users

### Output Features
- ✅ Creates events with proper timestamps
- ✅ Assigns random future dates (spread across 60+ days)
- ✅ Uses first available admin user as creator
- ✅ Provides summary statistics on completion
- ✅ Shows tag distribution
- ✅ Displays organization breakdown
- ✅ Previews first created event for verification

---

## TESTING PURPOSES

This seeded data enables:

1. **Algorithm Testing**
   - Validates hybrid filtering recommendations
   - Tests tag-based interest matching
   - Verifies collaborative filtering signals
   - Checks organization-specific recommendations

2. **Metrics Evaluation**
   - Tests cosine similarity calculation
   - Validates RMSE/MAE on known data
   - Measures MRR ranking quality
   - Confirms precision/recall metrics

3. **User Experience Testing**
   - Simulates realistic recommendation scenarios
   - Tests event discovery by interest
   - Validates recommendation distribution
   - Checks engagement metric calculations

---

## VALIDATION CHECKLIST

Before running script, verify:
- [ ] All 10 events have unique, descriptive titles
- [ ] 5 events have `eventType: 'audition'`
- [ ] 5 events have `eventType: 'watch-only'`
- [ ] Every event has 6-10 tags
- [ ] Tags are semantically aligned with description
- [ ] All events assigned valid organizations
- [ ] All required model fields are populated
- [ ] Image URLs are valid HTTPS links
- [ ] Engagement metrics are realistic numbers
- [ ] Dates are in future (relative to script execution)

---

## SUCCESS CRITERIA

- ✅ Script runs without database errors
- ✅ All 10 events created successfully
- ✅ Events appear correctly in MongoDB
- ✅ Recommendation algorithm can identify matching tags
- ✅ Metrics calculations reflect event properties
- ✅ Events are discoverable by their primary interests
- ✅ Tag-based filtering works as expected

---

## DELIVERABLES

```
📁 backend/scripts/
├── seedEvents.js           # Main seeding script
└── (automatic execution output)
```
