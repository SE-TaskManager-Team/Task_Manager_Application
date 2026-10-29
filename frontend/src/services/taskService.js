/**
 * Task Service
 * Connects frontend UI to backend Task Management endpoints.
 * All requests adhere to the contract in docs/api-contract.md.
 */

const API_BASE = '/api';

/**
 * Parses and handles backend response envelope:
 * Success: { success: true, data: { ... } }
 * Error:   { success: false, error: { code: '...', message: '...' } }
 */
const handleResponse = async (response) => {
  let json;
  try {
    json = await response.json();
  } catch (_e) {
    const err = new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    err.status = response.status;
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  if (!response.ok || !json.success) {
    const message = json.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.code = json.error?.code || 'REQUEST_FAILED';
    err.status = response.status;
    throw err;
  }

  return json.data;
};

/**
 * Builds authorization headers if token is present
 */
const getHeaders = (token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const taskService = {
  /**
   * GET /api/projects/:projectId/tasks
   * List tasks for a project with filters, sorting, and pagination.
   */
  async getProjectTasks(projectId, params = {}, token) {
    const query = new URLSearchParams();
    if (params.page !== undefined && params.page !== '') query.set('page', params.page);
    if (params.limit !== undefined && params.limit !== '') query.set('limit', params.limit);
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.deadline) query.set('deadline', params.deadline);
    if (params.overdue !== undefined && params.overdue !== '') query.set('overdue', params.overdue);
    if (params.assigneeId !== undefined && params.assigneeId !== '') query.set('assigneeId', params.assigneeId);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.order) query.set('order', params.order);

    const qs = query.toString();
    const url = `${API_BASE}/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(token)
    });

    return handleResponse(res);
  },

  /**
   * GET /api/tasks/:id
   * Fetch single task details by ID.
   */
  async getTaskById(taskId, token) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  /**
   * GET /api/tasks/my
   * Fetch tasks assigned to the authenticated user across all projects.
   */
  async getMyTasks(params = {}, token) {
    const query = new URLSearchParams();
    if (params.page !== undefined && params.page !== '') query.set('page', params.page);
    if (params.limit !== undefined && params.limit !== '') query.set('limit', params.limit);

    const qs = query.toString();
    const url = `${API_BASE}/tasks/my${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  /**
   * POST /api/projects/:projectId/tasks
   * Create a new task within a project (Team Leader only).
   */
  async createTask(projectId, taskData, token) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(taskData)
    });
    return handleResponse(res);
  },

  /**
   * PUT /api/tasks/:id
   * Update task details: title, description, priority, deadline (Team Leader only).
   */
  async updateTask(taskId, taskData, token) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(taskData)
    });
    return handleResponse(res);
  },

  /**
   * DELETE /api/tasks/:id
   * Hard delete task and cascade delete related comments/notifications (Team Leader only).
   */
  async deleteTask(taskId, token) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  /**
   * PATCH /api/tasks/:id/status
   * Update task status (Assignee: linear todo -> inProgress -> completed; Leader: arbitrary).
   */
  async updateTaskStatus(taskId, status, token) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },

  /**
   * PATCH /api/tasks/:id/assign
   * Assign or reassign task to an active project member, or unassign with null (Team Leader only).
   */
  async assignTask(taskId, assigneeId, token) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/assign`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ assigneeId })
    });
    return handleResponse(res);
  },

  /**
   * GET /api/tasks/:id/comments
   * Fetch comments for a task.
   */
  async getTaskComments(taskId, token) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/comments`, {
      method: 'GET',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  /**
   * POST /api/tasks/:id/comments
   * Add a new comment to a task.
   */
  async addComment(taskId, payload, token) {
    const body = typeof payload === 'string' ? { text: payload } : payload;
    const res = await fetch(`${API_BASE}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  }
};
