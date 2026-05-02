import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
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
  Tabs,
  Tab,
  Badge,
  Grid,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar
} from '@mui/material';
import {
  Block as BlockIcon,
  Warning as WarningIcon,
  Email as EmailIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Error as ErrorIcon,
  Security as SecurityIcon,
  Devices as DevicesIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  Computer as ComputerIcon,
  PhoneIphone as MobileIcon,
  Tablet as TabletIcon,
  Public as PublicIcon,
  WarningAmber as AlertIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { toast } from 'react-toastify';
import './adminMonitoring.scss';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

const AdminMonitoring = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState(24);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Data states
  const [activityData, setActivityData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionStats, setSessionStats] = useState({});
  const [performanceData, setPerformanceData] = useState({});
  const [errorData, setErrorData] = useState({});
  const [securityData, setSecurityData] = useState({});
  const [deviceData, setDeviceData] = useState({});
  const [geoData, setGeoData] = useState([]);
  const [showAdminSessions, setShowAdminSessions] = useState(true);
  
  // Alert states
  const [alerts, setAlerts] = useState([]);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState(0);
  
  // Dialog states
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedError, setSelectedError] = useState(null);
  const [selectedSecurityEvent, setSelectedSecurityEvent] = useState(null);
  
  const socketRef = useRef(null);

  // ==================== DATA FETCHING ====================

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [
        activityRes,
        sessionsRes,
        sessionStatsRes,
        perfRes,
        errorRes,
        securityRes,
        deviceRes,
        geoRes
      ] = await Promise.all([
        axios.get(`/api/admin/monitoring/activity?hours=${timeRange}`, { headers }),
        axios.get('/api/admin/monitoring/sessions', { headers }),
        axios.get(`/api/admin/monitoring/sessions/stats?hours=${timeRange}`, { headers }),
        axios.get(`/api/admin/monitoring/performance?hours=${timeRange}`, { headers }),
        axios.get(`/api/admin/monitoring/errors?hours=${timeRange}`, { headers }),
        axios.get(`/api/admin/monitoring/security?hours=${timeRange}`, { headers }),
        axios.get(`/api/admin/monitoring/analytics/devices?hours=${timeRange}`, { headers }),
        axios.get(`/api/admin/monitoring/analytics/geo?hours=${timeRange}`, { headers })
      ]);

      setActivityData(activityRes.data.activity || []);
      setSessions(sessionsRes.data.sessions || []);
      setSessionStats(sessionStatsRes.data || {});
      setPerformanceData(perfRes.data || {});
      setErrorData(errorRes.data || {});
      setSecurityData(securityRes.data || {});
      setDeviceData(deviceRes.data || {});
      setGeoData(geoRes.data.geoData || []);
      
      // Calculate unacknowledged alerts
      const unack = (securityRes.data.recent || []).filter(e => !e.acknowledged && ['high', 'critical'].includes(e.severity)).length;
      setUnacknowledgedAlerts(unack);
    } catch (error) {
      console.error('Fetch monitoring data error:', error);
      toast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Setup socket connection
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (token) {
      socketRef.current = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
        path: '/socket.io',
        auth: { token }
      });

      socketRef.current.on('connect', () => {
        setSocketConnected(true);
        socketRef.current.emit('join', 'admin:monitoring');
      });

      socketRef.current.on('disconnect', () => {
        setSocketConnected(false);
      });

      // Real-time performance alerts
      socketRef.current.on('performance:alert', (payload) => {
        toast.warning(`Performance Alert: ${payload.alerts[0]?.message}`, {
          position: 'top-right'
        });
        setAlerts(prev => [...prev, { type: 'performance', ...payload, timestamp: new Date() }]);
      });

      // Real-time error alerts
      socketRef.current.on('error:new', (payload) => {
        toast.error(`New Error: ${payload.error.message.substring(0, 50)}...`, {
          position: 'top-right'
        });
        setAlerts(prev => [...prev, { type: 'error', ...payload, timestamp: new Date() }]);
        fetchAllData(); // Refresh error data
      });

      // Real-time session updates
      socketRef.current.on('monitoring.sessions.update', (payload) => {
        setSessions(payload.sessions || []);
      });

      // Real-time activity updates
      socketRef.current.on('monitoring.activity.update', (payload) => {
        setActivityData(payload.activity || []);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [timeRange]);

  // ==================== ACTIONS ====================

  const handleTerminateSession = async (sessionId) => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      await axios.post(`/api/admin/monitoring/sessions/${sessionId}/terminate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Session terminated');
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      setSelectedSession(null);
    } catch (error) {
      toast.error('Failed to terminate session');
    }
  };

  const handleBlockUser = async (userId) => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      await axios.post(`/api/admin/monitoring/users/${userId}/block`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User blocked');
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const handleResolveError = async (errorId, resolution) => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      await axios.patch(`/api/admin/monitoring/errors/${errorId}/resolve`, { resolution }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Error marked as resolved');
      fetchAllData();
      setSelectedError(null);
    } catch (error) {
      toast.error('Failed to resolve error');
    }
  };

  const handleAcknowledgeSecurityEvent = async (eventId) => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      await axios.patch(`/api/admin/monitoring/security/${eventId}/acknowledge`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Security event acknowledged');
      fetchAllData();
      setSelectedSecurityEvent(null);
    } catch (error) {
      toast.error('Failed to acknowledge event');
    }
  };

  // ==================== RENDER HELPERS ====================

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const formatDuration = (seconds, startTime) => {
    // For active sessions without duration, calculate from startTime
    if (!seconds && startTime) {
      seconds = Math.round((Date.now() - new Date(startTime).getTime()) / 1000);
    }
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatLocation = (location) => {
    if (!location) return 'Unknown';
    const city = location.city;
    const country = location.country;
    if (!city && !country) return 'Unknown';
    if (city && country) return `${city}, ${country}`;
    return city || country;
  };

  // ==================== TAB COMPONENTS ====================

  const renderOverviewTab = () => (
    <Grid container spacing={3}>
      {/* Key Metrics */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Active Sessions</Typography>
            <Typography variant="h3">{sessions.filter(s => s.status === 'active').length}</Typography>
            <Typography variant="caption" color="textSecondary">
              {sessionStats.stats?.uniqueUsers?.length || 0} unique users
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Avg Load Time</Typography>
            <Typography variant="h3">
              {Math.round(performanceData.metrics?.[0]?.avgLoadTime || 0)}ms
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {performanceData.slowPages?.length || 0} slow pages
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Errors (24h)</Typography>
            <Typography variant="h3" color={errorData.recent?.length > 0 ? 'error' : 'inherit'}>
              {errorData.recent?.length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {errorData.topErrors?.[0]?.count || 0} top error occurrences
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Security Alerts</Typography>
            <Typography variant="h3" color={unacknowledgedAlerts > 0 ? 'error' : 'inherit'}>
              {unacknowledgedAlerts}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {securityData.recent?.length || 0} total events
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Activity Chart */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Real-time Activity
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(val) => val?.split(' ')[1]?.substring(0, 5) || ''} />
                  <YAxis />
                  <ChartTooltip />
                  <Area type="monotone" dataKey="users" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="uniqueUsers" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Alerts */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <AlertIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Recent Alerts
            </Typography>
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {alerts.slice(0, 10).map((alert, idx) => (
                <React.Fragment key={idx}>
                  <ListItem>
                    <ListItemIcon>
                      {alert.type === 'performance' ? <SpeedIcon color="warning" /> : <ErrorIcon color="error" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={alert.alerts?.[0]?.message || alert.error?.message?.substring(0, 30)}
                      secondary={new Date(alert.timestamp).toLocaleTimeString()}
                    />
                  </ListItem>
                  {idx < 9 && <Divider />}
                </React.Fragment>
              ))}
              {alerts.length === 0 && (
                <ListItem>
                  <ListItemText primary="No recent alerts" secondary="System is running smoothly" />
                </ListItem>
              )}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderSessionsTab = () => {
    const filteredSessions = showAdminSessions 
      ? sessions 
      : sessions.filter(s => !s.isAdmin);
    
    return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Active Sessions ({filteredSessions.length})</Typography>
          <FormControlLabel
            control={
              <Switch 
                checked={showAdminSessions} 
                onChange={(e) => setShowAdminSessions(e.target.checked)}
              />
            }
            label="Show admin sessions"
          />
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Pages</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSessions.length > 0 ? filteredSessions.map((session) => (
                <TableRow key={session._id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar src={session.userId?.profilePic} sx={{ width: 32, height: 32 }}>
                        {session.userId?.username?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{session.userId?.username || 'Anonymous'}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {session.sessionId?.substring(0, 8)}...
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={session.device?.type === 'mobile' ? <MobileIcon /> : session.device?.type === 'tablet' ? <TabletIcon /> : <ComputerIcon />}
                      label={`${session.device?.browser || 'Unknown'} on ${session.device?.os || 'Unknown'}`}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {session.location ? (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <LocationIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {formatLocation(session.location)}
                        </Typography>
                      </Box>
                    ) : 'Unknown'}
                  </TableCell>
                  <TableCell>{formatDuration(session.duration, session.startTime)}</TableCell>
                  <TableCell>{session.pageViews?.length || 0} pages</TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => setSelectedSession(session)}>
                        <PlayIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Terminate Session">
                      <IconButton size="small" color="error" onClick={() => handleTerminateSession(session.sessionId)}>
                        <BlockIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="textSecondary" sx={{ py: 4 }}>
                      No active sessions. Users need to log in to see sessions here.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
  };

  const renderPerformanceTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Core Web Vitals</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    <TableCell>Average</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>LCP (Largest Contentful Paint)</TableCell>
                    <TableCell>{Math.round(performanceData.metrics?.[0]?.avgLCP || 0)}ms</TableCell>
                    <TableCell>
                      <Chip
                        label={(performanceData.metrics?.[0]?.avgLCP || 0) < 2500 ? 'Good' : (performanceData.metrics?.[0]?.avgLCP || 0) < 4000 ? 'Needs Improvement' : 'Poor'}
                        color={(performanceData.metrics?.[0]?.avgLCP || 0) < 2500 ? 'success' : (performanceData.metrics?.[0]?.avgLCP || 0) < 4000 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>FID (First Input Delay)</TableCell>
                    <TableCell>{Math.round(performanceData.metrics?.[0]?.avgFID || 0)}ms</TableCell>
                    <TableCell>
                      <Chip
                        label={(performanceData.metrics?.[0]?.avgFID || 0) < 100 ? 'Good' : (performanceData.metrics?.[0]?.avgFID || 0) < 300 ? 'Needs Improvement' : 'Poor'}
                        color={(performanceData.metrics?.[0]?.avgFID || 0) < 100 ? 'success' : (performanceData.metrics?.[0]?.avgFID || 0) < 300 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>CLS (Cumulative Layout Shift)</TableCell>
                    <TableCell>{(performanceData.metrics?.[0]?.avgCLS || 0).toFixed(3)}</TableCell>
                    <TableCell>
                      <Chip
                        label={(performanceData.metrics?.[0]?.avgCLS || 0) < 0.1 ? 'Good' : (performanceData.metrics?.[0]?.avgCLS || 0) < 0.25 ? 'Needs Improvement' : 'Poor'}
                        color={(performanceData.metrics?.[0]?.avgCLS || 0) < 0.1 ? 'success' : (performanceData.metrics?.[0]?.avgCLS || 0) < 0.25 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Page Load Time</TableCell>
                    <TableCell>{Math.round(performanceData.metrics?.[0]?.avgLoadTime || 0)}ms</TableCell>
                    <TableCell>
                      <Chip
                        label={(performanceData.metrics?.[0]?.avgLoadTime || 0) < 2000 ? 'Good' : (performanceData.metrics?.[0]?.avgLoadTime || 0) < 4000 ? 'Needs Improvement' : 'Poor'}
                        color={(performanceData.metrics?.[0]?.avgLoadTime || 0) < 2000 ? 'success' : (performanceData.metrics?.[0]?.avgLoadTime || 0) < 4000 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Slowest Pages</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Page</TableCell>
                    <TableCell>Avg Load Time</TableCell>
                    <TableCell>Requests</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {performanceData.slowPages?.map((page, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {page._id}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min((page.avgLoadTime / 5000) * 100, 100)}
                            sx={{ width: 60, height: 8, borderRadius: 1 }}
                            color={page.avgLoadTime > 3000 ? 'error' : page.avgLoadTime > 1500 ? 'warning' : 'success'}
                          />
                          {Math.round(page.avgLoadTime)}ms
                        </Box>
                      </TableCell>
                      <TableCell>{page.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Performance Trends</Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData.trends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id.hour" tickFormatter={(h) => `${h}:00`} />
                  <YAxis />
                  <ChartTooltip />
                  <Line type="monotone" dataKey="avgLoadTime" stroke="#ff8042" name="Load Time (ms)" />
                  <Line type="monotone" dataKey="avgLCP" stroke="#8884d8" name="LCP (ms)" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderErrorsTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Error Summary</Typography>
            <Box height={250}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={errorData.byType || []}
                    dataKey="count"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {(errorData.byType || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box mt={2}>
              {(errorData.byType || []).map((type, idx) => (
                <Chip
                  key={idx}
                  label={`${type._id}: ${type.count}`}
                  size="small"
                  sx={{ m: 0.5, backgroundColor: COLORS[idx % COLORS.length], color: 'white' }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Recent Errors</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Message</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {errorData.recent?.map((error) => (
                    <TableRow key={error._id} hover>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography noWrap variant="body2">
                          {error.message}
                        </Typography>
                      </TableCell>
                      <TableCell>{error.errorType}</TableCell>
                      <TableCell>
                        <Chip label={error.severity} color={getSeverityColor(error.severity)} size="small" />
                      </TableCell>
                      <TableCell>{new Date(error.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => setSelectedError(error)}>
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Top Errors</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Error</TableCell>
                    <TableCell>Occurrences</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>First Seen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {errorData.topErrors?.map((error, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography noWrap variant="body2">{error.message}</Typography>
                      </TableCell>
                      <TableCell>
                        <Badge badgeContent={error.count} color="error" />
                      </TableCell>
                      <TableCell>
                        <Chip label={error.severity} color={getSeverityColor(error.severity)} size="small" />
                      </TableCell>
                      <TableCell>Recently</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderSecurityTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Security Events by Type</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Event Type</TableCell>
                    <TableCell>Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {securityData.byType?.map((type, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{type._id}</TableCell>
                      <TableCell>
                        <Chip label={type.count} color={type.count > 5 ? 'warning' : 'default'} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Geographic Threats</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Country</TableCell>
                    <TableCell>Events</TableCell>
                    <TableCell>High Risk</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {securityData.geographicThreats?.map((threat, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{threat._id}</TableCell>
                      <TableCell>{threat.count}</TableCell>
                      <TableCell>
                        {threat.highRisk > 0 && (
                          <Chip label={threat.highRisk} color="error" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Security Events
              {unacknowledgedAlerts > 0 && (
                <Chip label={`${unacknowledgedAlerts} unacknowledged`} color="error" size="small" sx={{ ml: 1 }} />
              )}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {securityData.recent?.map((event) => (
                    <TableRow key={event._id} hover sx={{ backgroundColor: !event.acknowledged && ['high', 'critical'].includes(event.severity) ? 'rgba(255,0,0,0.05)' : 'inherit' }}>
                      <TableCell>{event.eventType}</TableCell>
                      <TableCell>
                        <Chip label={event.severity} color={getSeverityColor(event.severity)} size="small" />
                      </TableCell>
                      <TableCell>{event.userId?.username || 'Unknown'}</TableCell>
                      <TableCell>{event.sourceIp}</TableCell>
                      <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        {event.acknowledged ? (
                          <Chip icon={<CheckIcon />} label="Acknowledged" color="success" size="small" />
                        ) : (
                          <Chip label="Pending" color="warning" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => setSelectedSecurityEvent(event)}>
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderDevicesTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Device Types</Typography>
            <Box height={250}>
              {(deviceData.devices || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData.devices}
                    dataKey="count"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {deviceData.devices.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography color="textSecondary">No device data available</Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Browsers</Typography>
            <Box height={250}>
              {(deviceData.browsers || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviceData.browsers}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <ChartTooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography color="textSecondary">No browser data available</Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Geographic Distribution</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Country</TableCell>
                    <TableCell>Sessions</TableCell>
                    <TableCell>Unique Users</TableCell>
                    <TableCell>Cities</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geoData.length > 0 ? geoData.map((geo, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PublicIcon fontSize="small" />
                          {geo._id}
                        </Box>
                      </TableCell>
                      <TableCell>{geo.sessions}</TableCell>
                      <TableCell>{geo.uniqueUsers?.length || 0}</TableCell>
                      <TableCell>{geo.cities?.slice(0, 3).join(', ')}...</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="textSecondary">No geographic data available</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // ==================== DIALOGS ====================

  const renderSessionDialog = () => (
    <Dialog open={!!selectedSession} onClose={() => setSelectedSession(null)} maxWidth="md" fullWidth>
      <DialogTitle>Session Details</DialogTitle>
      <DialogContent>
        {selectedSession && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2">User</Typography>
              <Typography>{selectedSession.userId?.username || 'Anonymous'}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Session ID</Typography>
              <Typography variant="caption">{selectedSession.sessionId}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Device</Typography>
              <Typography>{selectedSession.device?.browser} on {selectedSession.device?.os}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Page Views ({selectedSession.pageViews?.length || 0})</Typography>
              <List dense>
                {selectedSession.pageViews?.map((view, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={view.url}
                      secondary={`Duration: ${formatDuration(view.duration)} | Scroll: ${view.scrollDepth || 0}%`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
            <Box>
              <Typography variant="subtitle2">Interactions ({selectedSession.interactions?.length || 0})</Typography>
              <List dense>
                {selectedSession.interactions?.slice(0, 10).map((interaction, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={`${interaction.type} on ${interaction.target}`}
                      secondary={new Date(interaction.timestamp).toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelectedSession(null)}>Close</Button>
        <Button color="error" onClick={() => handleTerminateSession(selectedSession?.sessionId)}>
          Terminate Session
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderErrorDialog = () => (
    <Dialog open={!!selectedError} onClose={() => setSelectedError(null)} maxWidth="md" fullWidth>
      <DialogTitle>Error Details</DialogTitle>
      <DialogContent>
        {selectedError && (
          <Stack spacing={2}>
            <Alert severity={getSeverityColor(selectedError.severity)}>
              <AlertTitle>{selectedError.errorType} - {selectedError.severity}</AlertTitle>
              {selectedError.message}
            </Alert>
            <Box>
              <Typography variant="subtitle2">Stack Trace</Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.100', maxHeight: 200, overflow: 'auto' }}>
                <pre style={{ margin: 0, fontSize: '12px' }}>{selectedError.stack || 'No stack trace available'}</pre>
              </Paper>
            </Box>
            <Box>
              <Typography variant="subtitle2">Location</Typography>
              <Typography>{selectedError.pageUrl}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Time</Typography>
              <Typography>{new Date(selectedError.timestamp).toLocaleString()}</Typography>
            </Box>
            {selectedError.userActions?.length > 0 && (
              <Box>
                <Typography variant="subtitle2">User Actions Leading to Error</Typography>
                <List dense>
                  {selectedError.userActions.map((action, idx) => (
                    <ListItem key={idx}>
                      <ListItemText primary={action.action} secondary={new Date(action.timestamp).toLocaleTimeString()} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelectedError(null)}>Close</Button>
        {!selectedError?.resolved && (
          <Button color="success" onClick={() => handleResolveError(selectedError._id, 'Resolved by admin')}>
            Mark Resolved
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  const renderSecurityDialog = () => (
    <Dialog open={!!selectedSecurityEvent} onClose={() => setSelectedSecurityEvent(null)} maxWidth="md" fullWidth>
      <DialogTitle>Security Event Details</DialogTitle>
      <DialogContent>
        {selectedSecurityEvent && (
          <Stack spacing={2}>
            <Alert severity={getSeverityColor(selectedSecurityEvent.severity)}>
              <AlertTitle>{selectedSecurityEvent.eventType}</AlertTitle>
              Risk Score: {selectedSecurityEvent.riskScore}/100
            </Alert>
            <Box>
              <Typography variant="subtitle2">User</Typography>
              <Typography>{selectedSecurityEvent.userId?.username || 'Unknown'}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Source IP</Typography>
              <Typography>{selectedSecurityEvent.sourceIp}</Typography>
            </Box>
            {selectedSecurityEvent.location && (
              <Box>
                <Typography variant="subtitle2">Location</Typography>
                <Typography>
                  {selectedSecurityEvent.location.city}, {selectedSecurityEvent.location.country}
                  {selectedSecurityEvent.location.isVpn && ' (VPN detected)'}
                  {selectedSecurityEvent.location.isTor && ' (Tor exit node)'}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="subtitle2">Time</Typography>
              <Typography>{new Date(selectedSecurityEvent.timestamp).toLocaleString()}</Typography>
            </Box>
            {selectedSecurityEvent.details && (
              <Box>
                <Typography variant="subtitle2">Details</Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
                    {JSON.stringify(selectedSecurityEvent.details, null, 2)}
                  </pre>
                </Paper>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelectedSecurityEvent(null)}>Close</Button>
        {!selectedSecurityEvent?.acknowledged && (
          <Button color="success" onClick={() => handleAcknowledgeSecurityEvent(selectedSecurityEvent._id)}>
            Acknowledge
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="monitoringContainer">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          User Monitoring & Analytics
          <Chip
            label={socketConnected ? 'Live' : 'Disconnected'}
            color={socketConnected ? 'success' : 'error'}
            size="small"
            sx={{ ml: 2 }}
          />
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value={1}>Last Hour</MenuItem>
              <MenuItem value={6}>Last 6 Hours</MenuItem>
              <MenuItem value={24}>Last 24 Hours</MenuItem>
              <MenuItem value={168}>Last 7 Days</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchAllData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        <Tab icon={<TimelineIcon />} label="Overview" />
        <Tab icon={<PeopleIcon />} label="Sessions" />
        <Tab icon={<SpeedIcon />} label="Performance" />
        <Tab icon={<ErrorIcon />} label="Errors" />
        <Tab icon={<SecurityIcon />} label="Security" />
        <Tab icon={<DevicesIcon />} label="Devices & Geo" />
      </Tabs>

      <Box mt={2}>
        {activeTab === 0 && renderOverviewTab()}
        {activeTab === 1 && renderSessionsTab()}
        {activeTab === 2 && renderPerformanceTab()}
        {activeTab === 3 && renderErrorsTab()}
        {activeTab === 4 && renderSecurityTab()}
        {activeTab === 5 && renderDevicesTab()}
      </Box>

      {renderSessionDialog()}
      {renderErrorDialog()}
      {renderSecurityDialog()}
    </div>
  );
};

export default AdminMonitoring;
