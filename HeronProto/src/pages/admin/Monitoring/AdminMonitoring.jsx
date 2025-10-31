import React, { useState } from 'react';
import "./adminMonitoring.scss";

const AdminMonitoring = () => {
  const [activeTab, setActiveTab] = useState('activities');

  return (
    <div className="adminMonitoring">
      <div className="monitoringHeader">
        <h1>User Monitoring</h1>
        <div className="tabControls">
          <button 
            className={`tab ${activeTab === 'activities' ? 'active' : ''}`}
            onClick={() => setActiveTab('activities')}
          >
            User Activities
          </button>
          <button 
            className={`tab ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setActiveTab('online')}
          >
            Online Users
          </button>
          <button 
            className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            System Reports
          </button>
        </div>
      </div>

      <div className="monitoringContent">
        {activeTab === 'activities' && (
          <div className="activityLog">
            <div className="filterBar">
              <input type="text" placeholder="Search activities..." />
              <select defaultValue="all">
                <option value="all">All Activities</option>
                <option value="login">Logins</option>
                <option value="event">Event Actions</option>
                <option value="profile">Profile Updates</option>
              </select>
            </div>
            <div className="activityList">
              {/* Activity items will be populated here */}
            </div>
          </div>
        )}

        {activeTab === 'online' && (
          <div className="onlineUsers">
            <div className="userStats">
              <div className="statCard">
                <h3>Current Online</h3>
                <div className="value">0</div>
              </div>
              <div className="statCard">
                <h3>Peak Today</h3>
                <div className="value">0</div>
              </div>
            </div>
            <div className="userList">
              {/* Online users will be listed here */}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="systemReports">
            <div className="reportGrid">
              {/* System reports will be displayed here */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonitoring;