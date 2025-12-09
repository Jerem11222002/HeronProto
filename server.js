const logger = require('./backend/utils/logger');
logger.info('🟢 Server.js starting...');

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./backend/config/db");
const authRoutes = require("./backend/routes/auth");
const adminAuthRoutes = require("./backend/routes/adminAuth");
const userRoutes = require("./backend/routes/userRoutes");
const settingsRoutes = require("./backend/routes/settings"); // settings router
const postRoutes = require("./backend/routes/posts");
const commentRoutes = require("./backend/routes/commentRoute");
const notificationRoutes = require("./backend/routes/notifications");
const featuredRoutes = require("./backend/routes/featured");
const profileRoutes = require("./backend/routes/profile");
const userSearchRoutes = require("./backend/routes/userSearch");
const eventRoute = require("./backend/routes/events");
const eventRegistrationRoutes = require('./backend/routes/eventRegistration'); // singular, file exists
const adminParticipantsRouter = require('./backend/routes/adminParticipants');
const adminStatsRouter = require('./backend/routes/adminDasboardStats');
const messageRoutes = require("./backend/routes/messages");
const uploadRoutes = require('./backend/routes/upload');
const adminAnalyticsRouter = require('./backend/routes/adminAnalytics');
const adminMonitoringRouter = require('./backend/routes/adminMonitoring');
const adminAccountsRouter = require('./backend/routes/adminAccounts');

const path = require("path");
const fs = require("fs");
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./backend/models/users');
const sessionStore = require('./backend/services/sessionStore');

// Constants
const CORS_OPTIONS = {
  origin: ["http://localhost:3000", "http://localhost:3001","http://localhost:3002"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // <-- Add 'PATCH' here
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires',
    'ETag',
    'x-socket-id',
    'x-client-version',
    'x-access-token'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};



// Initialize Express and Server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: '*' }
});

app.set('io', io); // <-- ADD THIS LINE

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user data to socket
    socket.userId = decoded.id;
    socket.isAdmin = decoded.isAdmin || false;
    socket.role = decoded.role || 'user';
    socket.permissions = decoded.permissions || {};

    logger.debug('🔌 Socket authenticated:', { socketId: socket.id, userId: socket.userId, isAdmin: socket.isAdmin, role: socket.role });

    next();
  } catch (error) {
    console.error('🔌 Socket auth error:', error.message);
    next(new Error('Authentication failed'));
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  logger.info('🔌 Client connected', { socketId: socket.id, userId: socket.userId, isAdmin: socket.isAdmin });

  // Join user-specific room
  socket.join(`user:${socket.userId}`);
  if (socket.isAdmin) {
    socket.join('admins');
  }

  // Join conversation room for real-time chat
  socket.on('join', ({ conversationId }) => {
    if (conversationId) {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    }
  });

  // Optionally: handle leaving a conversation room
  socket.on('leave', ({ conversationId }) => {
    if (conversationId) {
      socket.leave(conversationId);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', {
      socketId: socket.id,
      userId: socket.userId
    });
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('🔌 Socket error:', {
      socketId: socket.id,
      userId: socket.userId,
      error: error.message
    });
  });
});

// Authenticate socket and track sessions
io.on('connection', async (socket) => {
  try {
    // Token may be sent in handshake auth: { token } or query.token
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      socket.disconnect(true);
      return;
    }

    const userId = decoded?.id || decoded?._id || decoded?.userId || null;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Optionally read username from DB (fast) or decode from token
    let username = decoded?.username || decoded?.user?.username || null;
    if (!username) {
      try {
        const u = await User.findById(userId).select('username');
        if (u) username = u.username;
      } catch (e) { /* ignore */ }
    }

    const device = socket.handshake.headers['user-agent'] || 'unknown';
    const ip = socket.handshake.address || (socket.request && (socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress)) || null;

    // include isAdmin so we can filter admin sessions later
    sessionStore.addSession(socket.id, { userId, username, device, ip, isAdmin: !!socket.isAdmin });
    
    // Broadcast updated sessions/activity to admins
    io.emit('monitoring.sessions.update', { sessions: sessionStore.getSessions() });
    io.emit('monitoring.activity.update', { activity: sessionStore.getActivity() });

    socket.on('activity:heartbeat', () => {
      sessionStore.touchSession(socket.id);
    });

    socket.on('disconnect', (reason) => {
      sessionStore.removeSession(socket.id);
      io.emit('monitoring.sessions.update', { sessions: sessionStore.getSessions() });
      io.emit('monitoring.activity.update', { activity: sessionStore.getActivity() });
    });
  } catch (err) {
    console.error('socket connection error', err);
    try { socket.disconnect(true); } catch(e) {}
  }
});

app.get('/favicon.ico', (req, res) => {
  res.sendStatus(204); // No content response
});

// Express Middleware Stack
app.use(cors(CORS_OPTIONS));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Development request logging (lightweight, no headers/body dump)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    // skip logging static assets to avoid noise
    if (req.path.startsWith('/static') || req.path.startsWith('/uploads') || req.path.startsWith('/assets')) {
      return next();
    }
    logger.debug(`${req.method} ${req.path}`, { query: req.query });
    next();
  });
}

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'backend/uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_OPTIONS.origin);
    res.setHeader('Access-Control-Allow-Methods', CORS_OPTIONS.methods.join(','));
    res.setHeader('Access-Control-Allow-Headers', CORS_OPTIONS.allowedHeaders.join(','));
    if (filePath.includes('profiles')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31557600');
    }
  },
  fallthrough: false
}));

// Serve static files before auth middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'build'))); // If serving React build

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'backend/uploads');
if (!fs.existsSync(uploadsDir)) {
  logger.info('📁 Creating uploads directory:', uploadsDir);
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Auth Middleware
app.use((req, res, next) => {
  const publicPaths = [
    '/',
    '/favicon.ico',
    '/default-cover.png',
    '/assets',
    '/uploads',
    '/static',
    '/build',
    '/api/auth/login',
    '/api/auth/register',
    '/api/admin/auth/login',
    '/api/interests',
    '/socket.io'
  ];

  if (publicPaths.some(path => req.path.startsWith(path))) {
    console.log('🔓 Skipping auth check for:', req.path);
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('❌ No token provided for:', req.path);
    return res.status(401).json({ 
      success: false,
      message: 'No token provided',
      type: req.path.includes('/admin/') ? 'admin' : 'user'
    });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    console.log('✅ Token verified for:', req.path);
    next();
  } catch (err) {
    console.error('🚫 Authentication error:', {
      path: req.path,
      error: err.message
    });
    res.status(401).json({ 
      success: false,
      message: 'Invalid token',
      type: req.path.includes('/admin/') ? 'admin' : 'user'
    });
  }
});

// single concise logger for all requests in non-dev too (info level)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    // skip verbose logging for asset requests in production
    if (req.path.startsWith('/static') || req.path.startsWith('/uploads') || req.path.startsWith('/assets')) {
      return next();
    }
    logger.info(`${req.method} ${req.url}`);
    return next();
  }
  return next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", settingsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/interests", require("./backend/routes/interests"));
app.use("/api/search", require("./backend/routes/userSearch"));
app.use("/api/posts", postRoutes);
app.use("/api/featured", featuredRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/events", eventRoute);
app.use('/api/admin', adminStatsRouter);
app.use("/api/event-registrations", eventRegistrationRoutes);
app.use('/api/admin', adminParticipantsRouter);
app.use("/api/comments", commentRoutes);
app.use("/api/messages", messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin/analytics', adminAnalyticsRouter);
app.use('/api/admin/monitoring', adminMonitoringRouter);
app.use('/api/admin/accounts', adminAccountsRouter);
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// health check for quick dev diagnostics
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', time: new Date().toISOString(), pid: process.pid });
});

logger.info('🔌 Admin analytics router mounted at /api/admin/analytics');
// Error Handlers
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      details: err.message
    });
  }
  next(err);
});

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: "Route not found",
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path
  });
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// --- DEBUG: inspect imported route objects to find non-router values ---
try {
  const routeInspect = (name, obj) => {
    const t = typeof obj;
    const isRouter = !!(obj && (typeof obj === 'function' || typeof obj.use === 'function' || obj.stack));
    console.log(`ROUTE CHECK: ${name} -> type=${t}, isRouter=${isRouter}, keys=${obj && Object.keys(obj).slice(0,6)}`);
  };

  routeInspect('authRoutes', authRoutes);
  routeInspect('adminAuthRoutes', adminAuthRoutes);
  routeInspect('notificationRoutes', notificationRoutes);
  routeInspect('settingsRoutes', settingsRoutes);
  routeInspect('userRoutes', userRoutes);
  routeInspect('postRoutes', postRoutes);
  routeInspect('commentRoutes', commentRoutes);
  routeInspect('featuredRoutes', featuredRoutes);
  routeInspect('profileRoutes', profileRoutes);
  routeInspect('userSearchRoutes', userSearchRoutes);
  routeInspect('eventRoute', eventRoute);
  routeInspect('eventRegistrationRoutes', eventRegistrationRoutes);
  routeInspect('adminParticipantsRouter', adminParticipantsRouter);
  routeInspect('adminStatsRouter', adminStatsRouter);
  routeInspect('messageRoutes', messageRoutes);
  routeInspect('uploadRoutes', uploadRoutes);
  routeInspect('adminAnalyticsRouter', adminAnalyticsRouter);
  routeInspect('adminMonitoringRouter', adminMonitoringRouter);
  routeInspect('adminAccountsRouter', adminAccountsRouter);
} catch (err) {
  console.error('Route inspect error:', err);
}

// Server Startup
const startServer = async () => {
  try {
    await connectDB();
    

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`✅ Server running on http://localhost:${PORT}`);
      logger.info('🌍 Environment:', process.env.NODE_ENV || 'development');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Global Error Handling
process.on('unhandledRejection', (err) => {
  logger.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Export for testing
module.exports = { app, server, io };