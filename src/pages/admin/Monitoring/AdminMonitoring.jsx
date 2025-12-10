import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Stack,
} from '@mui/material';
import {
  Block as BlockIcon,
  Warning as WarningIcon,
  Email as EmailIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import './adminMonitoring.scss';

const AdminMonitoring = () => {
  const [activityData, setActivityData] = useState([]);
  const [userSessions, setUserSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdmins, setShowAdmins] = useState(false);      // new
  const [groupByUser, setGroupByUser] = useState(true);     // new default to grouped view
  const socketRef = useRef(null);

  // computed filtered sessions and grouped view
  const filteredSessions = useMemo(() => {
    return userSessions.filter(s => (showAdmins ? true : !s.isAdmin));
  }, [userSessions, showAdmins]);

  const groupedUsers = useMemo(() => {
    if (!groupByUser) return [];
    const map = new Map();
    filteredSessions.forEach(s => {
      const key = s.userId || s.user || s.id;
      if (!map.has(key)) {
        map.set(key, { userId: s.userId, user: s.user, count: 0, sessions: [] });
      }
      const item = map.get(key);
      item.count++;
      item.sessions.push(s);
    });
    return Array.from(map.values()).sort((a,b) => b.count - a.count);
  }, [filteredSessions, groupByUser]);

  const fetchInitial = async () => {
    try {
      setLoading(true);
      const [actRes, sessRes] = await Promise.all([
        axios.get('/api/admin/monitoring/activity'),
        axios.get('/api/admin/monitoring/sessions')
      ]);
      setActivityData(actRes.data?.activity || []);
      setUserSessions(sessRes.data?.sessions || []);
    } catch (err) {
      console.error('fetch monitoring data error', err);
      toast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchInitial();

    // connect socket.io and authenticate using token stored by auth
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (!token) {
      console.warn('AdminMonitoring: no token in localStorage, socket will not connect');
      return () => {};
    }

    socketRef.current = io('/', {
      path: '/socket.io',
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      console.log('AdminMonitoring socket connected', socketRef.current.id);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('AdminMonitoring socket connect_error', err);
      toast.error('Real-time connection failed: ' + (err.message || err));
    });

    socketRef.current.on('monitoring.activity.update', (payload) => {
      if (!mounted) return;
      setActivityData(payload.activity || []);
    });

    socketRef.current.on('monitoring.sessions.update', (payload) => {
      if (!mounted) return;
      setUserSessions(payload.sessions || []);
    });

    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const handleTerminate = async (sessionId) => {
    try {
      await axios.post(`/api/admin/monitoring/sessions/${sessionId}/terminate`);
      toast.success('Session terminated');
      setUserSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('terminate error', err);
      toast.error('Failed to terminate session');
    }
  };

  const handleBlockUser = async (userId) => {
    try {
      await axios.post(`/api/admin/monitoring/users/${userId}/block`);
      toast.success('User blocked');
      setUserSessions(prev => prev.map(s => s.userId === userId ? { ...s, status: 'blocked' } : s));
    } catch (err) {
      console.error('block user error', err);
      toast.error('Failed to block user');
    }
  };

  const handleWarnUser = (userId) => {
    toast.info('Warning sent to user (not implemented)');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'idle': return 'warning';
      case 'suspicious': return 'error';
      default: return 'default';
    }
  };

  const getActivityColor = (activity) => {
    switch (activity) {
      case 'high': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'low': return '#f44336';
      default: return '#757575';
    }
  };

  // Render helper to avoid complex inline JSX ternary parsing issues
  const renderRows = () => {
    if (groupByUser) {
      return groupedUsers.map(u => (
        <TableRow key={u.userId || u.user}>
          <TableCell>{u.user || 'unknown'}</TableCell>
          <TableCell>{u.count}</TableCell>
          <TableCell>
            <small>{u.sessions.slice(0,2).map(s => `${s.device} â€¢ ${s.duration}`).join(' Â· ')}</small>
          </TableCell>
          <TableCell>
            <Box className="actionButtons">
              <Tooltip title="Terminate all sessions for user">
                <IconButton size="small" color="error" onClick={() => Promise.all(u.sessions.map(s => handleTerminate(s.id)))}>
                  <BlockIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Warn user">
                <IconButton size="small" color="warning" onClick={() => handleWarnUser(u.userId)}>
                  <WarningIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Block user">
                <IconButton size="small" onClick={() => handleBlockUser(u.userId)}>
                  <EmailIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        </TableRow>
      ));
    }

    return filteredSessions.map((session) => (
      <TableRow key={session.id}>
        <TableCell>{session.user}</TableCell>
        <TableCell>
          <Chip label={session.status} color={getStatusColor(session.status)} size="small" />
        </TableCell>
        <TableCell>{session.device}</TableCell>
        <TableCell>{session.ip}</TableCell>
        <TableCell>{session.duration}</TableCell>
        <TableCell>
          <Box sx={{ width: 60, height: 6, borderRadius: 3, backgroundColor: getActivityColor(session.activity) }} />
        </TableCell>
        <TableCell>
          <Box className="actionButtons">
            <Tooltip title="Terminate session">
              <IconButton size="small" color="error" onClick={() => handleTerminate(session.id)}><BlockIcon /></IconButton>
            </Tooltip>
            <Tooltip title="Send warning">
              <IconButton size="small" color="warning" onClick={() => handleWarnUser(session.userId)}><WarningIcon /></IconButton>
            </Tooltip>
            <Tooltip title="Block user">
              <IconButton size="small" onClick={() => handleBlockUser(session.userId)}><EmailIcon /></IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="monitoringContainer">
      <Typography variant="h5" component="h1" className="pageTitle">
        User Monitoring
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControlLabel
          control={<Switch checked={showAdmins} onChange={(e) => setShowAdmins(e.target.checked)} />}
          label="Show admin sessions"
        />
        <FormControlLabel
          control={<Switch checked={groupByUser} onChange={(e) => setGroupByUser(e.target.checked)} />}
          label="Group by user"
        />
      </Stack>

      <div className="monitoringGrid">
        <Card className="activityCard">
          <CardContent>
            <div className="cardHeader">
              <Typography variant="h6">
                <TimelineIcon /> Real-time Activity
              </Typography>
            </div>
            <div className="chartContainer">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <ChartTooltip />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#8884d8"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="sessionsCard">
          <CardContent>
            <Typography variant="h6" className="cardHeader">
              Active Sessions
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Sessions</TableCell>
                    <TableCell>Preview</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {renderRows()}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMonitoring;
