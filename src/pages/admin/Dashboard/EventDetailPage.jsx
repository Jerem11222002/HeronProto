import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CircularProgress } from "@mui/material";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import "./eventDetailPage.scss";

const COLORS = ["#5271ff", "#3f57ff", "#ffb347", "#ff6961", "#6dd3c6", "#b7b7b7"];

function getRegistrantsByDay(registrants) {
  // Group by day
  const byDay = {};
  registrants.forEach(r => {
    const day = new Date(r.createdAt).toLocaleDateString();
    byDay[day] = (byDay[day] || 0) + 1;
  });
  return Object.entries(byDay).map(([date, count]) => ({ date, count }));
}

const EventDetailPage = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [registrants, setRegistrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      setError("");
      try {
        const [eventRes, regRes] = await Promise.all([
          axios.get(`/api/events/${id}`),
          axios.get(`/api/event-registrations/admin/registrations/${id}`)
        ]);
        setEvent(eventRes.data);
        setRegistrants(regRes.data);
      } catch (err) {
        setError("Failed to load event details.");
      }
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  const handleExport = () => {
    setExporting(true);
    exportRegistrants(registrants, event.title);
    setTimeout(() => setExporting(false), 1200);
  };

  // Registrant summary stats
  const uniqueEmails = new Set(registrants.map(r => r.email)).size;
  const regByType = registrants.reduce((acc, r) => {
    acc[r.type || "General"] = (acc[r.type || "General"] || 0) + 1;
    return acc;
  }, {});
  const regTypeData = Object.entries(regByType).map(([type, count], i) => ({
    name: type, value: count, color: COLORS[i % COLORS.length]
  }));

  const regTimelineData = getRegistrantsByDay(registrants);

  if (loading) return (
    <div className="eventDetailPage" style={{ textAlign: "center", padding: "60px" }}>
      <CircularProgress />
    </div>
  );

  if (error) return (
    <div className="eventDetailPage emptyState">
      {error}
    </div>
  );

  return (
    <div className="eventDetailPage">
      <h1>{event.title}</h1>
      <div className="eventReportGrid">
        <div>
          <img
            className="eventImage"
            src={event.image || event.pubmat || "/default-event.png"}
            alt={event.title}
            onError={e => { e.target.src = "/default-event.png"; }}
          />
          <div className="eventMeta">
            <div className="metaItem">
              <span role="img" aria-label="calendar">ðŸ“…</span>
              {event.date ? new Date(event.date).toLocaleString() : "No date"}
            </div>
            <div className="metaItem">
              <span role="img" aria-label="location">ðŸ“</span>
              {event.location || event.venue || "No location"}
            </div>
            <div className="metaItem">
              <span role="img" aria-label="capacity">ðŸ‘¥</span>
              {event.maxParticipants != null
                ? event.maxParticipants
                : event.ticketing?.availableSeats != null
                  ? event.ticketing.availableSeats
                  : "No capacity"}
            </div>
            <div className="metaItem">
              <span role="img" aria-label="status">ðŸŸ¢</span>
              {event.status || "Active"}
            </div>
            {event.type && (
              <div className="metaItem">
                <span role="img" aria-label="type">ðŸ·ï¸</span>
                {event.type}
              </div>
            )}
            {event.organizer && (
              <div className="metaItem">
                <span role="img" aria-label="organizer">ðŸ§‘â€ðŸ’¼</span>
                {event.organizer}
              </div>
            )}
          </div>
        </div>
        <div className="eventSummary">
          <h2>Event Summary</h2>
          <ul>
            <li><strong>Total Registrants:</strong> {registrants.length}</li>
            <li><strong>Unique Emails:</strong> {uniqueEmails}</li>
            <li><strong>Registration Types:</strong>
              <ul>
                {Object.entries(regByType).map(([type, count]) => (
                  <li key={type}>{type}: {count}</li>
                ))}
              </ul>
            </li>
            <li><strong>Created:</strong> {event.createdAt ? new Date(event.createdAt).toLocaleString() : "N/A"}</li>
            <li><strong>Last Updated:</strong> {event.updatedAt ? new Date(event.updatedAt).toLocaleString() : "N/A"}</li>
          </ul>
          <div className="exportRow">
            <button onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
            <span style={{ color: "#888", fontSize: "0.98rem" }}>
              {registrants.length} registrant{registrants.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* --- Charts Section --- */}
      <div className="eventChartsGrid">
        <div className="chartCard">
          <h3>Registration Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={regTypeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {regTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chartCard">
          <h3>Registrations Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={regTimelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#5271ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* --- End Charts Section --- */}

      <div className="eventDescription">
        {event.description || "No description provided."}
      </div>
      <h2>Registrants</h2>
      {registrants.length === 0 ? (
        <div className="emptyState">No registrants yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="registrantsTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Type</th>
                <th>Registered At</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map(r => (
                <tr key={r._id}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.type || "General"}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Simple CSV export
function exportRegistrants(data, eventTitle) {
  const csv = [
    ["Name", "Email", "Type", "Registered At"],
    ...data.map(r => [r.name, r.email, r.type || "General", new Date(r.createdAt).toLocaleString()])
  ].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${eventTitle}-registrants.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default EventDetailPage;
