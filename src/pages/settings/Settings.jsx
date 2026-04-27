import React, { useState, useRef, useContext, useEffect } from 'react';
import './Settings.scss';
import { DarkModeContext } from '../../context/darkModeContext';
import { LanguageContext } from '../../context/languageContext';
import { useLanguage } from '../../hooks/useLanguage';
import { Visibility, VisibilityOff, ExpandMore, ExpandLess } from '@mui/icons-material';

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

  // Expanded sections on mobile
  const [expandedSections, setExpandedSections] = useState({
    account: true,
    password: false,
    preferences: true,
    notifications: false,
    privacy: false,
  });

  // Dark mode context - read actual theme value from DOM/localStorage instead of relying on context
  const { darkMode, setDarkMode } = useContext(DarkModeContext) || {};
  
  // Initialize themeSelect from actual DOM/localStorage state, not context
  const getInitialTheme = () => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      const dark = localStorage.getItem('darkMode');
      if (dark === 'true') return 'dark';
      if (dark === 'false') return 'light';
    } catch (e) {}
    return darkMode ? 'dark' : 'light';
  };
  
  const [themeSelect, setThemeSelect] = useState(getInitialTheme());
  
  // Language - use both context and hook to ensure updates propagate
  const { t, language: contextLanguage, setLanguage: setContextLanguage } = useLanguage();

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
          
          // Initialize language from user or context
          const userLang = user.customization?.language || user.language || contextLanguage || 'en';
          setLanguage(userLang);
          if (userLang !== contextLanguage) {
            setContextLanguage(userLang);
          }
          
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
          } else if (storedDark) {
            setThemeSelect(storedDark);
            if (setDarkMode) setDarkMode(storedDark === 'dark');
          } else {
            setThemeSelect(darkMode ? 'dark' : 'light');
          }
        }
      } catch (err) {
        console.error('Error fetching user info:', err);
        setErrorMsg('Failed to load user settings');
      }
    };
    fetchUserInfo();
  }, []);

  const handleThemeChange = (e) => {
    const value = e.target.value;
    
    // Update state, DOM, localStorage, and context all immediately
    setThemeSelect(value);
    
    // Apply DOM classes immediately
    if (value === 'dark') {
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
      document.documentElement.classList.add('theme-light');
    }
    
    // Save to localStorage immediately
    try {
      localStorage.setItem('theme', value);
      localStorage.setItem('darkMode', value === 'dark' ? 'true' : 'false');
      if (userId) {
        localStorage.setItem(`userTheme_${userId}`, value);
      }
    } catch (err) { /* ignore */ }
    
    // Update context immediately for instant UI theme update across all components
    if (typeof setDarkMode === 'function') {
      setDarkMode(value === 'dark');
    }
    
    // Save to server in the background (fire and forget - don't block UI)
    // If it fails, localStorage still has the value so it persists
    const updateServerTheme = async () => {
      try {
        const formData = new FormData();
        formData.append('theme', value);
        
        await fetch(SETTINGS_ENDPOINT, {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: getAuthHeaders()
        });
      } catch (err) {
        // Silently fail - user already sees theme change locally
        console.error('Failed to save theme to server:', err);
      }
    };
    
    updateServerTheme();
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    // Also update the global language context immediately
    if (typeof setContextLanguage === 'function') {
      setContextLanguage(newLang);
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
    // Always send theme and language - these are always important
    formData.append('theme', themeSelect);
    formData.append('language', language);
    formData.append('privacy', privacy);
    formData.append('notifications', JSON.stringify(notifications));
    
    // Optional fields - only append if changed
    if (username && username.trim()) formData.append('username', username.trim());
    if (email && email.trim()) formData.append('email', email.trim());
    if (currentPassword && currentPassword.trim()) formData.append('currentPassword', currentPassword.trim());
    if (newPassword && newPassword.trim()) formData.append('newPassword', newPassword.trim());
    if (profilePicture) {
      formData.append('profilePicture', profilePicture);
    }

    try {
      const response = await fetch(SETTINGS_ENDPOINT, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: getAuthHeaders()
        // DO NOT set Content-Type header with FormData - let browser handle it
      });

      const data = await response.json();

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
        
        // Extract theme from settings object or directly from response
        const returnedTheme = data.theme || 
                             data.settings?.customization?.theme || 
                             data.customization?.theme ||
                             themeSelect; // Fallback to what we sent
        
        const returnedLang = data.language || 
                            data.settings?.customization?.language || 
                            data.customization?.language ||
                            language; // Fallback to what we sent
        
        // Update theme from server response
        if (returnedTheme) {
          setThemeSelect(returnedTheme);
          // Apply DOM changes immediately
          try {
            if (returnedTheme === 'dark') {
              document.documentElement.classList.remove('theme-light');
              document.documentElement.classList.add('theme-dark');
            } else {
              document.documentElement.classList.remove('theme-dark');
              document.documentElement.classList.add('theme-light');
            }
            localStorage.setItem('theme', returnedTheme);
            localStorage.setItem('darkMode', returnedTheme === 'dark' ? 'true' : 'false');
            if (userId) {
              localStorage.setItem(`userTheme_${userId}`, returnedTheme);
            }
          } catch (err) { /* ignore */ }
          
          // Update context AFTER DOM changes so components re-render with new theme
          setTimeout(() => {
            if (typeof setDarkMode === 'function') {
              setDarkMode(returnedTheme === 'dark');
            }
          }, 0);
        }
        
        // Update language if returned from server
        if (returnedLang) {
          setLanguage(returnedLang);
          setContextLanguage(returnedLang);
          // Fire custom event so other components know language changed
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: returnedLang } }));
          }
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderSection = (section, title, icon, children, description) => (
    <section className={`settings-section ${expandedSections[section] ? 'expanded' : ''}`}>
      <div className="section-header" onClick={() => toggleSection(section)}>
        <div className="section-title">
          <span className="section-icon">{icon}</span>
          <div className="section-label">
            <h2>{title}</h2>
            {description && <p className="section-description">{description}</p>}
          </div>
        </div>
        <button type="button" className="expand-btn" aria-label="Toggle section">
          {expandedSections[section] ? <ExpandLess size={24} /> : <ExpandMore size={24} />}
        </button>
      </div>
      {expandedSections[section] && (
        <div className="section-content">
          {children}
        </div>
      )}
    </section>
  );

  return (
    <div className="settings">
      <h1>
        <span className="settings-icon" role="img" aria-label="settings">⚙️</span>
        {t('account-settings')}
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
        {renderSection(
          'account',
          t('account-information'),
          '👤',
          <div className="settings-row">
            <label>
              {t('username')}
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
              {t('email')}
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
          </div>,
          'Update your account details'
        )}

        {renderSection(
          'password',
          t('password-management'),
          '🔐',
          <div className="settings-row">
            {renderPasswordField(
              t('current-password'),
              currentPassword,
              setCurrentPassword,
              showCurrentPassword,
              setShowCurrentPassword,
              'currentPassword'
            )}
            {renderPasswordField(
              t('new-password'),
              newPassword,
              setNewPassword,
              showNewPassword,
              setShowNewPassword,
              'newPassword'
            )}
            <small className="password-hint">
              {t('password-hint')}
            </small>
            {renderPasswordField(
              t('confirm-password'),
              confirmPassword,
              setConfirmPassword,
              showConfirmPassword,
              setShowConfirmPassword,
              'confirmPassword'
            )}
          </div>,
          'Change your password to keep your account secure'
        )}

        {renderSection(
          'preferences',
          t('preferences'),
          '🎨',
          <div className="settings-row">
            <label>
              {t('theme')}
              <select value={themeSelect} onChange={handleThemeChange}>
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
              </select>
            </label>
            <label>
              {t('language')}
              <select value={language} onChange={handleLanguageChange}>
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Spanish</option>
                <option value="fr">🇫🇷 French</option>
                <option value="tl">🇵🇭 Tagalog</option>
              </select>
            </label>
          </div>,
          'Customize your appearance and language'
        )}

        {renderSection(
          'notifications',
          t('notifications'),
          '🔔',
          <div className="settings-row notifications-row">
            <label className="switch">
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={e => setNotifications(n => ({ ...n, email: e.target.checked }))}
              />
              <span className="slider"></span>
              <span className="switch-label">{t('email-notif')}</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={notifications.push}
                onChange={e => setNotifications(n => ({ ...n, push: e.target.checked }))}
              />
              <span className="slider"></span>
              <span className="switch-label">{t('push-notif')}</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={notifications.sms}
                onChange={e => setNotifications(n => ({ ...n, sms: e.target.checked }))}
              />
              <span className="slider"></span>
              <span className="switch-label">{t('sms-notif')}</span>
            </label>
          </div>,
          'Choose how you want to be notified'
        )}

        {renderSection(
          'privacy',
          t('privacy'),
          '🔒',
          <div className="settings-row">
            <label>
              {t('profile-visibility')}
              <select value={privacy} onChange={e => setPrivacy(e.target.value)}>
                <option value="public">🌐 Public (everyone can see)</option>
                <option value="friends">👥 Friends Only</option>
                <option value="private">🔒 Private (only you)</option>
              </select>
            </label>
          </div>,
          'Control who can see your profile'
        )}

        <div className="settings-actions">
          <button type="submit" disabled={loading} className="save-btn">
            {loading ? t('saving') : t('save-changes')}
          </button>
          {successMsg && <div className="success">✅ {successMsg}</div>}
          {errorMsg && <div className="error">❌ {errorMsg}</div>}
        </div>
      </form>

      <section className="danger-zone">
        <h2>{t('danger-zone')}</h2>
        {!deleteConfirm ? (
          <button
            className="delete-account"
            onClick={() => setDeleteConfirm(true)}
            disabled={loading}
          >
            {t('delete-account')}
          </button>
        ) : (
          <div>
            <p>{t('confirm-delete-message')}</p>
            <button className="confirm-delete" onClick={handleDeleteAccount} disabled={loading}>
              {t('confirm-delete')}
            </button>
            <button onClick={() => setDeleteConfirm(false)} disabled={loading}>
              {t('cancel')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Settings;