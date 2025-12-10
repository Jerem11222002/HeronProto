import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdClose } from 'react-icons/md';
import './adminAccounts.scss';

const DEFAULT_PERMISSIONS = {
  canManageUsers: false,
  canManageEvents: false,
  canModerateContent: false,
  canAccessAnalytics: false,
  canManageSettings: false
};

const AdminAccounts = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [query, setQuery] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    isAdmin: true,
    adminRole: 'admin',
    adminPermissions: { ...DEFAULT_PERMISSIONS }
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const modalRef = useRef(null);
  const searchRef = useRef(null);

  // Media query for responsive design â€” MOVED BEFORE GUARD
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 820px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 820px)');
    const handler = (e) => setIsNarrow(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    setIsNarrow(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  // Fetch admin accounts from backend
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/admin/login');
          return;
        }
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }

      const data = await response.json();
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (showModal) {
      modalRef.current?.querySelector('input,select,button')?.focus();
    }
  }, [showModal]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && showModal) setShowModal(false);
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const filtered = useMemo(() => {
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter(u => (u.username + u.email + (u.name||'')).toLowerCase().includes(q));
  }, [list, query]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setForm({
      username: '',
      email: '',
      name: '',
      password: '',
      isAdmin: true,
      adminRole: 'admin',
      adminPermissions: { ...DEFAULT_PERMISSIONS }
    });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setFormError(null);
    setForm({
      username: user.username || '',
      email: user.email || '',
      name: user.name || '',
      password: '',
      isAdmin: !!user.isAdmin,
      adminRole: user.adminRole || 'admin',
      adminPermissions: { ...DEFAULT_PERMISSIONS, ...(user.adminPermissions || {}) }
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setFormError(null);

    // Validation
    if (!form.username.trim() || !form.email.trim() || !form.name.trim()) {
      setFormError('Username, email, and name are required.');
      return;
    }
    if (!editing && !form.password.trim()) {
      setFormError('Password is required for new accounts.');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken') || '';
      const url = editing ? `/api/admin/accounts/${editing._id}` : '/api/admin/accounts';
      const method = editing ? 'PUT' : 'POST';

      // Build request body
      const body = {
        email: form.email,
        name: form.name,
        adminRole: form.adminRole,
        adminPermissions: form.adminPermissions
      };

      // Only include username and password for new accounts
      if (!editing) {
        body.username = form.username;
        body.password = form.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${editing ? 'update' : 'create'} account`);
      }

      const savedAdmin = await response.json();

      if (editing) {
        setList(prev => prev.map(p => (p._id === editing._id ? savedAdmin.admin : p)));
      } else {
        setList(prev => [savedAdmin.admin, ...prev]);
      }

      window.dispatchEvent(new CustomEvent('app:admin:accounts:changed', {
        detail: { action: editing ? 'updated' : 'created', admin: savedAdmin.admin }
      }));

      setShowModal(false);
    } catch (err) {
      setFormError(err.message || 'An error occurred');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this admin account? This will remove their admin privileges.')) return;

    try {
      const token = localStorage.getItem('adminToken') || '';
      const response = await fetch(`/api/admin/accounts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete account');
      }

      setList(prev => prev.filter(p => p._id !== id));

      window.dispatchEvent(new CustomEvent('app:admin:accounts:changed', {
        detail: { action: 'deleted', adminId: id }
      }));
    } catch (err) {
      setError(err.message || 'Failed to delete account');
      console.error('Delete error:', err);
    }
  };

  // GUARD CHECK NOW COMES AFTER ALL HOOKS
  if (!currentUser || currentUser.adminRole !== 'super') {
    return (
      <div className="adminAccountsPage">
        <header className="pageHeader">
          <h1>Admin Accounts</h1>
        </header>
        <div className="accessDenied" style={{ padding: 24 }}>
          Access denied â€” Super admin role required.
        </div>
      </div>
    );
  }

  return (
    <div className="adminAccountsPage">
      <header className="pageHeader">
        <div className="titleWrap">
          <h1>Admin Accounts</h1>
          <p className="subtitle">Create and manage administrative users and their permissions.</p>
        </div>

        <div className="controls">
          <div className="search">
            <MdSearch className="icon" />
            <input
              ref={searchRef}
              placeholder="Search username or email (Ctrl/Cmd+K)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search admin accounts"
            />
            {query && <button className="clear" onClick={() => setQuery('')} aria-label="Clear search">Ã—</button>}
          </div>

          <button className="btn primary" onClick={openCreate} aria-label="Create admin account">
            <MdAdd /> Create
          </button>
        </div>
      </header>

      {error && (
        <div className="errorBanner" style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
          {error}
        </div>
      )}

      <section className="accountsList" aria-live="polite">
        {loading ? (
          <div className="muted">Loading admin accountsâ€¦</div>
        ) : filtered.length === 0 ? (
          <div className="emptyState">
            <div className="emptyTitle">No admin accounts found</div>
            <div className="emptySubtitle">Create a new admin account to get started.</div>
            <button className="btn primary" onClick={openCreate}>Create account</button>
          </div>
        ) : (
          <>
            <div className="tableWrap">
              <table className="accountsTable" role="table" aria-label="Admin accounts table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u._id}>
                      <td className="mono">{u.username}</td>
                      <td>{u.name || '-'}</td>
                      <td>{u.email}</td>
                      <td>{u.adminRole || '-'}</td>
                      <td className="perms">
                        {Object.entries(u.adminPermissions || {}).filter(([k,v]) => v).map(([k]) => (
                          <span key={k} className="chip" title={k}>{k.replace(/([A-Z])/g, ' $1')}</span>
                        ))}
                      </td>
                      <td className="actions">
                        <button title="Edit" onClick={() => openEdit(u)} aria-label={`Edit ${u.username}`}><MdEdit /></button>
                        <button title="Delete" onClick={() => handleDelete(u._id)} aria-label={`Delete ${u.username}`} className="danger"><MdDelete /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Responsive card view for narrow screens */}
            <div className="cards" aria-hidden={!isNarrow ? 'true' : 'false'}>
              {isNarrow && filtered.map(u => (
                <div className="card" key={`card-${u._id}`}>
                  <div className="meta">
                    <div>
                      <div className="mono">{u.username}</div>
                      <div style={{ fontSize: '0.95rem' }}>{u.name || '-'}</div>
                      <div style={{ color: 'var(--textColorMuted, rgba(0,0,0,0.6))' }}>{u.email}</div>
                    </div>
                    <div>
                      <div style={{ textAlign: 'right' }}>{u.adminRole}</div>
                      <div style={{ marginTop: 8 }} className="actions">
                        <button onClick={() => openEdit(u)} title="Edit"><MdEdit /></button>
                        <button onClick={() => handleDelete(u._id)} title="Delete" className="danger"><MdDelete /></button>
                      </div>
                    </div>
                  </div>
                  <div className="chipRow">
                    {Object.entries(u.adminPermissions || {}).filter(([k,v]) => v).map(([k]) => (
                      <span key={k} className="chip">{k.replace(/([A-Z])/g, ' $1')}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {showModal && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label={editing ? 'Edit admin account' : 'Create admin account'}>
          <form className="modal" onSubmit={handleSave} ref={modalRef}>
            <div className="modalHeader">
              <h3>{editing ? 'Edit Admin Account' : 'Create Admin Account'}</h3>
              <button type="button" className="closeBtn" onClick={() => setShowModal(false)} aria-label="Close dialog"><MdClose /></button>
            </div>

            {formError && (
              <div className="formError" style={{ padding: '12px 18px', background: 'rgba(220,38,38,0.1)', color: '#dc2626', borderBottom: '1px solid rgba(220,38,38,0.2)' }}>
                {formError}
              </div>
            )}

            <div className="modalBody">
              {!editing && (
                <label className="formRow">
                  <span>Username</span>
                  <input required value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                </label>
              )}

              <label className="formRow">
                <span>Name</span>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </label>

              <label className="formRow">
                <span>Email</span>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </label>

              {!editing && (
                <label className="formRow">
                  <span>Password</span>
                  <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                </label>
              )}

              <label className="formRow">
                <span>Role</span>
                <select value={form.adminRole} onChange={e => setForm({...form, adminRole: e.target.value})}>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="editor">Editor</option>
                  <option value="super">Super Admin</option>
                </select>
              </label>

              <div className="formRow permissions" style={{ gridColumn: !editing ? 'span 2' : 'span 2' }}>
                <span>Permissions</span>
                <div className="grid">
                  {Object.entries(DEFAULT_PERMISSIONS).map(([key]) => (
                    <label key={key} className="permissionItem">
                      <input
                        type="checkbox"
                        checked={!!form.adminPermissions[key]}
                        onChange={e => setForm({
                          ...form,
                          adminPermissions: { ...form.adminPermissions, [key]: e.target.checked }
                        })}
                      />
                      <span className="permLabel">{key.replace(/([A-Z])/g, ' $1')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button type="button" className="btn" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Savingâ€¦' : (editing ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminAccounts;
