import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const SocketContext = createContext();

const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const profileUpdateHandlersRef = useRef(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const cleanupSocket = useCallback((socket) => {
    if (!socket || isCleaningUp) return;
    setIsCleaningUp(true);
    
    if (socket.connected) {
      socket.disconnect();
    }
    
    if (socketRef.current === socket) {
      socketRef.current = null;
    }
    
    setIsConnected(false);
    profileUpdateHandlersRef.current.clear();
    setIsCleaningUp(false);
  }, [isCleaningUp]);

  const initSocket = useCallback(() => {
    if (socketRef.current?.connected || isCleaningUp) return;
  
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (!token) {
      console.warn('⚠️ No authentication token found');
      return;
    }

    const newSocket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: MAX_RETRIES,
      reconnectionDelay: RETRY_DELAY,
      auth: {
        token: token
      },
      query: {
        clientType: 'web'
      }
    });

    console.log('Socket.IO client version:', io.version);

    socketRef.current = newSocket;

    const debouncedConnect = debounce(() => {
      if (socketRef.current === newSocket && !newSocket.connected) {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          newSocket.auth = { token: currentToken };
          newSocket.connect();
        }
      }
    }, 1000);

    const handlers = {
      'connect': () => {
        console.log('🔌 Socket connected');
        setIsConnected(true);
        setConnectionError(null);
        setRetryCount(0);
      },
      'authenticated': (data) => {
        console.log('🔑 Socket authenticated', data);
        console.log('📋 Received onlineUsers:', data?.onlineUsers);
        if (data?.onlineUsers) {
          const onlineSet = new Set(data.onlineUsers);
          console.log('✅ Setting onlineUsers to:', Array.from(onlineSet));
          setOnlineUsers(onlineSet);
        } else {
          console.warn('⚠️ No onlineUsers in authenticated data');
        }
      },
      'auth_error': (error) => {
        console.error('❌ Socket authentication failed:', error);
        setConnectionError('Authentication failed');
        cleanupSocket(newSocket);
      },
      'connect_error': (error) => {
        console.error('❌ Socket connection error:', error);
        setIsConnected(false);
        setConnectionError(error.message);
        
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          debouncedConnect();
        }
      },
      'disconnect': (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          cleanupSocket(newSocket);
        }
      },
      'user:online': (userId) => {
        console.log('🟢 User online:', userId);
        setOnlineUsers(prev => {
          const updated = new Set([...prev, userId]);
          console.log('📊 Updated onlineUsers:', Array.from(updated));
          return updated;
        });
      },
      'user:offline': (userId) => {
        console.log('🔴 User offline:', userId);
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          updated.delete(userId);
          console.log('📊 Updated onlineUsers:', Array.from(updated));
          return updated;
        });
      },
      'profile:update': (data) => {
        console.log('📸 Profile update received:', data);
        if (data.updates) {
          profileUpdateHandlersRef.current.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              console.error('❌ Error in profile update handler:', error);
            }
          });
        }
      },
      'profile:update:error': (error) => {
        console.error('❌ Profile update error:', error);
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      newSocket.on(event, handler);
    });

    debouncedConnect();

    return () => {
      Object.keys(handlers).forEach(event => {
        newSocket.off(event);
      });
      cleanupSocket(newSocket);
    };
  }, [retryCount, isCleaningUp, cleanupSocket]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const cleanup = initSocket();
      return () => cleanup && cleanup();
    }
  }, [initSocket]);

  const emitProfileUpdate = useCallback((data) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ Socket not connected, profile update not sent');
      return false;
    }

    try {
      console.log('📤 Emitting profile update:', data);
      socketRef.current.emit('profile:update', {
        userId: data.userId,
        updates: data.updates
      });
      return true;
    } catch (error) {
      console.error('❌ Error emitting profile update:', error);
      return false;
    }
  }, []);

  const subscribeToProfileUpdates = useCallback((handler) => {
    if (typeof handler !== 'function') {
      console.error('❌ Invalid handler provided to subscribeToProfileUpdates');
      return () => {};
    }

    console.log('👂 Adding profile update subscriber');
    profileUpdateHandlersRef.current.add(handler);

    return () => {
      console.log('🔕 Removing profile update subscriber');
      profileUpdateHandlersRef.current.delete(handler);
    };
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    connectionError,
    onlineUsers: Array.from(onlineUsers),
    emit: useCallback((event, data) => {
      if (!socketRef.current?.connected) {
        console.warn('⚠️ Socket not connected, event not sent:', event);
        return false;
      }
      try {
        socketRef.current.emit(event, data);
        return true;
      } catch (error) {
        console.error('❌ Error emitting event:', error);
        return false;
      }
    }, []),
    subscribe: useCallback((event, handler) => {
      if (!socketRef.current) {
        console.warn('⚠️ Socket not initialized');
        return () => {};
      }
      socketRef.current.on(event, handler);
      return () => socketRef.current?.off(event, handler);
    }, []),
    connect: useCallback(() => {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ Cannot connect: No authentication token');
        return;
      }

      if (socketRef.current && !isConnected) {
        socketRef.current.auth = { token };
        socketRef.current.connect();
      } else if (!socketRef.current) {
        initSocket();
      }
    }, [isConnected, initSocket]),
    disconnect: useCallback(() => {
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
    }, []),
    emitProfileUpdate,
    subscribeToProfileUpdates
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext, SocketProvider, useSocket };