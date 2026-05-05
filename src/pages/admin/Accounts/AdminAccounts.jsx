import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdClose } from 'react-icons/md';
import './adminAccounts.scss';

const DEFAULT_PERMISSIONS = {
  canManageUsers: false,
  canManageEvents: false,
  canAccessUserMonitoring: false,
  canAccessAnalytics: false,
  canManageSettings: false
};

const API = process.env.REACT_APP_API_URL || '';

const parseJSONorThrow = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text ? text.slice(0, 200).replace(/\s+/g, ' ') : '';
    throw new Error(`Unexpected non-JSON response (status ${res.status}): ${snippet}`);
  }
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
    adminOrganization: null,
    adminPermissions: { ...DEFAULT_PERMISSIONS }
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const modalRef = useRef(null);
  const searchRef = useRef(null);

  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
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
      const response = await fetch(`${API}/api/admin/accounts`, {
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
        const body = await parseJSONorThrow(response).catch(err => { throw new Error(err.message); });
        throw new Error(body.message || `Failed to fetch accounts (status ${response.status})`);
      }

      const data = await parseJSONorThrow(response);
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
    return list.filter(u => ((u.username || '') + (u.email || '') + (u.name || '')).toLowerCase().includes(q));
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
      adminOrganization: null,
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
      adminOrganization: user.adminOrganization || null,
      adminPermissions: { ...DEFAULT_PERMISSIONS, ...(user.adminPermissions || {}) }
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setFormError(null);

    if (!form.username.trim() && !editing) {
      setFormError('Username is required for new accounts.');
      return;
    }
    if (!form.email.trim() || !form.name.trim()) {
      setFormError('Email and name are required.');
      return;
    }
    if (!editing && !form.password.trim()) {
      setFormError('Password is required for new accounts.');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken') || '';
      const url = editing ? `${API}/api/admin/accounts/${editing._id}` : `${API}/api/admin/accounts`;
      const method = editing ? 'PUT' : 'POST';

      const body = {
        email: form.email,
        name: form.name,
        adminRole: form.adminRole,
        adminOrganization: form.adminOrganization,
        adminPermissions: form.adminPermissions
      };

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
        if (response.status === 401) {
          navigate('/admin/login');
          return;
        }
        const errBody = await parseJSONorThrow(response).catch(err => { throw new Error(err.message); });
        throw new Error(errBody.message || `Failed to ${editing ? 'update' : 'create'} account`);
      }

      const savedAdmin = await parseJSONorThrow(response);
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
    const userToDelete = list.find(u => u._id === id);
    
    // Prevent deletion of superadmin accounts
    if (userToDelete?.adminRole === 'super') {
      alert('Cannot delete superadmin account. This account is protected and cannot be removed.');
      return;
    }
    
    if (!window.confirm('Delete this admin account? This will remove their admin privileges.')) return;

    try {
      const token = localStorage.getItem('adminToken') || '';
      const response = await fetch(`${API}/api/admin/accounts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/admin/login');
          return;
        }
        const errBody = await parseJSONorThrow(response).catch(err => { throw new Error(err.message); });
        throw new Error(errBody.message || 'Failed to delete account');
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
          Access denied — Super admin role required.
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
            {query && <button className="clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
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
          <div className="muted">Loading admin accounts…</div>
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
                    <th>Organization</th>
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
                      <td>{u.adminOrganization || 'All Organizations'}</td>
                      <td className="perms">
                        {Object.entries(u.adminPermissions || {}).filter(([k,v]) => v).map(([k]) => (
                          <span key={k} className="chip" title={k}>{k.replace(/([A-Z])/g, ' $1')}</span>
                        ))}
                      </td>
                      <td className="actions">
                        {u.adminRole !== 'super' ? (
                          <button title="Edit" onClick={() => openEdit(u)} aria-label={`Edit ${u.username}`}><MdEdit /></button>
                        ) : (
                          <button 
                            title="Cannot edit superadmin account" 
                            disabled 
                            style={{ opacity: 0.3, cursor: 'not-allowed' }}
                            aria-label="Superadmin account protected"
                          >
                            <MdEdit />
                          </button>
                        )}
                        {u.adminRole !== 'super' ? (
                          <button title="Delete" onClick={() => handleDelete(u._id)} aria-label={`Delete ${u.username}`} className="danger"><MdDelete /></button>
                        ) : (
                          <button 
                            title="Cannot delete superadmin account" 
                            disabled 
                            style={{ opacity: 0.3, cursor: 'not-allowed' }}
                            aria-label="Superadmin account protected"
                          >
                            <MdDelete />
                          </button>
                        )}
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
                        {u.adminRole !== 'super' ? (
                          <button onClick={() => openEdit(u)} title="Edit"><MdEdit /></button>
                        ) : (
                          <button 
                            title="Cannot edit superadmin" 
                            disabled 
                            style={{ opacity: 0.3, cursor: 'not-allowed' }}
                          >
                            <MdEdit />
                          </button>
                        )}
                        {u.adminRole !== 'super' ? (
                          <button onClick={() => handleDelete(u._id)} title="Delete" className="danger"><MdDelete /></button>
                        ) : (
                          <button 
                            title="Cannot delete superadmin" 
                            disabled 
                            style={{ opacity: 0.3, cursor: 'not-allowed' }}
                          >
                            <MdDelete />
                          </button>
                        )}
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

              <label className="formRow">
                <span>Organization</span>
                <select value={form.adminOrganization || ''} onChange={e => setForm({...form, adminOrganization: e.target.value || null})}>
                  <option value="">All Organizations (Default)</option>
                  <option value="UTPC">UTPC</option>
                  <option value="CAST">CAST</option>
                  <option value="CULTURA">CULTURA</option>
                  <option value="UMAK Jammers">UMAK Jammers</option>
                  <option value="UMAK Chorale">UMAK Chorale</option>
                  <option value="UMAK Dance Extreme">UMAK Dance Extreme</option>
                  <option value="UMAK Siglahi">UMAK Siglahi</option>
                  <option value="UMAK Brass Band">UMAK Brass Band</option>
                  <option value="admin@all">Super Admin (All Access)</option>
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
                {saving ? 'Saving…' : (editing ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminAccounts;