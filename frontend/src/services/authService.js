const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const STORAGE_KEY =
    import.meta.env.VITE_AUTH_STORAGE_KEY || "task_manager_auth";

const parseResponse = async (response) => {
    let json = null;
    try {
        json = await response.json();
    } catch (_error) {
        const error = new Error(
            `Request failed with status ${response.status}`,
        );
        error.status = response.status;
        error.code = "NETWORK_ERROR";
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

const isExpired = (token) => {
    try {
        const encodedPayload = token
            .split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(token.split(".")[1].length / 4) * 4, "=");
        const payload = JSON.parse(atob(encodedPayload));
        return !payload.exp || payload.exp * 1000 <= Date.now();
    } catch (_error) {
        return true;
    }
};

const readSession = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const session = JSON.parse(raw);
        if (!session?.token || !session?.user || isExpired(session.token)) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return session;
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
};

const saveSession = (session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
};

export const authService = {
    getSession() {
        return readSession();
    },

    async register({ name, email, password }) {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name.trim(),
                email: email.trim(),
                password,
            }),
        });

        return parseResponse(response);
    },

    async login(email, password) {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), password }),
        });

        const data = await parseResponse(response);
        const session = {
            token: data.token,
            tokenType: data.tokenType || "Bearer",
            expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000,
            user: data.user,
        };

        saveSession(session);
        return session;
    },

    async getCurrentUser(token) {
        const response = await fetch(`${API_BASE}/auth/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await parseResponse(response);
        return data.user;
    },

    async restoreSession() {
        const session = readSession();
        if (!session) return null;

        try {
            const user = await this.getCurrentUser(session.token);
            const refreshed = { ...session, user };
            saveSession(refreshed);
            return refreshed;
        } catch (_error) {
            clearSession();
            return null;
        }
    },

    async logout(token) {
        try {
            if (token) {
                const response = await fetch(`${API_BASE}/auth/logout`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });
                await parseResponse(response);
            }
        } finally {
            clearSession();
        }
    },

    clearSession,
};
