import React, { useState, useEffect } from 'react';

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

const Field = ({ field, value, onChange }) => {
  const common = {
    id: field.key,
    name: field.key,
    placeholder: field.placeholder || '',
    value: value ?? '',
    readOnly: field.readOnly || false,
    disabled: field.readOnly || false
  };

  switch (field.type) {
    case 'textarea':
      return <textarea className="form-textarea" {...common} onChange={e => onChange(field.key, e.target.value)} />;
    case 'number':
      return <input className="form-control" {...common} type="number" onChange={e => onChange(field.key, e.target.value)} />;
    case 'select':
      return (
        <select className="form-select" {...common} onChange={e => onChange(field.key, e.target.value)}>
          <option value="">Select</option>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    case 'multicheck':
      return (
        <div className="multi-check">
          {field.options.map(opt => (
            <label key={opt} className="multi-check-item">
              <input
                className="checkbox-input"
                type="checkbox"
                checked={(value || []).includes(opt)}
                onChange={e => {
                  const next = new Set(value || []);
                  if (e.target.checked) next.add(opt); else next.delete(opt);
                  onChange(field.key, Array.from(next));
                }}
                disabled={field.readOnly}
              /> <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return <input className="checkbox-input" type="checkbox" checked={!!value} onChange={e => onChange(field.key, e.target.checked)} disabled={field.readOnly} />;
    case 'file':
      return <input className="file-input" type="file" multiple={!!field.validation?.multiple} onChange={e => onChange(field.key, Array.from(e.target.files))} disabled={field.readOnly} />;
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

export default function DynamicRegistrationForm({
  schema = [],
  initialValues = {},
  onSubmit,
  submitLabel = 'Submit',
  className = '',
  asForm = true // when false render fields-only preview
}) {
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
        else val = '';
      }
      setDeep(init, key, val);
    });
    return init;
  };

  const [values, setValues] = useState(buildInitial);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // if schema or initialValues change, rebuild values conservatively
    setValues(prev => {
      const next = { ...prev };
      (schema || []).forEach(f => {
        const existing = getDeep(next, f.key);
        if (existing === undefined) {
          const defaultVal = f.type === 'multicheck' ? [] : (f.type === 'checkbox' ? false : '');
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
  };

  const validate = () => {
    for (const f of schema) {
      if (f.required) {
        const v = getDeep(values, f.key);
        if (f.type === 'file') {
          if (!v || v.length === 0) { setError(`${f.label} is required`); return false; }
        } else if (f.type === 'multicheck') {
          if (!v || v.length === 0) { setError(`${f.label} is required`); return false; }
        } else if ((v === undefined || v === null || v === '') && v !== 0) {
          setError(`${f.label} is required`); return false;
        }
      }
      if (f.validation?.pattern) {
        const v = getDeep(values, f.key);
        if (v) {
          try {
            const re = new RegExp(f.validation.pattern);
            if (!re.test(v)) { setError(f.validation.message || `${f.label} is invalid`); return false; }
          } catch (e) {
            // ignore invalid regex from admin
          }
        }
      }
    }
    setError(null);
    return true;
  };

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
        // Append files and non-file fields. For nested non-file objects, serialize to JSON under top-level key
        // Strategy: for each top-level key in schema, if it contains nested structure and contains non-file values -> append as JSON
        // and append files with their field key (dot-notation) multiple times.
        const flat = flattenForFormData(values);
        // first append non-file entries (strings, numbers, booleans) grouped by top-level key when nested
        const nonFileGrouped = {};
        flat.forEach(({ key, value, isFile }) => {
          if (isFile) return;
          // for nested keys, group into a top-level JSON object by top-level field
          const top = key.split('.')[0];
          if (!nonFileGrouped[top]) nonFileGrouped[top] = {};
          // set nested path inside group
          const rest = key.split('.').slice(1).join('.');
          if (rest) setDeep(nonFileGrouped[top], rest, value);
          else nonFileGrouped[top] = value;
        });
        Object.keys(nonFileGrouped).forEach(k => {
          // if the value is an object, stringify it
          const v = nonFileGrouped[k];
          if (typeof v === 'object' && v !== null) fd.append(k, JSON.stringify(v));
          else fd.append(k, v ?? '');
        });
        // append files (flat entries) using their exact dot key
        flat.forEach(({ key, value, isFile }) => {
          if (!isFile) return;
          fd.append(key, value);
        });

        await onSubmit(fd, true);
      } else {
        // Non-file submit: send nested object as-is
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
    return (
      <div key={field.key} className="drf-field">
        <label htmlFor={field.key}>{field.label}{field.required ? ' *' : ''}</label>
        <Field field={field} value={value} onChange={handleChange} />
        {field.hint && <small className="field-hint">{field.hint}</small>}
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
    <form className={`dynamic-registration-form ${className}`} onSubmit={handleSubmit}>
      {(schema || []).map(renderField)}
      {error && <div className="form-error">{error}</div>}
      <div className="drf-actions">
        <button disabled={submitting} type="submit">{submitting ? 'Submitting...' : submitLabel}</button>
      </div>
    </form>
  );
}