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
};
