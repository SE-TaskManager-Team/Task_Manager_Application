import React, { useState, useEffect, useCallback } from 'react';
import { taskService } from '../../services/taskService';
import { TaskList } from './TaskList';
import { Pagination } from './Pagination';
import { TaskDetailsModal } from './TaskDetailsModal';
import { TaskStatusModal } from './TaskStatusModal';

export function MyTasksView({ token, currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Modals state
  const [selectedTask, setSelectedTask] = useState(null);
  const [statusTask, setStatusTask] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchMyTasks = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await taskService.getMyTasks({ page, limit }, token);
      setTasks(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load personal tasks.');
    } finally {
      setIsLoading(false);
    }
  }, [token, page, limit]);

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  const handleQuickAdvance = async (taskId, nextStatus) => {
    setError(null);
    try {
      await taskService.updateTaskStatus(taskId, nextStatus, token);
      setFeedback(`Task status updated to ${nextStatus}.`);
      fetchMyTasks();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleStatusSubmit = async (newStatus) => {
    if (!statusTask) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await taskService.updateTaskStatus(statusTask._id, newStatus, token);
      setFeedback(`Task status updated to ${newStatus}.`);
      setStatusTask(null);
      fetchMyTasks();
    } catch (err) {
      setModalError(err.message || 'Failed to update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="my-tasks-container" data-testid="my-tasks-view">
      <div className="my-tasks-header">
        <div>
          <h2>My Assigned Tasks</h2>
          <p className="text-muted">
            All tasks currently assigned to you across projects.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={fetchMyTasks}
          disabled={isLoading}
        >
          🔄 Refresh
        </button>
      </div>

      {feedback && (
        <div className="alert alert-success" role="status">
          {feedback}
          <button type="button" className="btn-close-sm" onClick={() => setFeedback(null)}>
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        error={error}
        currentUserId={currentUser?._id}
        isLeader={false}
        onSelectTask={(task) => setSelectedTask(task)}
        onOpenStatus={(task) => {
          setStatusTask(task);
          setModalError(null);
        }}
        onQuickAdvanceStatus={handleQuickAdvance}
      />

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        onPageChange={(newPage) => setPage(newPage)}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
      />

      {/* Task Details Modal */}
      <TaskDetailsModal
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        isLeader={false}
        isAssignee={true}
        currentUserId={currentUser?._id}
        onOpenStatus={(task) => {
          setSelectedTask(null);
          setStatusTask(task);
          setModalError(null);
        }}
      />

      {/* Status Modal */}
      <TaskStatusModal
        isOpen={Boolean(statusTask)}
        onClose={() => setStatusTask(null)}
        onSubmit={handleStatusSubmit}
        task={statusTask}
        isLeader={false}
        isAssignee={true}
        isSubmitting={isSubmitting}
        error={modalError}
      />
    </div>
  );
}
