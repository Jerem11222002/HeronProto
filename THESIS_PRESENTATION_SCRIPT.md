# Heron Fusion Thesis Presentation Script

## Introduction (2 minutes)

Good [morning/afternoon], everyone. I'm presenting **Heron Fusion**, a specialized recommendation engine designed to solve the "diluted focus" problem on mainstream social media platforms for the University of Makati's artistic community.

**The Problem We Solved:**
Imagine you're a music student at UMAK. You follow your friends, your professors, your college announcements, and other accounts. When you open your feed, you see:
- Your friend's random meme
- A viral video that has nothing to do with music
- An advertisement
- Buried somewhere: a concert announcement from your department

This is the "diluted focus" problem. Important artistic content gets lost in the noise.

**Our Solution:**
We built Heron Fusion—a platform that *understands* what you care about artistically and puts relevant content first. Not random viral content. Not random announcements. *Your* content.

---

## Objective 4: The Algorithm (8 minutes)

### Part A: What We Built (3 minutes)

Let me explain what makes Heron Fusion's recommendation algorithm special. It has **four phases**:

**Phase 1: Training the Algorithm**

Think of training an algorithm like teaching a friend to understand your taste in music.

1. **The 75/13/12/3/2 Weighting System**
   - When deciding what to show you, our algorithm considers five factors:
     - **75%: Your stated interests** - If you selected "Music," and you see a post tagged #music, that's a strong match
     - **13%: Popularity** - Sometimes we show you what's trending *if* it's relevant to you
     - **12%: Recency** - Fresh content is better than old content
     - **3%: Your past engagement** - If you liked similar content before, we give it a boost
     - **2%: Trending patterns** - What's getting fast engagement right now
   
   The key: We don't let popularity override your interests. Art stays artistic, not viral.

2. **Semantic Interest Mapping (The "Artistic Thesaurus")**
   - This is clever. If you select "Music," our system knows that concert announcements, vocal performances, instrumental posts, and music festivals are all relevant to you.
   - We map related terms, so you don't miss out just because a post uses different words.
   - Example: You love "Digital Art" → We also recommend posts tagged "3D modeling," "animation," "graphic design"

3. **Cold-Start Problem**
   - What if you're a new student with no history on the platform?
   - We don't show you random content. Instead, we show you the most popular posts from your artistic community until we understand your preferences.
   - This ensures a great first experience.

4. **Quality Caps (Error Prevention)**
   - If something has *zero* connection to your interests, we don't just give it a low score—we cap it at 0.10 (on a scale of 0-1).
   - If it's partially relevant, we cap it at 0.30.
   - This prevents noise from sneaking into your feed.

**Phase 2: Evaluating Performance (The Metrics)**

Now, how do we know our algorithm actually works? We evaluated it using continuous relevance scoring and standard ranking metrics.

**1. Cosine Similarity (Artistic Matchmaking Accuracy)**
- **What it measures:** How well the system matches content metadata to a user's interest profile.
- **How we calculated it:** We compared each user's interest vector with each post's tag and description vector.
- **Outcome:** 0.997 out of 1.0
  - This means the recommendation algorithm is almost perfectly aligning content with user preferences.

**2. Mean Reciprocal Rank (Prioritizing Exposure)**
- **What it measures:** Whether the most relevant content appears near the top of the recommendations.
- **How we optimized it:** We prioritized relevance first, recency second, and used engagement history as a ranking signal.
- **Outcome:** 1.0 for our validation users
  - Best-matching content consistently appears first, so students see the most useful posts right away.

**3. Root Mean Square Error & Mean Absolute Error (Prediction Accuracy)**
- **What it measures:** How accurately the algorithm predicts the strength of user interest.
- **Outcome:** Low error values indicate the system is assigning scores that closely match actual user relevance.

**4. Four-User Continuous Scoring Validation**
- **Why we tested this:** To confirm relevance scores behave continuously across different profiles.
- **What we did:** We evaluated four distinct user profiles with different interests and engagement histories, and measured RMSE, MAE, MRR, accuracy, and coverage.
- **Outcome:** All users showed continuous relevance behavior with high ranking quality and full coverage.

**Validation Results:**
| User | RMSE | MAE | MRR | Accuracy | Coverage |
|------|------|-----|-----|----------|----------|
| Alice (Dancer) | 0.3171 | 0.2625 | 1.0 | 0.9908 | 100% |
| Bob (Tech) | 0.1467 | 0.1146 | 1.0 | 0.9906 | 100% |
| Carol (Artist) | 0.2214 | 0.1979 | 1.0 | 1.0 | 100% |
| Dave (Multi) | 0.2745 | 0.2437 | 1.0 | 0.9997 | 100% |

**Key takeaway:** The evaluator produces continuous relevance scores, confirming the algorithm is both accurate and stable.

**Phase 3: Collaborative Filtering (The Social Discovery Layer)**

Beyond content-based matching, we added a social layer:
- **Pearson Correlation:** We look at what similar students like
- **Peer groups:** If 5 members of the UMAK Chorale engaged with a specific vocal performance, we recommend it to other music-focused students
- **Community trends:** Fresh talent gets visibility based on current community engagement

**Phase 4: The Hybrid Balance**

Finally, we blend everything together. In a standard 50-item feed:
- **15% Events** - Institutional announcements and CCA activities
- **30% Community** - Posts from friends and followed artists
- **55% Hybrid Recommendations** - The algorithm's best picks

Plus contextual boosts:
- **Urgency Boost:** Events in the next 7 days get a 2.5x multiplier
- **Artistic Niche Boost:** Categories like "Dance" get a 30% boost for relevant audiences

**Translation:** You get discovery, community, AND the institutional information you need—all balanced.

---

## Objective 5: Web Application Development (6 minutes)

### The User Experience (3 minutes)

Now that we have a smart algorithm, we needed to build the actual platform where students and faculty can use it. We developed Heron Fusion as a complete web application with two main modules: **User Module** (for students and artists) and **Administrator Module** (for CCA leadership).

Let me walk you through the key features that make this platform work for the UMAK community.

**User Module - The Artist's Workspace**

1. **Onboarding Experience (Sequences 1-4)**
   - **Sign-Up Page:** Clean registration with real-time validation
   - **Interest Selection:** Choose from categories like Music, Digital Arts, Dance, or add custom interests
   - **Profile Setup:** Upload photo, add bio, set display name
   - **Sign-In:** Secure login with admin toggle for faculty

   *Why this matters:* First impressions count. We wanted new students to feel welcome and set up their artistic identity immediately.

2. **Content Creation & Discovery (Sequences 5-8)**
   - **Home Page:** Featured artworks and announcements for visitors
   - **User Profile:** Personal dashboard to manage your artistic presence
   - **Artwork Upload:** Drag-and-drop interface for sharing art (images, videos, descriptions)
   - **Art Feed:** The heart of the platform - personalized recommendations powered by our algorithm

   *The Art Feed is where the magic happens:* Users see content tailored to their interests, with like/comment/share buttons for engagement.

3. **Community & Learning (Sequences 9-11)**
   - **Feedback System:** Constructive critique forms for each artwork
   - **Events Feed:** Centralized view of CCA activities and announcements
   - **Event Registration:** One-click registration with status tracking

   *Translation:* Artists can get feedback to improve, and never miss an audition or performance opportunity.

4. **Communication & Recognition (Sequences 19-21)**
   - **Chat Functionality:** Real-time messaging between artists
   - **Featured Artists:** Automatic recognition of outstanding work
   - **Notifications:** Updates on likes, shares, event changes

   *Why this works:* It builds community. Artists can collaborate, get inspired, and feel valued.

### The Administrative Control (2 minutes)

**Administrator Module - The CCA Leadership Tools**

While students use the platform to create and discover, administrators need tools to coordinate the entire community.

5. **Dashboard & Oversight (Sequences 12, 17-18)**
   - **Admin Dashboard:** Overview of activities, analytics, recent interactions
   - **User Monitoring:** Approve/reject artworks to maintain quality
   - **Settings:** Theme changes, password updates for both users and admins

   *Purpose:* Keep the platform safe and running smoothly.

6. **Event Management (Sequences 13, 15)**
   - **Admin Events:** Create, edit, delete events with full scheduling
   - **Participants Page:** View registrations, accept/reject participants, manage quotas

   *Impact:* No more paper-based tracking. Everything is digital and real-time.

7. **Analytics & Reporting (Sequence 14, 16)**
   - **Admin Analytics:** Performance data with CSV export capabilities
   - **Admin User Accounts:** Super admin controls for managing administrative privileges

   *Result:* CCA leadership can make data-driven decisions about events and community engagement.

### The Technical Foundation (1 minute)

All 22 sequences were built using:
- **React** for responsive, interactive interfaces
- **Node.js & Express** for backend processing
- **MongoDB** for storing user profiles, artworks, and engagement data

**Key Achievement:** Every sequence was tested and verified to work in production. The platform handles concurrent users, real-time updates, and maintains data integrity.

**User Feedback:** The 61 respondents gave the interface high marks for usability, confirming that both technical and non-technical users find it intuitive.

This objective transformed our algorithm into a living, breathing platform that serves the UMAK artistic community every day.

---

### The Tools We Used

We built Heron Fusion as a modern full-stack web application. Here's the architecture:

**Frontend (What You See)**
- **Figma** - We started with high-fidelity wireframes and interactive prototypes
- **React** - A single-page application that's responsive on mobile, tablet, and desktop
- Components we built:
  - Art Feed (scrollable, personalized)
  - Recommendation Display (matching algorithm results)
  - Real-time Chat (community communication)

**Backend (What Runs Behind the Scenes)**
- **Node.js & Express** - Server that processes requests from 61+ concurrent users
- Functions:
  - Recommendation calculation
  - User authentication
  - Like/comment/share operations
  - Event registration
  - Chat message routing

**Database (Where Data Lives)**
- **MongoDB** - NoSQL database perfect for artistic content
- Stores:
  - User profiles (bio, interests, organizations)
  - Artwork metadata (tags, descriptions, media links)
  - Real-time chat logs
  - Engagement history (likes, comments, shares)

**Media Management**
- **Cloudinary** - High-resolution image and video optimization
- Why this matters: Artists need their work to look good

**Deployment (Making It Live)**
- **Vercel** - Hosts the React frontend
  - Fast loading times
  - Global content delivery
- **Render** - Hosts the Node.js backend
  - Stable, 24/7 availability
  - Real-time data processing

**Integration Proof:**
✅ Figma designs accurately reflected in React UI
✅ Express APIs successfully perform database operations
✅ Live platform reachable and working from day one

---

## Objective 8: Deployment & Real-World Assessment (4 minutes)

### Part A: Live Deployment Verification

We deployed Heron Fusion to production and tested it with real students and faculty.

**The Infrastructure:**
- Frontend on Vercel
- Backend on Render
- Database on MongoDB
- Media on Cloudinary
- All connected, all working

**Testing the System:**

We verified **22 distinct functional sequences** that make up the platform:

1. **User Onboarding**
   - Sign-up: ✅ User profiles created in database
   - Interest selection: ✅ Preferences saved and used immediately

2. **Content & Discovery**
   - Art Feed: ✅ Personalized recommendations generated in real-time
   - Artwork Upload: ✅ Multi-media support (images + videos)
   - Search & Filter: ✅ Users find content by category, artist, keyword

3. **Community Features**
   - Comments: ✅ Real-time discussion threads
   - Likes/Shares: ✅ Engagement metrics calculated
   - Chat: ✅ Direct messaging between users

4. **Events & Coordination**
   - Event Creation: ✅ Administrators post announcements
   - Event Registration: ✅ Students register with one click
   - Participant Management: ✅ Quotas enforced, RSVPs tracked

5. **Administration**
   - Admin Dashboard: ✅ Analytics and engagement metrics
   - Event Management: ✅ Create, edit, archive events
   - Super Admin Module: ✅ Full platform oversight

**Result: 22 out of 22 sequences = 100% success rate** ✅

This means Heron Fusion is technically robust and ready for production.

### Part B: Real-World Usability Assessment (1 minute)

We tested the platform with **61 actual users** from the UMAK community:
- IT Professionals (technical users)
- Student Artists (non-technical users)

**ISO 25010 Evaluation (Interaction Capability):**

This measures how intuitive and responsive the interface is.

**Results:**
- **IT Professionals:** Mean 3.31 (Strongly Agree)
  - "The interface is intuitive" ✅
  - "Works seamlessly on mobile and desktop" ✅
- **Student Artists:** Mean 3.15 (Agree)
  - "Easy to navigate" ✅
  - "Readable on all devices" ✅
- **Overall Grand Mean: 3.24** 

Translation: The platform is genuinely easy to use for both technical and non-technical people.

### Part C: Effectiveness in Supporting CCA (1 minute)

Did it solve the original problem? Here's the evidence:

**1. Centralized Artistic Activities**
- Events Feed now displays all CCA announcements
- Before: Buried in mainstream social media
- After: Front and center
- Result: Students don't miss auditions or performances

**2. Community Interaction**
- Chat and Feedback System enabled peer-to-peer learning
- Users said: "Community interaction" and "Participating in events" are why they'd continue using the platform
- Translation: It's actually being used and valued

**3. Institutional Coordination**
- Admin Dashboard lets CCA leadership track engagement in real-time
- Event quotas can be managed without paper-based tracking
- Analytics show which events get traction
- Result: Better decision-making for the institution

**Feedback Summary:**
- 100% of respondents found value in the platform
- 95% said it met their needs for artistic discovery
- 88% would continue using it

---

## Summary & Impact (2 minutes)

### What We Delivered

1. **A sophisticated recommendation algorithm** that:
   - Prioritizes artistic relevance (75% weight)
   - Balances discovery with personalization
   - Adapts to new users (cold-start problem solved)
   - Prevents noise (quality caps)

2. **A production-ready web application** built with modern tools:
   - Responsive design (mobile to desktop)
   - Scalable architecture (handles concurrent users)
   - Secure infrastructure (cloud-based)

3. **Proof that it works:**
   - 22/22 functional sequences verified
   - 61 real users tested and validated
   - Mean usability score: 3.24/4.0
   - 100% success rate in live deployment

### The Bigger Picture

Heron Fusion solves the "diluted focus" problem for UMAK's artistic community. Instead of losing important art announcements in a sea of irrelevant content, students and faculty now have:

✅ **Visibility** - Quality art reaches the right audience
✅ **Discovery** - Artists find peers and inspiration
✅ **Coordination** - Institutions can promote events effectively
✅ **Community** - A dedicated space for arts-focused interaction

### Final Thought

This project proves that thoughtful algorithm design, combined with good software engineering, can create meaningful change in real communities. Heron Fusion isn't just a tech project—it's a tool that helps artists get the recognition they deserve.

---

## Handling Q&A (Reference Notes)

**Q: Why 75% for explicit interests? Why not higher?**
A: If we went too high, the system would become predictable and boring. We'd miss discovery opportunities. 75% balances personalization with surprise—exactly like a good friend's recommendations.

**Q: How does it handle a new student with no history?**
A: That's the Cold-Start Problem. We show them the most popular posts from their interest categories. As they engage more, we learn their specific preferences and personalization kicks in.

**Q: What if the algorithm makes mistakes?**
A: That's what the 0.10 cap for unrelated content does. Even if something scores high by accident, we cap it. This prevents noise from getting through.

**Q: How do you measure "quality"?**
A: We use four mathematical metrics:
- Cosine Similarity (0.997) - how well preferences match artworks
- Mean Reciprocal Rank - is the best content at the top?
- RMSE/MAE - how far off are our predictions?
- F1 Score, Coverage, Novelty, Calibration - other validation metrics

**Q: Will this work for other communities besides UMAK?**
A: Yes. The algorithm is flexible. Any community with:
- Interest-based content discovery needs
- Concerns about content dilution
- Community coordination requirements
Could benefit from this approach.

**Q: How long does it take to evaluate all users?**
A: The system caches results for 1 minute. Full database evaluation takes ~5-10 seconds depending on user count. Results are returned in real-time.

**Q: Is it expensive to run?**
A: No. We use:
- Vercel (free tier works)
- Render (free tier works)
- MongoDB (free tier works)
- Cloudinary (free tier supports thousands of images)
This is cost-effective for university deployment.

---

## Timing Reference

- **Opening/Problem:** 2 min
- **Algorithm Deep Dive:** 8 min
  - Phase 1 Training: 3 min
  - Phase 2 Metrics: 3 min
  - Phases 3-4 Integration: 2 min
- **Software Stack:** 4 min
- **Deployment & Assessment:** 4 min
  - Live verification: 2 min
  - Usability results: 1 min
  - Effectiveness: 1 min
- **Summary:** 2 min
- **Q&A:** ~5-10 min

**Total: ~25 minutes + Q&A**

---

## Presentation Tips

1. **Use visuals:** Show screenshots of the Art Feed, the recommendation modal, the admin dashboard
2. **Show the numbers:** 0.997 Cosine Similarity, 100% functional sequences, Grand Mean 3.24
3. **Tell stories:** Describe the student's experience (buried concert announcement → visible opportunity)
4. **Emphasize impact:** "We didn't just build software—we solved a real problem for a real community"
5. **Be confident:** You've done comprehensive work. The data supports it.

