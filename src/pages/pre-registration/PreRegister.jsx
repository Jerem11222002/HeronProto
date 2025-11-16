import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/authContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import './PreRegister.scss';
import AuditionRegister from './Forms/AuditionRegister';
import WatchOnlyRegister from './Forms/WatchOnlyRegister';

const ORGANIZATION_BADGES = {
  'CAST': '/images/badges/umak-cca-cast-300x300.png',
  'CULTURA': '/images/badges/umak-cca-cultura-300x300.jpg',
  'UMAK Jammers': '/images/badges/umak-cca-umakjammers-1-300x300.png',
  'UMAK Chorale': '/images/badges/UMak-Chorale-Logo-300x300.jpg',
  'UMAK Dance Extreme': '/images/badges/umak-cca-udx-dark.jpg',
  'UMAK Siglahi': '/images/badges/umak-cca-siglahi-300x300.jpg',
  'UMAK Brass Band': '/images/badges/umak-cca-brassband-300x300.jpg',
  'UTPC': '/images/badges/UTPC-Logo-1-296x300.png'
};

const getOrganizationBadge = (orgName) => {
  return ORGANIZATION_BADGES[orgName] || '/images/badges/default-badge.png';
};

const PreRegister = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
    }
    // eslint-disable-next-line
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch event details
      const response = await axios.get(`/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const eventData = response.data;

      console.debug('[PreRegister] fetched event:', { id: eventId, registrationForm: eventData.registrationForm });
      
      // If admin saved a template reference but not the embedded schema, fetch the template
      if ((!Array.isArray(eventData.registrationForm) || eventData.registrationForm.length === 0)
          && eventData.registrationFormTemplate) {
        try {
          const tplRes = await axios.get(`/api/form-templates/${eventData.registrationFormTemplate}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          // try common property names
          const tpl = tplRes.data || {};
          const tplSchema = tpl.schema || tpl.registrationForm || tpl.form || [];
          if (Array.isArray(tplSchema) && tplSchema.length) {
            eventData.registrationForm = tplSchema;
            console.debug('[PreRegister] loaded registrationForm from template:', tplSchema);
          }
        } catch (tplErr) {
          console.debug('[PreRegister] failed to fetch registration form template', tplErr?.message || tplErr);
        }
      }

      // 2. Fetch participant count
      const countsRes = await axios.post('/api/event-registrations/counts', { eventIds: [eventId] });
      const participantData = countsRes.data?.counts?.[eventId] || { count: 0, maxParticipants: eventData.maxParticipants ?? null };

      eventData.currentParticipants = participantData.count;
      eventData.maxParticipants = participantData.maxParticipants;

      if (eventData.maxParticipants &&
        eventData.currentParticipants >= eventData.maxParticipants) {
        setError('Event is at full capacity');
        toast.error('This event has reached its maximum capacity');
      }

      setEvent(eventData);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to load event details';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!event) return <div>No event found</div>;

  const isEventFull = Boolean(
    event.maxParticipants &&
    event.currentParticipants >= event.maxParticipants
  );

  // Use the admin-created registrationForm schema
  const schema = event.registrationForm && event.registrationForm.length > 0
    ? event.registrationForm
    : []; // fallback to empty or default if needed

  return (
    <div className="pre-register">
      <div className="pre-register-header">
        <h1>Event Registration</h1>
        <div className="event-details">
          <div className="event-header">
            <div className="organization-badge">
              <img
                src={getOrganizationBadge(event.organization)}
                alt={`${event.organization} badge`}
                className="org-badge"
                onError={(e) => {
                  e.target.src = '/images/badges/default-badge.png';
                  e.target.onerror = null;
                }}
              />
            </div>
            <div className="event-info">
              <h2>{event.title}</h2>
              <p className="event-meta">
                <span><i className="far fa-calendar"></i> {new Date(event.date).toLocaleDateString()}</span>
                <span><i className="far fa-clock"></i> {new Date(event.date).toLocaleTimeString()}</span>
                <span><i className="fas fa-map-marker-alt"></i> {event.location}</span>
              </p>
              <p className="organization">Organized by: {event.organization}</p>
              <div className="capacity">
                <div className="capacity-bar">
                  <div
                    className="capacity-filled"
                    style={{
                      width: `${(event.currentParticipants / event.maxParticipants) * 100}%`
                    }}
                  ></div>
                </div>
                <span>
                  {event.currentParticipants}/{event.maxParticipants} participants
                  {isEventFull && <span className="full-badge">Event Full</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEventFull ? (
        <div className="event-full-message">
          <h3>Registration Closed</h3>
          <p>This event has reached its maximum capacity. Please check back later or explore other events.</p>
          <button onClick={() => navigate('/events')} className="btn-secondary">
            View Other Events
          </button>
        </div>
      ) : (
        event.eventType === 'audition'
          ? <AuditionRegister event={event} user={currentUser} />
          : <WatchOnlyRegister event={event} user={currentUser} />
      )}
    </div>
  );
};

export default PreRegister;