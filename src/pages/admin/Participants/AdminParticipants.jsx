// Update the imports at the top of the file
import React, { useState, useEffect } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import {
  Box,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import './adminParticipants.scss';
import { getAuthToken } from '../../../utils/tokenManager';
import { useAuth } from '../../../context/authContext';
import { useNavigate } from 'react-router-dom';
import { 
  ORGANIZATION_CATEGORIES,
  ORGANIZATION_COLORS,
  EVENT_STATUS,
  EVENT_CATEGORIES,
  STATUS_COLORS,
  REGISTRATION_STATUS
} from '../../../utils/constants'; // Updated path with correct spelling





class ParticipantsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔥 Participants component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Typography color="error">
            Something went wrong loading the participants data.
          </Typography>
          <Button 
            onClick={() => window.location.reload()} 
            sx={{ mt: 2 }}
          >
            Reload Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Wrap the component export

const AdminParticipants = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState({
    type: null, // 'auth' | 'fetch' | 'grid' | null
    message: null,
    details: null
  });

  const [participants, setParticipants] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [viewMode, setViewMode] = useState('organizations'); // 'organizations' | 'events' | 'all'
  const [expandedSections, setExpandedSections] = useState([]);
  const [groupStats, setGroupStats] = useState({});
  const [filters, setFilters] = useState({
    organization: 'all',
    status: 'all',
    event: 'all'
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showCustomFields, setShowCustomFields] = useState(false);

  const handleError = (error, type = 'fetch') => {
    console.error(`❌ ${type.toUpperCase()} Error:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    setError({
      type,
      message: error.message,
      details: error.response?.data
    });

    if (error.response?.status === 401) {
      toast.error('Session expired. Please login again.');
      navigate('/login');
    } else {
      toast.error(
        error.response?.data?.message || 
        'An error occurred. Please try again.'
      );
    }
  };

               useEffect(() => {
            const fetchData = async () => {
              try {
                setLoading(true);
                
                // Check admin authentication
                if (!isAdmin) {
                  toast.error('Admin access required');
                  navigate('/login');
                  return;
                }
          
                // Get admin token using token manager
                const token = getAuthToken(true); // true for admin token
                console.log('🔑 Auth Token:', token ? 'Present' : 'Missing');
          
                if (!token) {
                  toast.error('Please login as admin to access this feature');
                  navigate('/login');
                  return;
                }
          
                const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
                const apiUrl = `${baseURL}/api/admin/participants`;
                
                console.log('🌐 Fetching participants:', { url: apiUrl });
          
                const response = await axios.get(apiUrl, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  },
                  timeout: 5000,
                  validateStatus: (status) => status === 200
                });
          
                // Validate and transform response
                if (!response.data?.success || !Array.isArray(response.data?.data)) {
                  throw new Error('Invalid server response format');
                }
          
                // Replace the transformedData mapping block with this:
                const transformedData = response.data.data.map((participant) => {
                  const raw = participant.raw || participant;
                  // prefer populated event object where possible
                  const ev = raw.eventId || raw.event || {};
                  // canonical eventId string (could be object or already a string)
                  const evId = ev && ev._id ? String(ev._id) : (typeof raw.eventId === 'string' ? raw.eventId : (participant.eventId || ''));
                  const eventForm = Array.isArray(participant.eventForm) && participant.eventForm.length
                    ? participant.eventForm
                    : Array.isArray(ev.registrationForm) && ev.registrationForm.length
                      ? ev.registrationForm
                      : [];

                  // --- CHANGED: include registrationDate, registeredDate and eventDate top-level fields ---
                  const regDateVal = participant.registrationDate || raw.registrationDate || raw.createdAt || null;
                  const evDateVal = ev.date || raw.eventDate || null;

                  return {
                    // keep original backend payload accessible
                    raw,
                    eventForm,
                    // stable identifiers
                    id: participant.id || String(raw._id || raw.id || `${raw.userId || 'u'}_${evId}`),
                    _id: raw._id || participant._id,
                    eventId: evId,
                    // user / participant fields (backwards-compatible)
                    name: participant.name || raw.name || (raw.userId && raw.userId.name) || 'N/A',
                    email: participant.email || raw.email || (raw.userId && raw.userId.email) || 'N/A',
                    phone: participant.phone || raw.phone || '',
                    studentId: participant.studentId || raw.studentId || '',
                    yearLevel: participant.yearLevel || raw.yearLevel || '',
                    course: participant.course || raw.course || '',
                    organization: participant.organization || ev.organization || raw.organization || 'Unassigned',
                    eventName: participant.eventName || ev.title || raw.eventName || 'No Event',
                    status: participant.status || raw.status || 'pending',
                    // provide both names used across code: registrationDate, registeredDate (ISO) and eventDate
                    registrationDate: regDateVal ? new Date(regDateVal).toISOString() : null,
                    registeredDate: regDateVal ? new Date(regDateVal).toISOString() : null,
                    eventDate: evDateVal ? new Date(evDateVal).toISOString() : null,
                    registeredDateRaw: regDateVal,
                    eventDateRaw: evDateVal,
                    registeredDateFormatted: regDateVal ? new Date(regDateVal).toLocaleDateString() : 'N/A',
                    eventDetails: {
                      id: evId,
                      title: ev.title || raw.eventName || '',
                      organization: ev.organization || raw.organization || '',
                      date: evDateVal || null
                    },
                    uploadedFiles: participant.uploadedFiles || raw.uploadedFiles || []
                  };
                });
                                
                setParticipants(transformedData);
          
                // Extract unique organizations and events for filters
                const uniqueOrgs = [...new Set(transformedData.map(p => p.organization))];
                const uniqueEvents = [...new Set(transformedData.map(p => p.eventName))];
                
                setOrganizations(uniqueOrgs);
                setEvents(uniqueEvents.map(name => ({ id: name, name })));
          
              } catch (error) {
                console.error('❌ Fetch Error:', {
                  message: error.message,
                  status: error.response?.status,
                  data: error.response?.data
                });
          
                if (error.response?.status === 401) {
                  toast.error('Session expired. Please login again.');
                  navigate('/login');
                } else {
                  toast.error(
                    error.response?.data?.message || 
                    'Failed to load participants. Please try again.'
                  );
                }
              } finally {
                setLoading(false);
              }
            };
          
            fetchData();
          }, [isAdmin, navigate]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const getOrganizationColor = (orgName) => {
    return ORGANIZATION_COLORS[orgName] || '#666666'; // Fallback color
  };
  
  const groupParticipantsByOrg = () => {
    const groups = {};
    
    // Initialize groups from ORGANIZATION_CATEGORIES
    Object.keys(ORGANIZATION_CATEGORIES).forEach(org => {
      groups[org] = [];
    });
  
    // Group participants
    participants.forEach(participant => {
      const org = participant.organization;
      if (org && groups[org]) {
        groups[org].push(participant);
      } else if (org) {
        groups[org] = [participant];
      }
    });
  
    return groups;
  }; 
  
  useEffect(() => {
    if (viewMode === 'organizations') {
      const groups = groupParticipantsByOrg();
      const stats = {};
      
      Object.entries(groups).forEach(([org, participants]) => {
        stats[org] = {
          total: participants.length,
          pending: participants.filter(p => p.status === REGISTRATION_STATUS.PENDING).length,
          approved: participants.filter(p => p.status === REGISTRATION_STATUS.APPROVED).length,
          rejected: participants.filter(p => p.status === REGISTRATION_STATUS.REJECTED).length
        };
      });
      
      setGroupStats(stats);
    }
  }, [participants, viewMode, REGISTRATION_STATUS]);
  
    

  const groupParticipantsByEvent = () => {
    const groups = {};
    
    // First sort participants by event date and registration date
    const sortedParticipants = [...participants].sort((a, b) => {
      // First compare by event date
      const eventDateA = new Date(a.eventDetails?.date || 0);
      const eventDateB = new Date(b.eventDetails?.date || 0);
      if (eventDateA !== eventDateB) {
        return eventDateB - eventDateA; // Most recent events first
      }
      // Then by registration date
      return new Date(b.registeredDate) - new Date(a.registeredDate);
    });
  
    // Group sorted participants
    sortedParticipants.forEach(participant => {
      const eventId = participant.eventId;
      if (!groups[eventId]) {
        groups[eventId] = {
          eventId: participant.eventId,
          eventName: participant.eventName,
          organization: participant.organization,
          eventDate: participant.eventDetails?.date,
          participants: [],
          stats: {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0
          }
        };
      }
  
      groups[eventId].participants.push(participant);
      groups[eventId].stats.total++;
      groups[eventId].stats[participant.status]++;
    });
  
    return groups;
  };
  
  const handleSectionToggle = (section) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };
  
  const getStatusColor = (status) => {
    return STATUS_COLORS[status] || 'default';
  };

  const getFilteredParticipants = () => {
    let filtered = participants.filter(participant => {
      // Skip filtering if all filters are set to 'all'
      if (filters.organization === 'all' && 
          filters.status === 'all' && 
          filters.event === 'all') {
        return true;
      }
  
      const organizationMatch = filters.organization === 'all' ||
        participant.organization === filters.organization;
      const statusMatch = filters.status === 'all' ||
        participant.status === filters.status;
      const eventMatch = filters.event === 'all' ||
        participant.eventName === filters.event;
  
      return organizationMatch && statusMatch && eventMatch;
    });

    // Search filter
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.email.toLowerCase().includes(s) ||
        p.studentId.toLowerCase().includes(s)
      );
    }

    return filtered;
  };


    const handleStatusUpdate = async (participantId, newStatus) => {
    try {
      setActionLoading(true);
      const token = getAuthToken(true); // Get admin token

      if (!token) {
        toast.error('Authentication required');
        navigate('/login');
        return;
      }

      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.patch(
        `${baseURL}/api/admin/participants/${participantId}/status`,
        {
          status: newStatus,
          adminNotes: adminNotes
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        toast.success(`Application ${newStatus} successfully`);
        
        // Update local state
        setParticipants(prev =>
          prev.map(p =>
            p.id === participantId 
              ? { ...p, status: newStatus } 
              : p
          )
        );
        
        // Close dialog and reset notes
        setOpenDialog(false);
        setAdminNotes('');
        
        // Log success
        console.log('✅ Status updated:', {
          participantId,
          newStatus,
          timestamp: new Date().toISOString()
        });

        // show if backend sent a confirmation email
        if (response.data?.emailSent) {
          toast.success('Confirmation email sent to participant');
        } else if (response.data?.emailError) {
          toast.error(`Email failed: ${response.data.emailError}`);
        }
      } else {
        throw new Error(response.data?.message || 'Update failed');
      }
    } catch (error) {
      console.error('❌ Status update error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error(
          error.response?.data?.message || 
          'Failed to update status. Please try again.'
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // --- NEW: send confirmation email to participant (ADMIN action) ---
  const handleSendConfirmationEmail = async (participant) => {
    if (!participant) {
      toast.error('No participant selected');
      return;
    }
    try {
      setActionLoading(true);
      const token = getAuthToken(true);
      if (!token) {
        toast.error('Authentication required');
        navigate('/login');
        return;
      }

      const id = participant.id || participant._id || participant._id || '';
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const url = `${baseURL}/api/admin/participants/${id}/send-confirmation`;

      // send current adminNotes (from dialog input) so the email includes the admin message
      const payload = { adminNotes: adminNotes || '' };
      const res = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res?.status === 200) {
        toast.success(res.data?.message || 'Confirmation email sent');
      } else {
        toast.error(res?.data?.message || 'Failed to send confirmation email');
      }
    } catch (err) {
      console.error('Send confirmation email error:', err);
      toast.error(err.response?.data?.message || 'Failed to send confirmation email');
    } finally {
      setActionLoading(false);
    }
  };
  
  // Add helper inside component
  const fetchEventFormIfMissing = async (participant) => {
    try {
      const raw = participant?.raw || participant || {};
      // try populated eventId object, or fallback to eventId string
      const populatedEvent = raw?.eventId;
      if (Array.isArray(populatedEvent?.registrationForm) && populatedEvent.registrationForm.length) {
        return populatedEvent.registrationForm;
      }
      if (Array.isArray(participant?.eventForm) && participant.eventForm.length) {
        return participant.eventForm;
      }

      const eventId = (populatedEvent && populatedEvent._id) ? String(populatedEvent._id) : (participant?.eventId || raw?.eventId || null);
      if (!eventId) return [];

      const token = getAuthToken(true);
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const res = await axios.get(`${baseURL}/api/events/${eventId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const ev = res.data || {};
      const schema = Array.isArray(ev.registrationForm) ? ev.registrationForm : (Array.isArray(ev.schema) ? ev.schema : []);
      // patch participant in state so dialog can read it
      setParticipants(prev => prev.map(p => p.id === participant.id ? ({ ...p, eventForm: schema, raw: { ...(p.raw || p), eventId: { ...(p.raw?.eventId || {}), registrationForm: schema } } }) : p));
      return schema;
    } catch (e) {
      console.warn('Failed to fetch event form for participant', e?.message || e);
      return [];
    }
  };

  // Update handleViewDetails to fetch schema if needed
  const handleViewDetails = async (participant) => {
    // optimistic open so dialog renders quickly, then ensure schema
    setSelectedParticipant(participant);
    setAdminNotes('');
    setOpenDialog(true);

    // fetch missing form schema if it's not already present
    const raw = participant?.raw || participant || {};
    const hasSchema = Array.isArray(raw?.eventId?.registrationForm) && raw.eventId.registrationForm.length
                    || Array.isArray(participant?.eventForm) && participant.eventForm.length;
    if (!hasSchema) {
      const schema = await fetchEventFormIfMissing(participant);
      // update local selected participant so dialog shows fields immediately
      setSelectedParticipant(prev => prev ? ({ ...prev, eventForm: schema, raw: { ...(prev.raw || prev), eventId: { ...(prev.raw?.eventId || {}), registrationForm: schema } } }) : prev);
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'studentId', headerName: 'Student ID', width: 130 },
    { field: 'registrationType', headerName: 'Type', width: 120 }, // <-- ADDED
    { field: 'yearLevel', headerName: 'Year Level', width: 100 },
    { field: 'course', headerName: 'Course', width: 180 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 130 },

    // Uploaded files column
    {
      field: 'uploadedFiles',
      headerName: 'Uploads',
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const files = params.value || [];
        if (!files || files.length === 0) return <span style={{ color: '#666' }}>—</span>;
        // show up to 3 thumbnails (images) or a file icon + count
        const imgs = files.filter(f => f.type && f.type.startsWith && f.type.startsWith('image')).slice(0,3);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {imgs.length > 0 ? imgs.map((f, i) => (
              <img key={i} src={f.url} alt={f.name || 'upload'} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
            )) : <div style={{ fontSize: 12, color: '#444' }}>{files.length} file{files.length>1?'s':''}</div>}
          </div>
        );
      }
    },

    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Tooltip title={params.value.charAt(0).toUpperCase() + params.value.slice(1)}>
          <Chip
            label={params.value}
            color={
              params.value === 'approved'
                ? 'success'
                : params.value === 'pending'
                  ? 'warning'
                  : params.value === 'rejected'
                    ? 'error'
                    : 'default'
            }
            icon={
              params.value === 'approved' ? <CheckCircleIcon /> :
              params.value === 'pending' ? <CircularProgress size={16} /> :
              params.value === 'rejected' ? <CancelIcon /> : null
            }
            size="small"
            variant="outlined"
          />
        </Tooltip>
      )
    },
    {
      field: 'registeredDate',
      headerName: 'Registered',
      width: 120,
      valueFormatter: (params) => {
        const date = new Date(params.value);
        return isNaN(date.getTime())
          ? 'N/A'
          : date.toLocaleDateString();
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="View Details">
            <IconButton
              onClick={() => handleViewDetails(params.row)}
              size="small"
              color="primary"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {params.row.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <IconButton
                  onClick={() => handleStatusUpdate(params.row.id, 'approved')}
                  size="small"
                  color="success"
                >
                  <CheckCircleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject">
                <IconButton
                  onClick={() => handleStatusUpdate(params.row.id, 'rejected')}
                  size="small"
                  color="error"
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      )
    }
  ];

  const rows = getFilteredParticipants();

    return (
    <div className="participantsContainer">
     <ToastContainer
       position="top-right"
       autoClose={4000}
       hideProgressBar={false}
       newestOnTop
       closeOnClick
       rtl={false}
       pauseOnFocusLoss
       draggable
       pauseOnHover
       limit={3}
     />
      {/* Sticky filter header */}
      <Card className="filtersCard" sx={{ position: 'sticky', top: 0, zIndex: 10, mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {/* Search Bar */}
            <Grid item xs={12} sm={3}>
              <TextField
                label="Search"
                variant="outlined"
                fullWidth
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, Email, Student ID"
                size="small"
              />
            </Grid>
            {/* View Mode Selector */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>View Mode</InputLabel>
                <Select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  size="small"
                >
                  <MenuItem value="organizations">By Organizations</MenuItem>
                  <MenuItem value="events">By Events</MenuItem>
                  <MenuItem value="all">All Participants</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {/* Organization Filter */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>Organization</InputLabel>
                <Select
                  value={filters.organization}
                  onChange={(e) => handleFilterChange('organization', e.target.value)}
                  size="small"
                >
                  <MenuItem value="all">All Organizations</MenuItem>
                  {organizations.map((org) => (
                    <MenuItem key={org} value={org}>{org}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {/* Status Filter */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  size="small"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {/* Event Filter */}
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>Event</InputLabel>
                <Select
                  value={filters.event}
                  onChange={(e) => handleFilterChange('event', e.target.value)}
                  size="small"
                >
                  <MenuItem value="all">All Events</MenuItem>
                  {events.map((event) => (
                    <MenuItem key={event.id} value={event.name}>{event.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {/* Refresh Button */}
            <Grid item xs={12} sm={1}>
              <Button
                variant="outlined"
                onClick={() => window.location.reload()}
                size="small"
                sx={{ minWidth: 0, px: 1 }}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Status summary chips */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <Chip label={`Total: ${participants.length}`} color="primary" />
        <Chip label={`Pending: ${participants.filter(p => p.status === 'pending').length}`} color="warning" />
        <Chip label={`Approved: ${participants.filter(p => p.status === 'approved').length}`} color="success" />
        <Chip label={`Rejected: ${participants.filter(p => p.status === 'rejected').length}`} color="error" />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {viewMode === 'organizations' ? (
        Object.entries(groupParticipantsByOrg()).map(([orgName, orgParticipants]) => (
          <Accordion 
            key={orgName}
            expanded={expandedSections.includes(orgName)}
            onChange={() => handleSectionToggle(orgName)}
            sx={{ 
              mb: 2,
              borderLeft: 4,
              borderColor: getOrganizationColor(orgName)
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  {orgName}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip 
                    label={`${orgParticipants.length} Total`}
                    color="primary"
                    size="small"
                  />
                  <Chip 
                    label={`${groupStats[orgName]?.pending || 0} Pending`}
                    color="warning"
                    size="small"
                  />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <DataGrid
                rows={orgParticipants}
                columns={columns}
                pageSize={5}
                rowsPerPageOptions={[5, 10, 25]}
                autoHeight
                disableSelectionOnClick
                loading={loading}
              />
            </AccordionDetails>
          </Accordion>
        ))
        ) : viewMode === 'events' ? (
          Object.entries(groupParticipantsByEvent())
    .sort(([, a], [, b]) => new Date(b.eventDate) - new Date(a.eventDate))
    .map(([eventId, eventData]) => (
      <Accordion
        key={eventId}
        expanded={expandedSections.includes(eventId)}
        onChange={() => handleSectionToggle(eventId)}
        sx={{ 
          mb: 2,
          borderLeft: 4,
          borderColor: getOrganizationColor(eventData.organization)
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">
                {eventData.eventName}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {eventData.organization} • {new Date(eventData.eventDate).toLocaleDateString()}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={`${eventData.stats.total} Total`}
                color="primary"
                size="small"
              />
              {eventData.stats.pending > 0 && (
                <Chip 
                  label={`${eventData.stats.pending} Pending`}
                  color="warning"
                  size="small"
                />
              )}
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <DataGrid
            rows={eventData.participants}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5, 10, 25]}
            autoHeight
            disableSelectionOnClick
            loading={loading}
            sortModel={[
              {
                field: 'registeredDate',
                sort: 'desc'
              }
            ]}
          />
        </AccordionDetails>
      </Accordion>
    ))
        ) : (
          // Original DataGrid for all participants view
        <DataGrid
          rows={rows}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          checkboxSelection={false}
          disableSelectionOnClick
          loading={loading}
          autoHeight
          className="dataGrid"
          components={{
            NoRowsOverlay: () => (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                flexDirection: 'column',
                gap: 1,
                p: 2
              }}>
                <Typography variant="h6">
                  {loading ? 'Loading participants...' : 'No registrations found'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {!loading && participants.length === 0 ? 
                    'No registrations available in the system' : 
                    participants.length > 0 ? 'Try adjusting the filters' :
                    'Please wait while we fetch the data'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total: {participants.length} | Filtered: {rows.length}
                  {filters.organization !== 'all' && ` | Org: ${filters.organization}`}
                  {filters.status !== 'all' && ` | Status: ${filters.status}`}
                  {filters.event !== 'all' && ` | Event: ${filters.event}`}
                </Typography>
              </Box>
            ),
            LoadingOverlay: () => (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%' 
              }}>
                <CircularProgress />
              </Box>
            )
          }}
        />
      )}
  
      {/* Existing Dialog component */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Registration Details
          {selectedParticipant?.status === 'pending' && (
            <Chip 
              label="PENDING APPROVAL"
              color="warning"
              size="small"
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        {/* ===== REPLACE the <DialogContent>...</DialogContent> block inside the Registration Details dialog with the following =====*/}
<DialogContent>
  <Grid container spacing={2}>
    {/* Basic Info Section */}
    <Grid item xs={12}>
      <Typography variant="subtitle2">Participant Info</Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography><strong>Name:</strong> {selectedParticipant?.name}</Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography>
        <strong>Email:</strong> {selectedParticipant?.email}
        <IconButton size="small" onClick={() => navigator.clipboard.writeText(selectedParticipant?.email || '')}>
          <ContentCopyIcon fontSize="inherit" />
        </IconButton>
      </Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography><strong>Student ID:</strong> {selectedParticipant?.studentId}</Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography>
        <strong>Phone:</strong> {selectedParticipant?.phone}
        {selectedParticipant?.phone && (
          <IconButton size="small" onClick={() => navigator.clipboard.writeText(selectedParticipant?.phone)}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        )}
      </Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography><strong>Course:</strong> {selectedParticipant?.course}</Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography><strong>Year Level:</strong> {selectedParticipant?.yearLevel}</Typography>
    </Grid>

    <Grid item xs={12}>
      <Divider sx={{ my: 1 }} />
    </Grid>

    {/* Event Info Section */}
    <Grid item xs={12}>
      <Typography variant="subtitle2">Event Info</Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography><strong>Event:</strong> {selectedParticipant?.eventName}</Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography><strong>Organization:</strong> {selectedParticipant?.organization}</Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography>
        <strong>Event Date:</strong> {selectedParticipant?.eventDate ? new Date(selectedParticipant.eventDate).toLocaleDateString() : 'N/A'}
      </Typography>
    </Grid>
    <Grid item xs={6}>
      <Typography><strong>Status:</strong> {selectedParticipant?.status}</Typography>
    </Grid>
    <Grid item xs={12}>
      <Typography>
        <strong>Registered Date:</strong> {selectedParticipant?.registrationDate ? new Date(selectedParticipant.registrationDate).toLocaleDateString() : 'N/A'}
      </Typography>
    </Grid>

    {/* Custom Fields Toggle Section */}
    <Grid item xs={12}>
      <Button
        onClick={() => setShowCustomFields(!showCustomFields)}
        endIcon={<ExpandMoreIcon sx={{ transform: showCustomFields ? 'rotate(180deg)' : 'none' }} />}
        sx={{ mt: 2, mb: 1 }}
        variant="outlined"
        fullWidth
      >
        {showCustomFields ? 'Hide Custom Fields' : 'Show Custom Fields'}
      </Button>
    </Grid>

    {/* Custom Fields Content */}
    {showCustomFields && (
      <Grid item xs={12}>
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          bgcolor: 'background.paper', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography variant="subtitle2" gutterBottom>
            Custom Registration Fields
          </Typography>
          
          {(() => {
            const raw = selectedParticipant?.raw || selectedParticipant;
            const formSchema = raw?.eventId?.registrationForm || [];
            
            if (!formSchema.length) {
              return (
                <Typography color="textSecondary" variant="body2">
                  No custom fields found for this registration
                </Typography>
              );
            }

            return formSchema.map((field, idx) => {
              // Prefer dynamic responses (stored in formResponses) then fallback to top-level fields
              const formResponses = raw?.formResponses || {};
              let value = formResponses[field.key];
              if (value === undefined) value = raw[field.key];
              const displayValue = Array.isArray(value)
                ? value.join(', ')
                : typeof value === 'boolean'
                  ? (value ? 'Yes' : 'No')
                  : (value === null || value === undefined || value === '') 
                    ? 'Not provided' 
                    : String(value);
 
               return (
                 <Box key={idx} sx={{ mb: 2 }}>
                   <Typography variant="body2" color="textSecondary">
                     {field.label}
                   </Typography>
                   <Typography variant="body1">
                     {displayValue}
                   </Typography>
                 </Box>
               );
             });
          })()}

          {/* File Uploads Section */}
          {selectedParticipant?.uploadedFiles?.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Uploaded Files
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {selectedParticipant.uploadedFiles.map((file, idx) => (
                  <Box key={idx}>
                    {file.type?.startsWith('image') ? (
                      <img 
                        src={file.url} 
                        alt={file.name} 
                        style={{ 
                          width: 120, 
                          height: 120, 
                          objectFit: 'cover',
                          borderRadius: 4 
                        }} 
                      />
                    ) : (
                      <Box sx={{ 
                        p: 1, 
                        border: '1px solid', 
                        borderColor: 'divider',
                        borderRadius: 1 
                      }}>
                        <Typography variant="body2">{file.name}</Typography>
                        <Button 
                          size="small" 
                          href={file.url} 
                          target="_blank"
                          sx={{ mt: 1 }}
                        >
                          Download
                        </Button>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Grid>
    )}

    {/* Admin Notes Section */}
    <Grid item xs={12} sx={{ mt: 2 }}>
      <TextField
        fullWidth
        label="Admin Notes"
        multiline
        rows={3}
        value={adminNotes}
        onChange={(e) => setAdminNotes(e.target.value)}
        disabled={actionLoading}
      />
    </Grid>
  </Grid>
</DialogContent>
{/* ===== END REPLACEMENT =====*/}
        <DialogActions>
          {selectedParticipant?.status === 'pending' && (
            <>
              <Button
                onClick={() => handleStatusUpdate(selectedParticipant.id, 'approved')}
                color="success"
                disabled={actionLoading}
                startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
              >
                Approve
              </Button>
              <Button
                onClick={() => handleStatusUpdate(selectedParticipant.id, 'rejected')}
                color="error"
                disabled={actionLoading}
                startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
              >
                Reject
              </Button>
            </>
          )}
          {/* --- NEW: Send Confirmation Email Button --- */}
          <Button
            onClick={() => handleSendConfirmationEmail(selectedParticipant)}
            color="primary"
            disabled={actionLoading}
            startIcon={<CheckCircleIcon />}
          >
            Send Confirmation Email
          </Button>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AdminParticipants;