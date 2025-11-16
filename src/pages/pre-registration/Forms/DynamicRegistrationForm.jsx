import React, { useState, useEffect, useRef } from 'react';

/**
 * DynamicRegistrationForm
 * - Handles nested field keys using dot notation (e.g. emergencyContact.name)
 * - Keeps values as nested objects
 * - Properly validates required nested fields
 * - Builds FormData for file uploads, serializing nested non-file fields as JSON
 */

const setDeep = (obj, path, value) => {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === parts.length - 1) {
      cur[p] = value;
    } else {
      if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
  }
  return obj;
};

const getDeep = (obj, path) => {
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

// ----------------- Enhanced Field component -----------------
const Field = ({ field, value, onChange, errorId }) => {
  const common = {
    id: field.key,
    name: field.key,
    placeholder: field.placeholder || '',
    value: value ?? '',
    readOnly: field.readOnly || false,
    disabled: field.readOnly || false,
    'aria-required': !!field.required,
    'aria-describedby': errorId || undefined,
    'aria-invalid': !!errorId
  };

  // file-specific UI: show list of selected files and allow removal
  if (field.type === 'file') {
    const files = Array.isArray(value) ? value : [];
    return (
      <div>
        <input
          className="file-input"
          type="file"
          multiple={!!field.validation?.multiple}
          onChange={e => onChange(field.key, Array.from(e.target.files))}
          disabled={field.readOnly}
          aria-label={field.label}
        />
        {files && files.length > 0 && (
          <div className="file-list" aria-live="polite">
            {files.map((f, idx) => (
              <div key={`${f.name || f.size}-${idx}`} className="file-item">
                <span className="file-name">{f.name || f.filename || `file-${idx+1}`}</span>
                <small className="file-meta">{f.size ? `${Math.round(f.size/1024)} KB` : ''}</small>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const next = files.slice();
                    next.splice(idx, 1);
                    onChange(field.key, next);
                  }}
                  style={{ marginLeft: 8 }}
                  aria-label={`Remove ${f.name || 'file'}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  switch (field.type) {
    case 'textarea':
      return <textarea className="form-textarea" {...common} onChange={e => onChange(field.key, e.target.value)} />;
    case 'number':
      return <input className="form-control" {...common} type="number" onChange={e => onChange(field.key, e.target.value)} />;
    case 'select':
      return (
        <select className="form-select" {...common} onChange={e => onChange(field.key, e.target.value)}>
          <option value="">Select</option>
          {(field.options || []).map((opt, i) => <option key={`${opt}-${i}`} value={opt}>{opt}</option>)}
        </select>
      );
    case 'multicheck': {
      const seen = new Set();
      return (
        <div className="multi-check" role="group" aria-label={field.label || field.key}>
          {(field.options || []).map((opt, i) => {
            // support option objects { label, value } and primitive options
            const optLabel = opt && typeof opt === 'object' ? (opt.label ?? String(opt.value)) : String(opt);
            // base value (may collide if labels/texts are same)
            let baseValue = opt && typeof opt === 'object' ? (opt.value ?? optLabel) : String(opt);
            baseValue = String(baseValue).trim();
            // if a duplicate baseValue already seen, make a unique value by appending the index
            const optValue = seen.has(baseValue) ? `${baseValue}__dup__${i}` : baseValue;
            seen.add(baseValue);
            const itemKey = `${field.key}__multi__${i}__${optValue}`;
            const inputId = `${field.key}__checkbox__${i}`;
            const checked = Array.isArray(value) && value.includes(optValue);
            return (
              <label key={itemKey} htmlFor={inputId} className="multi-check-item">
                <input
                  id={inputId}
                  name={`${field.key}-${i}`}
                  className="checkbox-input"
                  type="checkbox"
                  value={optValue}
                  checked={checked}
                  onChange={e => {
                    const cur = Array.isArray(value) ? value.slice() : [];
                    if (e.target.checked) {
                      if (!cur.includes(optValue)) cur.push(optValue);
                    } else {
                      const idx = cur.indexOf(optValue);
                      if (idx >= 0) cur.splice(idx, 1);
                    }
                    onChange(field.key, cur);
                  }}
                  disabled={field.readOnly}
                  aria-checked={checked}
                />
                <span>{optLabel}</span>
              </label>
            );
          })}
        </div>
      );
    }
    case 'checkbox':
      return <input className="checkbox-input" type="checkbox" checked={!!value} onChange={e => onChange(field.key, e.target.checked)} disabled={field.readOnly} />;
    case 'email':
      return <input className="form-control" {...common} type="email" onChange={e => onChange(field.key, e.target.value)} />;
    case 'tel':
      return <input className="form-control" {...common} type="tel" onChange={e => onChange(field.key, e.target.value)} />;
    case 'date':
      return <input className="form-control" {...common} type="date" onChange={e => onChange(field.key, e.target.value)} />;
    case 'time':
      return <input className="form-control" {...common} type="time" onChange={e => onChange(field.key, e.target.value)} />;
    default:
      return <input className="form-control" {...common} type="text" onChange={e => onChange(field.key, e.target.value)} />;
  }
};
// ----------------- end Field -----------------

export default function DynamicRegistrationForm({
  schema = [],
  initialValues = {},
  onSubmit,
  submitLabel = 'Submit',
  className = '',
  asForm = true // when false render fields-only preview
}) {
  useEffect(() => {
    console.debug('[DynamicRegistrationForm] schema:', schema, 'initialValues:', initialValues);
  }, [schema, JSON.stringify(initialValues)]);

  // build initial nested values
  const buildInitial = () => {
    const init = {};
    (schema || []).forEach(f => {
      const key = f.key;
      let val = undefined;
      // support initialValues flat or nested
      if (getDeep(initialValues, key) !== undefined) {
        val = getDeep(initialValues, key);
      } else if (initialValues && Object.prototype.hasOwnProperty.call(initialValues, key)) {
        val = initialValues[key];
      } else {
        if (f.type === 'multicheck') val = [];
        else if (f.type === 'checkbox') val = false;
        else if (f.type === 'file') val = [];
        else val = '';
      }
      setDeep(init, key, val);
    });
    return init;
  };

  const [values, setValues] = useState(buildInitial);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({}); // per-field error messages
  const [submitting, setSubmitting] = useState(false);
  const firstInvalidRef = useRef(null);

  useEffect(() => {
    // if schema or initialValues change, rebuild values conservatively
    setValues(prev => {
      const next = { ...prev };
      (schema || []).forEach(f => {
        const existing = getDeep(next, f.key);
        if (existing === undefined) {
          const defaultVal = f.type === 'multicheck' ? [] : (f.type === 'checkbox' ? false : (f.type === 'file' ? [] : ''));
          setDeep(next, f.key, defaultVal);
        }
        // merge provided initialValues
        const provided = getDeep(initialValues, f.key);
        if (provided !== undefined) setDeep(next, f.key, provided);
      });
      return next;
    });
    // eslint-disable-next-line
  }, [schema, JSON.stringify(initialValues)]);

  const handleChange = (key, val) => {
    setValues(v => {
      const next = { ...v };
      setDeep(next, key, val);
      return next;
    });
    // clear per-field error on change
    setFieldErrors(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setError(null);
  };

  const validate = () => {
    const newFieldErrors = {};
    for (const f of schema) {
      if (f.required) {
        const v = getDeep(values, f.key);
        if (f.type === 'file') {
          if (!v || v.length === 0) { newFieldErrors[f.key] = `${f.label} is required`; }
        } else if (f.type === 'multicheck') {
          if (!v || v.length === 0) { newFieldErrors[f.key] = `${f.label} is required`; }
        } else if (f.type === 'checkbox') {
          // required checkbox must be checked (true)
          if (v !== true) {
            // Formal consent message for agreement/consent checkboxes
            const keyLower = String(f.key || '').toLowerCase();
            const labelLower = String(f.label || '').toLowerCase();
            if (keyLower.includes('consent') || keyLower.includes('agree') || labelLower.includes('consent') || labelLower.includes('agree')) {
              newFieldErrors[f.key] = 'You must agree to the collection and use of your information for event registration and related communication before proceeding.';
            } else {
              newFieldErrors[f.key] = `${f.label} is required`;
            }
          }
        } else if ((v === undefined || v === null || v === '') && v !== 0) {
          newFieldErrors[f.key] = `${f.label} is required`;
        }
      }
      if (f.validation?.pattern) {
        const v = getDeep(values, f.key);
        if (v) {
          try {
            const re = new RegExp(f.validation.pattern);
            if (!re.test(v)) { newFieldErrors[f.key] = f.validation.message || `${f.label} is invalid`; }
          } catch (e) {
            // ignore invalid regex from admin
          }
        }
      }
    }

    setFieldErrors(newFieldErrors);
    if (Object.keys(newFieldErrors).length) {
      // removed global message — display errors inline per-field only
      setError(null);
      // focus first invalid input
      const firstKey = Object.keys(newFieldErrors)[0];
      firstInvalidRef.current = firstKey;
      setTimeout(() => {
        const el = document.querySelector(`[name="${firstKey}"]`);
        if (el) el.focus();
      }, 50);
      return false;
    }
    setError(null);
    return true;
  };

  // flattenForFormData and handleSubmit unchanged
  const flattenForFormData = (obj, parentKey = '') => {
    const entries = [];
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      const composed = parentKey ? `${parentKey}.${k}` : k;
      if (v instanceof File) {
        entries.push({ key: composed, value: v, isFile: true });
      } else if (Array.isArray(v) && v.length && v[0] instanceof File) {
        // multiple files array
        v.forEach((file, idx) => entries.push({ key: composed, value: file, isFile: true }));
      } else if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
        entries.push(...flattenForFormData(v, composed));
      } else {
        entries.push({ key: composed, value: v, isFile: false });
      }
    }
    return entries;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Detect file presence anywhere in values
      let hasFiles = false;
      const fileCheck = (obj) => {
        if (!obj) return false;
        if (Array.isArray(obj)) {
          return obj.some(i => i instanceof File);
        }
        if (obj instanceof File) return true;
        if (typeof obj === 'object') {
          return Object.values(obj).some(v => fileCheck(v));
        }
        return false;
      };
      hasFiles = fileCheck(values);

      if (hasFiles) {
        const fd = new FormData();
        const flat = flattenForFormData(values);
        const nonFileGrouped = {};
        flat.forEach(({ key, value, isFile }) => {
          if (isFile) return;
          const top = key.split('.')[0];
          if (!nonFileGrouped[top]) nonFileGrouped[top] = {};
          const rest = key.split('.').slice(1).join('.');
          if (rest) setDeep(nonFileGrouped[top], rest, value);
          else nonFileGrouped[top] = value;
        });
        Object.keys(nonFileGrouped).forEach(k => {
          const v = nonFileGrouped[k];
          if (typeof v === 'object' && v !== null) fd.append(k, JSON.stringify(v));
          else fd.append(k, v ?? '');
        });
        flat.forEach(({ key, value, isFile }) => {
          if (!isFile) return;
          fd.append(key, value);
        });

        await onSubmit(fd, true);
      } else {
        await onSubmit(values, false);
      }
    } catch (err) {
      setError(err?.message || 'Submission failed');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const value = getDeep(values, field.key);
    const fe = fieldErrors[field.key];
    const errorId = fe ? `${field.key}-error` : undefined;

    // Render checkbox inline with label for better UX
    if (field.type === 'checkbox') {
      return (
        <div key={field.key} className="drf-field drf-field-inline">
          <label className="form-label checkbox-label" htmlFor={field.key}>
            <Field field={field} value={value} onChange={handleChange} errorId={errorId} />
            <span style={{ marginLeft: 10 }}>
              {field.label}
              {field.required && <span className="required-asterisk" aria-hidden="true">*</span>}
            </span>
          </label>

          {field.hint && <small className="field-hint">{field.hint}</small>}
          {fe && <div id={errorId} className="form-error" role="alert">{fe}</div>}
        </div>
      );
    }

    return (
      <div key={field.key} className="drf-field">
        <label className="form-label" htmlFor={field.key}>
          {field.label}
          {field.required && <span className="required-asterisk" aria-hidden="true">*</span>}
        </label>

        <Field field={field} value={value} onChange={handleChange} errorId={errorId} />

        {field.hint && <small className="field-hint">{field.hint}</small>}
        {fe && <div id={errorId} className="form-error" role="alert">{fe}</div>}
      </div>
    );
  };

  const renderFieldsOnly = () => (
    <div className={`drf-fields-only ${className}`}>
      {(schema || []).map(renderField)}
    </div>
  );

  if (!asForm) return renderFieldsOnly();

  return (
    <form onSubmit={handleSubmit} className={`dynamic-registration-form ${className}`}>
      {(schema || []).map(renderField)}

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="drf-actions">
        <button type="button" className="btn-secondary" onClick={() => { setValues(buildInitial()); setError(null); setFieldErrors({}); }}>
          Reset
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Submitting...' : submitLabel}
        </button>
      </div>
    </form>
  );
}