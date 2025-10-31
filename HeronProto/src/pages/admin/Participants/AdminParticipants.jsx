import React, { useState } from 'react';
import "./adminParticipants.scss";

const AdminParticipants = () => {
  const [selectedEvent, setSelectedEvent] = useState('all');

  return (
    <div className="adminParticipants">
      <div className="participantsHeader">
        <h1>Registration Participants</h1>
        <div className="filterControls">
          <select 
            value={selectedEvent} 
            onChange={(e) => setSelectedEvent(e.target.value)}
          >
            <option value="all">All Events</option>
            <option value="event1">Event 1</option>
            <option value="event2">Event 2</option>
          </select>
        </div>
      </div>

      <div className="participantsTable">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Event</th>
              <th>Registration Date</th>
              <th>Status</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Participant rows will be populated here */}
          </tbody>
        </table>
      </div>

      <div className="participantStats">
        <div className="statCard">
          <h3>Total Registrations</h3>
          <div className="statValue">0</div>
        </div>
        <div className="statCard">
          <h3>Pending Approvals</h3>
          <div className="statValue">0</div>
        </div>
        <div className="statCard">
          <h3>Approved</h3>
          <div className="statValue">0</div>
        </div>
      </div>
    </div>
  );
};

export default AdminParticipants;