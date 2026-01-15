const logger = require('./backend/utils/logger');
logger.info('🟢 Server.js starting...');

console.log('Loading dotenv...');
require('dotenv').config();
console.log('Env loaded, MONGO_URI:', process.env.MONGO_URI ? 'set' : 'not set');
console.log('CORS_ORIGINS:', process.env.CORS_ORIGINS);
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

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
const initializeSocket = require('./backend/socket/socketIndex');

// Constants
const CORS_OPTIONS = {
  origin: (origin, cb) => {
    // allow if no origin (e.g., server-side requests / non-browser)
    if (!origin) return cb(null, true);

    // build allowlist from env
    const envList = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const clientUrl = (process.env.CLIENT_URL || '').trim();
    const frontendUrl = (process.env.FRONTEND_URL || '').trim();
    if (clientUrl) envList.push(clientUrl);
    if (frontendUrl) envList.push(frontendUrl);

    // exact match check
    if (envList.includes(origin)) {
      return cb(null, true);
    }

    // allow localhost:3000 for development (with startsWith for flexibility)
    if (origin.startsWith('http://localhost:3000')) {
      return cb(null, true);
    }

    // allow any localhost or 127.0.0.1 for development
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return cb(null, true);
      }
    } catch (e) {
      // ignore URL parse errors
    }

    // allow any Vercel-hosted origin (preview + main)
    try {
      const host = new URL(origin).hostname;
      if (host.endsWith('.vercel.app')) {
        return cb(null, true);
      }
    } catch (e) {
      // ignore URL parse errors
    }

    // still not matched
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

// Initialize Socket.IO using the dedicated socketIndex module
const io = initializeSocket(server);

// Make io accessible to routes
app.set('io', io);

app.get('/', (req, res) => {
  res.send('Server is running');
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
    res.setHeader('Access-Control-Allow-Origin', '*');  // ✅ Fixed: Use a valid string instead of the function
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Cache-Control');
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
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-reset-token',
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

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  res.sendFile(
    path.join(__dirname, 'build', 'index.html'),
    err => err && next(err)
  );
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
    console.log('Starting server on port', PORT);
    server.listen(PORT, () => {
      console.log('Server is running on port', PORT);
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