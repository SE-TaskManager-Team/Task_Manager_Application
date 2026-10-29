import React, { useCallback, useEffect, useState } from 'react';
import { userService } from '../../services/userService';
import { UserCreateModal } from './UserCreateModal';

// These values intentionally match the existing backend User schema.
const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'teamLeader', label: 'Team leader' },
  { value: 'teamMember', label: 'Team member' }
];

export function AdminUserManagement({ token, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await userService.getUsers(token);
      setUsers(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreateUser = async (userData) => {
    setIsCreating(true);
    setCreateError('');
    try {
      const data = await userService.createUser(token, userData);
      setIsCreateOpen(false);
      setMessage(`User ${data.user?.name || userData.name} created successfully.`);
      await loadUsers();
    } catch (err) {
      setCreateError(err.message || 'Could not create user.');
    } finally {
      setIsCreating(false);
    }
  };

  const changeRole = async (user, role) => {
    if (role === user.role) return;
    setBusyId(String(user._id));
    setError('');
    setMessage('');
    try {
      const data = await userService.updateUser(token, user._id, { role });
      setUsers((current) => current.map((item) => String(item._id) === String(user._id) ? data.user : item));
      setMessage(`Updated role for ${user.name}.`);
    } catch (err) {
      setError(err.message || 'Could not update the role.');
      await loadUsers();
    } finally {
      setBusyId('');
    }
  };

  const deactivate = async (user) => {
    if (!window.confirm(`Deactivate ${user.name}'s account? They will no longer be able to sign in.`)) return;
    setBusyId(String(user._id));
    setError('');
    setMessage('');
    try {
      const data = await userService.deactivateUser(token, user._id);
      setUsers((current) => current.map((item) => String(item._id) === String(user._id) ? data.user : item));
      setMessage(`Deactivated ${user.name}.`);
    } catch (err) {
      setError(err.message || 'Could not deactivate the account.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="admin-users" aria-labelledby="admin-users-title">
      <div className="admin-users-heading">
        <div>
          <h2 id="admin-users-title">User and role management</h2>
          <p>Only administrators can change roles or deactivate accounts.</p>
        </div>
        <div className="admin-users-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setCreateError('');
              setIsCreateOpen(true);
            }}
            data-testid="create-user-btn"
          >
            + Create User
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadUsers} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="admin-message admin-message-error" role="alert">{error}</p>}
      {message && <p className="admin-message admin-message-success" role="status">{message}</p>}

      {loading ? <p>Loading users…</p> : users.length === 0 ? <p>No users found.</p> : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const isSelf = String(user._id) === String(currentUser?._id);
                const busy = busyId === String(user._id);
                return (
                  <tr key={user._id}>
                    <td>{user.name}{isSelf ? ' (you)' : ''}</td>
                    <td>{user.email}</td>
                    <td>
                      <select aria-label={`Role for ${user.name}`} value={user.role} disabled={busy || isSelf || !user.isActive} onChange={(event) => changeRole(user, event.target.value)}>
                        {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </td>
                    <td><span className={user.isActive ? 'admin-status-active' : 'admin-status-inactive'}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button type="button" className="admin-deactivate-button" aria-label={`Deactivate ${user.name}`} disabled={busy || isSelf || !user.isActive} onClick={() => deactivate(user)}>
                        {busy ? 'Saving…' : 'Deactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-users-note">Your backend roles are <code>admin</code>, <code>teamLeader</code>, and <code>teamMember</code>; public signup always creates a team member.</p>

      <UserCreateModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError('');
        }}
        onSubmit={handleCreateUser}
        isSubmitting={isCreating}
        error={createError}
        currentUser={currentUser}
      />
    </section>
  );
}
