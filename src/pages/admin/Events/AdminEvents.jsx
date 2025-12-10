import React, { useState, useCallback, useMemo } from 'react';
import { useEvents } from '../../../context/EventsContext';
import { 
  IconButton, 
  Tooltip, 
  Dialog, 
  DialogTitle, 
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Chip,
  CircularProgress,
  Typography,
  FormControlLabel,
  Switch,
  InputAdornment
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { RestoreFromTrash as ArchiveIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import './adminEvents.scss';
import VisualFormBuilder from './VisualFormBuilder';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * @typedef {import('../../../types/admin').EventFormData} EventFormData
 * @typedef {import('../../../types/recommendation').EventItem} EventItem
 * @typedef {import('../../../types/recommendation').OrganizationName} OrganizationName
 */

const EVENT_TYPES = {
  WATCH_ONLY: 'watch-only',
  AUDITION: 'audition'
};

const INITIAL_FORM_DATA = {
  title: '',
  description: '',
  date: new Date().toISOString().slice(0, 16),
  image: '',
  organization: 'CAST',
  location: '',
  category: 'workshop',
  status: 'upcoming',
  tags: [],  

  eventType: EVENT_TYPES.WATCH_ONLY,
  requirements: {
    videoRequired: false,
    photoRequired: false,
    experienceRequired: false,
    additionalRequirements: ''
  },
  ticketing: {
    isPaid: false,
    price: 0,
    availableSeats: 0
  }
};

const ORGANIZATION_OPTIONS = [
  'UTPC',
  'CAST',
  'CULTURA',
  'UMAK Jammers',
  'UMAK Chorale',
  'UMAK Dance Extreme',
  'UMAK Siglahi',
  'UMAK Brass Band'
];

const CATEGORY_OPTIONS = [
  'workshop',
  'performance',
  'competition',
  'exhibition',
  'training',
  'showcase'
];

const STATUS_OPTIONS = [
  'upcoming',
  'ongoing',
  'completed',
  'cancelled'
];

const ORGANIZATION_SUGGESTED_TAGS = {
  'UTPC': [
    'visual-arts',
    'painting',
    'artwork',
    'canvas',
    'digital-art',
    'technical-production',
    'creatives',
    'multimedia',
    'design',
    'graphics'
  ],
  'CAST': [
    'drama',
    'acting',
    'stage-performance',
    'theatre',
    'performing-arts',
    'musical',
    'production'
  ],
  'CULTURA': [
    'dance',
    'music',
    'cultural',
    'traditional',
    'filipino-culture',
    'heritage',
    'folk-arts'
  ],
  'UMAK Jammers': [
    'band',
    'modern-music',
    'performance',
    'live-music',
    'contemporary',
    'pop',
    'rock'
  ],
  'UMAK Chorale': [
    'choir',
    'vocal-arts',
    'singing',
    'choral-music',
    'acapella',
    'classical',
    'ensemble'
  ],
  'UMAK Dance Extreme': [
    'modern-dance',
    'choreography',
    'dance',
    'contemporary-dance',
    'street-dance',
    'hip-hop',
    'performance'
  ],
  'UMAK Siglahi': [
    'folk-dance',
    'traditional-arts',
    'cultural',
    'filipino-dance',
    'ethnic',
    'heritage',
    'cultural-performance'
  ],
  'UMAK Brass Band': [
    'instruments',
    'band',
    'orchestra',
    'brass',
    'classical',
    'marching-band',
    'ensemble'
  ]
};

const SuggestedTags = ({ organization, onAddTag }) => {
  const suggestedTags = ORGANIZATION_SUGGESTED_TAGS[organization] || [];
  
  if (!suggestedTags.length) return null;

  return (
    <Box mt={2}>
      <p className="suggested-tags-label" style={{ 
        fontSize: '0.875rem', 
        color: 'rgba(0, 0, 0, 0.6)', 
        marginBottom: '8px' 
      }}>
        Suggested tags for {organization}:
      </p>
      <Box display="flex" gap={1} flexWrap="wrap">
        {suggestedTags.map(tag => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            variant="outlined"
            onClick={() => onAddTag(tag)}
            style={{ cursor: 'pointer' }}
            color="primary"
          />
        ))}
      </Box>
    </Box>
  );
};

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const AdminEvents = () => {
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const { events, loading, error, addEvent, updateEvent, deleteEvent } = useEvents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [validationErrors, setValidationErrors] = useState([]);
  const [imagePreview, setImagePreview] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  // newest-first by default â€” UI toggle below lets admin switch order
  const [newestFirst, setNewestFirst] = useState(true);

  // minimum allowed datetime (local) â€” 3 days from today, used to disable picking earlier dates
  const minDateTime = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  // sanitize registrationForm payload before sending to backend
  const sanitizeRegistrationForm = (input) => {
    let arr = [];
    if (!input) return arr;
    if (typeof input === 'string') {
      try { arr = JSON.parse(input); } catch { arr = []; }
    } else if (Array.isArray(input)) {
      arr = input;
    } else {
      return [];
    }
    const MAX_FIELDS = 200;
    return arr.slice(0, MAX_FIELDS).map(f => {
      const field = f || {};
      return {
        key: String(field.key || '').trim(),
        label: String(field.label || '').trim(),
        type: String(field.type || 'text'),
        required: !!field.required,
        placeholder: field.placeholder || '',
        hint: field.hint || '',
        options: Array.isArray(field.options) ? field.options.map(String) : [],
        validation: field.validation || {},
        meta: field.meta || {}
      };
    }).filter(f => f.key && f.label && f.type);
  };

  const validateForm = useCallback((data) => {
    const errors = [];
    
    // Basic field validations
    if (!data.title || data.title.length < 3) {
      errors.push('Title must be at least 3 characters long');
    }
    if (!data.description || data.description.length < 10) {
      errors.push('Description must be at least 10 characters long');
    }
    if (!data.date) {
      errors.push('Date is required');
    } else {
      const eventDate = new Date(data.date);
      if (isNaN(eventDate.getTime())) {
        errors.push('Invalid date format');
      } else {
        // Require at least 3 full days lead time
        const minAllowed = new Date();
        minAllowed.setHours(0,0,0,0);
        minAllowed.setDate(minAllowed.getDate() + 3);
        if (eventDate < minAllowed) {
          errors.push('Event date must be at least 3 days from today');
        }
      }
    }
    if (!data.image || !data.image.startsWith('http')) {
      errors.push('Valid image URL is required');
    }
    if (!data.organization) {
      errors.push('Organization is required');
    }
    if (!data.location) {
      errors.push('Location is required');
    }
    if (!data.category) {
      errors.push('Category is required');
    }
    
    // Event type specific validations
    if (!data.eventType) {
      errors.push('Event type is required');
    }
  
    if (data.eventType === EVENT_TYPES.WATCH_ONLY) {
      // Validate watch-only event specific fields
      if (data.ticketing.isPaid && (!data.ticketing.price || data.ticketing.price <= 0)) {
        errors.push('Please set a valid ticket price for paid events');
      }
      // Only require available seats when the event is paid (ticketing.isPaid)
      if (data.ticketing.isPaid && (data.ticketing.availableSeats <= 0)) {
        errors.push('Available seats must be greater than 0 for paid events');
      }
    }
  
    if (data.eventType === EVENT_TYPES.AUDITION) {
      // Validate audition event specific fields
      if (!data.requirements.additionalRequirements && 
          !data.requirements.videoRequired && 
          !data.requirements.photoRequired && 
          !data.requirements.experienceRequired) {
        errors.push('At least one audition requirement must be specified');
      }
      
      // Validate audition capacity if specified
      if (data.requirements.maxParticipants && data.requirements.maxParticipants <= 0) {
        errors.push('Maximum participants must be greater than 0');
      }
    }
  
    return errors;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    if (errors.length > 0) {
      setValidationErrors(errors);
      errors.forEach(error => toast.error(error));
      console.warn('Validation failed:', errors, 'formData:', formData);
      return;
    }
 
    setIsSaving(true);
    try {
      // sanitize registrationForm explicitly to ensure backend receives valid schema
      const registrationForm = sanitizeRegistrationForm(formData.registrationForm);

      const eventData = {
        ...formData,
        date: new Date(formData.date).toISOString(),
        // Normalize tags to lowercase before saving
        tags: (formData.tags || []).filter(Boolean).map(tag => tag.toLowerCase()),
        registrationForm
      };
 
       // DEBUG: show what will be sent
       console.log('[AdminEvents] Submitting eventData:', eventData);
 
       if (editingEvent) {
         const result = await updateEvent(editingEvent._id, eventData);
         console.log('[AdminEvents] updateEvent result:', result);
         toast.success('Event updated successfully');
         // notify other admin UIs that events changed
         try { window.dispatchEvent(new CustomEvent('app:events:updated', { detail: { eventId: editingEvent._id } })); } catch (e) {}
       } else {
         const result = await addEvent(eventData);
         console.log('[AdminEvents] addEvent result:', result);
         toast.success('Event created successfully');
         // notify other admin UIs that an event was created
         try { window.dispatchEvent(new CustomEvent('app:events:updated', { detail: { eventId: result && result._id || result.id } })); } catch (e) {}
       }
       
       handleClose();
     } catch (error) {
       console.error('[AdminEvents] submit error:', error);
       toast.error(error.message || 'Failed to save event');
     } finally {
       setIsSaving(false);
     }
   };

  // helper to read token from common storage locations
  const getAuthToken = () => {
    return (
      localStorage.getItem('adminToken') ||
      sessionStorage.getItem('adminToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('authToken') ||
      ''
    );
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete (archive) this event?')) return;

    const token = getAuthToken();
    if (!token) {
      toast.error('Authentication required. Please login.');
      navigate('/login');
      return;
    }

    try {
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const res = await axios.delete(`${baseURL}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 200) {
        toast.success('Event archived. Open Archive to restore or permanently delete.');
        // update local state if context helper exists, otherwise reload
        try {
          if (typeof deleteEvent === 'function') {
            await deleteEvent(eventId);
          } else {
            window.location.reload();
          }
        } catch (refreshErr) {
          console.warn('Refresh after archive failed, reloading page', refreshErr);
          window.location.reload();
        }
      } else {
        toast.error(res.data?.message || 'Failed to archive event');
      }
    } catch (err) {
      console.error('Archive failed', err);
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error(err?.response?.data?.message || 'Failed to archive event');
      }
    }
  };

  const handleImageChange = (url) => {
    setFormData({ ...formData, image: url });
    setImagePreview(url);
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    setIsSaving(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required to upload image');
        return;
      }
      const form = new FormData();
      form.append('image', file);

      const res = await axios.post(`${BASE_URL}/api/events/upload`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000
      });

      if (res?.data?.success && res.data.url) {
        const url = res.data.url;
        setFormData(prev => ({ ...prev, image: url }));
        setImagePreview(url);
        toast.success('Image uploaded and set');
      } else {
        throw new Error(res?.data?.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Event image upload failed', err);
      toast.error(err?.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    setFormData({
      ...formData,
      tags: [...(formData.tags || []), newTag.trim()]
    });
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setFormData(INITIAL_FORM_DATA);
    setValidationErrors([]);
    setImagePreview('');
    setNewTag('');
  };

  const handleOpenFormBuilder = () => {
    // ensure formData.registrationForm is an array
    if (!Array.isArray(formData.registrationForm)) {
      setFormData({ ...formData, registrationForm: [] });
    }
    setIsFormBuilderOpen(true);
  };

  const handleSaveFormSchema = async (schemaArray) => {
    // update local formData immediately
    const newFormData = { ...formData, registrationForm: schemaArray };
    setFormData(newFormData);

    // if editing an existing event, persist to backend right away
    if (editingEvent && editingEvent._id) {
      setIsSaving(true);
      try {
        // normalize payload similar to handleSubmit
        const payload = {
          ...newFormData,
          date: new Date(newFormData.date).toISOString(),
          tags: (newFormData.tags || []).filter(Boolean).map(t => String(t).toLowerCase()),
          registrationForm: schemaArray
        };
        const updated = await updateEvent(editingEvent._id, payload);
        // update local editing state with returned event (normalize date for form)
        if (updated) {
          setEditingEvent(updated);
          setFormData({
            ...updated,
            date: new Date(updated.date).toISOString().slice(0, 16)
          });
        }
        toast.success('Registration form saved');
      } catch (err) {
        console.error('Failed to persist registrationForm:', err);
        toast.error(err?.message || 'Failed to save registration form');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // sortedEvents: newest-first by default (based on createdAt), toggle to invert order
  const sortedEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return [...events].sort((a, b) => {
      // prefer createdAt (when sorting by creation time), fallback to event date
      const ta = new Date(a?.createdAt || a?.date || 0).getTime();
      const tb = new Date(b?.createdAt || b?.date || 0).getTime();
      if (ta === tb) {
        return String(a?.title || '').localeCompare(String(b?.title || ''));
      }
      // newestFirst => show latest created first (descending)
      return newestFirst ? (tb - ta) : (ta - tb);
    });
  }, [events, newestFirst]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="error-container">
        <p className="error-message">{error}</p>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

    return (
    <div className="admin-events">
      <Box className="header" display="flex" justifyContent="space-between" alignItems="center">
        <h1>Event Management</h1>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={newestFirst}
                onChange={(e) => setNewestFirst(Boolean(e.target.checked))}
                color="primary"
              />
            }
            label={newestFirst ? 'Newest first' : 'Oldest first'}
          />
          <Button variant="contained" onClick={() => navigate('/admin/events/archive')} className="archiveBtn" startIcon={<ArchiveIcon />}>
            View Archive
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
          >
            Create New Event
          </Button>
        </Box>
      </Box>
  
      <div className="events-grid">
        {sortedEvents.map(event => (
          <div key={event._id} className="event-card">
            <div className="event-image">
              <img src={event.image} alt={event.title} />
              <div className="event-actions">
                <Tooltip title="Edit Event">
                  <IconButton
                    onClick={() => {
                      setEditingEvent(event);
                      setFormData({
                        ...event,
                        date: new Date(event.date).toISOString().slice(0, 16)
                      });
                      setImagePreview(event.image);
                      setIsModalOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Event">
                  <IconButton onClick={() => handleDelete(event._id)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
            <div className="event-content">
              <h3>{event.title}</h3>
              <p className="description">{event.description}</p>
              <div className="event-meta">
                <span className="date">
                  {new Date(event.date).toLocaleDateString()}
                </span>
                <span className="location">{event.location}</span>
                <span className={`status ${event.status}`}>
                  {event.status}
                </span>
                <Chip
                  label={event.eventType === EVENT_TYPES.AUDITION ? 'Audition Event' : 'Watch-Only Event'}
                  color={event.eventType === EVENT_TYPES.AUDITION ? 'secondary' : 'primary'}
                  size="small"
                />
                {event.eventType === EVENT_TYPES.WATCH_ONLY && event.ticketing?.isPaid && (
                  <Chip
                    label={`â‚±${event.ticketing.price}`}
                    color="success"
                    size="small"
                  />
                )}
              </div>
              {event.tags && event.tags.length > 0 && (
                <div className="tags">
                  {event.tags.map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
  
      <Dialog
        open={isModalOpen}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingEvent ? 'Edit Event' : 'Create New Event'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent dividers>
            <Box display="grid" gap={3}>
              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                error={validationErrors.includes('title')}
              />
              <TextField
                label="Description"
                multiline
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                required
                error={validationErrors.includes('description')}
              />
              <TextField
                type="datetime-local"
                label="Date and Time"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  // enforce minimum selectable date/time in the native picker
                  min: minDateTime,
                  // optional: prevent incremental arrows in some browsers
                  inputMode: 'numeric'
                }}
                helperText={
                  // show guidance for new events; when editing show warning if existing date is within 3 days
                  !editingEvent
                    ? 'Events must be scheduled at least 3 days from today'
                    : (new Date(formData.date) < new Date(minDateTime)
                        ? 'Warning: this event is scheduled less than 3 days from now. To change the date, pick a datetime at least 3 days ahead.'
                        : '')
                }
              />
              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  label="Image URL"
                  value={formData.image}
                  onChange={(e) => handleImageChange(e.target.value)}
                  required
                  error={validationErrors.includes('image')}
                  fullWidth
                  InputProps={{
                    endAdornment: imagePreview && (
                      <img 
                        src={imagePreview} 
                        alt="preview"
                        style={{ height: 40, marginLeft: 8 }}
                      />
                    )
                  }}
                />
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="event-image-file"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) handleFileSelect(f);
                    // reset input so same file can be re-selected later
                    e.target.value = '';
                  }}
                />
                <label htmlFor="event-image-file">
                  <Button component="span" variant="outlined" startIcon={<ImageIcon />} disabled={isSaving}>
                    Upload from device
                  </Button>
                </label>
              </Box>
              <TextField
                select
                label="Organization"
                value={formData.organization}
                onChange={(e) => setFormData({...formData, organization: e.target.value})}
                required
              >
                {ORGANIZATION_OPTIONS.map(org => (
                  <MenuItem key={org} value={org}>{org}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                required
              />
              <TextField
                select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                required
              >
                {CATEGORY_OPTIONS.map(cat => (
                  <MenuItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                {STATUS_OPTIONS.map(status => (
                  <MenuItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Event Type"
                value={formData.eventType}
                onChange={(e) => setFormData({...formData, eventType: e.target.value})}
                required
                error={validationErrors.includes('eventType')}
              >
                <MenuItem value={EVENT_TYPES.WATCH_ONLY}>Watch-Only Event</MenuItem>
                <MenuItem value={EVENT_TYPES.AUDITION}>Audition/Performance Event</MenuItem>
              </TextField>
              {formData.eventType === EVENT_TYPES.WATCH_ONLY && (
                <Box sx={{ border: '1px solid #e0e0e0', p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Ticketing Information
                  </Typography>
                  <Box display="grid" gap={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.ticketing.isPaid}
                          onChange={(e) => setFormData({
                            ...formData,
                            ticketing: {
                              ...formData.ticketing,
                              isPaid: e.target.checked
                            }
                          })}
                        />
                      }
                      label="Paid Event"
                    />
                    {formData.ticketing.isPaid && (
                      <TextField
                        label="Ticket Price"
                        type="number"
                        InputProps={{
                          startAdornment: <InputAdornment position="start">â‚±</InputAdornment>
                        }}
                        value={formData.ticketing.price}
                        onChange={(e) => setFormData({
                          ...formData,
                          ticketing: {
                            ...formData.ticketing,
                            price: Number(e.target.value)
                          }
                        })}
                      />
                    )}
                    <TextField
                      label="Available Seats"
                      type="number"
                      value={formData.ticketing.availableSeats}
                      onChange={(e) => setFormData({
                        ...formData,
                        ticketing: {
                          ...formData.ticketing,
                          availableSeats: Number(e.target.value)
                        }
                      })}
                    />
                  </Box>
                </Box>
              )}
              {formData.eventType === EVENT_TYPES.AUDITION && (
                <Box sx={{ border: '1px solid #e0e0e0', p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Audition Requirements
                  </Typography>
                  <Box display="grid" gap={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.requirements.videoRequired}
                          onChange={(e) => setFormData({
                            ...formData,
                            requirements: {
                              ...formData.requirements,
                              videoRequired: e.target.checked
                            }
                          })}
                        />
                      }
                      label="Require Video Submission"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.requirements.photoRequired}
                          onChange={(e) => setFormData({
                            ...formData,
                            requirements: {
                              ...formData.requirements,
                              photoRequired: e.target.checked
                            }
                          })}
                        />
                      }
                      label="Require Photo Submission"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.requirements.experienceRequired}
                          onChange={(e) => setFormData({
                            ...formData,
                            requirements: {
                              ...formData.requirements,
                              experienceRequired: e.target.checked
                            }
                          })}
                        />
                      }
                      label="Require Prior Experience"
                    />
                    <TextField
                      label="Additional Requirements"
                      multiline
                      rows={3}
                      value={formData.requirements.additionalRequirements}
                      onChange={(e) => setFormData({
                        ...formData,
                        requirements: {
                          ...formData.requirements,
                          additionalRequirements: e.target.value
                        }
                      })}
                    />
                  </Box>
                </Box>
              )}
              <Box>
                <TextField
                  label="Add Tags"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  helperText="Press Enter to add a tag or click suggested tags below"
                  fullWidth
                />
                <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                  {formData.tags?.map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveTag(tag)}
                      color="primary"
                    />
                  ))}
                </Box>
                <SuggestedTags 
                  organization={formData.organization}
                  onAddTag={(tag) => {
                    if (!formData.tags?.includes(tag)) {
                      setFormData({
                        ...formData,
                        tags: [...(formData.tags || []), tag]
                      });
                    }
                  }}
                />
              </Box>
              <Box display="flex" gap={2} alignItems="center">
                <Button
                  variant="outlined"
                  onClick={() => {
                    // ensure array exists
                    if (!Array.isArray(formData.registrationForm)) {
                      setFormData({ ...formData, registrationForm: [] });
                    }
                    setIsFormBuilderOpen(prev => !prev);
                  }}
                  aria-expanded={isFormBuilderOpen}
                  aria-controls="form-builder-panel"
                >
                  {isFormBuilderOpen ? 'Hide Registration Form Editor' : 'Create / Edit Registration Form'}
                </Button>

                <Typography variant="body2" color="textSecondary">
                  Fields: {Array.isArray(formData.registrationForm) ? formData.registrationForm.length : 0}
                </Typography>
              </Box>

              {/* Inline collapsible panel (inside the DialogContent) */}
              {isFormBuilderOpen && (
                <Box id="form-builder-panel" mt={2} sx={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 1, p: 2 }}>
                  <Typography variant="subtitle1" mb={1}>Registration Form Builder</Typography>
                  <Typography variant="body2" color="textSecondary" mb={1}>
                    Build the registration form that will be attached to this event. Use the preview to test.
                  </Typography>

                  {/* VisualFormBuilder renders the field list + live preview.
                      It is already designed to be embedded (not a dialog). */}
                  <VisualFormBuilder
                    value={formData.registrationForm || []}
                    onSave={(schema) => {
                      // persist updated schema to local form state; do NOT auto-close editor
                      setFormData(prev => ({ ...prev, registrationForm: schema }));
                    }}
                    onClose={() => setIsFormBuilderOpen(false)}
                  />

                  {/* quick actions */}
                  <Box mt={2} display="flex" gap={1} justifyContent="flex-end">
                    <Button onClick={() => setIsFormBuilderOpen(false)}>Close Editor</Button>
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={isSaving}
            >
              {isSaving ? (
                <CircularProgress size={24} />
              ) : editingEvent ? (
                'Update Event'
              ) : (
                'Create Event'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
};

export default AdminEvents;
