const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const commentHandlers = require('./commentHandlers');

const initializeSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        const allowed = [
          "http://localhost:3000",
          process.env.CLIENT_URL,
          ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : [])
        ].filter(Boolean);
        
        if (allowed.includes(origin) || !origin) {
          callback(null, true);
        } else {
          callback(new Error('CORS not allowed for Socket.IO'));
        }
      },
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.userId = decoded.id;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.userId);
    
    // Initialize comment handlers
    commentHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log('👤 User disconnected:', socket.userId);
    });
  });

  return io;
};

module.exports = initializeSocket;