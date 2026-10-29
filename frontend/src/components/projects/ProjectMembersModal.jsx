import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { projectService } from '../../services/projectService';
import { userService } from '../../services/userService';

const getId = (v) => String(v?._id ?? v);

export function ProjectMembersModal({
  isOpen,
  onClose,
  projectId,
  project,
  token,
  memberNames = {},
  onProjectUpdated,
  currentUser = null,
  allUsers: propAllUsers = []
}) {
  const [users, setUsers] = useState(propAllUsers);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isLeader = useMemo(() => {
    if (!currentUser || !project) return true;
    return (
      currentUser.role === 'teamLeader' &&
      String(project.teamLeaderId) === String(currentUser._id)
    );
  }, [currentUser, project]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setIsLoadingUsers(true);
    try {
      const data = await userService.getUsers(token);
      const items = Array.isArray(data?.items) ? data.items : [];
      setUsers(items);
    } catch (_err) {
      // Non-critical: we can continue with what we have
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNotice(null);
      setSelectedUserId('');
      if (propAllUsers && propAllUsers.length > 0) {
        setUsers(propAllUsers);
      } else {
        loadUsers();
      }
    }
  }, [isOpen, propAllUsers, loadUsers]);

  const currentMemberIds = useMemo(() => {
    return Array.isArray(project?.memberIds)
      ? project.memberIds.map((m) => getId(m))
      : [];
  }, [project]);

  // Eligible users: active team members who are not currently members of this project
  const eligibleUsers = useMemo(() => {
    return users.filter((u) => {
      const uId = getId(u);
      return (
        u.role === 'teamMember' &&
        u.isActive !== false &&
        uId !== String(project?.teamLeaderId) &&
        !currentMemberIds.includes(uId)
      );
    });
  }, [users, project, currentMemberIds]);

  if (!isOpen) return null;

  const handleAddMember = async (e) => {
    e?.preventDefault();
    if (!selectedUserId || !projectId) return;

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const data = await projectService.addMember(projectId, selectedUserId, token);
      const updatedProject = data?.project;
      if (updatedProject && onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }
      setSelectedUserId('');
      setNotice('Member added to project successfully.');
    } catch (err) {
      setError(err.message || 'Failed to add member to project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!userId || !projectId) return;

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const data = await projectService.removeMember(projectId, userId, token);
      const updatedProject = data?.project;
      if (updatedProject && onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }
      setNotice('Member removed from project.');
    } catch (err) {
      setError(err.message || 'Failed to remove member from project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid="project-members-modal"
    >
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>Project Members – {project?.name || 'Project'}</h3>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="btn-close-members-modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              className="alert alert-error"
              role="alert"
              data-testid="members-modal-error"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              className="alert alert-success"
              role="status"
              data-testid="members-modal-success"
            >
              {notice}
            </div>
          )}

          {!isLeader && (
            <div
              className="alert alert-error"
              role="alert"
              data-testid="members-unauthorized"
            >
              Only the project team leader can manage its members.
            </div>
          )}

          {isLeader && (
            <>
              {/* Add Member Section */}
              <div
                className="add-member-section"
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  marginBottom: '1rem'
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Add Team Member</h4>
                <p className="text-muted" style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem' }}>
                  Assign registered active team members to this project so tasks can be assigned to them.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    id="member-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="form-input"
                    data-testid="select-member-to-add"
                    disabled={isSubmitting || isLoadingUsers || eligibleUsers.length === 0}
                    style={{ flex: 1, minWidth: '220px' }}
                  >
                    <option value="">
                      {isLoadingUsers
                        ? 'Loading registered team members…'
                        : eligibleUsers.length === 0
                          ? 'No eligible team members available to add'
                          : 'Select a team member to add…'}
                    </option>
                    {eligibleUsers.map((u) => (
                      <option key={getId(u)} value={getId(u)}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddMember}
                    disabled={!selectedUserId || isSubmitting}
                    data-testid="btn-confirm-add-member"
                  >
                    {isSubmitting ? 'Adding…' : 'Add Member'}
                  </button>
                </div>
              </div>

              {/* Current Members Section */}
              <div className="current-members-section">
                <h4 style={{ margin: '0 0 0.5rem 0' }}>
                  Current Project Members ({currentMemberIds.length})
                </h4>

                {currentMemberIds.length === 0 ? (
                  <p className="text-muted" data-testid="no-members-msg">
                    No team members added yet. Add active team members above so they can be assigned project tasks.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                    data-testid="project-members-list"
                  >
                    {currentMemberIds.map((mId) => {
                      const idStr = String(mId);
                      const userObj = users.find((u) => getId(u) === idStr);
                      const displayName =
                        userObj?.name || memberNames[idStr] || `Member (${idStr.slice(-4)})`;
                      const displayEmail = userObj?.email ? ` (${userObj.email})` : '';

                      return (
                        <li
                          key={idStr}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.6rem 0.8rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-surface)'
                          }}
                          data-testid={`member-row-${idStr}`}
                        >
                          <div>
                            <strong>{displayName}</strong>
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                              {displayEmail}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveMember(idStr)}
                            disabled={isSubmitting}
                            data-testid={`btn-remove-member-${idStr}`}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="btn-close-members"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
