import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Tooltip, Zoom } from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  CalendarToday,
  LocationOn, 
  People, 
  LocalOffer,
  Category,
  Visibility,
  PersonAdd,
  AccessTime,
  Place,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import axios from 'axios';
import './eventCard.scss';

/**
 * @typedef {import('../../types/recommendation').EventItem} EventItem
 * @typedef {import('../../types/recommendation').OrganizationName} OrganizationName
 */

/**
 * @typedef {Object} OrganizationInfo
 * @property {'theatre' | 'cultural-arts' | 'music' | 'dance' | 'photography' | 'other'} primaryCategory
 * @property {string[]} tags
 * @property {string} badge
 */

/** @type {Record<OrganizationName, OrganizationInfo>} */
const ORGANIZATION_CATEGORIES = {
  'CAST': {
    primaryCategory: 'theatre',
    tags: ['drama', 'acting', 'stage-performance'],
    badge: '/images/badges/umak-cca-cast-300x300.png'
  },
  'CULTURA': {
    primaryCategory: 'cultural-arts',
    tags: ['dance', 'music'],
    badge: '/images/badges/umak-cca-cultura-300x300.jpg'
  },
  'UMAK Jammers': {
    primaryCategory: 'music',
    tags: ['band', 'modern-music'],
    badge: '/images/badges/umak-cca-umakjammers-1-300x300.png'
  },
  'UMAK Chorale': {
    primaryCategory: 'music',
    tags: ['choir', 'vocal-arts'],
    badge: '/images/badges/UMak-Chorale-Logo-300x300.jpg'
  },
  'UMAK Dance Extreme': {
    primaryCategory: 'dance',
    tags: ['modern-dance', 'choreography'],
    badge: '/images/badges/umak-cca-udx-dark.jpg'
  },
  'UMAK Siglahi': {
    primaryCategory: 'dance',
    tags: ['folk-dance', 'traditional-arts'],
    badge: '/images/badges/umak-cca-siglahi-300x300.jpg'
  },
  'UMAK Brass Band': {
    primaryCategory: 'music',
    tags: ['instruments', 'band'],
    badge: '/images/badges/umak-cca-brassband-300x300.jpg'
  },
  'UTPC': {
    primaryCategory: 'Technical Production',
    tags: ['photography', 'media'],
    badge: '/images/badges/UTPC-Logo-1-296x300.png'
  }
};

/**
 * EventCard Component
 * @param {Object} props
 * @param {EventItem} props.event
 * @param {(event: EventItem) => void} props.onJoin
 * @param {boolean} props.isAdmin
 * @param {(event: EventItem) => void} [props.onEdit]
 * @param {(eventId: string) => void} [props.onDelete]
 * @param {(eventId: string) => void} [props.onToggleFavorite]
 * @param {boolean} [props.isFavorite]
 * @param {boolean} [props.isHomePage]
 * @param {string[] | undefined} [props.currentUserInterests]
 * @param {{ count: number, maxParticipants: number | null }} [props.participantData]
 * @returns {JSX.Element}
 */
const EventCard = ({ 
  event, 
  onJoin, 
  isAdmin, 
  onEdit, 
  onDelete, 
  onToggleFavorite,
  isFavorite = false,
  isHomePage = false,
  currentUserInterests = [],
  participantData = { count: 0, maxParticipants: null }
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [hasTagOverflow, setHasTagOverflow] = useState(false);
  const tagsContainerRef = useRef(null);
  const tagsWrapperRef = useRef(null);
  const participantCount = participantData.count ?? 0;
  const maxParticipants = participantData.maxParticipants ?? event.maxParticipants ?? null;

  // Memoize the safe interests array
  const safeInterests = useMemo(() => {
    if (!currentUserInterests) return [];
    return Array.isArray(currentUserInterests) ? currentUserInterests : [];
  }, [currentUserInterests]);

  // Safely convert possible object fields to plain strings
  const toPlain = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(toPlain).filter(Boolean).join(', ');
    if (typeof v === 'object') return v.name || v.title || v.label || v.displayName || '';
    return String(v);
  };
  
  // Get organization category and tags
  const getOrganizationInfo = (orgName) => {
    return ORGANIZATION_CATEGORIES[orgName] || {
      primaryCategory: 'other',
      tags: [],
      badge: ''
    };
  };

  // derive safe labels used in UI
  const orgLabel = toPlain(event.organization) || '';
  const safeTags = (event.tags || []).map(t => toPlain(t)).filter(Boolean);

  const orgInfo = getOrganizationInfo(orgLabel);
  
  // Memoize the unique tags - MOVED UP before useEffect
  const uniqueTags = useMemo(() => {
    const allTags = [...orgInfo.tags, ...safeTags];
    return [...new Set(allTags.map(tag => (typeof tag === 'string' ? tag.toLowerCase() : toPlain(tag))))];
  }, [orgInfo.tags, safeTags]);

  // Check if tags have overflow
  useEffect(() => {
    const checkOverflow = () => {
      if (tagsContainerRef.current) {
        const hasOverflow = tagsContainerRef.current.scrollWidth > tagsContainerRef.current.clientWidth;
        setHasTagOverflow(hasOverflow);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    
    return () => window.removeEventListener('resize', checkOverflow);
  }, [uniqueTags]);

  /**
   * Check if a tag matches user interests
   * @param {string} tag
   * @returns {boolean}
   */
  const isTagInUserInterests = (tag) => {
    return safeInterests.includes(tag.toLowerCase());
  };

  /**
   * Format date to locale string
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date
   */
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // --- UPDATED: Render engagement metrics as Seats and Participants ---
  const renderEngagementMetrics = () => (
    <div className="engagement-metrics">
      <div className="metric">
        {/* Seats */}
        <span className="metric-label">Seats</span>
        <span className="metric-value">{maxParticipants ?? '—'}</span>
      </div>
      <div className="metric">
        {/* Participants */}
        <span className="metric-label">Participants</span>
        <span className="metric-value">{participantCount}</span>
      </div>
    </div>
  );
  // --- END UPDATED ---

  const description = isHomePage && !showFullDescription 
    ? `${event.description.slice(0, 120)}${event.description.length > 120 ? '...' : ''}`
    : event.description;
 
  const handleJoinClick = (eventData) => {
    try {
      if (!eventData._id) {
        console.log('Invalid event data:', eventData);
        toast.error('Unable to join: Invalid event ID');
        return;
      }
  
      // Update path to match the route in App.js
      navigate(`/pre-registration/${eventData._id}`);
      console.log('Navigating to:', `/pre-registration/${eventData._id}`);
      
      if (onJoin) {
        onJoin(eventData);
      }
    } catch (error) {
      console.error('Error joining event:', error);
      toast.error('Failed to join event. Please try again.');
    }
  };
  const isPastOrCompleted = (() => {
    try {
      if (event.status === 'completed') return true;
      const evDate = new Date(event.date);
      return !isNaN(evDate.getTime()) && evDate < new Date();
    } catch { return false; }
  })();

  // --- NEW: Render Event Type, Ticketing, and Audition Requirements ---
  const renderEventTypeAndDetails = () => (
    <div className="event-extra-details">
      {/* Event Type */}
      <div className="event-type">
        <strong>Type:</strong>{' '}
        {event.eventType === 'audition' ? 'Audition/Performance' : 'Watch-Only'}
      </div>
      {/* Ticketing Info for Watch-Only */}
      {event.eventType === 'watch-only' && (
        <div className="event-ticketing">
          <strong>Ticket:</strong>{' '}
          {event.ticketing?.isPaid ? `₱${event.ticketing.price}` : 'Free'}
          {event.ticketing?.availableSeats
            ? ` • Seats: ${event.ticketing.availableSeats}`
            : ''}
        </div>
      )}
      {/* Audition Requirements */}
      {event.eventType === 'audition' && (
        <div className="event-requirements">
          <strong>Requirements:</strong>
          <ul>
            {event.requirements?.videoRequired && <li>Video Submission Required</li>}
            {event.requirements?.photoRequired && <li>Photo Submission Required</li>}
            {event.requirements?.experienceRequired && <li>Prior Experience Required</li>}
            {event.requirements?.additionalRequirements && (
              <li>{event.requirements.additionalRequirements}</li>
            )}
            {event.requirements?.maxParticipants && (
              <li>Max Participants: {event.requirements.maxParticipants}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
  // --- END NEW ---

  // Add this helper function above your component:
  const getEventStatusLabel = (event) => {
    const now = new Date();
    const eventDate = new Date(event.date);

    if (event.status === 'ongoing') return 'Ongoing';
    if (event.status === 'completed') return 'Completed';
    if (event.status === 'upcoming') {
      // If the event date is in the past, mark as completed
      if (eventDate < now) return 'Completed';
      return 'Upcoming';
    }
    // fallback
    return event.status ? event.status.charAt(0).toUpperCase() + event.status.slice(1) : 'Upcoming';
  };

  return (
    <div 
      className={`event-card ${isHomePage ? 'homepage' : ''} ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="event-image">
        <img
          src={event.image}
          alt={event.title}
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            img.onerror = null;
            // inline SVG fallback avoids requesting protected /assets route
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='270'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' fill='#9ca3af' font-family='Arial, Helvetica, sans-serif' font-size='18' dominant-baseline='middle' text-anchor='middle'>No image available</text></svg>`;
            img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
          }}
        />
         <div className="event-badge">
           <Tooltip title="Event Status" placement="right" TransitionComponent={Zoom}>
             <span className={`status ${event.status}`}>
               {getEventStatusLabel(event)}
             </span>
           </Tooltip>
           <Tooltip title="Event Date" placement="right" TransitionComponent={Zoom}>
             <span className="date">
               <AccessTime fontSize="small" />
               {formatDate(event.date)}
             </span>
           </Tooltip>
         </div>
         {isAdmin && !isHomePage && (
           <div className="admin-controls">
             <Tooltip title="Edit Event" placement="left" TransitionComponent={Zoom}>
               <span style={{ display: 'inline-flex' }}>
                <IconButton onClick={() => onEdit?.(event)} className="edit-button">
                 <EditIcon />
                </IconButton>
               </span>
             </Tooltip>
             <Tooltip title="Delete Event" placement="left" TransitionComponent={Zoom}>
               <span style={{ display: 'inline-flex' }}>
                <IconButton 
                  onClick={() => onDelete?.(event._id)}
                  className="delete-button"
                >
                  <DeleteIcon />
                </IconButton>
               </span>
             </Tooltip>
           </div>
         )}
       </div>

      <div className="event-info">
        <div className="event-header">
          <h2>{event.title}</h2>
          <div className="org-info">
            <Tooltip title="Organizing Body" placement="top" TransitionComponent={Zoom}>
              <span className="organization">{orgLabel}</span>
            </Tooltip>
            <Tooltip title="Event Category" placement="top" TransitionComponent={Zoom}>
              <span className="primary-category">
                <Category fontSize="small" />
                {orgInfo.primaryCategory}
              </span>
            </Tooltip>
            {orgInfo.badge && (
              <Tooltip title="Organization Badge" placement="top" TransitionComponent={Zoom}>
                <img src={orgInfo.badge} alt={`${event.organization} badge`} className="organization-badge" />
              </Tooltip>
            )}
          </div>
        </div>

        {renderEngagementMetrics()}
        
        <p 
          className="description"
          onClick={() => isHomePage && setShowFullDescription(!showFullDescription)}
          style={{ cursor: isHomePage ? 'pointer' : 'default' }}
        >
          {description}
        </p>

        {/* NEW: Event Type, Ticketing, Audition Requirements */}
        {renderEventTypeAndDetails()}

        <div className="event-tags">
          <LocalOffer fontSize="small" />
          <div 
            className={`tags-wrapper ${hasTagOverflow ? 'has-overflow' : ''}`}
            ref={tagsWrapperRef}
          >
            <div className="tags-container" ref={tagsContainerRef}>
              {uniqueTags.map((tag, index) => {
                const label = typeof tag === 'string' ? tag : toPlain(tag);
                return (
                  <Tooltip 
                    key={index}
                    title={isTagInUserInterests(label) ? "Matches your interests!" : label}
                    placement="top" 
                    TransitionComponent={Zoom}
                  >
                    <span className={`tag ${isTagInUserInterests(label) ? 'matching' : ''}`}>
                      #{label}
                    </span>
                  </Tooltip>
              );
              })}
            </div>
          </div>
        </div>

        <div className="event-details">
          <Tooltip title="Event Date & Time" placement="top" TransitionComponent={Zoom}>
            <div className="detail">
              <CalendarToday fontSize="small" />
              <span>{formatDate(event.date)}</span>
            </div>
          </Tooltip>
          <Tooltip title="Event Location" placement="top" TransitionComponent={Zoom}>
            <div className="detail">
              <Place fontSize="small" />
              <span>{event.location}</span>
            </div>
          </Tooltip>
          <Tooltip title="Organizing Body" placement="top" TransitionComponent={Zoom}>
            <div className="detail">
              <People fontSize="small" />
              <span>{orgLabel}</span>
            </div>
          </Tooltip>
        </div>

        {!isHomePage && (
          <div className="event-actions">
            <Tooltip title={isPastOrCompleted ? "Event already finished — view details" : "Join this event"} placement="top" TransitionComponent={Zoom}>
              <span style={{ display: 'inline-flex' }}>
                <button 
                  className={`join-button ${isPastOrCompleted ? 'disabled' : ''}`}
                  onClick={() => {
                    if (isPastOrCompleted) {
                      navigate(`/pre-registration/${event._id}`);
                      return;
                    }
                    handleJoinClick(event);
                  }}
                  disabled={isPastOrCompleted}
                  aria-disabled={isPastOrCompleted}
                >
                  <PersonAdd fontSize="small" />
                  {isPastOrCompleted ? 'View' : 'Join Event'}
                </button>
              </span>
            </Tooltip>
            <Tooltip 
              title={isFavorite ? "Remove from favorites" : "Add to favorites"} 
              placement="top" 
              TransitionComponent={Zoom}
            >
              <span style={{ display: 'inline-flex' }}>
                <button 
                  className={`favorite-button ${isFavorite ? 'active' : ''}`}
                  onClick={() => onToggleFavorite?.(event._id)}
                >
                  {isFavorite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                  {isFavorite ? 'Saved' : 'Save'}
                </button>
              </span>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCard;