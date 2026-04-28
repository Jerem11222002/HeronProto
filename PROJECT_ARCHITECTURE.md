# HeronProto - Project Architecture

## 📋 Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Core Modules](#core-modules)
5. [Data Models](#data-models)
6. [API Architecture](#api-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Key Features](#key-features)
9. [Data Flow](#data-flow)
10. [Deployment & Configuration](#deployment--configuration)

---

## Overview

**HeronProto** is a full-stack social networking and event management platform built with the MERN stack. It facilitates user connections through event participation, social feeds, recommendations, and direct messaging.

### Core Purpose
- Enable users to discover and attend events
- Foster community through social networking (posts, comments, likes)
- Provide intelligent user recommendations
- Manage user profiles and interests
- Support real-time messaging and notifications
- Admin dashboard for analytics and monitoring

---

## Tech Stack

### Frontend
- **React** 18.x - UI library
- **Material-UI (MUI)** 5.x - Component library
- **Framer Motion** - Animation library
- **Axios** - HTTP client
- **Chart.js** - Data visualization
- **Socket.io-client** - Real-time communication
- **Cloudinary** - Image/video management
- **React Router** - Client-side routing
- **Emotion** - CSS-in-JS styling

### Backend
- **Node.js + Express** 4.x - Web server framework
- **MongoDB + Mongoose** 8.x - Database & ODM
- **Socket.io** - WebSocket support for real-time features
- **JWT (jsonwebtoken)** - Authentication
- **bcrypt/bcryptjs** - Password hashing
- **Multer** - File upload handling
- **SendGrid** - Email service
- **Redis (ioredis)** - Caching & session management
- **Node-cron** - Task scheduling

### Development & Testing
- **Jest** - Testing framework
- **dotenv** - Environment configuration
- **CORS** - Cross-origin request handling

---

## Project Structure

```
HeronProto/
├── backend/                          # Express.js API server
│   ├── config/                       # Database & configuration
│   │   └── db.js                     # MongoDB connection
│   ├── controllers/                  # Business logic
│   │   └── postsController.js
│   ├── models/                       # Mongoose schemas
│   │   ├── users.js
│   │   ├── posts.js
│   │   ├── event.js
│   │   ├── message.js
│   │   ├── notification.js
│   │   ├── comment.js
│   │   ├── activity.js
│   │   ├── conversation.js
│   │   ├── eventRegistration.js
│   │   ├── eventArchive.js
│   │   ├── interest.js
│   │   └── registrationForm.js
│   ├── routes/                       # API endpoints
│   │   ├── auth.js                   # User authentication
│   │   ├── adminAuth.js              # Admin authentication
│   │   ├── userRoutes.js             # User profile operations
│   │   ├── posts.js                  # Post CRUD operations
│   │   ├── commentRoute.js           # Comment operations
│   │   ├── notifications.js          # Notification endpoints
│   │   ├── events.js                 # Event management
│   │   ├── eventRegistration.js      # Event registration
│   │   ├── messages.js               # Messaging
│   │   ├── profile.js                # User profiles
│   │   ├── settings.js               # User settings
│   │   ├── userSearch.js             # User search functionality
│   │   ├── featured.js               # Featured content
│   │   ├── interests.js              # User interests
│   │   ├── upload.js                 # File uploads to Cloudinary
│   │   ├── metricsRoutes.js          # Metrics/analytics
│   │   ├── recommendationEvaluation.js # Recommendation testing
│   │   ├── adminParticipants.js      # Admin participant management
│   │   ├── adminDasboardStats.js     # Dashboard statistics
│   │   ├── adminAnalytics.js         # Admin analytics
│   │   ├── adminAccounts.js          # Admin account management
│   │   └── adminMonitoring.js        # System monitoring
│   ├── Middleware/                   # Express middleware
│   │   └── requestTiming.js          # Request timing/logging
│   ├── services/                     # Business services
│   │   ├── sessionStore.js           # Session management
│   │   ├── logger.js                 # Logging utility
│   │   └── [other services]
│   ├── socket/                       # WebSocket handlers
│   │   └── socketIndex.js            # Socket.io initialization
│   ├── utils/                        # Utility functions
│   ├── migrations/                   # Database migrations
│   ├── scripts/                      # Utility scripts
│   └── tests/                        # Backend tests
│
├── src/                              # React frontend
│   ├── components/                   # Reusable React components
│   │   ├── admin/                    # Admin panel components
│   │   ├── chat/                     # Chat interface components
│   │   ├── comments/                 # Comment components
│   │   ├── evenCard/                 # Event card display
│   │   ├── ErrorBoundary/            # Error handling
│   │   ├── featuredArtists/          # Featured users component
│   │   ├── leftBar/                  # Sidebar navigation
│   │   ├── modals/                   # Modal dialogs
│   │   ├── navbar/                   # Header/navigation
│   │   ├── notifications/            # Notification components
│   │   ├── post/                     # Single post display
│   │   ├── posts/                    # Posts feed
│   │   ├── registration/             # Registration components
│   │   ├── rightBar/                 # Right sidebar
│   │   ├── share/                    # Share post component
│   │   └── sharedposts/              # Shared posts display
│   ├── pages/                        # Full page components/routes
│   │   ├── admin/                    # Admin pages
│   │   ├── dashboard/                # Dashboard
│   │   ├── events/                   # Event pages
│   │   ├── home/                     # Home page
│   │   ├── login/                    # Login page
│   │   ├── register/                 # Registration page
│   │   ├── profile/                  # User profile page
│   │   ├── settings/                 # User settings
│   │   ├── interests/                # Interest selection
│   │   ├── Landing/                  # Landing page
│   │   ├── Pledge/                   # Pledge page
│   │   ├── forgot-password/          # Password recovery
│   │   ├── reset-password/           # Password reset
│   │   ├── pre-registration/         # Pre-registration
│   │   └── RecommendationTest.jsx    # Recommendation testing page
│   ├── services/                     # API service layer
│   │   ├── [API integration services]
│   │   └── Socket.io client integration
│   ├── context/                      # React Context for global state
│   ├── hooks/                        # Custom React hooks
│   ├── utils/                        # Frontend utilities
│   ├── config/                       # Frontend configuration
│   ├── assets/                       # Static assets
│   ├── types/                        # TypeScript types (if any)
│   ├── App.js                        # Root React component
│   ├── index.js                      # App entry point
│   ├── layout.scss                   # Layout styles
│   └── style.scss                    # Global styles
│
├── public/                           # Static files served by React
│   ├── index.html                    # HTML template
│   └── [static assets]
│
├── build/                            # Production build output
│
├── scripts/                          # Utility scripts
│
├── tests/                            # Test files
│
├── server.js                         # Express server entry point
├── jest.config.js                    # Jest testing config
├── jsconfig.json                     # JavaScript config
├── package.json                      # Dependencies & scripts
├── package-lock.json
├── .env                              # Environment variables (local)
├── .env.example                      # Environment template
└── .env.local                        # Local overrides
```

---

## Core Modules

### 1. **Authentication Module**
- **Files**: `backend/routes/auth.js`, `backend/routes/adminAuth.js`
- **Functionality**:
  - User registration with interest selection
  - Login with JWT token generation
  - Password reset and recovery
  - Admin authentication
  - Session management via Redis/sessionStore
- **Models**: `users.js`, `registrationForm.js`

### 2. **User Management Module**
- **Files**: `backend/routes/userRoutes.js`, `backend/routes/profile.js`
- **Functionality**:
  - User profile creation and updates
  - Profile picture management
  - User search and discovery
  - Follow/unfollow system
  - Interest management
- **Models**: `users.js`, `interest.js`

### 3. **Social Feed Module**
- **Files**: `backend/routes/posts.js`, `backend/routes/commentRoute.js`
- **Functionality**:
  - Create, read, update, delete posts
  - Like/unlike posts
  - Comment on posts
  - Post sharing
  - Feed filtering and pagination
- **Models**: `posts.js`, `comment.js`
- **Controllers**: `postsController.js`

### 4. **Event Management Module**
- **Files**: `backend/routes/events.js`, `backend/routes/eventRegistration.js`
- **Functionality**:
  - Create and manage events
  - Event registration and ticket management
  - Event categorization
  - Event search and discovery
  - Event archival
  - Featured events
- **Models**: `event.js`, `eventRegistration.js`, `eventArchive.js`

### 5. **Messaging & Notifications Module**
- **Files**: `backend/routes/messages.js`, `backend/routes/notifications.js`
- **Functionality**:
  - Real-time messaging via Socket.io
  - Conversation management
  - Push notifications
  - Activity tracking
  - Notification preferences
- **Models**: `message.js`, `notification.js`, `conversation.js`, `activity.js`
- **Socket**: `backend/socket/socketIndex.js`

### 6. **Recommendation System**
- **Files**: `backend/routes/recommendationEvaluation.js`
- **Functionality**:
  - User recommendation engine
  - Matching based on interests and activity
  - ML scoring algorithm
  - Recommendation evaluation and testing
  - Metrics tracking (MRR - Mean Reciprocal Rank)
- **Algorithm**: Natural Language Processing & statistical matching

### 7. **Admin Dashboard Module**
- **Files**: Multiple admin routes and components
- **Functionality**:
  - User and account management
  - Analytics and metrics
  - System monitoring
  - Participant management
  - Dashboard statistics
  - Admin authentication
- **Routes**: 
  - `adminAuth.js`
  - `adminAccounts.js`
  - `adminAnalytics.js`
  - `adminDasboardStats.js`
  - `adminMonitoring.js`
  - `adminParticipants.js`

### 8. **File Upload Module**
- **Files**: `backend/routes/upload.js`
- **Functionality**:
  - Image and video uploads
  - Cloudinary integration
  - File validation
  - Multiple file handling
- **Dependencies**: Multer, Cloudinary

### 9. **Settings & Configuration Module**
- **Files**: `backend/routes/settings.js`
- **Functionality**:
  - User preference management
  - Privacy settings
  - Notification preferences
  - Language/localization settings

---

## Data Models

### Core Entities

#### User (`users.js`)
```
- _id (ObjectId)
- firstName, lastName
- email, password (hashed)
- profilePicture, coverPicture
- bio, location, dateOfBirth
- interests (array of Interest IDs)
- following (array of User IDs)
- followers (array of User IDs)
- isAdmin, isFeatured
- createdAt, updatedAt
```

#### Post (`posts.js`)
```
- _id (ObjectId)
- userId (User reference)
- desc (content)
- img (image URL)
- likes (array of User IDs)
- comments (array of Comment IDs)
- shares (count)
- createdAt, updatedAt
```

#### Comment (`comment.js`)
```
- _id (ObjectId)
- postId (Post reference)
- userId (User reference)
- desc (comment text)
- likes (array of User IDs)
- createdAt, updatedAt
```

#### Event (`event.js`)
```
- _id (ObjectId)
- title, description
- date, time
- location, address
- organizer (User reference)
- category, tags
- registrations (array of EventRegistration IDs)
- maxCapacity, currentParticipants
- image, media
- isFeatured
- createdAt, updatedAt
```

#### EventRegistration (`eventRegistration.js`)
```
- _id (ObjectId)
- eventId (Event reference)
- userId (User reference)
- registrationDate
- status (registered/cancelled)
- ticketNumber
```

#### Message (`message.js`)
```
- _id (ObjectId)
- conversationId (Conversation reference)
- senderId (User reference)
- text
- readAt
- createdAt
```

#### Conversation (`conversation.js`)
```
- _id (ObjectId)
- participants (array of User IDs)
- lastMessage (Message reference)
- updatedAt
```

#### Notification (`notification.js`)
```
- _id (ObjectId)
- userId (User reference)
- type (like/comment/follow/event/message)
- actor (User reference)
- resourceId (Post/Event/etc reference)
- read (boolean)
- createdAt
```

#### Interest (`interest.js`)
```
- _id (ObjectId)
- name
- category
- description
```

#### Activity (`activity.js`)
```
- _id (ObjectId)
- userId (User reference)
- action (post/like/comment/follow/event)
- resourceId
- createdAt
```

---

## API Architecture

### REST API Endpoints

#### Authentication Endpoints
```
POST   /api/auth/register           - Register new user
POST   /api/auth/login              - User login
POST   /api/auth/forgot-password    - Request password reset
POST   /api/auth/reset-password     - Reset password
POST   /api/auth/logout             - User logout
GET    /api/auth/verify-token       - Verify JWT token
```

#### User Endpoints
```
GET    /api/users/:id               - Get user profile
PUT    /api/users/:id               - Update user profile
GET    /api/users/search/:query     - Search users
POST   /api/users/:id/follow        - Follow user
DELETE /api/users/:id/follow        - Unfollow user
GET    /api/users/:id/followers     - Get followers list
GET    /api/users/:id/following     - Get following list
```

#### Post Endpoints
```
GET    /api/posts                   - Get feed posts
POST   /api/posts                   - Create post
GET    /api/posts/:id               - Get single post
PUT    /api/posts/:id               - Update post
DELETE /api/posts/:id               - Delete post
POST   /api/posts/:id/like          - Like post
DELETE /api/posts/:id/like          - Unlike post
POST   /api/posts/:id/share         - Share post
```

#### Comment Endpoints
```
POST   /api/comments                - Create comment
GET    /api/comments/post/:postId   - Get post comments
PUT    /api/comments/:id            - Update comment
DELETE /api/comments/:id            - Delete comment
POST   /api/comments/:id/like       - Like comment
DELETE /api/comments/:id/like       - Unlike comment
```

#### Event Endpoints
```
GET    /api/events                  - Get all events
POST   /api/events                  - Create event
GET    /api/events/:id              - Get event details
PUT    /api/events/:id              - Update event
DELETE /api/events/:id              - Delete event
GET    /api/events/featured         - Get featured events
POST   /api/events/:id/register     - Register for event
DELETE /api/events/:id/register     - Cancel registration
GET    /api/events/:id/participants - Get event participants
```

#### Message Endpoints
```
GET    /api/messages/conversations  - Get user conversations
POST   /api/messages/conversations  - Start new conversation
GET    /api/messages/:conversationId - Get conversation messages
POST   /api/messages                - Send message
DELETE /api/messages/:id            - Delete message
PUT    /api/messages/:id/read       - Mark message as read
```

#### Notification Endpoints
```
GET    /api/notifications           - Get user notifications
POST   /api/notifications/:id/read  - Mark notification as read
DELETE /api/notifications/:id       - Delete notification
DELETE /api/notifications           - Clear all notifications
GET    /api/notifications/unread    - Get unread count
```

#### Recommendation Endpoints
```
GET    /api/recommendations         - Get user recommendations
GET    /api/recommendations/test    - Evaluate recommendation quality
POST   /api/recommendations/metrics - Log recommendation metrics
```

#### Admin Endpoints
```
GET    /api/admin/accounts          - Get all user accounts
PUT    /api/admin/accounts/:id      - Update account
DELETE /api/admin/accounts/:id      - Deactivate/delete account
GET    /api/admin/analytics         - Get analytics data
GET    /api/admin/stats             - Get dashboard stats
GET    /api/admin/participants      - Get event participants
GET    /api/admin/monitoring        - Get system monitoring data
POST   /api/admin/auth/login        - Admin login
```

### WebSocket Events (Socket.io)

**Real-time Events:**
- `message` - New message
- `typing` - User typing indicator
- `notification` - New notification
- `online/offline` - User presence
- `post-update` - Post liked/commented
- `event-update` - Event changes

---

## Frontend Architecture

### React Component Hierarchy

```
App
├── Router (React Router)
│   ├── PublicLayout
│   │   ├── Landing Page
│   │   ├── Login
│   │   ├── Register
│   │   ├── Pre-Registration
│   │   ├── Forgot Password
│   │   └── Reset Password
│   │
│   └── PrivateLayout
│       ├── Navbar
│       ├── LeftBar
│       ├── MainContent
│       │   ├── Home
│       │   │   ├── Posts Feed
│       │   │   ├── Post Card
│       │   │   │   ├── Comments
│       │   │   │   └── Like/Share Actions
│       │   │   └── Create Post Modal
│       │   ├── Profile
│       │   │   ├── Profile Header
│       │   │   ├── User Info
│       │   │   ├── User Posts
│       │   │   └── Followers/Following Lists
│       │   ├── Events
│       │   │   ├── Event List
│       │   │   ├── Event Card
│       │   │   ├── Event Details
│       │   │   └── Event Registration
│       │   ├── Messages
│       │   │   ├── Conversations List
│       │   │   └── Chat Window
│       │   ├── Notifications
│       │   │   └── Notification List
│       │   ├── Settings
│       │   │   ├── Profile Settings
│       │   │   ├── Privacy Settings
│       │   │   ├── Notification Preferences
│       │   │   └── Account Settings
│       │   ├── Interests
│       │   │   └── Interest Selection
│       │   ├── Admin Dashboard
│       │   │   ├── Analytics
│       │   │   ├── User Management
│       │   │   ├── Event Management
│       │   │   ├── System Monitoring
│       │   │   └── Dashboard Stats
│       │   └── Pledge/Featured
│       │
│       └── RightBar
│           ├── Featured Users
│           ├── Recommendations
│           └── Suggested Events
```

### State Management

- **React Context API** - Global state (authentication, user data)
- **Local Component State** - UI state (modals, forms)
- **Redis/sessionStore** - Backend session management
- **Socket.io** - Real-time state sync

### API Service Layer

Services in `src/services/`:
- `authService.js` - Authentication API calls
- `userService.js` - User profile API
- `postService.js` - Posts API
- `eventService.js` - Events API
- `messageService.js` - Messaging API
- `notificationService.js` - Notifications API
- `recommendationService.js` - Recommendations API

---

## Key Features

### 1. **User Profiles**
- Customizable profiles with pictures and bio
- Follow/follower system
- Interest selection and management
- Profile visibility and privacy controls

### 2. **Social Feed**
- Post creation with images
- Like, comment, and share functionality
- Feed filtering by interests and followers
- Real-time feed updates

### 3. **Event Management**
- Event creation and discovery
- User registration and capacity management
- Event categorization and search
- Featured events
- Event archival for historical data

### 4. **Messaging**
- Real-time 1-on-1 conversations
- Conversation history
- Typing indicators
- Message read receipts
- User presence (online/offline)

### 5. **Notifications**
- Multi-type notifications (likes, comments, follows, events)
- Read/unread tracking
- Notification preferences
- Real-time push notifications

### 6. **Recommendation Engine**
- Intelligent user matching based on interests
- ML-based scoring algorithm
- Mean Reciprocal Rank (MRR) evaluation
- Continuous improvement through metrics

### 7. **Admin Dashboard**
- User and account management
- Analytics and reporting
- System monitoring
- Event and participant management
- Admin authentication and authorization

### 8. **Media Management**
- Image and video uploads via Cloudinary
- Multi-media gallery support
- Optimization and transformation
- CDN delivery

---

## Data Flow

### User Registration & Authentication Flow
```
1. User → Register Page (Frontend)
2. Submit form with email, password, interests
3. Backend validates and hashes password
4. User document created in MongoDB
5. JWT token generated and returned
6. Token stored in localStorage (Frontend)
7. User redirected to home page
```

### Post Creation Flow
```
1. User creates post with optional image
2. Image uploaded to Cloudinary (optional)
3. Post document created with user ID
4. Post added to feed
5. Notification sent to followers
6. Real-time update via Socket.io to connected clients
```

### Event Registration Flow
```
1. User views event details
2. Clicks register button
3. EventRegistration document created
4. Event participant count incremented
5. User added to event participant list
6. Confirmation notification sent
7. Real-time feed update with event participation
```

### Message Flow
```
1. User sends message via chat UI
2. Message emitted via Socket.io to backend
3. Message document created in MongoDB
4. Message broadcast to recipient via Socket
5. Recipient receives real-time notification
6. Message stored in Conversation
7. Conversation lastMessage updated
```

### Recommendation Flow
```
1. Frontend requests recommendations for user
2. Backend retrieves user interests and activity
3. Recommendation algorithm ranks all potential matches
4. Top matches returned (typically 5-10)
5. Metrics (MRR, accuracy) calculated
6. Results displayed in RightBar component
7. User can interact with recommendations
```

---

## Deployment & Configuration

### Environment Variables

**.env file structure:**
```
# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Server
PORT=5000
NODE_ENV=production

# Frontend
REACT_APP_API_URL=https://api.example.com
CLIENT_URL=https://example.com
FRONTEND_URL=https://example.com

# CORS
CORS_ORIGINS=https://example.com,https://www.example.com

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d

# Cloudinary
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# SendGrid
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@example.com

# Redis
REDIS_URL=redis://localhost:6379

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password
```

### Build & Deployment

**Development:**
```bash
npm install
npm start              # Starts both frontend and backend
npm run dev           # Development mode with nodemon
```

**Production:**
```bash
npm run build          # Build React frontend
npm start             # Start server (serves built React)
```

### Database Migrations
- Located in `backend/migrations/`
- Run before major updates
- Handle schema changes and data transformations

---

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading** - Components and routes loaded on demand
2. **Image Optimization** - Cloudinary transformations for responsive sizes
3. **Caching** - Redis for sessions and frequently accessed data
4. **Pagination** - Feed and list pagination to reduce payload
5. **Database Indexing** - Indexes on frequently queried fields
6. **Request Limiting** - Rate limiting via express-rate-limit
7. **Real-time Sync** - Socket.io for instant updates without polling

### Monitoring
- Server logging via custom logger
- Request timing middleware
- Admin monitoring dashboard
- Error tracking and reporting

---

## Security Measures

### Authentication & Authorization
- JWT-based authentication
- bcrypt password hashing
- Secure session management
- Admin role-based access

### Data Protection
- CORS configuration
- Input validation on all routes
- SQL/NoSQL injection prevention
- Rate limiting for API endpoints

### Infrastructure
- Environment variable isolation
- HTTPS in production
- Secure Cloudinary integration
- JWT secret management

---

## Future Architecture Considerations

1. **Microservices** - Separate services for messaging, events, recommendations
2. **Message Queue** - Job queue (Bull/Kafka) for async operations
3. **GraphQL** - Consider GraphQL API layer
4. **Search Enhancement** - Full-text search with Elasticsearch
5. **Analytics** - Advanced analytics pipeline
6. **Machine Learning** - Improved recommendation models
7. **CDN** - Global CDN for static assets and images
8. **Containerization** - Docker for consistent deployments

---

## Testing Architecture

### Test Files
- Located in `backend/tests/` and `tests/` directories
- Jest configuration in `jest.config.js`
- Integration tests for API endpoints
- Unit tests for business logic

### Testing Strategy
- Unit tests for utilities and services
- Integration tests for API routes
- End-to-end tests for critical workflows
- Performance testing for database queries

---

**Last Updated**: April 2026
**Tech Stack**: MERN (MongoDB, Express, React, Node.js)
**Status**: Production-ready with continuous improvements
