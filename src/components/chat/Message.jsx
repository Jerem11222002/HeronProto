import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import './Message.scss';
import { AuthContext } from '../../context/authContext';

const Message = ({ message }) => {
  const { currentUser } = useContext(AuthContext);
  const isSent = message.sender?._id === currentUser?._id;
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`message ${isSent ? 'sent' : 'received'}`}>
      <p>{message.text}</p>
      <span className="timestamp">{formattedTime}</span>
    </div>
  );
};

Message.propTypes = {
  message: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    sender: PropTypes.object.isRequired,
    text: PropTypes.string,
    createdAt: PropTypes.string.isRequired,
  }).isRequired,
};

export default Message;