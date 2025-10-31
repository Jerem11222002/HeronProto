// src/components/chat/ChatPopup.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import Message from './Message';
import MessageInput from './MessageInput';
import './ChatPopup.scss';
import { useSocket } from '../../context/SocketContext'; // Adjust the import based on your project structure

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ChatPopup = ({ friend, onClose, style, messages: externalMessages }) => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const { socket } = useSocket(); // import and use your socket context

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Escape key closes popup
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!friend) return;

    let isMounted = true;
    setLoading(true);

    // 1. Start or get conversation
    axios.post(`${API_URL}/api/messages/start/${friend._id}`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      .then(res => {
        if (!isMounted) return;
        setConversationId(res.data._id);
        // 2. Fetch messages
        return axios.get(`${API_URL}/api/messages/conversations/${res.data._id}/messages`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
      })
      .then(res => {
        if (!isMounted) return;
        setMessages(res?.data || []);
      })
      .catch(() => {
        if (isMounted) setMessages([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [friend]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    socket.on('chat:message', handleIncomingMessage);

    return () => {
      socket.off('chat:message', handleIncomingMessage);
    };
  }, [socket, conversationId]);

  // Join the conversation room for real-time updates
  useEffect(() => {
    if (socket && conversationId) {
      socket.emit('join', { conversationId });
    }
  }, [socket, conversationId]);

  // Use externalMessages if provided (for real-time updates)
  useEffect(() => {
    if (externalMessages) setMessages(externalMessages);
  }, [externalMessages]);

  if (!friend) return null;

  const handleSendMessage = async (text) => {
    if (!conversationId) return;
    try {
      const res = await axios.post(
        `${API_URL}/api/messages/conversations/${conversationId}/messages`,
        { text },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setMessages(prev => [...prev, res.data]);
      // Emit socket event for real-time update
      if (socket) {
        socket.emit('chat:message', {
          conversationId,
          message: res.data,
          to: friend._id // or friend.id, but use _id if that's what your data has
        });
      }
    } catch (err) {
      // Optionally show error to user
    }
  };

  return (
    <div className="chat-popup" style={style}>
      <div className="header">
        <div className="friend-info">
          <img src={friend.avatar || "/assets/person/Default.jpg"} alt={friend.name} className="avatar" />
          <div>
            <span className="friend-name">{friend.name}</span>
            <span className={`status-dot ${friend.isOnline ? "online" : "offline"}`}></span>
          </div>
        </div>
        <button className="close-button" onClick={onClose} title="Close (Esc)">×</button>
      </div>
      <div className="messages">
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg) => (
            <Message key={msg._id || msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput onSend={handleSendMessage} />
    </div>
  );
};

ChatPopup.propTypes = {
  friend: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
  }),
  onClose: PropTypes.func.isRequired,
  style: PropTypes.object,
};

export default ChatPopup;