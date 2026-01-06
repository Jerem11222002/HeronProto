const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const commentHandlers = require('./commentHandlers');
const sessionStore = require('../services/sessionStore');

const initializeSocket = (server) => {
  const io = socketIo(server, {
    path: '/socket.io/',
    cors: {
      origin: (origin, callback) => {
        const allowed = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          process.env.CLIENT_URL,
          process.env.FRONTEND_URL,
          ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : [])
        ].filter(Boolean);
        
        // Allow if origin is in allowed list
        if (allowed.includes(origin)) {
          return callback(null, true);
        }
        
        // Allow if no origin (like server-side requests)
        if (!origin) {
          return callback(null, true);
        }
        
        // Allow any localhost for development
        try {
          const url = new URL(origin);
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return callback(null, true);
          }
        } catch (e) {
          // ignore
        }

        console.warn('⚠️ CORS rejected origin:', origin);
        return callback(new Error('CORS not allowed for Socket.IO'));
      },
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Track online users
  const onlineUsers = new Set();

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        console.warn('⚠️ Socket auth: No token provided');
        return next(new Error('Authentication error'));
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          console.warn('⚠️ Socket auth: Token verification failed', err.message);
          return next(new Error('Authentication error'));
        }
        socket.userId = decoded.id;
        socket.isAdmin = decoded.isAdmin || false;
        socket.role = decoded.role || 'user';
        socket.permissions = decoded.permissions || {};
        console.log('✅ Socket authenticated:', socket.userId);
        next();
      });
    } catch (error) {
      console.error('❌ Socket middleware error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.userId);
    
    // Add user to online users set
    onlineUsers.add(socket.userId);
    console.log('📊 Current online users:', Array.from(onlineUsers));
    
    // Send current online users to the connected client
    socket.emit('authenticated', { onlineUsers: Array.from(onlineUsers) });
    console.log('✅ Sent authenticated event to', socket.userId);
    
    // Broadcast that this user is now online to all other connected clients
    socket.broadcast.emit('user:online', socket.userId);
    
    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    if (socket.isAdmin) {
      socket.join('admins');
    }

    // Track session for monitoring
    const device = socket.handshake.headers['user-agent'] || 'unknown';
    const ip = socket.handshake.address || (socket.request && (socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress)) || null;
    sessionStore.addSession(socket.id, { userId: socket.userId, username: socket.username, device, ip, isAdmin: socket.isAdmin });
    
    // Broadcast updated sessions/activity to admins
    io.emit('monitoring.sessions.update', { sessions: sessionStore.getSessions() });
    io.emit('monitoring.activity.update', { activity: sessionStore.getActivity() });

    // Join conversation room for real-time chat
    socket.on('join', ({ conversationId }) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
      }
    });

    socket.on('leave', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(conversationId);
        console.log(`Socket ${socket.id} left conversation ${conversationId}`);
      }
    });

    socket.on('activity:heartbeat', () => {
      sessionStore.touchSession(socket.id);
    });

    // Initialize comment handlers
    try {
      commentHandlers(io, socket);
    } catch (error) {
      console.error('❌ Error initializing comment handlers:', error);
    }

    socket.on('disconnect', () => {
      console.log('👤 User disconnected:', socket.userId);
      
      // Remove user from online users set
      onlineUsers.delete(socket.userId);
      console.log('📊 Current online users:', Array.from(onlineUsers));
      
      // Broadcast that this user is now offline to all connected clients
      socket.broadcast.emit('user:offline', socket.userId);
      
      // Remove from session tracking
      sessionStore.removeSession(socket.id);
      io.emit('monitoring.sessions.update', { sessions: sessionStore.getSessions() });
      io.emit('monitoring.activity.update', { activity: sessionStore.getActivity() });
    });

    socket.on('error', (error) => {
      console.error('🔌 Socket error:', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
    });
  });

  console.log('✅ Socket.IO initialized successfully');
  return io;
};

module.exports = initializeSocket;