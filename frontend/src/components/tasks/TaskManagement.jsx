import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { taskService } from '../../services/taskService';
import { projectService } from '../../services/projectService';
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
import { ProjectMembersModal } from '../projects/ProjectMembersModal';

export function TaskManagement({
  projectId,
  project,
  currentUser,
  token,
  memberNames = {},
  onProjectUpdated,
  allUsers = []
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
  const [projectProgress, setProjectProgress] = useState(null);

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
  const [isMembersOpen, setIsMembersOpen] = useState(false);
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

  // Load overall project progress from API (SRS TM-F-015)
  const fetchProgress = useCallback(async () => {
    if (!projectId || !token) return;
    try {
      const data = await projectService.getProjectProgress(projectId, token);
      setProjectProgress(data);
    } catch (_err) {
      // Graceful fallback to tasks-based calculation
    }
  }, [projectId, token]);

  useEffect(() => {
    setProjectProgress(null);
  }, [projectId]);

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
      fetchProgress();
    }
  }, [fetchTasks, fetchProgress, activeTab]);

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

  // Project progress indicator (SRS TM-F-015)
  const progressInfo = useMemo(() => {
    if (projectProgress && typeof projectProgress.progress === 'number') {
      const total = projectProgress.totalTasks ?? 0;
      const completed = projectProgress.completedTasks ?? 0;
      const pct = total > 0 ? Math.round((completed * 100) / total) : 0;
      return {
        progress: typeof projectProgress.progress === 'number' ? projectProgress.progress : pct,
        totalTasks: total,
        completedTasks: completed
      };
    }

    // Fallback: calculate from tasks belonging to the selected project
    const projectTasks = tasks.filter(
      (t) => !t.projectId || String(t.projectId) === String(projectId)
    );
    const total = projectTasks.length;
    const completed = projectTasks.filter((t) => t.status === 'completed').length;
    const pct = total > 0 ? Math.round((completed * 100) / total) : 0;

    return {
      progress: pct,
      totalTasks: total,
      completedTasks: completed
    };
  }, [projectProgress, tasks, projectId]);

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
      fetchProgress();
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
      fetchProgress();
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
      fetchProgress();
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
      fetchProgress();
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
      fetchProgress();
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
      fetchProgress();
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
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setModalError(null);
                  setIsMembersOpen(true);
                }}
                data-testid="btn-manage-members"
              >
                👥 Members ({memberIds.length})
              </button>
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
            </>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              fetchTasks();
              fetchProgress();
            }}
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
          {/* Overall Project Progress (SRS TM-F-015) */}
          <div className="project-progress-container" data-testid="project-progress-container">
            <div className="project-progress-header">
              <div className="project-progress-title-wrap">
                <span className="project-progress-title">Project Progress</span>
                <span className="project-progress-details text-muted" data-testid="project-progress-details">
                  {progressInfo.completedTasks} of {progressInfo.totalTasks} tasks completed
                </span>
              </div>
              <span className="project-progress-percentage" data-testid="project-progress-percentage">
                {progressInfo.progress}%
              </span>
            </div>
            <div
              className="progress-bar-track"
              role="progressbar"
              aria-valuenow={progressInfo.progress}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Project overall progress"
              data-testid="project-progress-bar"
            >
              <div
                className="progress-bar-fill"
                style={{ width: `${progressInfo.progress}%` }}
                data-testid="project-progress-fill"
              />
            </div>
          </div>

          {/* Summary Metric Cards */}
          <div className="summary-cards-grid" data-testid="task-summary-cards">
            <div className="metric-card metric-progress" data-testid="metric-progress-card">
              <span className="metric-label">Progress</span>
              <span className="metric-value" data-testid="metric-progress-value">{progressInfo.progress}%</span>
            </div>
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
        currentUser={currentUser}
        token={token}
            memberIds={memberIds}
            memberNames={memberNames}
          />

          {/* Task Card List */}
          <TaskList
            tasks={tasks}
            isLoading={isLoading}
            error={error}
            currentUserId={currentUser?._id}
        currentUser={currentUser}
        token={token}
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
        currentUser={currentUser}
        token={token}
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

      <ProjectMembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        projectId={projectId}
        project={project}
        token={token}
        memberNames={memberNames}
        onProjectUpdated={onProjectUpdated}
        currentUser={currentUser}
        allUsers={allUsers}
      />
    </div>
  );
}
