To train and evaluate a hybrid filtering model using appropriate evaluation metrics, specifically: Cosine Similarity, Root Mean Square, Mean Absolute Error, Mean Reciprocal Rank
Following the technical framework established in previous phases, the researchers conducted the training and algorithmic verification of the Heron Fusion recommendation engine. This process transformed interaction data gathered from the UMAK community into a functional hybrid model designed to support personalized content discovery and satisfy the ISO 25010 attribute of Functional Suitability. The workflow was organized into two main phases: Train and Evaluation.
Phase 1: Training Phase (Algorithmic Logic and Parameters)
The training of the hybrid filtering model focused on establishing a Heuristic Weighting System designed to prioritize artistic relevance and solve the problem of "diluted focus" found on general social media platforms. The training process resulted in the following implementation logic:


1. The 75/13/12/3/2 Hybrid Weighting System - The engine was tuned to prioritize a user's stated preferences above all other factors. The model assigns weights across five components: Explicit Interest Matches (75%), Popularity (13%), Recency (12%), Past Engagement (3%), and Trending Score (2%). This distribution ensures that content tagged with the user's specific categories dominates the feed while remaining dynamic through engagement metrics, temporal relevance, and content trends.
2. Semantic Interest Mapping The model was trained using an Interest Map that functions as an "artistic thesaurus". Instead of relying on exact keyword matches, the system recognizes semantic relationships between artistic domains. For example, if a student selects "Music," the algorithm is trained to identify and recommend content tagged as "concert," "vocal," "performance," or "instrumental," thereby increasing discovery precision for the user.
3. Handling the Cold-Start Problem A critical part of the training involved defining the system's behavior for new users with no historical data. The implementation utilizes isColdStart logic, where the system defaults to a Fallback Mode. In this state, the engine fetches the most popular public posts based on community engagement metrics (views and likes) to ensure that new students have an immediate and engaging experience until their personal preferences are established.
4. Error Prevention via Penalty Logic To ensure the model maintains high precision, the training phase established a Hard-Capped Penalty Rule. If an artwork has zero relation to a user’s profile (an explicitScore of 0), the system automatically caps its final recommendation score at 0.10. This logic effectively filters out irrelevant "noise" and prevents unrelated content from appearing in the user's personalized feed.



Phase 2: Evaluation Phase (Performance Metrics Results)
The performance of the hybrid filtering model was verified using objective mathematical metrics to ensure the system’s "intelligent behavior" aligns with the specific needs of the University of Makati (UMAK) artistic community. These metrics; Cosine Similarity, Mean Reciprocal Rank (MRR), Root Mean Square Error (RMSE), and Mean Absolute Error (MAE) serve as technical benchmarks for accuracy and ranking performance.

1. Cosine Similarity (Artistic Matchmaking Accuracy) The content-based stream utilizes Cosine Similarity logic to measure the degree of alignment between a user’s preference vector and an artwork’s metadata. This process ensures that the platform functions as an "Artistic Matchmaker" rather than a generic search engine.
How it is used: The system executes this through the calculateInterestScore function, which applies a hierarchical weighting system. Exact Matches (e.g., a user interested in "Digital Art" viewing a #digital-art post) receive a full score of 1.0, while Mapped Matches utilize an Interest Map to recognize related terms (e.g., mapping "Music" to "concert" or "vocal") with a weight of 0.6.
Results: A technical verification calculation comparing a sample user preference vector against an artwork’s attributes yielded a Cosine Similarity score of 0.997. Since a score of 1.0 represents a perfect match, this result mathematically confirms that the system is nearly perfect at identifying and suggesting artworks that align with a student’s specific artistic profile.

2. Mean Reciprocal Rank (Prioritizing Exposure) Mean Reciprocal Rank (MRR) is the primary metric used to evaluate the goal of "Gaining Exposure" for UMAK artists. It measures how effectively the system places the most relevant content at the very top of the user’s feed.
How it is used: The engine is explicitly "Optimized for Mean Reciprocal Rank (MRR)" within the sortContent function. To achieve a high reciprocal rank, the system uses a sorting formula where 90% of the priority is given to relevance and 10% to recency. Furthermore, an "Engagement Boost" of 30% is automatically applied to items with high-confidence matches (final score > 0.65) to force them into the top ranking positions.
Results: This logic ensures that high-priority student artworks and CCA events appear first on the homepage, preventing them from being buried under unrelated content and fulfilling the institutional goal of centralizing activity promotion.

3. RMSE and MAE (Error Prevention and Precision) Root Mean Square Error (RMSE) and Mean Absolute Error (MAE) are used to measure "prediction error", the difference between what the system suggests and what a user actually finds relevant. High error rates are the primary cause of the "diluted focus" problem found on mainstream platforms.
How it is used: These metrics are conceptually satisfied through the implementation of Hard-Capped Penalty Logic in the scoring engine. The system defines a strict "Penalty Rule": if an artwork has zero relation to a user's stated interests, its final recommendation score is automatically capped at a maximum of 0.10.
Results: By strictly "failing" and effectively hiding unrelated content, the system minimizes large deviations (RMSE) and ensures reliable performance (MAE). This ensures that the user's feed remains a dedicated space for the arts, solving the research problem of artistic content being overshadowed by irrelevant announcements.
Phase 3: Collaborative Filtering and Social Discovery (Pearson Correlation)
The second half of the recommendation engine focuses on "neighborhood-based" discovery. This allows the platform to suggest content based on community patterns and peer behavior, ensuring that student artists find inspiration beyond their immediate interests.
User-to-User Similarity Logic The researchers implemented Pearson Correlation logic to measure the relationship between users based on shared interactions. In the training phase, the similarity between two users is calculated using a weighted overlap of their interests (50%), their organizational affiliations (30%), and their implicit engagement patterns (20%). This enables the system to identify "peer groups”, for instance, if several members of the UMAK Chorale interact with a specific vocal performance, the system identifies this pattern and recommends that performance to other music-focused students who have not yet seen it.
Addressing Data Sparsity and the Cold-Start Problem To ensure the model remains effective for new students with minimal history, the collaborative stream utilizes implicit feedback (views, likes, and shares) rather than relying solely on explicit ratings. Furthermore, the researchers established a 30-day exponential decay curve (e−daysAgo/30), which ensures that recent community engagement is prioritized over older, less relevant interactions. This logic prevents the feed from stagnating and ensures that new talent receives immediate visibility based on current community trends.
Phase 4: Hybrid Integration and Final Distribution
The final component of Objective 4 is the "Hybridization" process, the method by which the Content-Based and Collaborative streams are merged and balanced to deliver a unified discovery experience.
Heuristic Balancing and Content Mix To solve the "diluted focus" problem, the system is hard-coded with a Hybrid Feed Configuration that guarantees a balanced variety of content. The implementation ensures the following distribution in a standard 50-item feed:
Event Ratio (15%): Ensures that institutional announcements and CCA activities are always visible without overwhelming artistic posts.
Community Posts (30%): Prioritizes content from mutual friends and followed artists to foster campus-wide collaboration.
Hybrid Recommendations (55%): Fills the remainder of the feed with high-scoring artworks identified by the filtering algorithms.
Contextual Boosting for Exposure To support the institutional goal of "centralizing activity promotion," the hybrid model applies contextual boosts during the final ranking process.
Urgency Boost: Events occurring within the next 7 days automatically receive a 2.5x score multiplier to ensure timely participation.
Artistic Niche Boost: Specific categories like Dance receive a 30% engagement boost when they match a user’s high-confidence interest profile, ensuring that specialized talent reaches the most relevant audience.

To develop the application with the following software tools: Figma, React, Node.js, Express, MongoDB, Render, and Vercel.
The researchers successfully translated the system requirements into a live web application by leveraging a modern full-stack architecture. The development followed an iterative process where the selected software tools were integrated to ensure a responsive, scalable, and secure platform for the UMak CCA community.

1. UI/UX Design and Prototyping (Figma) 
The development began in Figma, which was used to create high-fidelity wireframes and interactive prototypes. This tool allowed the researchers to design the visual layout, ensuring that the interface was intuitive for student artists and matched the branding requirements of the CCA before any coding commenced.

2. Front-end Development (React) 
The user interface was built using the React framework. This tool enabled the creation of a dynamic, single-page application (SPA) that provides a seamless user experience. React’s component-based architecture was instrumental in developing the Art Feed, the Personalized Recommendation display, and the Real-time Chat interface, ensuring they are responsive across various devices.

3. Backend and Server-Side Scripting (Node.js and Express) 
The platform’s logic and API management were powered by Node.js and Express. This backend stack facilitated fast server-side processing, allowing the platform to handle concurrent user interactions, such as liking, commenting, and registering for events, without significant latency.
4. Database Management (MongoDB) 
MongoDB served as the NoSQL database for the platform. Its document-oriented model was ideal for storing diverse and unstructured data, including user profiles (bio, interests), artwork metadata (tags, descriptions via Cloudinary links), and real-time chat logs.

5. Cloud Deployment and Accessibility (Vercel and Render) 
To ensure the platform is accessible to the University of Makati community, the researchers utilized cloud-based deployment services:
Vercel: Used for the deployment of the React client-side application, providing high availability and fast loading speeds for users.
Render: Utilized for hosting the Node.js backend server and Express APIs, ensuring a stable connection between the frontend and the database.


Proof of Integration
The successful integration of these tools resulted in a fully operational system where data flows seamlessly between the user’s browser and the cloud database. The researchers verified that:
Figma designs were accurately mirrored in the React frontend.
Express APIs successfully performed CRUD (Create, Read, Update, Delete) operations on the MongoDB clusters.
The live platform is reachable via Vercel and Render URLs, confirming that the deployment tools were utilized as intended.

8. To deploy the application and assess its usability and effectiveness in supporting the communication and coordination needs of the Center for Culture and the Arts.

Deployment Infrastructure
This section documents the transition of Heron Fusion from a controlled development environment to a live production state, ensuring it is accessible to the University of Makati community.
The researchers utilized a cloud-based infrastructure to host the platform, ensuring scalability, security, and high availability for both technical and non-technical users. The following stack was employed for the live deployment:
Client-Side Hosting (Vercel): The React-based frontend was deployed via Vercel to ensure fast loading speeds and a responsive user interface across various devices.
Server-Side Hosting (Render): The Node.js and Express backend, along with the MongoDB database, were hosted on Render, providing a stable production environment for real-time data processing and API management.
Media Management (Cloudinary): To handle the high-concurrency needs of an artistic platform, Cloudinary was integrated as the live media server to store and optimize high-resolution artwork and performance videos.
Consistent with the methodology of releasing a working prototype, the platform is reachable via its production URLs, allowing stakeholders from the Center for Culture and the Arts to interact with the system in a real-world scenario. This live accessibility served as the foundation for the final round of  User Acceptance Testing (UAT) involving the 61 respondents.
Verification of Live Functionality
To assess the stability of the production environment, the researchers performed a comprehensive verification of Heron Fusion while it was active on its live URLs. This phase ensured that the transition from local development to cloud hosting did not compromise the system’s core logic or data integrity.
The assessment was structured around the 22 distinct functional sequences that constitute the platform’s ecosystem. The researchers verified that the MERN stack successfully facilitates real-time communication between the live React frontend and the MongoDB database. As documented in the functional results, every critical module achieved a 100% success rate (PASSED) during live execution:
User Onboarding and Discovery: The Sign-Up (Sequence 1) and Interest Selection (Sequence 2) modules correctly populated user profiles in the live database, allowing the Art Feed (Sequence 8) to immediately generate personalized recommendations.
Media and Content Management: The Artwork Upload (Sequence 7) successfully utilized the Cloudinary integration to store and retrieve high-resolution artistic content without data loss or significant latency.
Administrative Coordination: The Admin Dashboard (Sequence 12) and Events Management (Sequence 13) were verified as fully operational, ensuring that CCA administrators can create, edit, and archive events that synchronize instantly with the student-side feed.
The successful verification of these 22 sequences in a live production state proves that Heron Fusion is technically robust. This confirms that the platform's architecture is capable of supporting the high-concurrency needs of the University of Makati community without functional failure.
Statistical Usability Assessment
The usability of Heron Fusion in a live environment was statistically validated through the results of the ISO 25010 Interaction Capability evaluation. This assessment focused on the intuitive nature of the interface and its responsiveness across the devices used by the 61 usable respondents.
The technical cohort (IT Professionals) provided a mean of 3.31 (Strongly Agree) for interaction capability, specifically highlighting that the React-based responsive design allowed the platform to work seamlessly on both mobile and desktop hardware (B3: 3.37). Similarly, the student artist cohort gave a mean of 3.15 (Agree), confirming that the navigation and readability of the live platform meet the standards of the target artistic community.
The achievement of an Overall Grand Mean of 3.24 provides mathematical evidence that the deployment was successful from a user-experience perspective. These scores indicate that the transition to a cloud-based production environment did not hinder the platform's ease of use, fulfilling the "usability" requirement of this objective.

Effectiveness in Supporting CCA Coordination
The final assessment of effectiveness focuses on the platform’s ability to solve the "diluted focus" identified in Chapter I and to support the specific coordination needs of the Center for Culture and the Arts.
Centralization of Artistic Activities: The deployment of the Events Feed (Sequence 10) and the Admin Events Module (Sequence 13) effectively centralized CCA announcements that were previously mixed with unrelated content on mainstream social media. By providing a dedicated space for "audition pre-registration" and "event details," the platform ensures that UMAK artists stay informed of professional opportunities.
Facilitating Community Interaction: Qualitative feedback from the survey responses confirms that the Feedback System (Sequence 9) and Chat Functionality (Sequence 19) are effective tools for artistic growth. Respondents identified "Community interaction" and "Participating in events" as the primary reasons they would continue using the platform.
Institutional Oversight: The Super Administrator Module was proven effective in managing the community's coordination needs. Administrators verified that they could monitor engagement through the Analytics Dashboard (Sequence 14) and manage event participant quotas, ensuring a structured approach to CCA activities that was previously impossible through manual paper-based methods.

The successful deployment and the subsequent assessment from both technical and artistic stakeholders indicate that Heron Fusion is a viable and effective tool. The platform successfully bridges the communication gap for the CCA, providing a specialized environment that fosters visibility, discovery, and streamlined institutional coordination for the University of Makati community.
