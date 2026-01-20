import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import SearchIcon from '@mui/icons-material/Search';
import './FriendsDropdown.scss';
import { getUserProfilePicUrl } from '../../utils/imageUrlHelper';

const FriendsDropdown = ({ 
  friends, 
  loading, 
  onFriendClick, 
  unreadCounts = {}, 
  messagePreviews = {},
  darkMode 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort friends
  const filteredFriends = useMemo(() => {
    let filtered = [...friends];

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by latest message
    return filtered.sort((a, b) => {
      const aMsg = messagePreviews[a._id]?.[0];
      const bMsg = messagePreviews[b._id]?.[0];
      if (!aMsg) return 1;
      if (!bMsg) return -1;
      return new Date(bMsg.createdAt) - new Date(aMsg.createdAt);
    });
  }, [friends, searchQuery, messagePreviews]);

  const formatTime = (date) => {
    const now = new Date();
    const msgDate = new Date(date);
    const diffMs = now - msgDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateText = (text, maxLength = 40) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Prevent scroll from bubbling up from header/search areas
  const handleHeaderTouchStart = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="friends-dropdown">
      <div className="dropdown-header">
        <span className="header-title">Messages</span>
        <span className="header-count">{filteredFriends.length}</span>
      </div>

      {/* Search Bar */}
      <div className="dropdown-search" onTouchStart={handleHeaderTouchStart}>
        <SearchIcon className="search-icon" />
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Friends List - Only this scrolls */}
      <div className="friends-list">
        {loading ? (
          <div className="dropdown-loading">Loading conversations...</div>
        ) : filteredFriends.length === 0 ? (
          <div className="no-friends">
            {friends.length === 0 ? 'No conversations yet' : 'No matches found'}
          </div>
        ) : (
          filteredFriends.map((friend) => {
            const unreadCount = unreadCounts[friend._id] || 0;
            const lastMessage = messagePreviews[friend._id]?.[0];
            const hasUnread = unreadCount > 0;

            return (
              <button
                key={friend._id}
                className={`friend-item ${hasUnread ? 'unread' : ''} ${
                  friend.isOnline ? 'online' : 'offline'
                }`}
                onClick={() => onFriendClick(friend)}
              >
                {/* Avatar Container */}
                <div className="avatar-container">
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
                  {friend.isOnline && <div className="online-indicator" title="Online" />}
                  {unreadCount > 0 && (
                    <div className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</div>
                  )}
                </div>

                {/* Friend Info */}
                <div className="friend-details">
                  <div className="friend-header">
                    <span className="friend-name">{friend.name}</span>
                    {lastMessage && (
                      <span className="message-time">{formatTime(lastMessage.createdAt)}</span>
                    )}
                  </div>
                  {lastMessage ? (
                    <p className={`message-preview ${hasUnread ? 'unread-text' : ''}`}>
                      {lastMessage.sender?._id === friend._id ? '' : 'You: '}
                      {truncateText(lastMessage.text)}
                    </p>
                  ) : (
                    <p className="message-preview no-message">No messages yet</p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      {filteredFriends.length > 0 && (
        <div className="dropdown-footer">
          <small>{filteredFriends.length} conversation{filteredFriends.length !== 1 ? 's' : ''}</small>
        </div>
      )}
    </div>
  );
};

FriendsDropdown.propTypes = {
  friends: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  onFriendClick: PropTypes.func.isRequired,
  unreadCounts: PropTypes.object,
  messagePreviews: PropTypes.object,
  darkMode: PropTypes.bool,
};

export default FriendsDropdown;
