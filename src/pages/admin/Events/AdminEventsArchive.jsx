import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Button, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Typography } from '@mui/material';
import { RestoreFromTrash as RestoreIcon, DeleteForever as DeleteIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

// helper to read token from common storage locations (match AdminEvents.jsx)
const getAuthToken = () => {
  return (
    localStorage.getItem('adminToken') ||
    sessionStorage.getItem('adminToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('authToken') ||
    ''
  );
};

const AdminEventsArchive = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required. Please login.');
        navigate('/login');
        return;
      }
      const res = await axios.get(`${baseURL}/api/events/archive`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(res.data?.items || []);
    } catch (err) {
      console.error('Failed to load archive', err);
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error('Failed to load archive');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArchive(); }, []);

  const handleRestore = async (archiveId) => {
    if (!window.confirm('Restore this event?')) return;
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required. Please login.');
        navigate('/login');
        return;
      }
      const res = await axios.post(`${baseURL}/api/events/archive/${archiveId}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Event restored');
      fetchArchive();
      // optional: navigate to events list or to the restored event
    } catch (err) {
      console.error('Restore failed', err);
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error(err?.response?.data?.message || 'Restore failed');
      }
    }
  };

  const handlePermanentDelete = async (archiveId) => {
    if (!window.confirm('Permanently delete this archived event? This cannot be undone.')) return;
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required. Please login.');
        navigate('/login');
        return;
      }
      await axios.delete(`${baseURL}/api/events/archive/${archiveId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Archive permanently deleted');
      fetchArchive();
    } catch (err) {
      console.error('Permanent delete failed', err);
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error(err?.response?.data?.message || 'Delete failed');
      }
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

  return (
    <Box p={3} className="admin-archive">
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5">Archived Events</Typography>
        <Button variant="outlined" onClick={() => navigate(-1)}>Back</Button>
      </Box>

      {items.length === 0 ? (
        <Typography>No archived events.</Typography>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Archived At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(item => (
              <TableRow key={item._id}>
                <TableCell>{item.eventData?.title}</TableCell>
                <TableCell>{item.eventData?.organization}</TableCell>
                <TableCell>{new Date(item.archivedAt).toLocaleString()}</TableCell>
                <TableCell>
                  <IconButton color="primary" onClick={() => handleRestore(item._id)} title="Restore">
                    <RestoreIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handlePermanentDelete(item._id)} title="Delete permanently">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default AdminEventsArchive;
