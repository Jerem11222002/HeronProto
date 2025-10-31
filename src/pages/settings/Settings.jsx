import React, { useState, useRef, useContext, useEffect } from 'react';
import './Settings.scss';
import { DarkModeContext } from '../../context/darkModeContext';

// Backend base (use REACT_APP_API_BASE in .env or fallback)
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
const USER_INFO_ENDPOINT = `${API_BASE}/api/users/me`;
const SETTINGS_ENDPOINT = `${API_BASE}/api/users/settings`;
const DELETE_ACCOUNT_ENDPOINT = `${API_BASE}/api/users/delete-account`;

const getAuthHeaders = () => {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const Settings = () => {
  const [userId, setUserId] = useState(null); // <-- new

  // State for user input
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);

  // New features
  const [language, setLanguage] = useState('en');
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
  });
  const [privacy, setPrivacy] = useState('public');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef();

  // Dark mode context (may not provide setDarkMode in some mounts)
  const { darkMode, setDarkMode } = useContext(DarkModeContext) || {};
  // For select value
  const [themeSelect, setThemeSelect] = useState(darkMode ? 'dark' : 'light');

  // User's current profile picture URL
  const [profilePicUrl, setProfilePicUrl] = useState(null);

  // Fetch user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch(USER_INFO_ENDPOINT, {
          credentials: 'include',
          headers: {
            ...getAuthHeaders()
          }
        });
        if (res.ok) {
          const user = await res.json();
          setUserId(user._id || user.id || null); // <-- new
          setUsername(user.username || '');
          setEmail(user.email || '');
          // prefer customization object if present
          setLanguage(user.customization?.language || user.language || 'en');
          setPrivacy(user.customization?.visibility || user.privacy || 'public');
          setNotifications(user.notifications || { email: true, push: false, sms: false });
          // backend uses profilePic; tolerate both keys
          const pic = user.profilePic || user.profilePicture || null;
          setProfilePicUrl(pic);
          setProfilePreview(pic);
          // Sync theme from server if provided (may be under customization)
          const serverTheme = user.customization?.theme || user.theme || null;

          // prefer a previously applied local setting if server doesn't have a theme
          const storedDark = (() => {
            try {
              const s = localStorage.getItem('darkMode');
              if (s === 'true') return 'dark';
              if (s === 'false') return 'light';
              return null;
            } catch (e) { return null; }
          })();

          if (serverTheme) {
            setThemeSelect(serverTheme);
            if (setDarkMode) setDarkMode(serverTheme === 'dark');
            else applyThemeLocally(serverTheme);
          } else if (storedDark) {
            // honor local preference if server hasn't stored a theme yet
            setThemeSelect(storedDark);
            if (setDarkMode) setDarkMode(storedDark === 'dark');
            else applyThemeLocally(storedDark);
          } else {
            setThemeSelect(darkMode ? 'dark' : 'light');
            if (!setDarkMode) applyThemeLocally(darkMode ? 'dark' : 'light');
          }
        } else {
          // optional: handle unauthorized etc.
        }
      } catch (err) {
        // Optionally handle error
      }
    };
    fetchUserInfo();
  }, []); // run once on mount

  // Sync select with context
  useEffect(() => {
    setThemeSelect(darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Handle theme change
  const applyThemeLocally = (value) => {
    if (value === 'dark') {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }
  };

  const handleThemeChange = (e) => {
    const value = e.target.value;
    setThemeSelect(value);

    // apply immediately to the document for instant feedback
    applyThemeLocally(value);

    // keep provider in sync if available
    if (typeof setDarkMode === 'function') {
      try { setDarkMode(value === 'dark'); } catch (err) { /* ignore */ }
    }
    // Optionally handle "system" here
  };

  // Handle profile picture preview
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    setProfilePicture(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setProfilePreview(profilePicUrl);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    // Password validation
    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setLoading(true);

    // Prepare data to send to the backend
    const formData = new FormData();
    if (username) formData.append('username', username);
    if (email) formData.append('email', email);
    if (currentPassword) formData.append('currentPassword', currentPassword);
    if (newPassword) formData.append('newPassword', newPassword);
    formData.append('theme', themeSelect);
    formData.append('language', language);
    formData.append('privacy', privacy);
    formData.append('notifications', JSON.stringify(notifications));
    if (profilePicture) {
      formData.append('profilePicture', profilePicture);
    }

    try {
      const response = await fetch(SETTINGS_ENDPOINT, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          ...getAuthHeaders() // do not set Content-Type for FormData
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMsg('Settings updated successfully!');
        const updatedPic = data.profilePic || data.profilePicture;
        if (updatedPic) {
          setProfilePicUrl(updatedPic);
          setProfilePreview(updatedPic);
        }
        const returnedTheme = data.theme || data.customization?.theme;
        if (returnedTheme) {
          setThemeSelect(returnedTheme);
          try {
            if (typeof setDarkMode === 'function') {
              setDarkMode(returnedTheme === 'dark');
            } else {
              applyThemeLocally(returnedTheme);
            }
          } catch (e) {
            applyThemeLocally(returnedTheme);
          }

          // persist canonical theme and per-user theme key so it survives logout
          try {
            localStorage.setItem('theme', returnedTheme);
            if (userId) {
              localStorage.setItem(`userTheme_${userId}`, returnedTheme);
            }
            // also update stored currentUser if present
            const stored = localStorage.getItem('currentUser');
            if (stored) {
              try {
                const cu = JSON.parse(stored);
                cu.customization = cu.customization || {};
                cu.customization.theme = returnedTheme;
                localStorage.setItem('currentUser', JSON.stringify(cu));
              } catch (err) { /* ignore parse error */ }
            }
          } catch (err) { /* ignore storage errors */ }
        }
      } else {
        const errBody = await response.json().catch(()=>null);
        setErrorMsg(errBody?.message || 'Error updating settings.');
      }
    } catch (error) {
      setErrorMsg('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const response = await fetch(DELETE_ACCOUNT_ENDPOINT, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            ...getAuthHeaders()
          }
        });
      if (response.ok) {
        setSuccessMsg('Account deleted.');
        // Optionally redirect or log out
      } else {
        setErrorMsg('Failed to delete account.');
      }
    } catch (error) {
      setErrorMsg('Network error: ' + error.message);
    } finally {
      setLoading(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <div className="settings">
      <h1>
        <span className="settings-icon" role="img" aria-label="settings">⚙️</span>
        Account Settings
      </h1>
      {/* Modern Centered round profile photo */}
      <div className="profile-photo-center">
        <div className="profile-preview">
          <img
            src={profilePreview || '/assets/person/noAvatar.png'}
            alt="Profile"
          />
          <div className="profile-photo-overlay">
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="change-photo-btn"
              title="Change Profile Photo"
            >
              <span role="img" aria-label="edit">✏️</span>
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleProfilePictureChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <div className="profile-photo-username">{username}</div>
        <div className="profile-photo-email">{email}</div>
      </div>
      <form onSubmit={handleSubmit} encType="multipart/form-data" className="settings-form">
        <section>
          <h2>Account Information</h2>
          <div className="settings-row">
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </label>
          </div>
        </section>

        <section>
          <h2>Password Management</h2>
          <div className="settings-row">
            <label>
              Current Password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>
        </section>

        <section>
          <h2>Preferences</h2>
          <div className="settings-row">
            <label>
              Theme
              <select value={themeSelect} onChange={handleThemeChange}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System Default</option>
              </select>
            </label>
            <label>
              Language
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                {/* Add more languages as needed */}
              </select>
            </label>
          </div>
        </section>

        <section>
          <h2>Notifications</h2>
          <div className="settings-row notifications-row">
            <label className="switch">
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={e => setNotifications(n => ({ ...n, email: e.target.checked }))}
              />
              <span className="slider"></span>
              <span className="switch-label">Email</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={notifications.push}
                onChange={e => setNotifications(n => ({ ...n, push: e.target.checked }))}
              />
              <span className="slider"></span>
              <span className="switch-label">Push</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={notifications.sms}
                onChange={e => setNotifications(n => ({ ...n, sms: e.target.checked }))}
              />
              <span className="slider"></span>
              <span className="switch-label">SMS</span>
            </label>
          </div>
        </section>

        <section>
          <h2>Privacy</h2>
          <div className="settings-row">
            <label>
              Profile Visibility
              <select value={privacy} onChange={e => setPrivacy(e.target.value)}>
                <option value="public">Public</option>
                <option value="friends">Friends Only</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>
        </section>

        <div className="settings-actions">
          <button type="submit" disabled={loading} className="save-btn">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          {successMsg && <div className="success">{successMsg}</div>}
          {errorMsg && <div className="error">{errorMsg}</div>}
        </div>
      </form>

      <section className="danger-zone">
        <h2>Danger Zone</h2>
        {!deleteConfirm ? (
          <button
            className="delete-account"
            onClick={() => setDeleteConfirm(true)}
            disabled={loading}
          >
            Delete Account
          </button>
        ) : (
          <div>
            <p>Are you sure? This action cannot be undone.</p>
            <button className="confirm-delete" onClick={handleDeleteAccount} disabled={loading}>
              Yes, Delete My Account
            </button>
            <button onClick={() => setDeleteConfirm(false)} disabled={loading}>
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Settings;