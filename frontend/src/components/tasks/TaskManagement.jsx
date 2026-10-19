import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { taskService } from '../../services/taskService';
import { TaskList } from './TaskList';
import { TaskFilters } from './TaskFilters';
import { Pagination } from './Pagination';
import { TaskCreateModal } from './TaskCreateModal';
import { TaskEditModal } from './TaskEditModal';
import { TaskAssignModal } from './TaskAssignModal';
import { TaskStatusModal } from './TaskStatusModal';
import { TaskDeleteModal } from './TaskDeleteModal';
import { TaskDetailsModal } from './TaskDetailsModal';
import { MyTasksView } from './MyTasksView';

export function TaskManagement({
  projectId,
  project,
  currentUser,
  token,
  memberNames = {}
}) {
  const [activeTab, setActiveTab] = useState('project'); // 'project' | 'my'
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    deadline: '',
    overdue: '',
    assigneeId: '',
    sortBy: '',
    order: ''
  });

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [assigningTask, setAssigningTask] = useState(null);
  const [statusTask, setStatusTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Determine if current user is the Team Leader of this project
  const isLeader = useMemo(() => {
    if (!currentUser || !project) return false;
    return (
      currentUser.role === 'teamLeader' &&
      String(project.teamLeaderId) === String(currentUser._id)
    );
  }, [currentUser, project]);

  // Project member list
  const memberIds = useMemo(() => {
    return Array.isArray(project?.memberIds) ? project.memberIds : [];
  }, [project]);

  // Load project tasks from API
  const fetchTasks = useCallback(async () => {
    if (!projectId || !token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await taskService.getProjectTasks(
        projectId,
        {
          page,
          limit,
          ...filters
        },
        token
      );

      setTasks(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load project tasks.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token, page, limit, filters]);

  useEffect(() => {
    if (activeTab === 'project') {
      fetchTasks();
    }
  }, [fetchTasks, activeTab]);

  // Task summary metrics
  const summary = useMemo(() => {
    const counts = { total: tasks.length, todo: 0, inProgress: 0, completed: 0, overdue: 0 };
    tasks.forEach((t) => {
      if (t.status === 'todo') counts.todo++;
      if (t.status === 'inProgress') counts.inProgress++;
      if (t.status === 'completed') counts.completed++;
      if (t.isOverdue) counts.overdue++;
    });
    return counts;
  }, [tasks]);

  // Actions
  const handleCreateSubmit = async (taskData) => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      await taskService.createTask(projectId, taskData, token);
      setFeedback('Task created successfully.');
      setIsCreateOpen(false);
      setPage(1);
      fetchTasks();
    } catch (err) {
      setModalError(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (taskData) => {
    if (!editingTask) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await taskService.updateTask(editingTask._id, taskData, token);
      setFeedback('Task details updated successfully.');
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      setModalError(err.message || 'Failed to update task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignSubmit = async (assigneeId) => {
    if (!assigningTask) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await taskService.assignTask(assigningTask._id, assigneeId, token);
      const actionText = assigneeId ? 'assigned' : 'unassigned';
      setFeedback(`Task successfully ${actionText}.`);
      setAssigningTask(null);
      fetchTasks();
    } catch (err) {
      setModalError(err.message || 'Failed to update task assignment.');
    } finally {
      setIsSubmitting(false);
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
      fetchTasks();
    } catch (err) {
      setModalError(err.message || 'Failed to update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdvance = async (taskId, nextStatus) => {
    setError(null);
    try {
      await taskService.updateTaskStatus(taskId, nextStatus, token);
      setFeedback(`Task status updated to ${nextStatus}.`);
      fetchTasks();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTask) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await taskService.deleteTask(deletingTask._id, token);
      setFeedback('Task deleted successfully.');
      setDeletingTask(null);
      fetchTasks();
    } catch (err) {
      setModalError(err.message || 'Failed to delete task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      status: '',
      priority: '',
      deadline: '',
      overdue: '',
      assigneeId: '',
      sortBy: '',
      order: ''
    });
    setPage(1);
  };

  return (
    <div className="task-management-root" data-testid="task-management">
      {/* Top Header */}
      <div className="task-mgmt-header">
        <div>
          <h1 className="task-mgmt-title">
            {project?.name ? `${project.name} – Tasks` : 'Task Management'}
          </h1>
          <p className="text-muted">
            Manage, assign, and track project tasks with status transitions.
          </p>
        </div>

        <div className="task-mgmt-header-actions">
          {/* Tab Navigation */}
          <div className="tab-group" role="tablist">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'project' ? 'active' : ''}`}
              onClick={() => setActiveTab('project')}
              data-testid="tab-project-tasks"
            >
              Project Tasks
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
              onClick={() => setActiveTab('my')}
              data-testid="tab-my-tasks"
            >
              My Tasks
            </button>
          </div>

          {activeTab === 'project' && isLeader && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setModalError(null);
                setIsCreateOpen(true);
              }}
              data-testid="btn-create-task"
            >
              ＋ New Task
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchTasks}
            disabled={isLoading}
            title="Refresh tasks"
            data-testid="btn-refresh-tasks"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Success Notification Feedback */}
      {feedback && (
        <div className="alert alert-success" role="status" data-testid="feedback-alert">
          <span>✓ {feedback}</span>
          <button
            type="button"
            className="btn-close-sm"
            onClick={() => setFeedback(null)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'my' ? (
        <MyTasksView token={token} currentUser={currentUser} />
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="summary-cards-grid" data-testid="task-summary-cards">
            <div className="metric-card">
              <span className="metric-label">Total in Page</span>
              <span className="metric-value">{summary.total}</span>
            </div>
            <div className="metric-card metric-todo">
              <span className="metric-label">To Do</span>
              <span className="metric-value">{summary.todo}</span>
            </div>
            <div className="metric-card metric-inprogress">
              <span className="metric-label">In Progress</span>
              <span className="metric-value">{summary.inProgress}</span>
            </div>
            <div className="metric-card metric-completed">
              <span className="metric-label">Completed</span>
              <span className="metric-value">{summary.completed}</span>
            </div>
            <div className={`metric-card ${summary.overdue > 0 ? 'metric-overdue' : ''}`}>
              <span className="metric-label">Overdue</span>
              <span className="metric-value">{summary.overdue}</span>
            </div>
          </div>

          {/* Filter and Sorting Controls */}
          <TaskFilters
            filters={filters}
            onChange={(newFilters) => {
              setFilters(newFilters);
              setPage(1);
            }}
            onReset={handleResetFilters}
            currentUserId={currentUser?._id}
            memberIds={memberIds}
            memberNames={memberNames}
          />

          {/* Task Card List */}
          <TaskList
            tasks={tasks}
            isLoading={isLoading}
            error={error}
            currentUserId={currentUser?._id}
            isLeader={isLeader}
            memberNames={memberNames}
            onSelectTask={(task) => setSelectedTask(task)}
            onOpenStatus={(task) => {
              setStatusTask(task);
              setModalError(null);
            }}
            onOpenEdit={(task) => {
              setEditingTask(task);
              setModalError(null);
            }}
            onOpenAssign={(task) => {
              setAssigningTask(task);
              setModalError(null);
            }}
            onOpenDelete={(task) => {
              setDeletingTask(task);
              setModalError(null);
            }}
            onQuickAdvanceStatus={handleQuickAdvance}
          />

          {/* Pagination Controls */}
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
        </>
      )}

      {/* Modals */}
      <TaskCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        memberIds={memberIds}
        memberNames={memberNames}
        isSubmitting={isSubmitting}
        error={modalError}
      />

      <TaskEditModal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSubmit={handleEditSubmit}
        task={editingTask}
        isSubmitting={isSubmitting}
        error={modalError}
      />

      <TaskAssignModal
        isOpen={Boolean(assigningTask)}
        onClose={() => setAssigningTask(null)}
        onSubmit={handleAssignSubmit}
        task={assigningTask}
        memberIds={memberIds}
        memberNames={memberNames}
        isSubmitting={isSubmitting}
        error={modalError}
      />

      <TaskStatusModal
        isOpen={Boolean(statusTask)}
        onClose={() => setStatusTask(null)}
        onSubmit={handleStatusSubmit}
        task={statusTask}
        isLeader={isLeader}
        isAssignee={
          currentUser &&
          statusTask &&
          statusTask.assigneeId &&
          String(statusTask.assigneeId) === String(currentUser._id)
        }
        isSubmitting={isSubmitting}
        error={modalError}
      />

      <TaskDeleteModal
        isOpen={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleDeleteConfirm}
        task={deletingTask}
        isSubmitting={isSubmitting}
        error={modalError}
      />

      <TaskDetailsModal
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        isLeader={isLeader}
        isAssignee={
          currentUser &&
          selectedTask &&
          selectedTask.assigneeId &&
          String(selectedTask.assigneeId) === String(currentUser._id)
        }
        memberNames={memberNames}
        currentUserId={currentUser?._id}
        onOpenStatus={(task) => {
          setSelectedTask(null);
          setStatusTask(task);
          setModalError(null);
        }}
        onOpenEdit={(task) => {
          setSelectedTask(null);
          setEditingTask(task);
          setModalError(null);
        }}
        onOpenAssign={(task) => {
          setSelectedTask(null);
          setAssigningTask(task);
          setModalError(null);
        }}
        onOpenDelete={(task) => {
          setSelectedTask(null);
          setDeletingTask(task);
          setModalError(null);
        }}
      />
    </div>
  );
}
