const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const handleResponse = async (response) => {
    let json;

    try {
        json = await response.json();
    } catch {
        const error = new Error(
            `Request failed with status ${response.status}`,
        );
        error.status = response.status;
        throw error;
    }

    if (!response.ok || !json.success) {
        const error = new Error(
            json?.error?.message ||
                `Request failed with status ${response.status}`,
        );
        error.status = response.status;
        error.code = json?.error?.code || "REQUEST_FAILED";
        throw error;
    }

    return json.data;
};

const headers = (token) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
});

export const projectService = {
    async getProjects(token) {
        const response = await fetch(`${API_BASE}/projects`, {
            method: "GET",
            headers: headers(token),
        });

        return handleResponse(response);
    },

    async getProjectById(projectId, token) {
        const response = await fetch(`${API_BASE}/projects/${projectId}`, {
            method: "GET",
            headers: headers(token),
        });

        return handleResponse(response);
    },

    async createProject(projectData, token) {
        let actualData = projectData;
        let actualToken = token;
        if (typeof projectData === "string" && typeof token === "object") {
            actualToken = projectData;
            actualData = token;
        }

        const response = await fetch(`${API_BASE}/projects`, {
            method: "POST",
            headers: headers(actualToken),
            body: JSON.stringify(actualData),
        });

        return handleResponse(response);
    },

    async addMember(projectId, userId, token) {
        const response = await fetch(`${API_BASE}/projects/${projectId}/members`, {
            method: "POST",
            headers: headers(token),
            body: JSON.stringify({ userId }),
        });

        return handleResponse(response);
    },

    async removeMember(projectId, userId, token) {
        const response = await fetch(
            `${API_BASE}/projects/${projectId}/members/${userId}`,
            {
                method: "DELETE",
                headers: headers(token),
            },
        );

        return handleResponse(response);
    },

    async getProjectProgress(projectId, token) {
        const response = await fetch(`${API_BASE}/projects/${projectId}/progress`, {
            method: "GET",
            headers: headers(token),
        });

        return handleResponse(response);
    },
};
