import React from 'react';
import PropTypes from 'prop-types';
import CloseIcon from '@mui/icons-material/Close';
import { getUserProfilePicUrl } from '../../utils/imageUrlHelper';
import './ConversationInfo.scss';

const ConversationInfo = ({ friend, onClose }) => {
  return (
    <div className="conversation-info">
      <div className="info-header">
        <h3>Conversation Info</h3>
        <button onClick={onClose} className="close-btn" title="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="info-content">
        <div className="friend-profile">
          <img
            src={getUserProfilePicUrl(friend)}
            alt={friend.name}
            className="profile-img"
            onError={(e) => {
              e.target.src = '/assets/person/Default.jpg';
            }}
          />
          <div className="profile-info">
            <h4>{friend.name}</h4>
            <span className={`status ${friend.isOnline ? 'online' : 'offline'}`}>
              {friend.isOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>
        </div>

        <div className="info-section">
          <h5>About</h5>
          <p className="info-item">
            <span className="label">Status:</span>
            <span className="value">{friend.isOnline ? 'Active now' : 'Inactive'}</span>
          </p>
        </div>

        <div className="info-section">
          <h5>Options</h5>
          <button className="info-action">🔔 Mute Notifications</button>
          <button className="info-action">📌 Pin Conversation</button>
          <button className="info-action danger">🗑️ Delete Conversation</button>
        </div>

        <div className="info-footer">
          <small>Started chatting recently</small>
        </div>
      </div>
    </div>
  );
};

ConversationInfo.propTypes = {
  friend: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ConversationInfo;
