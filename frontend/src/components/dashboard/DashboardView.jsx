import React, { useEffect, useState, useCallback } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { TaskPriorityBadge, TaskStatusBadge } from '../tasks/TaskBadges';

const formatDate = (dateStr) => {
  if (!dateStr) return 'No deadline';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

const isTaskOverdue = (task) => {
  if (!task.deadline || task.status === 'completed') return false;
  return new Date(task.deadline) < new Date();
};

export function DashboardView({
  currentUser,
  token,
  onNavigateToTasks,
  onCreateProject
}) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await dashboardService.getDashboardData(token);
      setDashboardData(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="task-loading-state" data-testid="dashboard-loading">
        <div className="spinner" />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-alert app-alert-error" role="alert" data-testid="dashboard-error">
        <span>{error}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          style={{ marginLeft: '1rem' }}
          data-testid="dashboard-retry-btn"
        >
          Retry
        </button>
      </div>
    );
  }

  const role = dashboardData?.role || currentUser?.role || 'teamMember';
  const summary = dashboardData?.summary || {
    totalProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0,
    overdueTasks: 0,
    completionPercentage: 0
  };

  const projects = dashboardData?.projects || [];
  const upcomingTasks = dashboardData?.upcomingTasks || [];

  const roleLabels = {
    admin: 'Administrator',
    teamLeader: 'Team Leader',
    teamMember: 'Team Member'
  };

  const roleSubtitles = {
    admin: 'System-wide overview, user analytics, and authorized projects',
    teamLeader: 'Project oversight, progress tracking, and team deliverables',
    teamMember: 'Your accessible projects, assigned tasks, and deadlines'
  };

  return (
    <div className="dashboard-root" data-testid="user-dashboard">
      {/* Header Banner */}
      <header className="dashboard-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 className="task-mgmt-title" data-testid="dashboard-title">Dashboard</h1>
            <span className="badge badge-info" data-testid="dashboard-role-badge">
              {roleLabels[role] || role}
            </span>
          </div>
          <p className="dashboard-subtitle">
            Welcome back, <strong>{currentUser?.name || 'User'}</strong>. {roleSubtitles[role] || ''}
          </p>
        </div>

        <div className="task-mgmt-header-actions">
          {role === 'teamLeader' && onCreateProject && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreateProject}
              data-testid="dashboard-create-project-btn"
            >
              ＋ New Project
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigateToTasks && onNavigateToTasks()}
            data-testid="btn-go-to-tasks"
          >
            Go to Task Management →
          </button>
        </div>
      </header>

      {/* Summary Metrics Bar */}
      <section className="dashboard-section" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="dashboard-section-title">
          {role === 'teamMember' ? 'My Task Summary' : 'Overview & Task Counts'}
        </h2>

        <div className="summary-cards-grid">
          {role === 'admin' && (
            <>
              <div className="metric-card" data-testid="stat-total-users">
                <span className="metric-label">Total Users</span>
                <span className="metric-value">{summary.totalUsers ?? 0}</span>
              </div>
              <div className="metric-card metric-completed" data-testid="stat-active-users">
                <span className="metric-label">Active Users</span>
                <span className="metric-value">{summary.activeUsers ?? 0}</span>
              </div>
            </>
          )}

          <div className="metric-card" data-testid="stat-total-projects">
            <span className="metric-label">
              {role === 'teamMember' ? 'Accessible Projects' : 'Projects'}
            </span>
            <span className="metric-value">{summary.totalProjects ?? 0}</span>
          </div>

          <div className="metric-card" data-testid="stat-total-tasks">
            <span className="metric-label">
              {role === 'teamMember' ? 'My Assigned Tasks' : 'Total Tasks'}
            </span>
            <span className="metric-value">{summary.totalTasks ?? 0}</span>
          </div>

          <div className="metric-card metric-todo" data-testid="stat-todo-tasks">
            <span className="metric-label">To Do</span>
            <span className="metric-value">{summary.todoTasks ?? 0}</span>
          </div>

          <div className="metric-card metric-inprogress" data-testid="stat-inprogress-tasks">
            <span className="metric-label">In Progress</span>
            <span className="metric-value">{summary.inProgressTasks ?? 0}</span>
          </div>

          <div className="metric-card metric-completed" data-testid="stat-completed-tasks">
            <span className="metric-label">Completed</span>
            <span className="metric-value">{summary.completedTasks ?? 0}</span>
          </div>

          <div
            className={`metric-card ${summary.overdueTasks > 0 ? 'metric-overdue' : ''}`}
            data-testid="stat-overdue-tasks"
          >
            <span className="metric-label">Overdue</span>
            <span className="metric-value">{summary.overdueTasks ?? 0}</span>
          </div>

          <div className="metric-card" data-testid="stat-completion-rate">
            <span className="metric-label">Completion Rate</span>
            <span className="metric-value">{summary.completionPercentage ?? 0}%</span>
          </div>
        </div>
      </section>

      {/* Accessible Projects & Progress */}
      <section className="dashboard-section" aria-labelledby="projects-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="projects-heading" className="dashboard-section-title">
            Accessible Projects & Progress
          </h2>
          <span className="dashboard-count-badge">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="dashboard-empty-card" data-testid="dashboard-no-projects">
            <h3>No projects available</h3>
            <p>
              {role === 'teamLeader'
                ? 'You have not created any projects yet. Create your first project to start organizing tasks and tracking team progress.'
                : role === 'teamMember'
                ? 'You are not assigned to any projects yet. When a team leader adds you to a project, it will appear here.'
                : 'There are currently no projects in the system.'}
            </p>
            {role === 'teamLeader' && onCreateProject && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onCreateProject}
                  data-testid="create-project-btn"
                >
                  + Create Project
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="projects-progress-grid" data-testid="dashboard-projects-list">
            {projects.map((proj) => (
              <div
                key={proj.projectId}
                className="project-progress-card"
                data-testid={`project-card-${proj.projectId}`}
              >
                <div className="project-card-header">
                  <h3 className="project-card-title">{proj.name}</h3>
                  {proj.overdueTasks > 0 && (
                    <span className="badge badge-danger" title="Overdue tasks in project">
                      ⚠️ {proj.overdueTasks} Overdue
                    </span>
                  )}
                </div>

                {proj.description && (
                  <p className="project-card-desc">{proj.description}</p>
                )}

                <div className="project-card-meta">
                  <span>📅 Deadline: {formatDate(proj.deadline)}</span>
                  <span>
                    Tasks: <strong>{proj.completedTasks}</strong> / {proj.totalTasks} done
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="project-progress-container">
                  <div className="project-progress-label">
                    <span>Progress</span>
                    <strong>{proj.progress}%</strong>
                  </div>
                  <div className="progress-bar-bg" role="progressbar" aria-valuenow={proj.progress} aria-valuemin="0" aria-valuemax="100">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(0, proj.progress))}%` }}
                    />
                  </div>
                </div>

                <div className="project-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigateToTasks && onNavigateToTasks(proj.projectId)}
                    data-testid={`btn-view-project-${proj.projectId}`}
                  >
                    View Tasks →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Deadlines / Tasks Summary */}
      <section className="dashboard-section" aria-labelledby="deadlines-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="deadlines-heading" className="dashboard-section-title">
            Upcoming Deadlines & Deliverables
          </h2>
          <span className="dashboard-count-badge">
            {upcomingTasks.length} {upcomingTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {upcomingTasks.length === 0 ? (
          <div className="dashboard-empty-card" data-testid="dashboard-no-tasks">
            <p>No upcoming incomplete tasks or pending deadlines.</p>
          </div>
        ) : (
          <div className="upcoming-tasks-list" data-testid="dashboard-upcoming-tasks">
            {upcomingTasks.map((task) => {
              const overdue = isTaskOverdue(task);
              return (
                <div
                  key={task._id}
                  className={`upcoming-task-item ${overdue ? 'task-item-overdue' : ''}`}
                  data-testid={`upcoming-task-${task._id}`}
                >
                  <div className="upcoming-task-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong className="upcoming-task-title">{task.title}</strong>
                      <span className="upcoming-task-project">{task.projectName}</span>
                      <TaskPriorityBadge priority={task.priority} />
                      <TaskStatusBadge status={task.status} />
                      {overdue && (
                        <span className="badge badge-danger">Overdue</span>
                      )}
                    </div>
                  </div>

                  <div className="upcoming-task-aside">
                    <span className="upcoming-task-deadline">
                      📅 {formatDate(task.deadline)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigateToTasks && onNavigateToTasks(task.projectId)}
                      data-testid={`btn-view-task-${task._id}`}
                    >
                      Open Task →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
