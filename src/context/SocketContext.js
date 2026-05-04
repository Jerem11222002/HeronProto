import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const MAX_RETRIES = 1;  // Reduced from 5 to fail faster
const RETRY_DELAY = 1000;  // Reduced from 2000ms to 1000ms
const CONNECTION_TIMEOUT = 3000;  // 3 second timeout before giving up

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
    console.log('[initSocket] Called');
    console.log('[initSocket] socketRef.current?.connected:', socketRef.current?.connected);
    console.log('[initSocket] isCleaningUp:', isCleaningUp);
    
    if (socketRef.current?.connected || isCleaningUp) {
      console.log('[initSocket] Early return: already connected or cleaning up');
      return;
    }
  
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    console.log('[initSocket] Token check:', {
      hasToken: !!token,
      hasAdminToken: !!localStorage.getItem('adminToken'),
      hasRegularToken: !!localStorage.getItem('token')
    });
    
    if (!token) {
      console.warn('⚠️ No authentication token found');
      return;
    }

    // Only check for existing socket if it's connected - allow retry if disconnected
    if (socketRef.current?.connected) {
      console.warn('⚠️ Socket already connected, not creating new one');
      return;
    }

    console.log('[initSocket] Creating new socket connection...');

    const newSocket = io(SOCKET_URL, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: MAX_RETRIES,
      reconnectionDelay: RETRY_DELAY,
      reconnectionDelayMax: 5000,
      timeout: CONNECTION_TIMEOUT,
      auth: {
        token: token
      },
      query: {
        clientType: 'web'
      },
      withCredentials: true,
      secure: true,
      rejectUnauthorized: false
    });

    console.log('🔌 Initializing Socket.IO client');
    console.log('📍 Socket URL:', SOCKET_URL);
    console.log('🔑 Token provided:', !!token);
    console.log('📡 Transport order: polling first, websocket as fallback');
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
        const transport = socketRef.current?.io?.engine?.transport?.name || 'unknown';
        console.log('🔌 Socket connected, id:', socketRef.current?.id);
        console.log('📡 Transport used:', transport);
        console.log('✅ Connection established');
        setIsConnected(true);
        setConnectionError(null);
      },
      'authenticated': (data) => {
        console.log('🔑 Socket authenticated', data);
        console.log('📋 Received onlineUsers:', data?.onlineUsers);
        console.log('📊 onlineUsers type:', typeof data?.onlineUsers);
        console.log('📊 onlineUsers is array:', Array.isArray(data?.onlineUsers));
        if (data?.onlineUsers) {
          const onlineSet = new Set(data.onlineUsers);
          console.log('✅ Setting onlineUsers to:', Array.from(onlineSet));
          console.log('✅ onlineUsers count:', onlineSet.size);
          setOnlineUsers(onlineSet);
        } else {
          console.warn('⚠️ No onlineUsers in authenticated data');
          console.warn('⚠️ Data keys:', Object.keys(data || {}));
        }
      },
      'auth_error': (error) => {
        console.warn('⚠️ Socket authentication failed (non-critical):', error.message);
        // Don't retry auth errors - socket is optional, app works fine without it
        cleanupSocket(newSocket);
      },
      'connect_error': (error) => {
        console.warn('⚠️ Socket connection error (non-critical):', error.message);
        setIsConnected(false);
        setConnectionError(error.message || 'Connection error');
        
        // Stop retrying on auth errors - they won't succeed without proper token setup
        if (error.message && error.message.includes('Authentication')) {
          console.warn('⚠️ Authentication error - giving up on socket connection');
          cleanupSocket(newSocket);
          return;
        }
        
        // Socket.io handles retries internally, just let it retry
        console.warn(`⚠️ Connection error: ${error.message}, socket.io will retry internally`);
      },
      'disconnect': (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          cleanupSocket(newSocket);
        }
      },
      'user:online': (userId) => {
        console.log('🟢 User online event received:', userId);
        console.log('📊 Current onlineUsers before update:', Array.from(onlineUsers));
        setOnlineUsers(prev => {
          const updated = new Set([...prev, userId]);
          console.log('📊 Updated onlineUsers after adding:', Array.from(updated));
          console.log('📊 New user count:', updated.size);
          return updated;
        });
      },
      'user:offline': (userId) => {
        console.log('🔴 User offline event received:', userId);
        console.log('📊 Current onlineUsers before update:', Array.from(onlineUsers));
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          updated.delete(userId);
          console.log('📊 Updated onlineUsers after removing:', Array.from(updated));
          console.log('📊 Remaining user count:', updated.size);
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
      'profile:updated': (data) => {
        if (data?.updates) {
          profileUpdateHandlersRef.current.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              console.error('❌ Error in profile:updated handler:', error);
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
  }, [isCleaningUp, cleanupSocket]);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    console.log('[SocketContext] useEffect triggered');
    console.log('[SocketContext] token found:', !!token);
    console.log('[SocketContext] token type:', token ? (token.startsWith('eyJ') ? 'JWT' : 'other') : 'none');
    console.log('[SocketContext] adminToken:', !!localStorage.getItem('adminToken'));
    console.log('[SocketContext] regularToken:', !!localStorage.getItem('token'));
    
    if (token) {
      console.log('[SocketContext] Calling initSocket...');
      const cleanup = initSocket();
      return () => {
        console.log('[SocketContext] Cleanup called');
        cleanup && cleanup();
      };
    } else {
      console.warn('[SocketContext] No token found, socket will not initialize');
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