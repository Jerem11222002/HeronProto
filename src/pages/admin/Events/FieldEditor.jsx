import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, FormControlLabel, Checkbox, MenuItem, Chip, IconButton, InputAdornment, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const FIELD_TYPES = ['text','textarea','number','select','checkbox','multicheck','date','time','file','email','tel'];

export default function FieldEditor({ open, field = {}, onClose, onSave }) {
  const [local, setLocal] = useState({});

  useEffect(() => {
    setLocal(field ? { ...field } : {});
  }, [field, open]);

  const update = (patch) => setLocal(l => ({ ...l, ...patch }));

  // helper for options as chips
  const addOption = (v) => {
    if (!v) return;
    update({ options: Array.isArray(local.options) ? [...local.options, v] : [v] });
  };
  const removeOption = (idx) => {
    update({ options: (local.options || []).filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    const normalized = { ...local };
    // ensure options array
    if (typeof normalized.options === 'string') {
      normalized.options = normalized.options.split(',').map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(normalized.options)) {
      normalized.options = [];
    }
    // keep visibility & validation shapes minimal
    normalized.visibility = normalized.visibility || null;
    normalized.validation = normalized.validation || {};
    onSave && onSave(normalized);
  };

  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Field Settings</DialogTitle>
      <DialogContent dividers>
        <Box display="grid" gap={2} mt={1}>
          <TextField label="Label" value={local.label || ''} onChange={e => update({ label: e.target.value })} />
          <TextField label="Key" value={local.key || ''} onChange={e => update({ key: e.target.value.replace(/\s+/g,'_') })} helperText="Unique key used in payload" />
          <TextField select label="Type" value={local.type || 'text'} onChange={e => update({ type: e.target.value })}>
            {FIELD_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField label="Placeholder" value={local.placeholder || ''} onChange={e => update({ placeholder: e.target.value })} />
          <TextField label="Hint (small text)" value={local.hint || ''} onChange={e => update({ hint: e.target.value })} />

          {/* Options editor as chips */}
          {(local.type === 'select' || local.type === 'multicheck') && (
            <Box>
              <Box display="flex" gap={1} alignItems="center" mb={1}>
                <TextField
                  size="small"
                  placeholder="Add option and press Add"
                  value={local._newOption || ''}
                  onChange={e => update({ _newOption: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(local._newOption); update({ _newOption: '' }); } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => { addOption(local._newOption); update({ _newOption: '' }); }}><AddIcon /></IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(local.options || []).map((opt, i) => (
                  <Chip key={`${opt}-${i}`} label={opt} onDelete={() => removeOption(i)} />
                ))}
              </Box>
            </Box>
          )}

          <FormControlLabel control={<Checkbox checked={!!local.required} onChange={e => update({ required: e.target.checked })} />} label="Required" />

          {/* visibility simple rule */}
          <Box>
            <Typography variant="subtitle2">Visibility rule (optional)</Typography>
            <TextField size="small" label="When (field key)" value={local.visibility?.when || ''} onChange={(e) => update({ visibility: { ...(local.visibility || {}), when: e.target.value } })} helperText="Field key this depends on" />
            <TextField size="small" label="Is (value)" value={local.visibility?.is ?? ''} onChange={(e) => update({ visibility: { ...(local.visibility || {}), is: e.target.value } })} helperText="Show when that field equals this value (string/true/false)" />
          </Box>

          {/* basic validation */}
          <Box>
            <Typography variant="subtitle2">Validation (optional)</Typography>
            <TextField size="small" label="Pattern (regex)" value={local.validation?.pattern || ''} onChange={(e) => update({ validation: { ...(local.validation || {}), pattern: e.target.value } })} helperText="e.g. ^\\d{4}$" />
            <Box display="flex" gap={1}>
              <TextField size="small" label="Min" value={local.validation?.min ?? ''} onChange={(e) => update({ validation: { ...(local.validation || {}), min: e.target.value } })} />
              <TextField size="small" label="Max" value={local.validation?.max ?? ''} onChange={(e) => update({ validation: { ...(local.validation || {}), max: e.target.value } })} />
            </Box>
          </Box>

        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save Field</Button>
      </DialogActions>
    </Dialog>
  );
}