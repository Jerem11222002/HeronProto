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
  const [list, setList] = useState([]); // placeholder data
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // null => create
  const [form, setForm] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    isAdmin: true,
    adminRole: 'admin',
    adminPermissions: { ...DEFAULT_PERMISSIONS }
  });

  const modalRef = useRef(null);
  const searchRef = useRef(null);

  // media query state to replace undefined `matchedMedia`
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 820px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 820px)');
    const handler = (e) => setIsNarrow(e.matches);
    // modern & fallback
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    // set initial
    setIsNarrow(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setList([
        { _id: '1', username: 'superadmin', email: 'superadmin@gmail.com', adminRole: 'super', adminPermissions: { ...DEFAULT_PERMISSIONS, canManageUsers: true, canManageEvents: true, canAccessAnalytics: true } },
        { _id: '2', username: 'eventmgr', email: 'events@umak.edu', adminRole: 'admin', adminPermissions: { ...DEFAULT_PERMISSIONS, canManageEvents: true } }
      ]);
      setLoading(false);
    }, 200);
  }, []);

  useEffect(() => {
    if (showModal) {
      // focus first input in modal
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
    if (editing) {
      setList(prev => prev.map(p => (p._id === editing._id ? { ...p, ...form } : p)));
    } else {
      setList(prev => [{ _id: Date.now().toString(), ...form }, ...prev]);
    }
    window.dispatchEvent(new CustomEvent('app:admin:accounts:changed', { detail: { action: editing ? 'updated' : 'created' } }));
    setShowModal(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this admin account?')) return;
    setList(prev => prev.filter(p => p._id !== id));
    window.dispatchEvent(new CustomEvent('app:admin:accounts:changed', { detail: { action: 'deleted', id } }));
  };

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

          {currentUser?.adminPermissions?.canManageUsers && (
            <button className="btn primary" onClick={openCreate} aria-label="Create admin account">
              <MdAdd /> Create
            </button>
          )}
        </div>
      </header>

      <section className="accountsList" aria-live="polite">
        {loading ? (
          <div className="muted">Loading admin accounts…</div>
        ) : filtered.length === 0 ? (
          <div className="emptyState">
            <div className="emptyTitle">No admin accounts found</div>
            <div className="emptySubtitle">Create a new admin account to get started.</div>
            {currentUser?.adminPermissions?.canManageUsers && <button className="btn primary" onClick={openCreate}>Create account</button>}
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
                        {Object.entries(u.adminPermissions || {}).filter(([k,v]) => v).map(([k]) => <span key={k} className="chip" title={k}>{k.replace(/([A-Z])/g, ' $1')}</span>)}
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

            {/* responsive cards for narrow screens */}
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
                    {Object.entries(u.adminPermissions || {}).filter(([k,v]) => v).map(([k]) => <span key={k} className="chip">{k.replace(/([A-Z])/g, ' $1')}</span>)}
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

            <div className="modalBody">
              <label className="formRow">
                <span>Username</span>
                <input required value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
              </label>

              <label className="formRow">
                <span>Name</span>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
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
                  <option value="super">Super Admin</option>
                </select>
              </label>

              <div className="formRow permissions">
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
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn primary">{editing ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminAccounts;