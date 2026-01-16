import React, { useEffect, useState, useCallback, useContext } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { EventAvailable as EventIcon, Visibility as ViewIcon, Search as SearchIcon } from '@mui/icons-material';
import { useLanguage } from '../../hooks/useLanguage';
import { DarkModeContext } from '../../context/darkModeContext';
import './dashboard.scss';

const Dashboard = () => {
  const { t } = useLanguage();
  const { darkMode } = useContext(DarkModeContext) || {};
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: '', q: '', startDate: '', endDate: '', sortBy: 'registrationDate', sortDir: 'desc' });
  const navigate = useNavigate();

  const buildQuery = (p, l, f) => {
    const params = new URLSearchParams();
    params.set('page', p);
    params.set('limit', l);
    if (f.status) params.set('status', f.status);
    if (f.q) params.set('q', f.q);
    if (f.startDate) params.set('startDate', f.startDate);
    if (f.endDate) params.set('endDate', f.endDate);
    if (f.sortBy) params.set('sortBy', f.sortBy);
    if (f.sortDir) params.set('sortDir', f.sortDir);
    return params.toString();
  };

  const fetchRegs = useCallback(async (p = page, l = limit, f = filters) => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.REACT_APP_API_URL || '';
      const qs = buildQuery(p, l, f);
      const res = await axios.get(`${base}/api/event-registrations/user?${qs}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setRegistrations(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || p);
      setLimit(res.data.limit || l);
    } catch (err) {
      console.error('Failed to load registrations', err);
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => { fetchRegs(1, limit, filters); }, [fetchRegs, limit, filters]);

  const totalPages = Math.ceil(total / limit) || 1;

  if (loading) return <div className="loading-spinner">{t('loading-registrations')}</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <h1>{t('my-registrations')}</h1>
        <div className="controls">
          <div className="filters">
            <input type="text" placeholder={t('search-events-registrations')} value={filters.q} onChange={(e) => setFilters({...filters, q: e.target.value})} />
            <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
              <option value="">{t('all-statuses')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="approved">{t('approved')}</option>
              <option value="rejected">{t('rejected')}</option>
              <option value="waitlisted">Waitlisted</option>
            </select>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
            <select value={filters.sortBy} onChange={(e) => setFilters({...filters, sortBy: e.target.value})}>
              <option value="registrationDate">{t('newest')}</option>
              <option value="eventName">{t('event-name')}</option>
              <option value="status">{t('status')}</option>
            </select>
            <select value={filters.sortDir} onChange={(e) => setFilters({...filters, sortDir: e.target.value})}>
              <option value="desc">{t('descending')}</option>
              <option value="asc">{t('ascending')}</option>
            </select>
            <button className="btn-primary" onClick={() => { setPage(1); fetchRegs(1, limit, filters); }}>{t('apply')}</button>
            <button className="btn-secondary" onClick={() => { setFilters({ status: '', q: '', startDate: '', endDate: '', sortBy: 'registrationDate', sortDir: 'desc' }); setPage(1); }}>{t('clear')}</button>
          </div>
          <label>
            {t('per-page')}:
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>
        </div>
      </div>

      {registrations.length === 0 ? (
        <p>You have no registrations yet. <Link to="/events">Explore events</Link> to register.</p>
      ) : (
        <>
          <ul className="registrations-list">
            {registrations.map(reg => (
              <li key={reg._id} className="registration-item">
                <div className="reg-main">
                  <div className="reg-info">
                    <h3>
                      <EventIcon />
                      {reg.eventId?.title || reg.eventName || 'Untitled Event'}
                    </h3>
                    <p className="muted">
                      <span>📅</span>
                      {new Date(reg.registrationDate || reg.createdAt || Date.now()).toLocaleString()}
                    </p>
                    <p>
                      <span>🆔</span>
                      {reg._id}
                    </p>
                    <p>
                      <span>📋</span>
                      Status: <span className={`status-badge status-${(reg.status||'pending')}`}>{reg.status || 'pending'}</span>
                    </p>
                  </div>
                  <div className="reg-actions">
                    {reg.eventId?.slug && <Link to={`/events/${reg.eventId.slug}`} className="btn-secondary"><ViewIcon /> View Event</Link>}
                    <button className="btn-primary" onClick={() => navigate(`/dashboard/registration/${reg._id}`)}><SearchIcon /> View Details</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="pagination">
            <button disabled={page <= 1} onClick={() => { const np = Math.max(1, page-1); setPage(np); fetchRegs(np, limit, filters); }}>Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => { const np = Math.min(totalPages, page+1); setPage(np); fetchRegs(np, limit, filters); }}>Next</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
