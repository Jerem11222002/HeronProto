import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import {
  Box, Paper, Typography, Button, Chip, Tabs, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  FormControl, Select, InputLabel, Avatar, Tooltip, Badge, CircularProgress,
  Grid, Card, CardContent, Divider, Pagination, InputAdornment
} from '@mui/material';
import {
  Refresh as RefreshIcon, BugReport as BugReportIcon,
  FilterList as FilterIcon, Search as SearchIcon,
  AssignmentInd as AssignIcon, CheckCircle as ResolvedIcon,
  OpenInNew as ViewIcon, Close as CloseIcon
} from '@mui/icons-material';
import { AuthContext } from '../../../context/authContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CATEGORIES = { ui: 'UI/UX', performance: 'Performance', security: 'Security', feature: 'Feature Request', bug: 'Bug', other: 'Other' };
const SEVERITIES = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const STATUSES = { pending: 'Pending', 'in-progress': 'In Progress', resolved: 'Resolved', closed: 'Closed' };

export default function AdminBugReports() {
  const { currentUser } = useContext(AuthContext);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '', category: '', assignedTo: '', sortBy: 'createdAt', sortOrder: 'desc', page: 1, search: '' });
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const getToken = () => localStorage.getItem('token') || localStorage.getItem('adminToken');

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.category) params.append('category', filters.category);
      if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);
      params.append('page', filters.page);

      const res = await axios.get(`${API_URL}/api/bug-reports/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });

      if (res.data.success) {
        setReports(res.data.reports || []);
        setStats(res.data.stats || {});
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch bug reports:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/api/bug-reports/${reportId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      fetchReports();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleAssign = async (reportId) => {
    try {
      await axios.patch(`${API_URL}/api/bug-reports/${reportId}/assign`,
        { assignedTo: currentUser._id },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      fetchReports();
    } catch (err) {
      console.error('Failed to assign report:', err);
    }
  };

  const openDetail = async (report) => {
    try {
      const res = await axios.get(`${API_URL}/api/bug-reports/${report._id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.data.success) {
        setSelectedReport(res.data.report);
        setDetailDialogOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch report detail:', err);
    }
  };

  const filteredReports = reports.filter(r => {
    if (!filters.search) return true;
    const q = filters.search.toLowerCase();
    return (r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.userId?.username?.toLowerCase().includes(q));
  });

  const getSeverityColor = (sev) => ({ low: 'success', medium: 'info', high: 'warning', critical: 'error' }[sev] || 'default');
  const getStatusColor = (st) => ({ pending: 'default', 'in-progress': 'info', resolved: 'success', closed: 'error' }[st] || 'default');

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BugReportIcon /> Bug Reports & User Concerns
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Total Reports</Typography>
            <Typography variant="h4">{stats.total || 0}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Unresolved</Typography>
            <Typography variant="h4" color="warning.main">{stats.unresolved || 0}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Critical</Typography>
            <Typography variant="h4" color="error">{stats.critical || 0}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Categories</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Object.entries(stats.byCategory || {}).map(([cat, count]) => (
                <Chip key={cat} label={`${cat}: ${count}`} size="small" />
              ))}
            </Box>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => { setTabValue(v); const st = ['','pending','in-progress','resolved'][v]; setFilters(f => ({ ...f, status: st, page: 1 })); }}>
          <Tab label="All" />
          <Tab label={<Badge badgeContent={stats.byStatus?.pending || 0} color="primary">Pending</Badge>} />
          <Tab label={<Badge badgeContent={stats.byStatus?.['in-progress'] || 0} color="info">In Progress</Badge>} />
          <Tab label={<Badge badgeContent={stats.byStatus?.resolved || 0} color="success">Resolved</Badge>} />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField placeholder="Search..." size="small" value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          sx={{ minWidth: 200 }} />
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Severity</InputLabel>
          <Select value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value, page: 1 }))}>
            <MenuItem value="">All</MenuItem>
            {Object.entries(SEVERITIES).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Category</InputLabel>
          <Select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value, page: 1 }))}>
            <MenuItem value="">All</MenuItem>
            {Object.entries(CATEGORIES).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="outlined" startIcon={<FilterIcon />} onClick={() => setFilters({ status: '', severity: '', category: '', assignedTo: '', sortBy: 'createdAt', sortOrder: 'desc', page: 1, search: '' })}>Reset</Button>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchReports}>Refresh</Button>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Report</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center"><CircularProgress /></TableCell></TableRow>
            ) : filteredReports.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center">No reports found</TableCell></TableRow>
            ) : (
              filteredReports.map(report => (
                <TableRow key={report._id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{report.title}</Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={report.userId?.profilePic} sx={{ width: 24, height: 24 }} />
                      <Typography variant="body2">{report.userId?.username}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Chip label={CATEGORIES[report.category] || report.category} size="small" /></TableCell>
                  <TableCell><Chip label={SEVERITIES[report.severity] || report.severity} size="small" color={getSeverityColor(report.severity)} /></TableCell>
                  <TableCell><Chip label={STATUSES[report.status] || report.status} size="small" color={getStatusColor(report.status)} /></TableCell>
                  <TableCell>
                    {report.assignedTo ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar src={report.assignedTo?.profilePic} sx={{ width: 20, height: 20 }} />
                        <Typography variant="body2">{report.assignedTo?.username}</Typography>
                      </Box>
                    ) : <Chip label="Unassigned" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>{new Date(report.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(report)}><ViewIcon /></IconButton></Tooltip>
                    {!report.assignedTo && <Tooltip title="Assign to Me"><IconButton size="small" onClick={() => handleAssign(report._id)}><AssignIcon /></IconButton></Tooltip>}
                    {report.status !== 'resolved' && <Tooltip title="Resolve"><IconButton size="small" color="success" onClick={() => handleStatusChange(report._id, 'resolved')}><ResolvedIcon /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Pagination count={totalPages} page={filters.page} onChange={(e, p) => setFilters(f => ({ ...f, page: p }))} color="primary" />
      </Box>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Report Details
          <IconButton onClick={() => setDetailDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedReport && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={CATEGORIES[selectedReport.category]} />
                <Chip label={SEVERITIES[selectedReport.severity]} color={getSeverityColor(selectedReport.severity)} />
                <Chip label={STATUSES[selectedReport.status]} color={getStatusColor(selectedReport.status)} />
              </Box>
              <Typography variant="h6" gutterBottom>{selectedReport.title}</Typography>
              <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{selectedReport.description}</Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Submitted By</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Avatar src={selectedReport.userId?.profilePic} />
                    <Box>
                      <Typography>{selectedReport.userId?.username}</Typography>
                      <Typography variant="caption" color="textSecondary">{selectedReport.userId?.email}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Assigned To</Typography>
                  {selectedReport.assignedTo ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Avatar src={selectedReport.assignedTo?.profilePic} />
                      <Typography>{selectedReport.assignedTo?.username || selectedReport.assignedTo?.name}</Typography>
                    </Box>
                  ) : <Typography color="textSecondary" sx={{ mt: 1 }}>Unassigned</Typography>}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Page URL</Typography>
                  <Typography variant="body2">{selectedReport.pageUrl || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Browser</Typography>
                  <Typography variant="body2">{selectedReport.userAgent || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Created At</Typography>
                  <Typography variant="body2">{new Date(selectedReport.createdAt).toLocaleString()}</Typography>
                </Grid>
              </Grid>
              {selectedReport.resolution?.notes && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Resolution Notes</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedReport.resolution.notes}</Typography>
                  </Paper>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!selectedReport?.assignedTo && <Button startIcon={<AssignIcon />} onClick={() => { handleAssign(selectedReport._id); setDetailDialogOpen(false); }}>Assign to Me</Button>}
          {selectedReport?.status === 'pending' && <Button startIcon={<ResolvedIcon />} onClick={() => { handleStatusChange(selectedReport._id, 'in-progress'); setDetailDialogOpen(false); }}>Start Progress</Button>}
          {selectedReport?.status !== 'resolved' && <Button startIcon={<ResolvedIcon />} color="success" onClick={() => { handleStatusChange(selectedReport._id, 'resolved'); setDetailDialogOpen(false); }}>Resolve</Button>}
          {selectedReport?.status === 'resolved' && <Button color="error" onClick={() => { handleStatusChange(selectedReport._id, 'closed'); setDetailDialogOpen(false); }}>Close</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
