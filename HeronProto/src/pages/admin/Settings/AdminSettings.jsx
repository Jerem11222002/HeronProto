import React, { useState } from 'react';
import "./adminSettings.scss";

const AdminSettings = () => {
  const [activeSection, setActiveSection] = useState('general');

  return (
    <div className="adminSettings">
      <div className="settingsHeader">
        <h1>Admin Settings</h1>
      </div>

      <div className="settingsContainer">
        <div className="settingsSidebar">
          <button 
            className={`sectionButton ${activeSection === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSection('general')}
          >
            General Settings
          </button>
          <button 
            className={`sectionButton ${activeSection === 'security' ? 'active' : ''}`}
            onClick={() => setActiveSection('security')}
          >
            Security
          </button>
          <button 
            className={`sectionButton ${activeSection === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveSection('notifications')}
          >
            Notifications
          </button>
          <button 
            className={`sectionButton ${activeSection === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveSection('permissions')}
          >
            Admin Permissions
          </button>
        </div>

        <div className="settingsContent">
          {activeSection === 'general' && (
            <div className="settingsSection">
              <h2>General Settings</h2>
              <div className="settingsForm">
                <div className="formGroup">
                  <label>Site Name</label>
                  <input type="text" placeholder="Enter site name" />
                </div>
                <div className="formGroup">
                  <label>Contact Email</label>
                  <input type="email" placeholder="Enter contact email" />
                </div>
                <div className="formGroup">
                  <label>Maintenance Mode</label>
                  <div className="toggle">
                    <input type="checkbox" id="maintenance" />
                    <label htmlFor="maintenance">Enable Maintenance Mode</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add other sections as needed */}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;