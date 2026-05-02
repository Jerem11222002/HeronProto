import React, { useState, useEffect } from 'react';
import { Close, Info } from '@mui/icons-material';
import './BugReportModal.scss';

const CATEGORIES = {
  bug: { label: 'Bug', icon: '🐛' },
  ui: { label: 'UI/UX Issue', icon: '🎨' },
  performance: { label: 'Performance', icon: '⚡' },
  security: { label: 'Security', icon: '🔒' },
  feature: { label: 'Feature Request', icon: '✨' },
  other: { label: 'Other', icon: '📋' }
};

const SEVERITIES = {
  low: { label: 'Low', color: '#10b981', icon: '🟢', description: 'Minor issue, doesn\'t affect functionality' },
  medium: { label: 'Medium', color: '#f59e0b', icon: '🟡', description: 'Noticeable issue, some impact' },
  high: { label: 'High', color: '#f97316', icon: '🟠', description: 'Significant issue, major impact' },
  critical: { label: 'Critical', color: '#ef4444', icon: '🔴', description: 'Severe issue, blocks usage' }
};

const TITLE_EXAMPLES = {
  bug: 'Login button not working on mobile',
  ui: 'Button text is cut off on small screens',
  performance: 'Feed takes 5+ seconds to load',
  security: 'Password visible in browser console',
  feature: 'Add dark mode toggle',
  other: 'Describe your issue here'
};

const DESCRIPTION_HINTS = `**Steps to reproduce:**
1. First step
2. Second step
3. Third step

**Expected behavior:**
What should happen

**Actual behavior:**
What actually happens

**Browser/Device:**
Chrome on Windows 10`;

const BugReportModal = ({ isOpen, onClose, onSubmit, isLoading, successMessage, errorMessage }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('bug');
  const [severity, setSeverity] = useState('medium');
  const [errors, setErrors] = useState({});
  const [showMarkdownHint, setShowMarkdownHint] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setCategory('bug');
      setSeverity('medium');
      setErrors({});
      setShowMarkdownHint(false);
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (title.trim().length < 5) newErrors.title = 'Title must be at least 5 characters';
    if (description.trim().length < 10) newErrors.description = 'Description must be at least 10 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        severity
      });
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const titleLength = title.length;
  const descriptionLength = description.length;
  const titleMax = 200;
  const descriptionMax = 5000;

  // Calculate progress color based on usage
  const getTitleProgressColor = () => {
    const percent = (titleLength / titleMax) * 100;
    if (percent < 50) return '#5271ff';
    if (percent < 80) return '#f59e0b';
    return '#ef4444';
  };

  const getDescriptionProgressColor = () => {
    const percent = (descriptionLength / descriptionMax) * 100;
    if (percent < 50) return '#5271ff';
    if (percent < 80) return '#f59e0b';
    return '#ef4444';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="bug-report-backdrop" onClick={handleClose} aria-hidden="true" />

      {/* Modal */}
      <div className="bug-report-modal" role="dialog" aria-modal="true" aria-labelledby="bug-report-title">
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <h2 id="bug-report-title">Submit Bug Report</h2>
            <p className="header-subtitle">Help us improve by reporting issues you encounter</p>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={handleClose}
            aria-label="Close modal"
            title="Close"
          >
            <Close size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Category & Severity Row */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">
                <span className="label-text">Category</span>
                <span className="label-required">*</span>
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-select"
              >
                {Object.entries(CATEGORIES).map(([key, { label, icon }]) => (
                  <option key={key} value={key}>
                    {icon} {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label-text">
                <span>Severity</span>
                <span className="label-required">*</span>
              </label>
              <div className="severity-selector">
                {Object.entries(SEVERITIES).map(([key, { label, color, icon, description }]) => (
                  <button
                    key={key}
                    type="button"
                    className={`severity-badge ${severity === key ? 'active' : ''}`}
                    onClick={() => setSeverity(key)}
                    style={{
                      '--severity-color': color,
                      backgroundColor: severity === key ? color : 'transparent',
                      borderColor: color
                    }}
                    title={description}
                    aria-pressed={severity === key}
                  >
                    <span className="severity-icon">{icon}</span>
                    <span className="severity-label">{label}</span>
                  </button>
                ))}
              </div>
              <p className="severity-description">
                {SEVERITIES[severity].description}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label htmlFor="title">
              <span className="label-text">Title</span>
              <span className="label-required">*</span>
            </label>
            <p className="field-hint">
              <Info size={14} /> Example: "{TITLE_EXAMPLES[category]}"
            </p>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }}
              placeholder={TITLE_EXAMPLES[category]}
              maxLength={titleMax}
              className={`form-input ${errors.title ? 'error' : ''}`}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'title-error' : 'title-counter'}
            />
            <div className="input-footer">
              {errors.title && (
                <span id="title-error" className="error-message">{errors.title}</span>
              )}
              <span id="title-counter" className="char-counter">
                {titleLength} / {titleMax}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(titleLength / titleMax) * 100}%`, backgroundColor: getTitleProgressColor() }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <div className="description-header">
              <label htmlFor="description">
                <span className="label-text">Description</span>
                <span className="label-required">*</span>
              </label>
              <button
                type="button"
                className="markdown-hint-btn"
                onClick={() => setShowMarkdownHint(!showMarkdownHint)}
                title="Show markdown formatting hints"
              >
                📝 Formatting
              </button>
            </div>
            
            {showMarkdownHint && (
              <div className="markdown-hint">
                <p className="hint-title">💡 Formatting Tips:</p>
                <ul>
                  <li><strong>**bold text**</strong> for emphasis</li>
                  <li><strong>1. 2. 3.</strong> for numbered steps</li>
                  <li><strong>- • *</strong> for bullet points</li>
                  <li><strong>`code`</strong> for code snippets</li>
                </ul>
              </div>
            )}

            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
              }}
              placeholder={DESCRIPTION_HINTS}
              maxLength={descriptionMax}
              rows={6}
              className={`form-textarea ${errors.description ? 'error' : ''}`}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : 'description-counter'}
            />
            <div className="input-footer">
              {errors.description && (
                <span id="description-error" className="error-message">{errors.description}</span>
              )}
              <span id="description-counter" className="char-counter">
                {descriptionLength} / {descriptionMax}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(descriptionLength / descriptionMax) * 100}%`, backgroundColor: getDescriptionProgressColor() }}
              />
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="message success-message" role="status">
              ✅ {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="message error-message" role="alert">
              ❌ {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !title.trim() || !description.trim()}
              title={!title.trim() || !description.trim() ? 'Please fill in all required fields' : 'Submit bug report'}
            >
              {isLoading ? 'Submitting...' : '📤 Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default BugReportModal;
