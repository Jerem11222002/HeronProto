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

// Bug report constants
const CATEGORIES = { bug: 'Bug', ui: 'UI/UX', performance: 'Performance', security: 'Security', feature: 'Feature Request', other: 'Other' };
const SEVERITIES = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

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

  // Bug reporting state
  const [bugReports, setBugReports] = useState([]);
  const [bugReportDialog, setBugReportDialog] = useState(false);
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugCategory, setBugCategory] = useState('bug');
  const [bugSeverity, setBugSeverity] = useState('medium');
  const [bugSubmitLoading, setBugSubmitLoading] = useState(false);
  const [bugSubmitSuccess, setBugSubmitSuccess] = useState('');
  const [bugAttachments, setBugAttachments] = useState([]);
  const [bugFilterStatus, setBugFilterStatus] = useState('all');
  const [bugSortBy, setBugSortBy] = useState('newest');
  const [toast, setToast] = useState(null);
  const [expandedReportId, setExpandedReportId] = useState(null);

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
    bugReports: false,
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
          // Fetch user's bug reports
          const bugRes = await fetch(`${API_BASE}/api/bug-reports/my-reports`, {
            credentials: 'include',
            headers: getAuthHeaders()
          });
          if (bugRes.ok) {
            const bugData = await bugRes.json();
            if (bugData.success) setBugReports(bugData.reports || []);
          }
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
  const submitBugReport = async () => {
    if (!bugTitle.trim() || !bugDescription.trim() || !bugCategory) {
      setErrorMsg('Title, category, and description are required for bug reports');
      return;
    }
    setBugSubmitLoading(true);
    setBugSubmitSuccess('');
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('title', bugTitle.trim());
      formData.append('description', bugDescription.trim());
      formData.append('category', bugCategory);
      formData.append('severity', bugSeverity);
      formData.append('pageUrl', window.location.href);
      bugAttachments.forEach(file => formData.append('attachments', file));

      const res = await fetch(`${API_BASE}/api/bug-reports`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Bug report submitted successfully!', 'success');
        setBugTitle('');
        setBugDescription('');
        setBugCategory('bug');
        setBugSeverity('medium');
        setBugAttachments([]);
        // Refresh bug reports list
        const bugRes = await fetch(`${API_BASE}/api/bug-reports/my-reports`, {
          credentials: 'include',
          headers: getAuthHeaders()
        });
        if (bugRes.ok) {
          const bugData = await bugRes.json();
          if (bugData.success) setBugReports(bugData.reports || []);
        }
      } else {
        setErrorMsg(data.message || 'Failed to submit bug report');
        showToast(data.message || 'Failed to submit bug report', 'error');
      }
    } catch (err) {
      setErrorMsg('Network error: ' + err.message);
      showToast('Network error: ' + err.message, 'error');
    } finally {
      setBugSubmitLoading(false);
    }
  };

  const getStatusLabel = (status) => ({ pending: 'Pending', 'in-progress': 'In Progress', resolved: 'Resolved', closed: 'Closed' }[status] || status);
  const getStatusClass = (status) => ({ pending: 'status-pending', 'in-progress': 'status-progress', resolved: 'status-resolved', closed: 'status-closed' }[status] || '');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + bugAttachments.length > 3) {
      setErrorMsg('Maximum 3 attachments allowed');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setBugAttachments(prev => [...prev, ...files].slice(0, 3));
  };

  const removeAttachment = (index) => {
    setBugAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const filteredSortedReports = React.useMemo(() => {
    let reports = [...bugReports];
    if (bugFilterStatus !== 'all') {
      reports = reports.filter(r => r.status === bugFilterStatus);
    }
    if (bugSortBy === 'newest') {
      reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (bugSortBy === 'oldest') {
      reports.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (bugSortBy === 'severity') {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      reports.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
    }
    return reports;
  }, [bugReports, bugFilterStatus, bugSortBy]);

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
      {/* Toast Notification */}
      {toast && (
        <div
          className={`toast-notification toast-${toast.type}`}
          role="alert"
          aria-live="assertive"
          onAnimationEnd={() => { }}
        >
          <span className="toast-icon" aria-hidden="true">
            {toast.type === 'success' ? '✅' : '❌'}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}
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

        {renderSection(
          'bugReports',
          'Bug Reports & Feedback',
          '🐛',
          <div className="bug-report-enhanced">
            {/* Report Form Card */}
            <div className="bug-form-card">
              <div className="card-header">
                <h3>Submit New Report</h3>
                <div className="form-progress">
                  <div className={`progress-step ${bugTitle.trim() ? 'completed' : ''}`}>
                    <span className="step-number">1</span>
                    <span className="step-label">Title</span>
                  </div>
                  <div className={`progress-step ${bugCategory ? 'completed' : ''}`}>
                    <span className="step-number">2</span>
                    <span className="step-label">Category</span>
                  </div>
                  <div className={`progress-step ${bugDescription.trim() ? 'completed' : ''}`}>
                    <span className="step-number">3</span>
                    <span className="step-label">Description</span>
                  </div>
                </div>
              </div>
              
              <div className="card-content">
                {/* Title Input */}
                <div className="form-group">
                  <label className="form-label">
                    Issue Title *
                    <span className="field-hint">Brief summary of the issue</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      value={bugTitle}
                      onChange={e => setBugTitle(e.target.value)}
                      placeholder="e.g., Login button not working on mobile"
                      className="form-input"
                      maxLength={200}
                      aria-label="Bug report title"
                    />
                    <span className="char-count">{bugTitle.length}/200</span>
                  </div>
                </div>

                {/* Category and Severity Row */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Category *
                      <span className="field-hint">What type of issue?</span>
                    </label>
                    <div className="select-wrapper">
                      <select 
                        value={bugCategory} 
                        onChange={e => setBugCategory(e.target.value)}
                        className="form-select"
                        aria-label="Bug category"
                      >
                        <option value="">Select category...</option>
                        <option value="bug">🐛 Bug</option>
                        <option value="ui">🎨 UI/UX Issue</option>
                        <option value="performance">⚡ Performance</option>
                        <option value="security">🔒 Security</option>
                        <option value="feature">✨ Feature Request</option>
                        <option value="other">📋 Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Severity *
                      <span className="field-hint">How critical is this?</span>
                    </label>
                    <div className="severity-selector">
                      {[
                        { value: 'low', icon: '🟢', label: 'Low' },
                        { value: 'medium', icon: '🟡', label: 'Medium' },
                        { value: 'high', icon: '🟠', label: 'High' },
                        { value: 'critical', icon: '🔴', label: 'Critical' }
                      ].map(sev => (
                        <button
                          key={sev.value}
                          type="button"
                          className={`severity-btn ${bugSeverity === sev.value ? 'active' : ''}`}
                          onClick={() => setBugSeverity(sev.value)}
                          aria-label={`Set severity to ${sev.label}`}
                        >
                          <span className="severity-icon">{sev.icon}</span>
                          <span className="severity-label">{sev.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">
                    Detailed Description *
                    <span className="field-hint">Please provide as much detail as possible</span>
                  </label>
                  <div className="textarea-wrapper">
                    <textarea
                      value={bugDescription}
                      onChange={e => setBugDescription(e.target.value)}
                      placeholder="Describe the issue in detail. Include steps to reproduce, expected behavior, and any error messages..."
                      className="form-textarea"
                      rows={5}
                      maxLength={5000}
                      aria-label="Bug report description"
                    />
                    <span className="char-count">{bugDescription.length}/5000</span>
                  </div>
                </div>

                {/* Attachments */}
                <div className="form-group">
                  <label className="form-label">
                    Attachments
                    <span className="field-hint">Screenshots or logs (max 3 files)</span>
                  </label>
                  <div className="attachment-area">
                    <label className="attachment-btn" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}>
                      <span role="img" aria-label="attach">📎</span> Add Files
                      <input
                        type="file"
                        multiple
                        accept="image/*,.txt,.log,.json"
                        onChange={handleAttachmentChange}
                        style={{ display: 'none' }}
                        aria-label="Upload bug report attachments"
                      />
                    </label>
                    {bugAttachments.length > 0 && (
                      <div className="attachment-list">
                        {bugAttachments.map((file, idx) => (
                          <div className="attachment-chip" key={idx}>
                            <span className="attachment-name">{file.name}</span>
                            <button
                              type="button"
                              className="attachment-remove"
                              onClick={() => removeAttachment(idx)}
                              aria-label={`Remove attachment ${file.name}`}
                              title="Remove file"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="form-actions">
                  <button
                    type="button"
                    className={`submit-btn ${!bugTitle.trim() || !bugDescription.trim() || !bugCategory ? 'disabled' : ''}`}
                    onClick={submitBugReport}
                    disabled={bugSubmitLoading || !bugTitle.trim() || !bugDescription.trim() || !bugCategory}
                    aria-label={bugSubmitLoading ? 'Submitting bug report' : 'Submit bug report'}
                  >
                    {bugSubmitLoading ? (
                      <>
                        <span className="spinner"></span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon" aria-hidden="true">📤</span>
                        Submit Report
                      </>
                    )}
                  </button>
                </div>

                {bugSubmitSuccess && (
                  <div className="success-message" role="status" aria-live="polite">
                    <span className="success-icon" aria-hidden="true">✅</span>
                    <span>{bugSubmitSuccess}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Report History */}
            {bugReports.length > 0 && (
              <div className="bug-history-card">
                <div className="card-header">
                  <h3>Your Report History</h3>
                  <div className="history-stats">
                    <span className="stat-item">
                      <span className="stat-number">{bugReports.length}</span>
                      <span className="stat-label">Total</span>
                    </span>
                    <span className="stat-item">
                      <span className="stat-number">{bugReports.filter(r => r.status === 'resolved').length}</span>
                      <span className="stat-label">Resolved</span>
                    </span>
                  </div>
                </div>

                <div className="card-content">
                  <div className="filter-controls">
                    <div className="filter-group">
                      <label className="filter-label" htmlFor="filter-status">Filter by status:</label>
                      <select
                        id="filter-status"
                        className="filter-select"
                        aria-label="Filter reports by status"
                        value={bugFilterStatus}
                        onChange={e => setBugFilterStatus(e.target.value)}
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="filter-group">
                      <label className="filter-label" htmlFor="sort-reports">Sort by:</label>
                      <select
                        id="sort-reports"
                        className="filter-select"
                        aria-label="Sort reports"
                        value={bugSortBy}
                        onChange={e => setBugSortBy(e.target.value)}
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="severity">Severity</option>
                      </select>
                    </div>
                  </div>

                  <div className="reports-timeline" role="list" aria-label="Bug report history">
                    {filteredSortedReports.map(report => (
                      <div key={report._id} className={`timeline-item ${getStatusClass(report.status)}`} role="listitem">
                        <div className="timeline-marker" aria-hidden="true">
                          <span className="marker-dot"></span>
                        </div>
                        <div className="timeline-content">
                          <div className="report-card">
                            <div className="report-header">
                              <div className="report-title-section">
                                <h4 className="report-title">{report.title}</h4>
                                <div className="report-meta">
                                  <span className={`category-badge category-${report.category}`}>
                                    {CATEGORIES[report.category] || report.category}
                                  </span>
                                  <span className={`severity-badge severity-${report.severity}`}>
                                    {SEVERITIES[report.severity] || report.severity}
                                  </span>
                                </div>
                              </div>
                              <div className="report-status-section">
                                <span className={`status-badge ${getStatusClass(report.status)}`}>
                                  {getStatusLabel(report.status)}
                                </span>
                                <span className="report-date">
                                  {new Date(report.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="report-description">
                              <p>
                                {expandedReportId === report._id
                                  ? report.description
                                  : (report.description || '').substring(0, 150) + ((report.description || '').length > 150 ? '...' : '')
                                }
                              </p>
                              {(report.description || '').length > 150 && (
                                <button
                                  type="button"
                                  className="expand-desc-btn"
                                  onClick={() => setExpandedReportId(expandedReportId === report._id ? null : report._id)}
                                  aria-expanded={expandedReportId === report._id}
                                  aria-controls={`report-desc-${report._id}`}
                                >
                                  {expandedReportId === report._id ? 'Show less' : 'Read more'}
                                </button>
                              )}
                            </div>

                            {report.attachments && report.attachments.length > 0 && (
                              <div className="report-attachments">
                                <span className="attachments-label">Attachments:</span>
                                <div className="attachments-list">
                                  {report.attachments.map((att, idx) => (
                                    <a
                                      key={idx}
                                      href={att.url || att}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="attachment-link"
                                    >
                                      📎 {att.name || `File ${idx + 1}`}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {report.adminResponse && (
                              <div className="admin-response">
                                <span className="response-label">Team Response:</span>
                                <p className="response-text">{report.adminResponse}</p>
                                {report.respondedAt && (
                                  <span className="response-date">
                                    {new Date(report.respondedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="report-actions">
                              <button
                                type="button"
                                className="action-btn secondary"
                                onClick={() => setExpandedReportId(expandedReportId === report._id ? null : report._id)}
                                aria-expanded={expandedReportId === report._id}
                              >
                                <span aria-hidden="true">{expandedReportId === report._id ? '📖' : '👁️'}</span>
                                {expandedReportId === report._id ? 'Collapse' : 'View Details'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredSortedReports.length === 0 && (
                      <div className="no-reports" role="status">
                        <p>No reports match the selected filter.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>,
          'Report bugs and track their resolution status'
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