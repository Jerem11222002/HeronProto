import React, { useState, useRef, useContext, useEffect } from 'react';
import './Settings.scss';
import { DarkModeContext } from '../../context/darkModeContext';
import { Visibility, VisibilityOff } from '@mui/icons-material';

// Backend base (use REACT_APP_API_URL in .env or fallback)
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const USER_INFO_ENDPOINT = `${API_BASE}/api/users/me`;
const SETTINGS_ENDPOINT = `${API_BASE}/api/users/settings`;
const DELETE_ACCOUNT_ENDPOINT = `${API_BASE}/api/users/delete-account`;

const getAuthHeaders = () => {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Validation helper functions
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
};

const validateUsername = (username) => {
  // At least 3 characters, alphanumeric and underscores
  return username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
};

const Settings = () => {
  const [userId, setUserId] = useState(null);

  // State for user input
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // New features
  const [language, setLanguage] = useState('en');
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
  });
  const [privacy, setPrivacy] = useState('public');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef();

  // Dark mode context
  const { darkMode, setDarkMode } = useContext(DarkModeContext) || {};
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
          setUserId(user._id || user.id || null);
          setUsername(user.username || '');
          setEmail(user.email || '');
          setLanguage(user.customization?.language || user.language || 'en');
          setPrivacy(user.customization?.visibility || user.privacy || 'public');
          setNotifications(user.notifications || { email: true, push: false, sms: false });
          const pic = user.profilePic || user.profilePicture || null;
          setProfilePicUrl(pic);
          setProfilePreview(pic);
          const serverTheme = user.customization?.theme || user.theme || null;

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
            setThemeSelect(storedDark);
            if (setDarkMode) setDarkMode(storedDark === 'dark');
            else applyThemeLocally(storedDark);
          } else {
            setThemeSelect(darkMode ? 'dark' : 'light');
            if (!setDarkMode) applyThemeLocally(darkMode ? 'dark' : 'light');
          }
        }
      } catch (err) {
        console.error('Error fetching user info:', err);
        setErrorMsg('Failed to load user settings');
      }
    };
    fetchUserInfo();
  }, []);

  useEffect(() => {
    setThemeSelect(darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
    applyThemeLocally(value);
    if (typeof setDarkMode === 'function') {
      try { setDarkMode(value === 'dark'); } catch (err) { /* ignore */ }
    }
  };

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

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (username && !validateUsername(username)) {
      errors.username = 'Username must be 3+ characters, alphanumeric and underscores only';
    }

    if (email && !validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation - stricter
    if (newPassword && newPassword.trim()) {
      if (!validatePassword(newPassword)) {
        errors.newPassword = 'Password must be 8+ characters with uppercase, lowercase, and numbers';
      }
      if (newPassword !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
      if (!currentPassword || !currentPassword.trim()) {
        errors.currentPassword = 'Current password is required to change password';
      }
    }

    // If confirmPassword is filled but newPassword is not, show error
    if (confirmPassword && !newPassword) {
      errors.confirmPassword = 'Please enter new password';
    }

    // If currentPassword is filled but newPassword is not, show info
    if (currentPassword && !newPassword) {
      // Just note it, don't error
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!validateForm()) {
      setErrorMsg('Please fix the errors above');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    if (username) formData.append('username', username.trim());
    if (email) formData.append('email', email.trim());
    if (currentPassword) formData.append('currentPassword', currentPassword.trim());
    if (newPassword) formData.append('newPassword', newPassword.trim());
    formData.append('theme', themeSelect);
    formData.append('language', language);
    formData.append('privacy', privacy);
    formData.append('notifications', JSON.stringify(notifications));
    if (profilePicture) {
      formData.append('profilePicture', profilePicture);
    }
    
    console.log('FormData being sent:');
    for (let [key, value] of formData.entries()) {
      if (key !== 'profilePicture') {
        console.log(`  ${key}:`, value);
      }
    }

    try {
      console.log('Submitting settings form...');
      console.log('Endpoint:', SETTINGS_ENDPOINT);
      
      // Log FormData contents for debugging
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        if (key === 'profilePicture') {
          console.log(`  ${key}: File(${value.size} bytes)`);
        } else if (key === 'notifications') {
          console.log(`  ${key}:`, value);
        } else {
          console.log(`  ${key}:`, value || '(empty)');
        }
      }
      
      const response = await fetch(SETTINGS_ENDPOINT, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: getAuthHeaders()
        // DO NOT set Content-Type header with FormData - let browser handle it
      });

      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok) {
        console.error('Settings update failed:', {
          status: response.status,
          statusText: response.statusText,
          message: data.message,
          error: data.error
        });
      }

      if (response.ok) {
        setSuccessMsg('✅ Settings updated successfully!');
        const updatedPic = data.profilePic || data.profilePicture;
        if (updatedPic) {
          setProfilePicUrl(updatedPic);
          setProfilePreview(updatedPic);
        }
        // Clear password fields after successful update
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setProfilePicture(null);
        setFieldErrors({});
        
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

          try {
            localStorage.setItem('theme', returnedTheme);
            if (userId) {
              localStorage.setItem(`userTheme_${userId}`, returnedTheme);
            }
            const stored = localStorage.getItem('currentUser');
            if (stored) {
              try {
                const cu = JSON.parse(stored);
                cu.customization = cu.customization || {};
                cu.customization.theme = returnedTheme;
                localStorage.setItem('currentUser', JSON.stringify(cu));
              } catch (err) { /* ignore */ }
            }
          } catch (err) { /* ignore */ }
        }
      } else {
        // Map common error codes to user-friendly messages
        if (response.status === 400) {
          setErrorMsg(data?.message || 'Invalid request. Please check your input.');
        } else if (response.status === 401) {
          setErrorMsg(data?.message || 'Current password is incorrect.');
          setFieldErrors(prev => ({ ...prev, currentPassword: data?.message || 'Incorrect password' }));
        } else if (response.status === 404) {
          setErrorMsg('User account not found.');
        } else {
          setErrorMsg(data?.message || `Error updating settings (${response.status}).`);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
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
        setSuccessMsg('Account deleted. Redirecting...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
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

  const renderPasswordField = (label, value, onChange, show, setShow, errorKey) => (
    <label>
      {label}
      <div className="password-input-wrapper">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className={fieldErrors[errorKey] ? 'input-error' : ''}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShow(!show)}
          title={show ? 'Hide password' : 'Show password'}
        >
          {show ? <VisibilityOff size={20} /> : <Visibility size={20} />}
        </button>
      </div>
      {fieldErrors[errorKey] && <span className="error-text">{fieldErrors[errorKey]}</span>}
    </label>
  );

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
                className={fieldErrors.username ? 'input-error' : ''}
              />
              {fieldErrors.username && <span className="error-text">{fieldErrors.username}</span>}
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className={fieldErrors.email ? 'input-error' : ''}
              />
              {fieldErrors.email && <span className="error-text">{fieldErrors.email}</span>}
            </label>
          </div>
        </section>

        <section>
          <h2>Password Management</h2>
          <div className="settings-row">
            {renderPasswordField(
              'Current Password',
              currentPassword,
              setCurrentPassword,
              showCurrentPassword,
              setShowCurrentPassword,
              'currentPassword'
            )}
            {renderPasswordField(
              'New Password',
              newPassword,
              setNewPassword,
              showNewPassword,
              setShowNewPassword,
              'newPassword'
            )}
            <small className="password-hint">
              Min 8 chars, 1 uppercase, 1 lowercase, 1 number
            </small>
            {renderPasswordField(
              'Confirm New Password',
              confirmPassword,
              setConfirmPassword,
              showConfirmPassword,
              setShowConfirmPassword,
              'confirmPassword'
            )}
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
                <option value="tl">Tagalog</option>
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
                <option value="public">🌐 Public (everyone can see)</option>
                <option value="friends">👥 Friends Only</option>
                <option value="private">🔒 Private (only you)</option>
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