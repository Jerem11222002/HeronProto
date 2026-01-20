import React, { useContext, useState } from 'react';
import PropTypes from 'prop-types';
import './Message.scss';
import { AuthContext } from '../../context/authContext';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DoneIcon from '@mui/icons-material/Done';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const Message = ({ message, onEdit, onDelete, onCopy, isEdited, deliveryStatus = 'sent' }) => {
  const { currentUser } = useContext(AuthContext);
  const isSent = message.sender?._id === currentUser?._id;
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleCopy = () => {
    onCopy?.(message.text);
    setShowContextMenu(false);
  };

  const handleEdit = () => {
    onEdit?.(message);
    setShowContextMenu(false);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this message?')) {
      onDelete?.(message._id);
      setShowContextMenu(false);
    }
  };

  const getDeliveryStatusIcon = () => {
    if (!isSent) return null;
    if (deliveryStatus === 'sending') return <DoneIcon className="status-icon sending" title="Sending" />;
    if (deliveryStatus === 'sent') return <DoneIcon className="status-icon sent" title="Sent" />;
    if (deliveryStatus === 'read') return <DoneAllIcon className="status-icon read" title="Read" />;
    if (deliveryStatus === 'failed') return <span className="status-icon failed" title="Failed">✕</span>;
    return null;
  };

  return (
    <>
      <div 
        className={`message ${isSent ? 'sent' : 'received'}`}
        onContextMenu={handleContextMenu}
      >
        <div className="message-content">
          <p className="message-text">{message.text}</p>
          {isEdited && <span className="edited-label">(edited)</span>}
        </div>
        <div className="message-footer">
          <span className="timestamp">{formattedTime}</span>
          {getDeliveryStatusIcon()}
        </div>
        {isSent && (
          <button 
            className="context-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(!showContextMenu);
            }}
            title="More options"
          >
            <MoreVertIcon fontSize="small" />
          </button>
        )}
      </div>

      {showContextMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setShowContextMenu(false)} />
          <div className="context-menu" style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}>
            <button onClick={handleCopy} className="context-menu-item">
              📋 Copy
            </button>
            <button onClick={handleEdit} className="context-menu-item">
              ✏️ Edit
            </button>
            <button onClick={handleDelete} className="context-menu-item delete">
              🗑️ Delete
            </button>
          </div>
        </>
      )}
    </>
  );
};

Message.propTypes = {
  message: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    sender: PropTypes.object.isRequired,
    text: PropTypes.string,
    createdAt: PropTypes.string.isRequired,
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onCopy: PropTypes.func,
  isEdited: PropTypes.bool,
  deliveryStatus: PropTypes.oneOf(['sending', 'sent', 'read', 'failed']),
};

export default Message;