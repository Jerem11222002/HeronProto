import React, { useState, useContext, useCallback, useRef, useEffect } from "react";
import "./navbar.scss";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CircularProgress from "@mui/material/CircularProgress";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { DarkModeContext } from "../../context/darkModeContext";
import { AuthContext } from "../../context/authContext";
import { useSocket } from "../../context/SocketContext";
import { getDefaultAvatar, getImageUrl } from "../../utils/imageUtils";
import NotificationBell from "../notifications/NotificationBell";
import ChatPopup from "../chat/ChatPopup";
import Badge from "@mui/material/Badge";
import MailIcon from "@mui/icons-material/Mail"; // Optional, for badge fallback
import notificationSound from '../../assets/sounds/notification.mp3'; // Add a sound file

// Create a simple initials avatar as a data-URL SVG (no external file required)
const createInitialsAvatar = (name = "User", { bg = "#8a8a8a", fg = "#fff", size = 128 } = {}) => {
  const initials = ("" + (name || "U"))
    .split(" ")
    .map((n) => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  const fontSize = Math.round(size / 2.8);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>` +
    `<rect width='100%' height='100%' fill='${bg}'/>` +
    `<text x='50%' y='50%' dy='.35em' font-family='Arial, Helvetica, sans-serif' font-size='${fontSize}' fill='${fg}' text-anchor='middle'>${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// New: simple generic silhouette user icon (data URL SVG)
const createSilhouetteIcon = ({ bg = "#e6e6e6", fg = "#777", size = 128 } = {}) => {
  const w = size;
  const h = size;
  // circle head + torso simplified shape, centered
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<rect width='100%' height='100%' fill='${bg}'/>` +
    `<g fill='${fg}' transform='translate(${w * 0.05}, ${h * 0.05}) scale(0.9)'>` +
    `<circle cx='${w/2}' cy='${h*0.28}' r='${w*0.14}' />` +
    `<path d='M${w*0.2},${h*0.75} C${w*0.2},${h*0.55} ${w*0.35},${h*0.45} ${w*0.5},${h*0.45} C${w*0.65},${h*0.45} ${w*0.8},${h*0.55} ${w*0.8},${h*0.75} C${w*0.8},${h*0.83} ${w*0.2},${h*0.83} ${w*0.2},${h*0.75} Z' />` +
    `</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const SEARCH_DEBOUNCE = 300;
const MAX_CHAT_POPUPS = 3;
const CHAT_POPUP_WIDTH = 370 + 22; // width + margin

const Navbar = () => {
  const { darkMode } = useContext(DarkModeContext);
  const { currentUser, logout } = useContext(AuthContext);
  const { socket } = useSocket();
  const navigate = useNavigate();

  // Refs
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const searchResultsRef = useRef(null);
  const audioRef = useRef(null);
  

  // State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showMobileOverlay, setShowMobileOverlay] = useState(false);
  const mobileInputRef = useRef(null);

  useEffect(() => {
    if (showMobileOverlay && mobileInputRef.current) {
      // small timeout to ensure element is mounted
      setTimeout(() => mobileInputRef.current && mobileInputRef.current.focus(), 50);
    }
  }, [showMobileOverlay]);

  // Chat dropdown state
  const [showFriendsDropdown, setShowFriendsDropdown] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Multiple chat popups state
  const [openChats, setOpenChats] = useState([]); // Array of friend objects
  const [unreadCounts, setUnreadCounts] = useState({});
  const [messagePreviews, setMessagePreviews] = useState({});

  // Search functionality
  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await axios.get(`${API_URL}/api/search/users`, {
        params: { q: query },
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        signal: controller.signal
      });

      setSearchResults(response.data.users || []);
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error("Search failed:", error);
        setSearchResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Search input handler
  const handleSearchInputChange = useCallback((e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(query);
    }, SEARCH_DEBOUNCE);
  }, [handleSearch]);

  // When the search icon is clicked: on small screens open overlay, on desktop focus input
  const handleSearchIconClick = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth <= 520) {
        setShowMobileOverlay(true);
      } else {
        const el = document.getElementById('navSearch');
        if (el) el.focus();
      }
    } catch (err) {
      setShowMobileOverlay(true);
    }
  }, []);

  // Navigation handlers
  const handleProfileClick = useCallback(async () => {
    try {
      const userId = currentUser?.id || currentUser?._id;
      if (!userId) return;
      setIsLoading(true);
      await navigate(`/profile/${userId}`);
      setDropdownOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, navigate]);

  const handleSettingsClick = useCallback(async () => {
    try {
      setIsLoading(true);
      await navigate("/settings");
      setDropdownOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    try {
      setIsLoading(true);
      await axios.post(`${API_URL}/api/auth/logout`, null, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      localStorage.clear();
      socket?.disconnect();
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.clear();
      navigate("/login", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [socket, logout, navigate]);

  // Chat dropdown handlers
  const handleMailClick = async () => {
    setShowFriendsDropdown((prev) => !prev);
    if (!showFriendsDropdown && friends.length === 0) {
      setLoadingFriends(true);
      try {
        const userId = currentUser?.id || currentUser?._id;
        const res = await axios.get(
          `${API_URL}/api/users/${userId}/mutual-friends`,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        setFriends(res.data || []);
        // Fetch previews for each friend
        const previews = {};
        await Promise.all(
          (res.data || []).map(async (friend) => {
            try {
              const previewRes = await axios.get(
                `${API_URL}/api/messages/conversations/${friend._id}/preview`,
                { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
              );
              previews[friend._id] = previewRes.data.messages || [];
            } catch {
              previews[friend._id] = [];
            }
          })
        );
        setMessagePreviews(previews);
      } catch (err) {
        setFriends([]);
      } finally {
        setLoadingFriends(false);
      }
    }
  };

  // Open a chat popup (max 3, no duplicates)
  const openChatWithFriend = (friend) => {
    setOpenChats((prev) => {
      // If already open, bring to front (move to end)
      const exists = prev.find(f => f._id === friend._id);
      if (exists) {
        return [...prev.filter(f => f._id !== friend._id), friend];
      }
      // If max popups, remove the oldest (first)
      if (prev.length >= MAX_CHAT_POPUPS) {
        return [...prev.slice(1), friend];
      }
      return [...prev, friend];
    });
  };

  // When a friend is clicked, open ChatPopup with that friend
  const handleFriendClick = async (friend) => {
    // Find the conversationId from the preview messages
    const previewMsgs = messagePreviews[friend._id] || [];
    const conversationId = previewMsgs.length > 0 ? previewMsgs[0].conversationId : null;

    if (conversationId) {
      try {
        await axios.put(
          `${API_URL}/api/messages/conversations/${conversationId}/read`,
          {},
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        // Set unread count to 0 for this friend
        setUnreadCounts((prev) => ({ ...prev, [friend._id]: 0 }));
        // Mark all preview messages as read
        setMessagePreviews((prev) => ({
          ...prev,
          [friend._id]: prev[friend._id]?.map(msg => ({ ...msg, read: true })) || []
        }));
      } catch (err) {
        // Optionally handle error
      }
    }

    openChatWithFriend({
      ...friend,
      id: friend._id,
      name: friend.name,
      profilePicture: friend.profilePicture,
      sex: friend.sex,
      isOnline: friend.isOnline,
    });
    setShowFriendsDropdown(false);
  };

  // Close a chat popup
  const handleCloseChat = (friendId) => {
    setOpenChats((prev) => prev.filter(f => f._id !== friendId));
  };

  // Fetch unread counts when user changes or on mount
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/unread-count`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setUnreadCounts(res.data.perFriend || {});
      } catch {
        setUnreadCounts({});
      }
    };
    if (currentUser) fetchUnreadCounts();
  }, [currentUser]);

  // Real-time update for message previews and chat popups via socket
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewMessage = (data) => {
      const { message, conversationId } = data;
      // Find the friendId (the other participant)
      let friendId = null;
      if (message.conversationId && message.conversationId.participants) {
        friendId = message.conversationId.participants.find(
          id => id !== currentUser._id && id !== currentUser.id
        );
      } else if (message.sender?._id && message.sender._id !== currentUser._id) {
        friendId = message.sender._id;
      } else if (message.sender && message.sender !== currentUser._id) {
        friendId = message.sender;
      }
      if (!friendId) return;

      // Only open popup and play sound if the message is NOT sent by me
      if (message.sender?._id === currentUser._id || message.sender === currentUser._id) {
        // Still update previews, but don't open a popup or play sound
        setMessagePreviews((prev) => ({
          ...prev,
          [friendId]: [{
            ...message,
            read: true
          }]
        }));
        return;
      }

      // Play notification sound
      if (audioRef.current) {
        audioRef.current.play();
      }

      // Update preview
      setMessagePreviews((prev) => ({
        ...prev,
        [friendId]: [{
          ...message,
          read: (message.readBy || []).map(id => id.toString()).includes(currentUser._id)
        }]
      }));

      // Open chat popup if not already open (and not muted)
      setOpenChats((prev) => {
        if (prev.find(f => f._id === friendId)) return prev;
        let friendObj = friends.find(f => f._id === friendId);
        if (!friendObj) {
          friendObj = { _id: friendId, name: "Unknown", profilePicture: "", isOnline: true };
        }
        if (prev.length >= MAX_CHAT_POPUPS) {
          return [...prev.slice(1), friendObj];
        }
        return [...prev, friendObj];
      });
    };

    socket.on("chat:message", handleNewMessage);

    return () => {
      socket.off("chat:message", handleNewMessage);
    };
  }, [socket, currentUser, friends]);

  // Calculate total unread
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  if (!currentUser) return null;

  return (
    <>
      <div className="navbar">
        <div className="left">
          <button
            type="button"
            className="heron-logo"
            aria-label="Go to home"
            // Use the route path (update to '/' if your Home route is registered at root)
            onClick={() => navigate("/")}
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {/* small SVG logo */}
            <span aria-hidden="true" style={{ display: "inline-flex", width: 24, height: 24 }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#5271ff" />
                <path d="M7 13 L10 9 L13 14 L17 8" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="heron-text">Heron</span>
          </button>

          <HomeOutlinedIcon
            onClick={() => navigate("/")}
            className="nav-icon"
            title="Home"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate("/"); }}
          />
          <GridViewOutlinedIcon
            onClick={() => navigate("/events")}
            className="nav-icon"
            title="Events"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate("/events"); }}
          />
          {/* unified search icon (click focuses desktop input; opens overlay on small screens) */}
          <SearchIcon
            onClick={handleSearchIconClick}
            className="nav-icon mobile-search-toggle"
            title="Search"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSearchIconClick(); }}
          />
          <div className="search-container">
            <div className="search-input-wrapper">
              {/* Screen-reader label for accessibility */}
              <label htmlFor="navSearch" className="sr-only">Search users</label>
              <input
                id="navSearch"
                name="navSearch"
                type="text"
                placeholder="Search users..."
                aria-label="Search users"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={() => setShowSearchResults(true)}
              />
            </div>
            {showSearchResults && (
              <div className="search-results" ref={searchResultsRef}>
                {isSearching ? (
                  <div className="search-loading">
                    <CircularProgress size={20} />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <Link
                      key={user._id}
                      to={`/profile/${user._id}`}
                      className="search-result-item"
                      onClick={() => setShowSearchResults(false)}
                    >
                      <img
                        src={getImageUrl(user.profilePic)}
                        alt={user.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          // prefer silhouette for neutral fallback
                          e.target.src = createSilhouetteIcon({ bg: "#f2f4f8", fg: "#99a1b3", size: 128 });
                        }}
                      />
                      <span>{user.name}</span>
                    </Link>
                  ))
                ) : searchQuery ? (
                  <div className="no-results">No users found</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="right">
          <PersonOutlinedIcon 
            onClick={handleProfileClick}
            className="nav-icon"
            title="My Profile"
          />
          {totalUnread > 0 ? (
            <Badge badgeContent={totalUnread} color="error">
              <EmailOutlinedIcon 
                onClick={handleMailClick}
                className="nav-icon"
                title="Messages"
              />
            </Badge>
          ) : (
            <EmailOutlinedIcon 
              onClick={handleMailClick}
              className="nav-icon"
              title="Messages"
            />
          )}
          {/* Friends Dropdown */}
          {showFriendsDropdown && (
            <div className="friends-dropdown">
              <div className="dropdown-header">Chats</div>
              {loadingFriends ? (
                <div className="dropdown-loading"><CircularProgress size={20} /></div>
              ) : (
                // Sort friends by latest message
                (() => {
                  const sortedFriends = [...friends].sort((a, b) => {
                    // Get the latest message timestamp for each friend
                    const aMsgs = messagePreviews[a._id] || [];
                    const bMsgs = messagePreviews[b._id] || [];
                    const aLatest = aMsgs.length > 0 ? new Date(aMsgs[aMsgs.length - 1].createdAt).getTime() : 0;
                    const bLatest = bMsgs.length > 0 ? new Date(bMsgs[bMsgs.length - 1].createdAt).getTime() : 0;
                    // Sort descending (most recent first)
                    return bLatest - aLatest;
                  });

                  return sortedFriends.length > 0 ? (
                    sortedFriends.map(friend => (
                      <div
                        key={friend._id}
                        className="friend-item"
                        onClick={() => handleFriendClick(friend)}
                      >
                        <img
                          src={getImageUrl(friend.profilePicture)}
                          alt={friend.name}
                          onError={e => {
                            e.target.onerror = null;
                            e.target.src = createSilhouetteIcon({ bg: "#f6f8fb", fg: "#8b99ad", size: 128 });
                          }}
                        />
                        <div className="friend-info">
                          <span className="friend-name">{friend.name}</span>
                          {/* Unread badge */}
                          {unreadCounts[friend._id] > 0 && (
                            <span className="unread-dot">{unreadCounts[friend._id]}</span>
                          )}
                          {/* Message preview */}
                          <div className="message-preview">
                            {messagePreviews[friend._id] && messagePreviews[friend._id].length > 0 ? (
                              [...(messagePreviews[friend._id] || [])]
                                .slice(-2)
                                .reverse()
                                .map((msg, idx) => (
                                  <div
                                    key={msg._id || idx}
                                    className={msg.read ? "preview-read" : "preview-unread"}
                                  >
                                    <span>
                                      {msg.sender === currentUser._id ? "You: " : ""}
                                      {msg.text}
                                    </span>
                                  </div>
                                ))
                            ) : (
                              <span className="no-preview">No messages</span>
                            )}
                          </div>
                        </div>
                        {friend.isOnline && <span className="online-dot" />}
                      </div>
                    ))
                  ) : (
                    <div className="no-friends">No friends found</div>
                  );
                })()
              )}
            </div>
          )}
          <NotificationBell />
          <div className="user" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <img
              src={getImageUrl(currentUser?.profilePic)}
              alt={currentUser?.name || 'User'}
              onError={e => {
                e.target.onerror = null;
                // fallback to neutral silhouette (no external file)
                e.target.src = createSilhouetteIcon({ bg: "#e9edf3", fg: "#7f8ca0", size: 128 });
              }}
              className="user-avatar"
            />
            <span>{currentUser?.name}</span>
          </div>
          
          {dropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={handleProfileClick}>
                {isLoading ? <CircularProgress size={16} /> : "Profile"}
              </div>
              <div className="dropdown-item" onClick={handleSettingsClick}>
                {isLoading ? <CircularProgress size={16} /> : "Settings"}
              </div>
              <div className="dropdown-item logout" onClick={handleLogout}>
                {isLoading ? <CircularProgress size={16} /> : "Logout"}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Mobile search overlay (opened when tapping the magnifier on small screens) */}
      {showMobileOverlay && (
        <div className="mobile-search-overlay" role="dialog" aria-label="Search users">
          <div className="mobile-search-inner">
            <SearchIcon className="nav-icon" />
            <input
              ref={mobileInputRef}
              id="mobileNavSearch"
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              onFocus={() => setShowSearchResults(true)}
            />
            <button className="close-search" onClick={() => { setShowMobileOverlay(false); setShowSearchResults(false); }} aria-label="Close search">×</button>
          </div>
          {showSearchResults && (
            <div className="search-results mobile" ref={searchResultsRef}>
              {isSearching ? (
                <div className="search-loading"><CircularProgress size={20} /></div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <Link
                    key={user._id}
                    to={`/profile/${user._id}`}
                    className="search-result-item"
                    onClick={() => { setShowSearchResults(false); setShowMobileOverlay(false); }}
                  >
                    <img
                      src={getImageUrl(user.profilePic)}
                      alt={user.name}
                      onError={(e) => { e.target.onerror = null; e.target.src = createSilhouetteIcon({ bg: "#f2f4f8", fg: "#99a1b3", size: 128 }); }}
                    />
                    <span>{user.name}</span>
                  </Link>
                ))
              ) : searchQuery ? (
                <div className="no-results">No users found</div>
              ) : null}
            </div>
          )}
        </div>
      )}
      {/* Multiple Chat Popups rendered outside navbar for correct fixed positioning */}
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
          messages={messagePreviews[friend._id]} // Pass messages for real-time sync
        />
      ))}
      <audio ref={audioRef} src={notificationSound} preload="auto" />
    </>
  );
};

export default React.memo(Navbar);