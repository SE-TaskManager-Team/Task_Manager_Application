const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function parseResponse(response) {
  let json;
  try {
    json = await response.json();
  } catch {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (!response.ok || !json.success) {
    const error = new Error(json?.error?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = json?.error?.code || 'REQUEST_FAILED';
    throw error;
  }
  return json.data;
}

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
});

export const notificationService = {
  async getNotifications(token, page = 1, limit = 20) {
    const response = await fetch(`${API_BASE}/notifications?page=${page}&limit=${limit}`, {
      headers: authHeaders(token)
    });
    return parseResponse(response);
  },

  async markAsRead(notificationId, token) {
    const response = await fetch(`${API_BASE}/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      headers: authHeaders(token)
    });
    return parseResponse(response);
  },

  async markAllAsRead(token) {
    const response = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: authHeaders(token)
    });
    return parseResponse(response);
  }
};
