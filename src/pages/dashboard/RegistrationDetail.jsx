import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowBack, Description, Person, CheckCircle, Event, Attachment } from '@mui/icons-material';
import './dashboard.scss';

const RegistrationDetail = () => {
  const { id } = useParams();
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Build a map of field keys to their labels from the registration's event's registration form
  const getFieldLabel = (fieldKey) => {
    if (!registration || !registration.eventId || !registration.eventId.registrationForm) return fieldKey;
    const field = registration.eventId.registrationForm.find(f => f.key === fieldKey);
    return field?.label || fieldKey;
  };

  // Humanize field names: convert snake_case to Title Case, remove generic prefixes
  const humanizeFieldName = (key) => {
    if (!key) return '';
    
    // Remove type prefixes like text_, select_, checkbox_
    let name = key.replace(/^(text|select|checkbox|radio|email|number|date|textarea|file)_\d*_?/i, '');
    
    // If result is empty or just numbers, keep original
    if (!name || /^\d+$/.test(name)) {
      name = key;
    }
    
    // Convert snake_case to Title Case
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Parse and display values smartly
  const renderValue = (value) => {
    if (value === null || value === undefined) return '—';
    
    // Try to parse JSON strings
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return renderValue(parsed); // Recursively render parsed value
      } catch {
        // Not JSON, return as-is
        return value;
      }
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? '✓ Yes' : '✗ No';
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((v, i) => (
        <div key={i} style={{ marginLeft: '12px', marginTop: '4px' }}>
          • {renderValue(v)}
        </div>
      ));
    }

    // Handle objects (non-JSON)
    if (typeof value === 'object') {
      return (
        <div style={{ marginLeft: '12px', fontSize: '0.9rem' }}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} style={{ marginTop: '4px' }}>
              <strong>{humanizeFieldName(k)}:</strong> {renderValue(v)}
            </div>
          ))}
        </div>
      );
    }

    // Return as string
    return String(value);
  };

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const base = process.env.REACT_APP_API_URL || '';
        const res = await axios.get(`${base}/api/event-registrations/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        setRegistration(res.data.data);
      } catch (err) {
        console.error('Failed to load registration detail', err);
        setError(err.response?.data?.message || err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  if (loading) return <div className="loading-spinner">Loading registration...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!registration) return <div className="error-message">Registration not found.</div>;

  return (
    <div className="registration-detail">
      <Link to="/dashboard" className="btn-secondary" style={{ marginBottom: '20px', display: 'inline-flex' }}>
        <ArrowBack /> Back to My Registrations
      </Link>

      <div className="registration-section">
        <h3>
          <Event />
          Event Details
        </h3>
        <div className="detail-card">
          <div className="detail-row">
            <span className="detail-label">Event:</span>
            <span className="detail-value">{registration.eventId?.title || registration.eventName || 'Untitled'}</span>
          </div>
          {registration.eventId && registration.eventId.slug && (
            <div className="detail-row">
              <span className="detail-label">Action:</span>
              <Link to={`/events/${registration.eventId.slug}`}>View Event Page</Link>
            </div>
          )}
        </div>
      </div>

      <div className="registration-section">
        <h3>
          <CheckCircle />
          Registration Status
        </h3>
        <div className="detail-card">
          <div className="detail-row">
            <span className="detail-label">ID:</span>
            <span className="detail-value">{registration._id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className={`status-badge status-${(registration.status || 'pending')}`}>
              {registration.status || 'pending'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Registered:</span>
            <span className="detail-value">
              {new Date(registration.registrationDate || registration.createdAt || Date.now()).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="registration-section">
        <h3>
          <Person />
          Registrant Information
        </h3>
        <div className="detail-card">
          <div className="detail-row">
            <span className="detail-label">Name:</span>
            <span className="detail-value">{registration.userId?.name || registration.name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Email:</span>
            <span className="detail-value">{registration.userId?.email || registration.email}</span>
          </div>
        </div>
      </div>

      {registration.formResponses && Object.keys(registration.formResponses).length > 0 && (
        <div className="registration-section">
          <h3>
            <Description />
            Form Responses
          </h3>
          <div className="form-responses">
            {Object.entries(registration.formResponses).map(([key, value]) => (
              <div key={key} className="response-item">
                <span className="response-label">{getFieldLabel(key)}:</span>
                <span className="response-value">
                  {renderValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(registration.uploadedFiles) && registration.uploadedFiles.length > 0 && (
        <div className="registration-section">
          <h3>
            <Attachment />
            Uploaded Files
          </h3>
          <div className="detail-card">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {registration.uploadedFiles.map((f, i) => (
                <li key={i}>
                  <a href={f.url || f} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                    {f.name || f.url || `File ${i+1}`}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrationDetail;
