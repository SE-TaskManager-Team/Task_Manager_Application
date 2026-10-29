import React, { useState, useEffect, useCallback } from 'react';
import { StatusBadge, PriorityBadge, OverdueBadge, formatDeadline } from './TaskBadges';
import { taskService } from '../../services/taskService';

export function TaskDetailsModal({
  isOpen,
  onClose,
  task,
  isLeader = false,
  isAssignee = false,
  memberNames = {},
  currentUserId,
  currentUser,
  token,
  onOpenStatus,
  onOpenEdit,
  onOpenAssign,
  onOpenDelete
}) {
  const [comments, setComments] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const loadComments = useCallback(async () => {
    if (!task?._id) return;
    setIsLoadingComments(true);
    setCommentsError(null);
    try {
      const data = await taskService.getTaskComments(task._id, token);
      const list = Array.isArray(data?.comments)
        ? data.comments
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setComments(list);
    } catch (err) {
      setCommentsError(err.message || 'Failed to load comments.');
    } finally {
      setIsLoadingComments(false);
    }
  }, [task?._id, token]);

  useEffect(() => {
    if (isOpen && task?._id) {
      setNewCommentText('');
      setSubmitError(null);
      setSubmitSuccess(null);
      loadComments();
    } else {
      setComments([]);
      setCommentsError(null);
    }
  }, [isOpen, task?._id, loadComments]);

  if (!isOpen || !task) return null;

  const canComment = currentUser
    ? (isLeader || isAssignee || currentUser.role !== 'admin')
    : true;

  let assigneeDisplay = 'Unassigned';
  if (task.assigneeId) {
    const idStr = String(task.assigneeId);
    if (currentUserId && idStr === String(currentUserId)) {
      assigneeDisplay = 'Assigned to You';
    } else {
      assigneeDisplay = memberNames[idStr] || `Member (${idStr.slice(-6)})`;
    }
  }

  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleString();
    } catch (_e) {
      return String(iso);
    }
  };

  const handleAddComment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = newCommentText.trim();
    if (!trimmed) {
      setSubmitError('Comment cannot be empty.');
      return;
    }

    setIsSubmittingComment(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const data = await taskService.addComment(task._id, { text: trimmed }, token);
      const newComment = data?.comment || data;
      setComments((prev) => [...prev, newComment]);
      setNewCommentText('');
      setSubmitSuccess('Comment added successfully.');
    } catch (err) {
      setSubmitError(err.message || 'Failed to add comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="task-details-modal">
      <div className="modal-content modal-lg">
        <div className="modal-header">
          <div className="modal-title-with-badges">
            <h3>{task.title}</h3>
            <div className="badge-row">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <OverdueBadge isOverdue={task.isOverdue} />
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="task-detail-section">
            <h4>Description</h4>
            <div className="task-description-box" data-testid="task-detail-description">
              {task.description ? (
                <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>
              ) : (
                <p className="text-muted italic">No description provided.</p>
              )}
            </div>
          </div>

          <div className="task-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Deadline:</span>
              <span className="detail-value" data-testid="task-detail-deadline">
                {formatDeadline(task.deadline)}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Assignee:</span>
              <span className="detail-value" data-testid="task-detail-assignee">
                {assigneeDisplay}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className="detail-value">
                <StatusBadge status={task.status} />
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Priority:</span>
              <span className="detail-value">
                <PriorityBadge priority={task.priority} />
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Project ID:</span>
              <span className="detail-value code">{String(task.projectId)}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Created By:</span>
              <span className="detail-value code">{String(task.createdById)}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Created At:</span>
              <span className="detail-value">{formatDate(task.createdAt)}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Last Updated:</span>
              <span className="detail-value">{formatDate(task.updatedAt)}</span>
            </div>
          </div>

          {/* Comments Section */}
          <div className="task-detail-section comments-section" data-testid="task-comments-section">
            <h4>Comments</h4>

            {commentsError && (
              <div className="alert alert-error" role="alert" data-testid="comments-load-error">
                {commentsError}
                <button
                  type="button"
                  className="btn-link"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={loadComments}
                >
                  Retry
                </button>
              </div>
            )}

            {submitSuccess && (
              <div className="alert alert-success" role="status" data-testid="comment-success-alert">
                {submitSuccess}
                <button
                  type="button"
                  className="btn-close-sm"
                  onClick={() => setSubmitSuccess(null)}
                >
                  ✕
                </button>
              </div>
            )}

            {submitError && (
              <div className="alert alert-error" role="alert" data-testid="comment-submit-error">
                {submitError}
                <button
                  type="button"
                  className="btn-close-sm"
                  onClick={() => setSubmitError(null)}
                >
                  ✕
                </button>
              </div>
            )}

            {isLoadingComments ? (
              <div className="comments-loading" data-testid="comments-loading">
                <span className="spinner-sm" /> Loading comments...
              </div>
            ) : comments.length === 0 ? (
              <p className="text-muted italic no-comments" data-testid="no-comments-msg">
                No comments yet.
              </p>
            ) : (
              <div className="comments-list" data-testid="comments-list">
                {comments.map((comment, index) => {
                  const authorObj = comment.authorId;
                  let authorName = 'Unknown User';
                  if (typeof authorObj === 'object' && authorObj?.name) {
                    authorName = authorObj.name;
                  } else if (memberNames[String(authorObj)]) {
                    authorName = memberNames[String(authorObj)];
                  } else if (authorObj && currentUserId && String(authorObj) === String(currentUserId)) {
                    authorName = currentUser?.name || 'You';
                  } else if (typeof authorObj === 'string') {
                    authorName = `User (${authorObj.slice(-6)})`;
                  }
                  const commentId = comment._id || `temp-${index}`;
                  return (
                    <div
                      key={commentId}
                      className="comment-item"
                      data-testid={`comment-item-${commentId}`}
                    >
                      <div className="comment-header">
                        <span className="comment-author" data-testid="comment-author">
                          {authorName}
                        </span>
                        <span className="comment-timestamp text-muted" data-testid="comment-timestamp">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <div className="comment-body" data-testid="comment-body">
                        {comment.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canComment && (
              <form onSubmit={handleAddComment} className="comment-form" data-testid="comment-form">
                <div className="form-group">
                  <label htmlFor="task-comment-input" className="detail-label">
                    Add a Comment
                  </label>
                  <textarea
                    id="task-comment-input"
                    className="form-input comment-textarea"
                    placeholder="Write a comment..."
                    rows={3}
                    value={newCommentText}
                    onChange={(e) => {
                      setNewCommentText(e.target.value);
                      if (submitError) setSubmitError(null);
                    }}
                    data-testid="comment-input"
                    disabled={isSubmittingComment}
                    maxLength={2000}
                  />
                </div>
                <div className="comment-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmittingComment}
                    data-testid="add-comment-btn"
                  >
                    {isSubmittingComment ? 'Posting...' : 'Add Comment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-actions-left">
            {isLeader && (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    onClose();
                    onOpenEdit(task);
                  }}
                  data-testid="detail-edit-btn"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    onClose();
                    onOpenAssign(task);
                  }}
                  data-testid="detail-assign-btn"
                >
                  👤 Assign
                </button>
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => {
                    onClose();
                    onOpenDelete(task);
                  }}
                  data-testid="detail-delete-btn"
                >
                  🗑️ Delete
                </button>
              </>
            )}

            {(isLeader || isAssignee) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose();
                  onOpenStatus(task);
                }}
                data-testid="detail-status-btn"
              >
                🔄 Update Status
              </button>
            )}
          </div>

          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
