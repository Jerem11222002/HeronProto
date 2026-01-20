import React from 'react';
import PropTypes from 'prop-types';
import './TypingIndicator.scss';

const TypingIndicator = ({ username }) => {
  return (
    <div className="typing-indicator">
      <span className="typing-user">{username} is typing</span>
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
};

TypingIndicator.propTypes = {
  username: PropTypes.string.isRequired,
};

export default TypingIndicator;
