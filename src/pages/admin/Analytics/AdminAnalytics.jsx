import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import './adminAnalytics.scss';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const formatDate = (d) => {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
};

const AdminAnalytics = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [visitorSeries, setVisitorSeries] = useState(null);
  const [eventDist, setEventDist] = useState(null);
  const [participantSeries, setParticipantSeries] = useState(null);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); return formatDate(d);
  });
  const [to, setTo] = useState(() => formatDate(new Date()));
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // try real endpoints; fallback to mock data if server returns non-OK
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [ovRes, visRes, evtRes, partRes] = await Promise.allSettled([
        axios.get(`/api/admin/analytics/overview${qs}`),
        axios.get(`/api/admin/analytics/visitors${qs}`),
        axios.get(`/api/admin/analytics/events-distribution${qs}`),
        axios.get(`/api/admin/analytics/participants${qs}`)
      ]);

      // helper to unwrap or null
      const unwrap = (r) => (r.status === 'fulfilled' && r.value && r.value.data) ? r.value.data : null;

      const ov = unwrap(ovRes);
      const vis = unwrap(visRes);
      const evt = unwrap(evtRes);
      const part = unwrap(partRes);

      // fallback to local mock if any piece is missing
      setOverview(ov || {
        totalUsers: 4521, activeEvents: 27, totalRevenue: 24500, conversionRate: 3.2
      });

      setVisitorSeries(vis || {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        values: [3000, 3500, 4000, 3800, 4200, 4500]
      });

      setEventDist(evt || {
        labels: ['Training', 'Workshop', 'Webinar', 'Conference', 'Seminar'],
        values: [30, 25, 20, 15, 10]
      });

      setParticipantSeries(part || {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        values: [65, 78, 90, 85, 95, 110]
      });

    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const exportCSV = useCallback(() => {
    // export visitor & participant series as CSV
    const rows = [];
    const labels = visitorSeries?.labels || [];
    rows.push(['date', 'visitors', 'participants'].join(','));
    for (let i = 0; i < labels.length; i++) {
      const a = labels[i] || '';
      const v = (visitorSeries?.values?.[i] ?? '');
      const p = (participantSeries?.values?.[i] ?? '');
      rows.push([a, v, p].join(','));
    }
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [visitorSeries, participantSeries, from, to]);

  if (isLoading) {
    return (
      <div className="loadingContainer">
        <div className="spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="analyticsContainer">
      <div className="headerRow">
        <h1>Analytics Dashboard</h1>
        <div className="controls">
          <label>
            From <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label>
            To <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <button className="btn" onClick={fetchAll}>Refresh</button>
          <button className="btn btn-outline" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="statsGrid">
        <div className="statCard">
          <h3>Total Users</h3>
          <p className="statNumber">{overview.totalUsers.toLocaleString()}</p>
          <span className="statChange positive">â€”</span>
        </div>
        <div className="statCard">
          <h3>Active Events</h3>
          <p className="statNumber">{overview.activeEvents}</p>
          <span className="statChange positive">â€”</span>
        </div>
        <div className="statCard">
          <h3>Total Revenue</h3>
          <p className="statNumber">${overview.totalRevenue.toLocaleString()}</p>
          <span className="statChange positive">â€”</span>
        </div>
        <div className="statCard">
          <h3>Conversion Rate</h3>
          <p className="statNumber">{overview.conversionRate}%</p>
          <span className="statChange negative">â€”</span>
        </div>
      </div>

      <div className="chartsGrid">
        <div className="chartCard">
          <h2>Visitor Trends</h2>
          <div className="chartContainer">
            <Line
              data={{
                labels: visitorSeries.labels,
                datasets: [{
                  label: 'Visitors',
                  data: visitorSeries.values,
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.3,
                  fill: false
                }]
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>

        <div className="chartCard">
          <h2>Event Distribution</h2>
          <div className="chartContainer">
            <Doughnut
              data={{
                labels: eventDist.labels,
                datasets: [{ data: eventDist.values, backgroundColor: ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF'] }]
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>

        <div className="chartCard">
          <h2>Participant Growth</h2>
          <div className="chartContainer">
            <Bar
              data={{
                labels: participantSeries.labels,
                datasets: [{ label: 'Participants', data: participantSeries.values, backgroundColor: 'rgba(54, 162, 235, 0.5)'}]
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
