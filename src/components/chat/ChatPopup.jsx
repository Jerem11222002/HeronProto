// src/components/chat/ChatPopup.jsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import axios from 'axios';
import Message from './Message';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import ConversationInfo from './ConversationInfo';
import MessageSearch from './MessageSearch';
import { groupMessagesByDate, getDateLabel } from '../../utils/messageGrouping';
import { getUserProfilePicUrl } from '../../utils/imageUrlHelper';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import './ChatPopup.scss';
import { useSocket } from '../../context/SocketContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ChatPopupInternal = ({ friend, onClose, style, messages: externalMessages }) => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Escape key closes popup
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Keyboard shortcuts (Ctrl+F for search, Ctrl+Shift+I for info)
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(!showSearch);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        setShowInfo(!showInfo);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [showSearch, showInfo]);

  // Load conversation
  useEffect(() => {
    if (!friend) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    axios.post(`${API_URL}/api/messages/start/${friend._id}`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        if (!isMounted) return;
        setConversationId(res.data._id);
        return axios.get(`${API_URL}/api/messages/conversations/${res.data._id}/messages`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      })
      .then(res => {
        if (!isMounted) return;
        // Backend now returns { messages: [...], pagination: {...} }
        console.log('📨 Messages response:', res?.data);
        const messagesArray = res?.data?.messages || res?.data || [];
        console.log('📨 Messages array:', messagesArray, 'is Array?', Array.isArray(messagesArray));
        setMessages(Array.isArray(messagesArray) ? messagesArray : []);
      })
      .catch(err => {
        if (isMounted) {
          setError('Failed to load messages');
          setMessages([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [friend]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    const handleUserTyping = (data) => {
      if (data.conversationId === conversationId && data.userId !== friend._id) return;
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 3000);
    };

    const handleMessageEdited = (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(msg => msg._id === data.messageId ? { ...msg, text: data.text, isEdited: true } : msg)
        );
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      }
    };

    socket.on('chat:message', handleIncomingMessage);
    socket.on('user:typing', handleUserTyping);
    socket.on('message:edited', handleMessageEdited);
    socket.on('message:deleted', handleMessageDeleted);

    return () => {
      socket.off('chat:message', handleIncomingMessage);
      socket.off('user:typing', handleUserTyping);
      socket.off('message:edited', handleMessageEdited);
      socket.off('message:deleted', handleMessageDeleted);
    };
  }, [socket, conversationId, friend._id]);

  // Join conversation room
  useEffect(() => {
    if (socket && conversationId) {
      socket.emit('join', { conversationId });
    }
  }, [socket, conversationId]);

  // Update messages from navbar
  useEffect(() => {
    if (externalMessages) {
      setMessages(Array.isArray(externalMessages) ? externalMessages : []);
    }
  }, [externalMessages]);

  // Send message
  const handleSendMessage = async (text, editingId) => {
    if (!conversationId || !text.trim()) return;

    try {
      setError(null);
      
      if (editingId) {
        // Edit existing message
        const res = await axios.put(
          `${API_URL}/api/messages/${editingId}`,
          { text },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setMessages(prev =>
          prev.map(msg => msg._id === editingId ? { ...msg, text: res.data.text, isEdited: true } : msg)
        );
        socket?.emit('message:edit', { conversationId, messageId: editingId, text });
        setEditingMessage(null);
      } else {
        // Send new message
        const res = await axios.post(
          `${API_URL}/api/messages/conversations/${conversationId}/messages`,
          { text },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setMessages(prev => [...prev, res.data]);
        socket?.emit('chat:message', {
          conversationId,
          message: res.data,
          to: friend._id
        });
      }
      setEditingMessage(null);
    } catch (err) {
      setError('Failed to send message. Retrying...');
      // Retry logic could be added here
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(
        `${API_URL}/api/messages/${messageId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
      socket?.emit('message:delete', { conversationId, messageId });
    } catch (err) {
      setError('Failed to delete message');
    }
  };

  // Copy message
  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Typing indicator
  const handleTyping = (isTypingNow) => {
    if (socket && conversationId) {
      socket.emit('user:typing', { conversationId, isTyping: isTypingNow });
    }
  };

  if (!friend) return null;

  const appliedStyle = { ...(style || {}) };
  appliedStyle.position = 'fixed';
  if ('top' in appliedStyle) delete appliedStyle.top;
  if (!('bottom' in appliedStyle)) appliedStyle.bottom = '24px';

  // Ensure messages is always an array before grouping
  const safeMessages = Array.isArray(messages) ? messages : [];
  const groupedMessages = groupMessagesByDate(safeMessages);
  const dateKeys = Object.keys(groupedMessages);

  return (
    <div className="chat-popup" style={appliedStyle}>
      <div className="header">
        <div className="friend-info">
          <img 
            src={friend.profilePicture || friend.profilePic || friend.avatar || '/assets/person/Default.jpg'} 
            alt={friend.name} 
            className="avatar"
            loading="lazy"
            onError={(e) => {
              if (e.target.src !== '/assets/person/Default.jpg') {
                e.target.src = '/assets/person/Default.jpg';
              }
            }}
          />
          <div>
            <span className="friend-name">{friend.name}</span>
            <span className={`status-dot ${friend.isOnline ? 'online' : 'offline'}`}></span>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="header-btn"
            title="Search messages (Ctrl+F)"
            aria-label="Search messages"
          >
            <SearchIcon fontSize="small" />
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="header-btn"
            title="Conversation info (Ctrl+Shift+I)"
            aria-label="Conversation info"
          >
            <InfoIcon fontSize="small" />
          </button>
          <button className="close-button" onClick={onClose} title="Close (Esc)">×</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showInfo ? (
        <ConversationInfo friend={friend} onClose={() => setShowInfo(false)} />
      ) : showSearch ? (
        <MessageSearch messages={messages} onClose={() => setShowSearch(false)} />
      ) : (
        <div className="messages">
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : safeMessages.length === 0 ? (
            <div className="empty-state">No messages yet. Say hello!</div>
          ) : (
            dateKeys.map(dateKey => (
              <div key={dateKey}>
                <div className="date-separator">{getDateLabel(dateKey)}</div>
                {groupedMessages[dateKey].map((msg) => (
                  <Message
                    key={msg._id}
                    message={msg}
                    onEdit={setEditingMessage}
                    onDelete={handleDeleteMessage}
                    onCopy={handleCopyMessage}
                    isEdited={msg.isEdited}
                    deliveryStatus={msg.deliveryStatus || 'sent'}
                  />
                ))}
              </div>
            ))
          )}
          {isTyping && <TypingIndicator username={friend.name} />}
          <div ref={messagesEndRef} />
        </div>
      )}

      {!showInfo && !showSearch && (
        <MessageInput
          onSend={handleSendMessage}
          onTyping={handleTyping}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
        />
      )}
    </div>
  );
};

ChatPopupInternal.propTypes = {
  friend: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
  }),
  onClose: PropTypes.func.isRequired,
  style: PropTypes.object,
};

const ChatPopupPortal = (props) => {
  const portalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!portalRoot) return null;
  return ReactDOM.createPortal(<ChatPopupInternal {...props} />, portalRoot);
};

export default ChatPopupPortal;