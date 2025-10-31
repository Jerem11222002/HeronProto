import React from 'react';
import "./adminAnalytics.scss";

const AdminAnalytics = () => {
  return (
    <div className="adminAnalytics">
      <div className="analyticsHeader">
        <h1>Application Analytics</h1>
        <div className="dateFilter">
          <select defaultValue="7days">
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      <div className="metricsGrid">
        <div className="metricCard">
          <h3>User Growth</h3>
          <div className="chartArea">
            {/* User growth chart will go here */}
          </div>
        </div>
        <div className="metricCard">
          <h3>Event Participation</h3>
          <div className="chartArea">
            {/* Event participation chart will go here */}
          </div>
        </div>
      </div>

      <div className="analyticsContent">
        <div className="section">
          <h2>User Demographics</h2>
          <div className="demographicsChart">
            {/* Demographics visualization will go here */}
          </div>
        </div>
        
        <div className="section">
          <h2>Popular Events</h2>
          <div className="eventsChart">
            {/* Events popularity chart will go here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;