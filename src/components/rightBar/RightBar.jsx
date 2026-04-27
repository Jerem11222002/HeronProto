import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useContext
} from "react";
import ChatPopup from "../chat/ChatPopup";
import { useSocket } from "../../context/SocketContext";
import { AuthContext } from "../../context/authContext";
import { useLanguage } from "../../hooks/useLanguage";
import "./rightBar.scss";

import { ReactComponent as IconFriends } from "./icons/friends.svg";
import { ReactComponent as IconFollowing } from "./icons/following.svg";
import { ReactComponent as IconFollowers } from "./icons/followers.svg";

const DEFAULT_AVATARS = {
  male: "/assets/person/Male.jpg",
  female: "/assets/person/Female.jpg",
  default: "/assets/person/Default.jpg"
};

const MAX_CHAT_POPUPS = 3;
const CHAT_POPUP_WIDTH = 392;

const getDefaultAvatar = (user) => {
  const gender = (user?.gender || user?.sex || "default").toLowerCase();
  return DEFAULT_AVATARS[gender] || DEFAULT_AVATARS.default;
};

/* ----------------------------- User Row ----------------------------- */

const UserRow = React.memo(({ user, isActive, onClick, compact }) => {
  const [imgError, setImgError] = useState(false);

  const avatar = useMemo(() => {
    if (imgError) return getDefaultAvatar(user);
    return user.profilePic || getDefaultAvatar(user);
  }, [user, imgError]);

  return (
    <div
      className={`user-row ${user.isOnline ? "online" : "offline"} ${
        isActive ? "active" : ""
      }`}
      onClick={() => onClick(user)}
      tabIndex={0}
      role="button"
      aria-label={`Chat with ${user.name}`}
      data-tooltip={compact ? user.name : undefined}
      onKeyDown={(e) => e.key === "Enter" && onClick(user)}
    >
      <div className="avatar-wrap">
        <img
          src={avatar}
          alt={user.name}
          onError={() => setImgError(true)}
          loading="lazy"
        />
        <span className="presence-dot" />
      </div>

      {!compact && (
        <div className="user-meta">
          <span className="name">{user.name}</span>
          {user.username && <span className="username">@{user.username}</span>}
        </div>
      )}

      <span className="chat-hint">Chat</span>
    </div>
  );
});

/* ------------------------------ Tabs ------------------------------ */

const Tabs = ({ tabs, active, onChange, compact }) => {
  return (
    <div className="tabs" role="tablist">
      {Object.values(tabs).map((tab) => (
        <button
          key={tab.id}
          className={`tab ${active === tab.id ? "active" : ""}`}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          <tab.icon />
          {!compact && <span className="label">{tab.label}</span>}
          {!compact && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
};

/* ----------------------------- RightBar ----------------------------- */

const RightBar = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("friends");
  const [openChats, setOpenChats] = useState([]);
  const [isCompact, setIsCompact] = useState(() => {
    const mq1 = window.matchMedia("(max-width: 768px)");
    const mq2 = window.matchMedia(
      "(orientation: portrait) and (max-width: 1200px)"
    );
    return mq1.matches || mq2.matches;
  });

  const { socket, isConnected, onlineUsers } = useSocket();
  const {
    currentUser,
    userRelationships,
    fetchUserRelationships
  } = useContext(AuthContext);

  const { mutualFriends = [], following = [], followers = [] } =
    userRelationships || {};

  const normalizeUsers = useCallback(
    (list) => {
      return list
        .filter((u) => u._id !== currentUser?._id)
        .map((u) => {
          const isUserOnline = onlineUsers.includes(u._id) || onlineUsers.includes(String(u._id));
          return {
            ...u,
            isOnline: isUserOnline
          };
        })
        .sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
    },
    [onlineUsers, currentUser?._id]
  );

  const usersByTab = {
    friends: normalizeUsers(mutualFriends),
    following: normalizeUsers(following),
    followers: normalizeUsers(followers)
  };

  const counts = {
    friends: mutualFriends.length,
    following: following.length,
    followers: followers.length
  };

  const handleUserClick = (user) => {
    setOpenChats((prev) => {
      if (prev.find((u) => u._id === user._id)) return prev;
      if (prev.length >= MAX_CHAT_POPUPS) return [...prev.slice(1), user];
      return [...prev, user];
    });
  };

  useEffect(() => {
    if (currentUser?._id) fetchUserRelationships(currentUser._id);
  }, [currentUser?._id, fetchUserRelationships]);

  useEffect(() => {
    const mq1 = window.matchMedia("(max-width: 768px)");
    const mq2 = window.matchMedia(
      "(orientation: portrait) and (max-width: 1200px)"
    );
    const update = () => setIsCompact(mq1.matches || mq2.matches);
    mq1.addEventListener?.("change", update) || mq1.addListener(update);
    mq2.addEventListener?.("change", update) || mq2.addListener(update);
    window.addEventListener("resize", update);
    return () => {
      mq1.removeEventListener?.("change", update) || mq1.removeListener(update);
      mq2.removeEventListener?.("change", update) || mq2.removeListener(update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <aside className={`rightBar ${isCompact ? "compact" : ""}`}>
      <div className="container">
        <Tabs
          tabs={{
            friends: { id: "friends", label: t('friends-tab'), icon: IconFriends, count: counts.friends },
            following: { id: "following", label: t('following-tab'), icon: IconFollowing, count: counts.following },
            followers: { id: "followers", label: t('followers-tab'), icon: IconFollowers, count: counts.followers }
          }}
          active={activeTab}
          onChange={setActiveTab}
          compact={isCompact}
        />

        <div className="user-list">
          {usersByTab[activeTab].length === 0 ? (
            <div className="empty">{t('no-users-yet')}</div>
          ) : (
            usersByTab[activeTab].map((user) => (
              <UserRow
                key={user._id}
                user={user}
                compact={isCompact}
                isActive={openChats.some((c) => c._id === user._id)}
                onClick={handleUserClick}
              />
            ))
          )}
        </div>
      </div>

      {openChats.map((friend, i) => (
        <ChatPopup
          key={friend._id}
          friend={friend}
          onClose={() =>
            setOpenChats((p) => p.filter((c) => c._id !== friend._id))
          }
          style={{
            position: "fixed",
            right: 24 + i * CHAT_POPUP_WIDTH,
            bottom: 24,
            zIndex: 3000 + i
          }}
        />
      ))}
    </aside>
  );
};

export default React.memo(RightBar);
