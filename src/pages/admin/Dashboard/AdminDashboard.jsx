import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/authContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { CircularProgress } from '@mui/material';
import "./adminDashboard.scss";
import logger from '../../../utils/logger';
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeEvents: 0,
    totalParticipants: 0,
    onlineUsers: 0
  });
  // removed activities to maximize upcoming events area
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Try multiple places for the admin token: localStorage first, then currentUser fields
        const tokenFromStorage = (() => {
          try {
            // check both normal user token and admin token keys
            return localStorage.getItem('token') || localStorage.getItem('adminToken');
          } catch (e) { return null; }
        })();
        const tokenFromCurrentUser = currentUser && (currentUser.token || currentUser.accessToken || currentUser.authToken || currentUser.jwt || currentUser.tokenString || currentUser.access_token);
        const token = tokenFromStorage || tokenFromCurrentUser || null;
        console.info('AdminDashboard: token present?', !!token, token ? `${String(token).slice(0,8)}...` : null);

        // Persist token if found on currentUser but not in storage
        if (!tokenFromStorage && tokenFromCurrentUser) {
          try { localStorage.setItem('token', tokenFromCurrentUser); } catch (e) { /* ignore storage errors */ }
        }

        // If no token, skip fetching (do NOT show toast here; allow effect to re-run when auth becomes available)
        if (!token) {
          if (mounted) setLoading(false);
          console.debug('AdminDashboard: no token available yet, skipping stats fetch');
          return;
        }

        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        // Also set axios default so other calls use the same header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        logger.info('admin.dashboard.fetch.start', { timestamp: new Date().toISOString() });

        // fetch stats + upcoming events (no activities to reduce payload)
        const [statsRes, eventsRes] = await Promise.all([
          axios.get('/api/admin/stats', config),
          axios.get('/api/admin/events/upcoming', config)
        ]);

        if (!mounted) return;

        console.debug('AdminDashboard: statsRes', statsRes);
        console.debug('AdminDashboard: eventsRes', eventsRes);

        setStats({
          totalUsers: statsRes.data.totalUsers || 0,
          activeEvents: statsRes.data.activeEvents || 0,
          totalParticipants: statsRes.data.totalParticipants || 0,
          onlineUsers: statsRes.data.onlineUsers || 0
        });
        setUpcomingEvents(eventsRes.data || []);

      } catch (error) {
        logger.error('admin.dashboard.fetch.error', { message: error?.message || String(error), response: error?.response?.data });
        // show toast only for real failures (not for missing token)
        if (error.response?.status === 401) {
          toast.error('Your session has expired. Please login again.');
        } else {
          toast.error(error.response?.data?.message || 'Failed to load dashboard data');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => { mounted = false; };
  // Re-run when currentUser changes (or when a token is stored manually)
  }, [currentUser]);
  
  if (loading) {
    return (
      <div className="loadingContainer">
        <CircularProgress />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="adminDashboard">
      <div className="dashboardHeader">
        <h1>Dashboard</h1>
        <span className="adminInfo">
          Welcome back, {currentUser?.name || 'Admin'}
        </span>
      </div>

      <div className="statsGrid">
        <div className="statCard">
          <h3>Total Users</h3>
          <div className="statValue">{stats.totalUsers}</div>
          <div className="statLabel">Registered Users</div>
        </div>
        <div className="statCard">
          <h3>Events</h3>
          <div className="statValue">{stats.activeEvents}</div>
          <div className="statLabel">Active Events</div>
        </div>
        <div className="statCard">
          <h3>Participants</h3>
          <div className="statValue">{stats.totalParticipants}</div>
          <div className="statLabel">Event Registrations</div>
        </div>
        <div className="statCard">
          <h3>Online Users</h3>
          <div className="statValue">{stats.onlineUsers}</div>
          <div className="statLabel">Currently Active</div>
        </div>
      </div>

      <div className="dashboardContent singleColumn">
        <div className="contentSection upcomingSection">
          <div className="sectionHeader">
            <h2>Upcoming Events</h2>
            <div className="sectionMeta">{upcomingEvents.length} events</div>
          </div>
          <div className="eventsList">
            {upcomingEvents.length > 0 ? (
              <ul className="eventsList__list">
                {upcomingEvents.map((event) => (
                  <li key={event._id} className="eventItem listRow">
                    <div className="eventLeft">
                      {event.image ? (
                        <img className="eventThumb" src={event.image} alt={event.title} loading="lazy" />
                      ) : (
                        <div className="eventThumb placeholder" />
                      )}
                    </div>
                    <div className="eventRight">
                      <div className="rowTop">
                        <h3 className="eventTitle">{event.title}</h3>
                        <div className="participantsBadge">👥 {event.participantCount || 0}</div>
                      </div>
                      <div className="metaRow">
                        <span className="dateBadge">📅 {event.date ? new Date(event.date).toLocaleString() : 'TBA'}</span>
                        {event.location || event.venue ? <span className="locationBadge">📍 {event.location || event.venue}</span> : null}
                        {event.capacity ? <span className="capacityBadge">🏷️ {event.capacity}</span> : null}
                      </div>
                      <p className="eventDesc">{event.description || 'No description provided.'}</p>
                      <div className="rowActions">
                        <Link className="btn btn-outline" to={`/admin/events/${event._id}`}>Open</Link>
                        <button className="btn" onClick={() => navigator.clipboard?.writeText(window.location.origin + `/admin/events/${event._id}`)}>Copy Link</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="emptyState">No upcoming events</div>
            )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;