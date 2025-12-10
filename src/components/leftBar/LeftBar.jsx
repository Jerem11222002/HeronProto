import { useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import Tooltip from '@mui/material/Tooltip';
import "./leftBar.scss";

// Icons
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import EventIcon from "@mui/icons-material/Event";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import SettingsIcon from "@mui/icons-material/Settings";
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import Badge from '@mui/material/Badge';
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";

const DEFAULT_MALE_PIC = '/assets/person/Male.jpg';
const DEFAULT_FEMALE_PIC = '/assets/person/Female.jpg';

const getDefaultProfilePic = (sex) => sex === 'female' ? DEFAULT_FEMALE_PIC : DEFAULT_MALE_PIC;

const MenuItem = ({ icon: Icon, label, path, badge, isActive, isCollapsed, onClick }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) return onClick();
    navigate(path);
  };

  return (
    <Tooltip title={isCollapsed ? label : ""} placement="right">
      <div 
        className={`menu-item ${isActive ? 'active' : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        <Badge badgeContent={badge} color="error" max={99}>
          <Icon className="icon" />
        </Badge>
        {!isCollapsed && <span className="label">{label}</span>}
      </div>
    </Tooltip>
  );
};

const UserStats = ({ following, followers, isCollapsed }) => (
  <div className="user-stats">
    <div className="stat">
      <span className="count">{following || 0}</span>
      {!isCollapsed && <span className="label">Following</span>}
    </div>
    <div className="stat">
      <span className="count">{followers || 0}</span>
      {!isCollapsed && <span className="label">Followers</span>}
    </div>
  </div>
);

const ProfileSection = ({ currentUser, isCollapsed, isLoading, onClick }) => (
  <div 
    className="user-link"
    onClick={onClick}
    style={{ cursor: isLoading ? 'wait' : 'pointer' }}
    role="button"
    tabIndex={0}
  >
    <div className="user-avatar">
      <img
        src={currentUser.profilePic || currentUser.profilePicture || getDefaultProfilePic(currentUser.gender || currentUser.sex)}
        alt={currentUser.name}
        onError={e => {
          e.target.onerror = null;
          e.target.src = getDefaultProfilePic(currentUser.gender || currentUser.sex);
        }}
      />
      <div className="online-indicator" />
    </div>
    {!isCollapsed && (
      <div className="user-info">
        <span className="name">{currentUser.name}</span>
        <span className="username">@{currentUser.username}</span>
      </div>
    )}
  </div>
);

const LeftBar = () => {
  const { currentUser, userRelationships } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const menuItems = [
    { id: 'home', icon: HomeIcon, label: 'Home', path: '/', badge: 0 },
    { 
      id: 'friends', 
      icon: PeopleIcon, 
      label: 'Friends', 
      path: currentUser ? `/profile/${currentUser._id}?tab=friends` : '/', 
      badge: 0 
    },
    { id: 'events', icon: EventIcon, label: 'Events', path: '/events', badge: 0 },
    { 
      id: 'gallery', 
      icon: PhotoLibraryIcon, 
      label: 'Gallery', 
      path: currentUser ? `/profile/${currentUser._id}?tab=gallery` : '/', 
      badge: 0 
    },
    { id: 'settings', icon: SettingsIcon, label: 'Settings', path: '/settings', badge: 0 }
  ];

  const isGalleryActive = () => {
    if (!currentUser) return false;
    return (
      location.pathname === `/profile/${currentUser._id}` &&
      new URLSearchParams(location.search).get("tab") === "gallery"
    );
  };

  const handleProfileClick = async () => {
    if (!currentUser?._id) return;
    setIsLoading(true);
    try {
      await navigate(`/profile/${currentUser._id}`);
    } catch (err) {
      console.error("Navigation failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // This is the important part: pass state to indicate gallery button was used
  const handleGalleryClick = () => {
    if (!currentUser?._id) return;
    navigate(`/profile/${currentUser._id}?tab=gallery`, { state: { fromGalleryButton: true } });
  };

  const handleFriendsClick = () => {
    if (!currentUser?._id) return;
    navigate(`/profile/${currentUser._id}?tab=friends`, { state: { fromFriendsButton: true } });
  };

  if (!currentUser) return null;

  return (
    <div className={`leftBar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="container">
        {/* Profile Section */}
        <div className="profile-section">
          <ProfileSection 
            currentUser={currentUser}
            isCollapsed={isCollapsed}
            isLoading={isLoading}
            onClick={handleProfileClick}
          />

          <UserStats 
            following={userRelationships?.following?.length}
            followers={userRelationships?.followers?.length}
            isCollapsed={isCollapsed}
          />
        </div>

        {/* Navigation */}
        <nav className="menu">
          {menuItems.map((item) => {
            let isActive = location.pathname === item.path;
            if (item.id === "gallery") {
              isActive = isGalleryActive();
            }
            if (item.id === "friends") {
              isActive =
                location.pathname === `/profile/${currentUser._id}` &&
                new URLSearchParams(location.search).get("tab") === "friends";
            }
            return (
              <MenuItem
                key={item.id}
                {...item}
                isActive={isActive}
                isCollapsed={isCollapsed}
                onClick={
                  item.id === "gallery"
                    ? handleGalleryClick
                    : item.id === "friends"
                    ? handleFriendsClick
                    : undefined
                }
              />
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <Tooltip title={isCollapsed ? "Expand" : "Collapse"}>
          <button 
            className="collapse-toggle"
            onClick={() => setIsCollapsed(prev => !prev)}
            disabled={isLoading}
          >
            {isCollapsed ? <KeyboardArrowRightIcon /> : <KeyboardArrowLeftIcon />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default LeftBar;
