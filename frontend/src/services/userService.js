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

export const userService = {
  async getUsers(token) {
    const response = await fetch(`${API_BASE}/users?limit=100`, {
      headers: authHeaders(token)
    });
    return parseResponse(response);
  },

  async updateUser(token, userId, changes) {
    const response = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(changes)
    });
    return parseResponse(response);
  },

  async deactivateUser(token, userId) {
    const response = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/deactivate`, {
      method: 'PATCH',
      headers: authHeaders(token)
    });
    return parseResponse(response);
  },

  async createUser(token, userData) {
    let actualToken = token;
    let actualData = userData;
    if (typeof token === 'object' && typeof userData === 'string') {
      actualToken = userData;
      actualData = token;
    }

    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: authHeaders(actualToken),
      body: JSON.stringify(actualData)
    });
    return parseResponse(response);
  }
};
