import React, { useState, useMemo } from 'react';
import './BugReportHistory.scss';

const CATEGORIES = {
  bug: { label: 'Bug', icon: '🐛' },
  ui: { label: 'UI/UX Issue', icon: '🎨' },
  performance: { label: 'Performance', icon: '⚡' },
  security: { label: 'Security', icon: '🔒' },
  feature: { label: 'Feature Request', icon: '✨' },
  other: { label: 'Other', icon: '📋' }
};

const SEVERITIES = {
  low: { label: 'Low', color: '#10b981' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#f97316' },
  critical: { label: 'Critical', color: '#ef4444' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b', icon: '⏳' },
  'in-progress': { label: 'In Review', color: '#3b82f6', icon: '🔍' },
  resolved: { label: 'Resolved', color: '#10b981', icon: '✅' },
  closed: { label: 'Closed', color: '#6b7280', icon: '🔒' }
};

const BugReportHistory = ({ reports = [] }) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    let filtered = [...reports];

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Apply severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(r => r.severity === filterSeverity);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'severity':
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        default:
          return 0;
      }
    });

    return filtered;
  }, [reports, filterStatus, filterSeverity, sortBy]);

  if (reports.length === 0) {
    return (
      <div className="bug-report-history empty-state">
        <div className="empty-icon">📋</div>
        <h3>No Bug Reports Yet</h3>
        <p>Your submitted bug reports will appear here. Help us improve by reporting issues!</p>
      </div>
    );
  }

  return (
    <div className="bug-report-history">
      {/* Header */}
      <div className="history-header">
        <h3>Your Report History</h3>
        <span className="report-count">{filteredReports.length} of {reports.length}</span>
      </div>

      {/* Filters */}
      <div className="history-filters">
        <div className="filter-group">
          <label htmlFor="filter-status">Status:</label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, { label, icon }]) => (
              <option key={key} value={key}>
                {icon} {label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-severity">Severity:</label>
          <select
            id="filter-severity"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Severities</option>
            {Object.entries(SEVERITIES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sort-by">Sort:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="severity">By Severity</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      <div className="reports-list">
        {filteredReports.length > 0 ? (
          filteredReports.map((report) => (
            <div key={report._id} className="report-card">
              {/* Card Header */}
              <div className="card-header">
                <div className="header-left">
                  <h4 className="report-title">{report.title}</h4>
                  <div className="header-badges">
                    <span
                      className="badge category-badge"
                      title={CATEGORIES[report.category]?.label}
                    >
                      {CATEGORIES[report.category]?.icon} {CATEGORIES[report.category]?.label}
                    </span>
                  </div>
                </div>
                <div className="header-right">
                  <span
                    className="status-badge"
                    style={{ '--status-color': STATUS_CONFIG[report.status]?.color }}
                  >
                    {STATUS_CONFIG[report.status]?.icon} {STATUS_CONFIG[report.status]?.label}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="card-body">
                <p className="report-description">{report.description}</p>
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                <div className="footer-left">
                  <span
                    className="severity-badge"
                    style={{ '--severity-color': SEVERITIES[report.severity]?.color }}
                  >
                    {SEVERITIES[report.severity]?.label}
                  </span>
                </div>
                <div className="footer-right">
                  <span className="report-date">
                    {new Date(report.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-results">
            <p>No reports match your filters. Try adjusting your selection.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BugReportHistory;
