const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const commentHandlers = require('./commentHandlers');

const initializeSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
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