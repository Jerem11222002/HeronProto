// ...existing code...
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography
} from '@mui/material';

/**
 * Props:
 * - open: boolean
 * - value: current registrationForm (array)
 * - onClose: () => void
 * - onSave: (parsedArray) => void
 */
export default function EventFormBuilder({ open, value = [], onClose, onSave }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      setText(JSON.stringify(value || [], null, 2));
      setError(null);
    } catch (e) {
      setText('[]');
      setError('Failed to stringify initial value');
    }
  }, [value, open]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setError('Form JSON must be an array of field objects');
        return;
      }
      // basic validation: each field needs key + label + type
      for (const f of parsed) {
        if (!f.key || !f.label || !f.type) {
          setError('Each field must include "key", "label", and "type"');
          return;
        }
      }
      setError(null);
      onSave(parsed);
      onClose();
    } catch (e) {
      setError(e.message || 'Invalid JSON');
    }
  };

  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Registration Form (JSON)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
          Edit the registrationForm JSON for this event. Each item should be an object with at least: key, label, type.
        </Typography>
        <TextField
          multiline
          minRows={12}
          fullWidth
          variant="outlined"
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={!!error}
        />
        {error && <Box mt={1}><Typography color="error">{error}</Typography></Box>}
        <Box mt={2}>
          <Typography variant="caption">Preview: {Array.isArray(value) ? value.length : 0} existing fields</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save Form</Button>
      </DialogActions>
    </Dialog>
  );
}
// ...existing code...
