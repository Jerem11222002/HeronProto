import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import './MessageInput.scss'; // Ensure this path is correct

const MessageInput = ({ onSend }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSend(inputValue);
      setInputValue(''); // Clear input after sending
    }
  };

  // Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        onSend(inputValue);
        setInputValue('');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input">
      <textarea
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
      />
      <button type="submit" disabled={!inputValue.trim()}>Send</button>
    </form>
  );
};

MessageInput.propTypes = {
  onSend: PropTypes.func.isRequired,
};

export default MessageInput;