import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import './MessageInput.scss';

const MessageInput = ({ onSend, onTyping, editingMessage = null, onCancelEdit }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef();
  const typingTimeoutRef = useRef(null);

  // Load message text if editing
  useEffect(() => {
    if (editingMessage) {
      setInputValue(editingMessage.text);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const handleTyping = () => {
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 3000);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSend(inputValue, editingMessage?._id);
      setInputValue('');
      if (onCancelEdit) onCancelEdit();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        handleSubmit(e);
      }
    }
  };

  const handleCancel = () => {
    setInputValue('');
    if (onCancelEdit) onCancelEdit();
  };

  return (
    <form onSubmit={handleSubmit} className="message-input">
      {editingMessage && (
        <div className="editing-indicator">
          <span>Editing message...</span>
          <button type="button" onClick={handleCancel} className="cancel-edit">
            <CloseIcon fontSize="small" />
          </button>
        </div>
      )}
      <div className="input-wrapper">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          rows={1}
          aria-label="Message input"
        />
        <button 
          type="submit" 
          disabled={!inputValue.trim()}
          className="send-btn"
          title="Send message (Enter)"
          aria-label="Send message"
        >
          <SendIcon fontSize="small" />
        </button>
      </div>
    </form>
  );
};

MessageInput.propTypes = {
  onSend: PropTypes.func.isRequired,
  onTyping: PropTypes.func,
  editingMessage: PropTypes.object,
  onCancelEdit: PropTypes.func,
};

export default MessageInput;