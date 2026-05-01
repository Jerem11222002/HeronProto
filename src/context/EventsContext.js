import { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './authContext';

const EventsContext = createContext();

// Constants
const POLLING_INTERVAL = 15000; // Reduced interval for testing
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

// Debug logger utility
const debug = (type, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Events Context] ${type}:`, JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data
    }, null, 2));
  }
};

export const EventsProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAdmin, currentUser } = useAuth();
  const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
  const lastFetchRef = useRef(null);
  const lastEventsRef = useRef([]); // Cache the last fetched events to avoid redundant updates
  const lastInterestsRef = useRef(null); // Track last interests to detect changes

  // Memoized headers function with stable reference
  const getAuthHeaders = useCallback(() => ({
    'Authorization': `Bearer ${localStorage.getItem('adminToken') || localStorage.getItem('token')}`,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }), []);

  // Event processing utilities with stable references
  const processEvents = useCallback((rawEvents) => {
    if (!Array.isArray(rawEvents)) {
      console.warn('Invalid events data received:', rawEvents);
      return [];
    }

    return rawEvents
      .filter(event => {
        try {
          const eventDate = new Date(event.date);
          const isValid = 
            event?._id &&
            event?.title &&
            event?.organization &&
            !isNaN(eventDate.getTime()) &&
            event?.status;

          if (!isValid) {
            console.warn('Invalid event filtered out:', { 
              id: event?._id,
              title: event?.title,
              date: event?.date,
              organization: event?.organization
            });
          }
          
          return isValid;
        } catch (err) {
          console.error('Error processing event:', err);
          return false;
        }
      })
      .map(event => ({
        ...event,
        id: event._id, // Ensure consistent ID field
        date: new Date(event.date).toISOString(),
        tags: Array.isArray(event.tags) ? event.tags : [],
        engagementMetrics: {
          views: 0,
          shares: 0,
          interested: 0,
          registrations: 0,
          completionRate: 0,
          ...event.engagementMetrics
        },
        targetAudience: {
          preferredGroupSize: {},
          interests: [],
          yearLevels: [],
          colleges: [],
          ...event.targetAudience
        },
        interested: Array.isArray(event.interested) ? event.interested : [],
        participants: Array.isArray(event.participants) ? event.participants : [],
        registrations: Array.isArray(event.registrations) ? event.registrations : []
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, []);

  // Optimized fetch function
  const fetchEvents = useCallback(async (force = false) => {
    if (!currentUser?._id) {
      console.warn('No user ID available for fetching events');
      return;
    }

    const now = Date.now();
    const cacheExpired = !lastFetchRef.current || (now - lastFetchRef.current) > CACHE_DURATION;
    
    if (!force && !cacheExpired && lastFetchRef.current && (now - lastFetchRef.current) < POLLING_INTERVAL) {
      return;
    }

    try {
      // Only show loading for initial load or when a forced refresh is requested.
      if (force || !lastEventsRef.current.length) {
        setLoading(true);
      }

      const response = await axios.get(`${BASE_URL}/api/events`, {
        headers: getAuthHeaders(),
        params: { 
          userId: currentUser._id,
          timestamp: now,
          interests: currentUser.interests?.join(','),
          following: currentUser.following?.join(',')
        }
      });

      if (!response.data) {
        throw new Error('No events data received');
      }

      const validEvents = processEvents(response.data);
      
      const interestsChanged = JSON.stringify(currentUser.interests) !== 
                              JSON.stringify(lastInterestsRef.current);
      
      if (force || cacheExpired || interestsChanged || 
          JSON.stringify(validEvents) !== JSON.stringify(lastEventsRef.current)) {
        setEvents(validEvents);
        lastEventsRef.current = validEvents;
        lastInterestsRef.current = [...(currentUser.interests || [])];
        
        debug('Events Updated', {
          count: validEvents.length,
          timestamp: new Date().toISOString(),
          forced: force,
          cacheExpired,
          interestsChanged
        });
      }

      lastFetchRef.current = now;
      setError(null);
    } catch (err) {
      console.error('Events fetch error:', err);
      setError(err.response?.data?.message || 'Failed to fetch events');
      if (!lastEventsRef.current.length) {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [BASE_URL, currentUser, getAuthHeaders, processEvents]);

  // Create refreshEvents callback
  const refreshEvents = useCallback(() => fetchEvents(true), [fetchEvents]);

  // Memoized date operations
  const dateOperations = useMemo(() => ({
    getToday: () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return now;
    },
    getMonthLater: () => {
      const now = new Date();
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }), []);

  // Optimized user operations
  const userOperations = useMemo(() => ({
    getUpcomingEvents: () => {
      const now = dateOperations.getToday();
      return events.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= now || event.status === 'ongoing';
      });
    },

    getRecommendedEvents: () => {
      const now = dateOperations.getToday();
      const monthLater = dateOperations.getMonthLater();
      
      return events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate > now && eventDate < monthLater;
      });
    },

    markEventInterest: async (eventId) => {
      try {
        const response = await axios.post(
          `${BASE_URL}/api/events/${eventId}/interest`,
          { userId: currentUser?._id },
          { headers: getAuthHeaders() }
        );
        await fetchEvents(true);
        return response.data;
      } catch (err) {
        throw new Error(err.response?.data?.message || 'Failed to mark interest');
      }
    }
  }), [events, BASE_URL, currentUser?._id, getAuthHeaders, fetchEvents, dateOperations]);

  // Optimized admin operations
  const adminOperations = useMemo(() => ({
    addEvent: async (eventData) => {
      try {
        const response = await axios.post(
          `${BASE_URL}/api/events`, 
          eventData,
          { headers: getAuthHeaders() }
        );
        await fetchEvents(true);
        return response.data;
      } catch (err) {
        throw new Error(err.response?.data?.message || 'Failed to create event');
      }
    },

    updateEvent: async (eventId, eventData) => {
      try {
        const response = await axios.put(
          `${BASE_URL}/api/events/${eventId}`,
          eventData,
          { headers: getAuthHeaders() }
        );
        await fetchEvents(true);
        return response.data;
      } catch (err) {
        throw new Error(err.response?.data?.message || 'Failed to update event');
      }
    },

    deleteEvent: async (eventId) => {
      try {
        await axios.delete(
          `${BASE_URL}/api/events/${eventId}`,
          { headers: getAuthHeaders() }
        );
        await fetchEvents(true);
      } catch (err) {
        throw new Error(err.response?.data?.message || 'Failed to delete event');
      }
    }
  }), [BASE_URL, getAuthHeaders, fetchEvents]);

  // Optimized polling effect
  useEffect(() => {
    let mounted = true;
    let intervalId;

    const fetchWithCheck = async () => {
      if (!mounted || !currentUser?._id) return;
      const interestsChanged = JSON.stringify(currentUser.interests) !== 
                              JSON.stringify(lastInterestsRef.current);
      await fetchEvents(interestsChanged);
    };

    // Admins don't need continuous polling here — they edit events and can refresh manually.
    if (currentUser?._id) {
      fetchWithCheck();
      if (!isAdmin) {
        intervalId = setInterval(fetchWithCheck, POLLING_INTERVAL);
      } else {
        // If admin, run only the initial fetch and stop automatic polling.
        debug('Polling disabled for admin', { userId: currentUser._id });
      }
    }

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentUser?._id, currentUser?.interests, fetchEvents, isAdmin]);

  // Memoized context value with stable reference
  const value = useMemo(() => ({
    events,
    loading,
    error,
    refreshEvents,
    ...(isAdmin ? adminOperations : {}),
    ...userOperations,
    areEventsReady: !loading && !error && Array.isArray(events) && events.length > 0,
    hasEvents: Array.isArray(events) && events.length > 0,
    getEventById: (id) => events.find(event => event._id === id || event.id === id),
    getEventsByOrganization: (org) => events.filter(event => event.organization === org)
  }), [
    events,
    loading,
    error,
    refreshEvents,
    isAdmin,
    adminOperations,
    userOperations
  ]);

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
};

export const useEvents = () => useContext(EventsContext);

export default EventsContext;