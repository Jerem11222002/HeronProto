import React, { useEffect, useState, useCallback, useMemo } from "react";
import ChatPopup from "../chat/ChatPopup";
import { useSocket } from "../../context/SocketContext";
import { useContext } from "react";
import { AuthContext } from "../../context/authContext";
import "./rightBar.scss";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DEFAULT_AVATARS = {
  male: '/assets/person/Male.jpg',
  female: '/assets/person/Female.jpg',
  default: '/assets/person/Default.jpg'
};

const TABS = {
  friends: { id: 'friends', label: 'Friends' },
  following: { id: 'following', label: 'Following' },
  followers: { id: 'followers', label: 'Followers' }
};

const MAX_CHAT_POPUPS = 3;
const CHAT_POPUP_WIDTH = 370 + 22; // width + margin

const getDefaultAvatar = (user) => {
  if (!user) return DEFAULT_AVATARS.default;
  const gender = user.gender || user.sex || 'male';
  const normalizedGender = gender?.toLowerCase()?.trim();
  return DEFAULT_AVATARS[normalizedGender] || DEFAULT_AVATARS.default;
};

const UserCard = React.memo(({ user, onUserClick }) => {
  const [imageError, setImageError] = useState(false);

  const profileImage = useMemo(() => {
    if (imageError) {
      return getDefaultAvatar(user);
    }
    try {
      // Try both fields for compatibility
      const profilePicture = user.profilePic || user.profilePicture;
      if (!profilePicture) {
        return getDefaultAvatar(user);
      }
      return profilePicture;
    } catch (error) {
      console.error('Error with profile picture:', error);
      return getDefaultAvatar(user);
    }
  }, [user, imageError]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <div className={`user ${user.isOnline ? 'online' : 'offline'}`} onClick={() => onUserClick(user)}>
      <div className="userInfo">
        <img 
          src={profileImage}
          alt={user.name}
          onError={handleImageError}
          loading="lazy"
          className={`profile-image ${imageError ? 'fallback' : ''}`}
        />
        <div className="user-details">
          <span className="user-name">{user.name}</span>
          {user.username && <span className="user-username">@{user.username}</span>}
        </div>
        <div className="status-indicator"></div>
      </div>
    </div>
  );
});

const LoadingSkeleton = () => (
  <div className="rightBar loading">
    <div className="container">
      <div className="tabs-skeleton">
        {[1,2,3].map(i => (
          <div key={i} className="tab-skeleton"></div>
        ))}
      </div>
      <div className="users-skeleton">
        {[1,2,3].map(i => (
          <div key={i} className="user-skeleton">
            <div className="avatar-skeleton"></div>
            <div className="name-skeleton"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const RightBar = () => {
  const [activeTab, setActiveTab] = useState(TABS.friends.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Multiple chat popups state
  const [openChats, setOpenChats] = useState([]); // Array of friend objects

  // Context
  const { socket, isConnected, onlineUsers, subscribeToProfileUpdates } = useSocket();
  const { 
    currentUser, 
    userRelationships, 
    fetchUserRelationships,
    updateUserRelationships,
    initialized 
  } = useContext(AuthContext);

  const { mutualFriends, following, followers } = userRelationships;

  const userLists = useMemo(() => {
    const currId = String(currentUser?._id || currentUser?.id || '');
    const norm = (list) => (Array.isArray(list) ? list.map(u => ({
      ...u,
      _id: String(u._id || u.id || ''),

      name: u.name || '',
      username: u.username || '',
      profilePic: u.profilePic || u.profilePicture || null,
      sex: u.sex || u.gender || null
    })) : []);

    const mf = norm(mutualFriends).filter(f => f._id !== currId);
    const fw = norm(following).filter(f => f._id !== currId);
    const fv = norm(followers).filter(f => f._id !== currId);

    return {
      friends: mf,
      following: fw,
      followers: fv
    };
  }, [mutualFriends, following, followers, currentUser?._id]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleProfileUpdate = (data) => {
      const { userId, profilePic } = data;
      const updateUserList = (users) => {
        if (!Array.isArray(users)) return users;
        return users.map(user => {
          if (user._id === userId) {
            return {
              ...user,
              profilePic: profilePic
            };
          }
          return user;
        });
      };
      updateUserRelationships(prev => ({
        mutualFriends: updateUserList(prev.mutualFriends),
        following: updateUserList(prev.following),
        followers: updateUserList(prev.followers)
      }));
    };

    const unsubscribe = subscribeToProfileUpdates(handleProfileUpdate);
    return () => unsubscribe();
  }, [socket, isConnected, updateUserRelationships, subscribeToProfileUpdates]);

  const handleUserClick = useCallback((user) => {
    setOpenChats((prev) => {
      const exists = prev.find(f => f._id === user._id);
      if (exists) {
        return [...prev.filter(f => f._id !== user._id), user];
      }
      if (prev.length >= MAX_CHAT_POPUPS) {
        return [...prev.slice(1), user];
      }
      return [...prev, user];
    });
  }, []);

  const handleCloseChat = (friendId) => {
    setOpenChats((prev) => prev.filter(f => f._id !== friendId));
  };

  const handleRetry = useCallback(async () => {
    if (!currentUser?._id) return;
    try {
      setLoading(true);
      setError(null);
      await fetchUserRelationships(currentUser._id);
    } catch (err) {
      setError("Failed to reload connections");
    } finally {
      setLoading(false);
    }
  }, [currentUser?._id, fetchUserRelationships]);

  useEffect(() => {
    const initializeData = async () => {
      if (!currentUser?._id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        if (!initialized) {
          await fetchUserRelationships(currentUser._id);
        }
      } catch (err) {
        setError("Failed to load connections");
      } finally {
        setLoading(false);
      }
    };
    initializeData();
  }, [currentUser?._id, fetchUserRelationships, initialized]);

  useEffect(() => {
    if (!socket || !isConnected || !currentUser?._id) return;
    const handleFollowUpdate = async () => {
      await fetchUserRelationships(currentUser._id);
    };
    socket.on('follow:updated', handleFollowUpdate);
    return () => socket.off('follow:updated', handleFollowUpdate);
  }, [socket, isConnected, currentUser?._id, fetchUserRelationships]);

  const addOnlineStatus = useCallback((users) => {
    if (!Array.isArray(users) || !currentUser?._id) return [];
    return users
      .filter(user => user._id !== currentUser._id)
      .map(user => ({
        ...user,
        isOnline: onlineUsers.includes(user._id),
        profilePic: user.profilePic || user.profilePicture || null,
        gender: user.gender || user.sex || 'male'
      }));
  }, [onlineUsers, currentUser?._id]);

  const renderUserList = useCallback((users, emptyMessage) => {
    const usersWithStatus = addOnlineStatus(users);
    return usersWithStatus.length > 0 ? (
      usersWithStatus.map((user) => (
        <UserCard 
          key={user._id} 
          user={user} 
          onUserClick={handleUserClick}
        />
      ))
    ) : (
      <div className="no-users">
        <span role="img" aria-label="no users" style={{fontSize: "2rem"}}>ðŸ‘¥</span>
        <div>{emptyMessage}</div>
      </div>
    );
  }, [addOnlineStatus, handleUserClick]);

  // compute safe counts (fallback to currentUser fields if relationships not ready)
  const counts = {
    friends: (userLists.friends?.length) ?? (currentUser?.mutualFriends?.length || 0),
    following: (userLists.following?.length) ?? (currentUser?.following?.length || 0),
    followers: (userLists.followers?.length) ?? (currentUser?.followers?.length || 0)
  };

  // tabs render: use counts for labels
  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <div className="rightBar">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={handleRetry}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rightBar">
      <div className="container">
        <div className="tabs">
          {Object.values(TABS).map(tab => (
            <button 
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} (
                {tab.id === 'friends' ? counts.friends 
                  : tab.id === 'following' ? counts.following 
                  : counts.followers}
              )
            </button>
          ))}
        </div>

        <div className="connections-list">
          {renderUserList(
            userLists[activeTab],
            `No ${activeTab} yet`
          )}
        </div>
      </div>

      {/* Multiple Chat Popups rendered outside container for correct fixed positioning */}
      {openChats.map((friend, idx) => (
        <ChatPopup
          key={friend._id}
          friend={friend}
          onClose={() => handleCloseChat(friend._id)}
          style={{
            right: 32 + idx * CHAT_POPUP_WIDTH,
            bottom: 24,
            zIndex: 2000 + idx,
            position: "fixed"
          }}
        />
      ))}
    </div>
  );
};

export default React.memo(RightBar);
