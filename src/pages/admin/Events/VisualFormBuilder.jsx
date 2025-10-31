import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Card, CardHeader, CardContent, Button, IconButton, List, ListItem, ListItemText, Divider, Typography, Menu, MenuItem, Tooltip, Stack, Chip, TextField, FormControlLabel, Switch, Grid, FormHelperText } from '@mui/material';
import { Add, ArrowUpward, ArrowDownward, Delete, Edit } from '@mui/icons-material';
import DynamicRegistrationForm from '../../pre-registration/Forms/DynamicRegistrationForm';
import FieldEditor from './FieldEditor';
import './VisualFormBuilder.scss';

/**
 * VisualFormBuilder
 * Props:
 *  - open: boolean (if you render as modal wrapper) -- this component returns UI regardless; Admin wraps in Dialog
 *  - value: initial schema array
 *  - onSave(schema)
 *  - onClose()
 */
export default function VisualFormBuilder({ value = [], onSave, onClose }) {
  const [schema, setSchema] = useState([]);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [filter, setFilter] = useState('');

  // preview controls
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => setSchema(Array.isArray(value) ? [...value] : []), [value]);

  const currentField = useMemo(() => {
    if (editingIndex < 0 || editingIndex >= schema.length) return null;
    return schema[editingIndex] ? { ...schema[editingIndex] } : null;
  }, [schema, editingIndex]);

  const normalizeKey = (key) => {
    return String(key || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || `field_${Date.now().toString(36).slice(-6)}`;
  };

  // ensure generated key is unique in current schema
  const makeUniqueKey = (base) => {
    let k = normalizeKey(base);
    const existing = new Set(schema.map(s => String(s.key).toLowerCase()));
    if (!existing.has(k)) return k;
    let i = 1;
    while (existing.has(`${k}_${i}`)) i++;
    return `${k}_${i}`;
  };

  // defer persisting to parent to avoid setState-in-render warnings.
  const didMountRef = useRef(false);
  const persistTimerRef = useRef(null);
  useEffect(() => {
    // skip initial copy-from-props -> local state update
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    // NEW: do not auto-persist while the field editor is open (prevents parent -> child overwrite while typing)
    if (isEditorOpen) {
      return;
    }

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        const { ok, value: sanitized, error } = sanitizeAndValidate(schema);
        if (!ok) {
          console.warn('Schema not persisted: ', error);
          return;
        }
        onSave && onSave(sanitized);
      } catch (e) {
        console.warn('persistSchema error', e);
      }
    }, 150);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [schema, onSave, isEditorOpen]);

  const addField = (type = 'text', label = 'New Field') => {
    const key = makeUniqueKey(label || type);
    const field = { 
      key, 
      label: String(label || '').trim() || label, 
      type, 
      required: false, 
      options: [], 
      placeholder: '', 
      hint: '',
      visibility: null,
      validation: {}
    };
    // append and immediately open editor for newly added field
    setSchema(prev => {
      const next = [...prev, field];
      setEditingIndex(next.length - 1);
      setIsEditorOpen(true);
      return next;
    });
  };
  
  // persist on update
  const updateField = (idx, patch) => {
    setSchema(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  // persist on remove (already confirms)
  const removeField = (idx) => {
    if (!window.confirm('Delete this field? This cannot be undone.')) return;

    setSchema(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (editingIndex === idx) {
        setIsEditorOpen(false);
        setEditingIndex(-1);
      } else if (editingIndex > idx) {
        setEditingIndex(prevIdx => Math.max(-1, prevIdx - 1));
      }
      return next;
    });
  };

  const moveField = (idx, dir) => {
    setSchema(prev => {
      const next = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= next.length) return prev;
      const tmp = next[to]; next[to] = next[idx]; next[idx] = tmp;
      return next;
    });
  };

  const openEditor = (idx) => { setEditingIndex(idx); setIsEditorOpen(true); };
  const closeEditor = () => { setEditingIndex(-1); setIsEditorOpen(false); };

  const handleMenuOpen = (ev) => setMenuAnchor(ev.currentTarget);
  const handleMenuClose = () => setMenuAnchor(null);

  const sanitizeAndValidate = (arr) => {
    // basic sanitization + unique keys check
    const normalized = (arr || []).map(f => {
      const field = { ...(f || {}) };
      field.key = normalizeKey(field.key || field.label || `field_${Date.now().toString(36).slice(-6)}`);
      field.label = String(field.label || field.key).trim();
      field.type = String(field.type || 'text');
      field.options = Array.isArray(field.options) ? field.options.map(String) : [];
      field.required = !!field.required;
      field.placeholder = field.placeholder || '';
      field.hint = field.hint || '';
      return field;
    });
    // enforce unique keys
    const seen = {};
    for (const f of normalized) {
      if (!f.key || !f.label || !f.type) {
        return { ok: false, error: 'Each field must have key, label and type.' };
      }
      if (seen[f.key]) {
        return { ok: false, error: `Duplicate key detected: "${f.key}". Keys must be unique.` };
      }
      seen[f.key] = true;
    }
    return { ok: true, value: normalized };
  };

  const saveAndClose = () => {
    const { ok, value, error } = sanitizeAndValidate(schema);
    if (!ok) {
      window.alert(error);
      return;
    }
    onSave && onSave(value);
    onClose && onClose();
  };

  const displayed = schema.filter(f => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (f.label || '').toLowerCase().includes(q) || (f.key || '').toLowerCase().includes(q) || (f.type || '').toLowerCase().includes(q);
  });

  // sample payload generator for preview
  const getSamplePayload = (schemaArr = []) => {
    const payload = {};
    (schemaArr || []).forEach(f => {
      switch (f.type) {
        case 'number': payload[f.key] = 0; break;
        case 'checkbox': payload[f.key] = false; break;
        case 'multicheck': payload[f.key] = (f.options && f.options.length) ? [f.options[0]] : []; break;
        case 'select': payload[f.key] = (f.options && f.options.length) ? f.options[0] : ''; break;
        case 'file': payload[f.key] = []; break;
        default: payload[f.key] = '';
      }
    });
    return payload;
  };

  return (
    // always stack vertically: fields editor first, preview below (when enabled)
    <Box className="visual-form-builder" display="flex" gap={2} flexDirection={{ xs: 'column', md: 'column' }}>
      {/* use full width here so the editor occupies the same wide area the preview used to */}
      <Paper className="fields-panel" sx={{ width: '100%', p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Form Fields</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Button size="small" startIcon={<Add />} onClick={(e) => setMenuAnchor(e.currentTarget)}>Quick Add</Button>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={handleMenuClose}>
              <MenuItem onClick={() => { handleMenuClose(); addField('text', 'Text'); }}>Text</MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); addField('textarea', 'Long Answer'); }}>Long Answer</MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); addField('select', 'Select Option'); }}>Select</MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); addField('multicheck', 'Multiple Choice'); }}>Multi Check</MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); addField('file', 'File Upload'); }}>File</MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); addField('email', 'Email'); }}>Email</MenuItem>
            </Menu>
            {/* single Preview toggle (preview will display below the editor) */}
            <Box ml={1} display="flex" alignItems="center" gap={1}>
              <FormControlLabel control={<Switch checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />} label="Preview" />
            </Box>
          </Box>
        </Box>

        <Box mb={1} display="flex" gap={1}>
          <TextField
            size="small"
            placeholder="Filter fields (label, key, type)..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            fullWidth
          />
        </Box>

        {displayed.length === 0 ? (
          <Box p={2} textAlign="center">
            <Typography color="textSecondary" mb={2}>No fields yet. Use Quick Add or the Add button to create fields.</Typography>
            <Stack direction="row" justifyContent="center" gap={1}>
              <Button variant="outlined" onClick={() => addField('text', 'Text')}>Add Text</Button>
              <Button variant="outlined" onClick={() => addField('select', 'Select')}>Add Select</Button>
            </Stack>
          </Box>
        ) : (
          <List dense>
            {displayed.map((f, i) => (
              <React.Fragment key={`${f.key}-${i}`}>
                <ListItem
                  secondaryAction={
                    <Box>
                      <Tooltip title="Move up"><IconButton size="small" onClick={() => moveField(i, -1)}><ArrowUpward fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Move down"><IconButton size="small" onClick={() => moveField(i, +1)}><ArrowDownward fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditor(i)}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" onClick={() => removeField(i)}><Delete fontSize="small" /></IconButton></Tooltip>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle2">{f.label || '(no label)'}</Typography>
                        <Chip label={f.type} size="small" />
                      </Box>
                    }
                    secondary={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{f.key}</span>}
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}

        <Box mt={2} display="flex" gap={1} justifyContent="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={saveAndClose}>Save Form</Button>
        </Box>
      </Paper>

      <FieldEditor
        open={isEditorOpen}
        field={currentField}
        onClose={closeEditor}
        onSave={(patch) => {
          // when saving a field, ensure its key is normalized & unique
          const patched = { ...currentField, ...patch };
          patched.key = normalizeKey(patched.key || patched.label);
          // if key collides with others, make unique
          const others = schema.filter((_, idx) => idx !== editingIndex).map(x => String(x.key).toLowerCase());
          if (others.includes(patched.key.toLowerCase())) {
            // append suffix
            let i = 1; const base = patched.key;
            while (others.includes(`${base}_${i}`)) i++;
            patched.key = `${base}_${i}`;
          }
          updateField(editingIndex, patched);
          closeEditor();
        }}
      />

      {/* Preview always displays below fields panel when enabled */}
      {showPreview && (
        <Box mt={2} className="preview-panel">
          <Card elevation={4} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <CardHeader
              title={<Typography variant="h6">Live Preview</Typography>}
              subheader={<Typography variant="caption" color="textSecondary">How this form will look to registrants</Typography>}
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ pt: 1 }}>
              <Box
                sx={{
                  bgcolor: (theme) => theme.palette.background.default,
                  border: '1px solid',
                  borderColor: (theme) => theme.palette.divider,
                  borderRadius: 1,
                  p: { xs: 2, md: 3 },
                  maxHeight: 760,
                  overflow: 'auto',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                {/* Wide centered form container — maximize space for preview */}
                <Box sx={{ width: '100%', maxWidth: 920 }}>
                  <DynamicRegistrationForm
                    schema={schema}
                    onSubmit={() => {}}
                    submitLabel="Preview Submit"
                    asForm={false}
                    sxOverrides={{
                      fieldSpacing: 3,
                      labelVariant: 'subtitle1',
                      inputVariant: 'outlined',
                      submitFullWidth: false
                    }}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}