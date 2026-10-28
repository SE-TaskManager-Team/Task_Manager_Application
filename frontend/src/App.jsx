import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TaskManagement } from "./components/tasks/TaskManagement";
import { authService } from "./services/authService";
import { projectService } from "./services/projectService";
import { AdminUserManagement } from "./components/admin/AdminUserManagement";
import "./styles/tasks.css";
import "./styles/auth.css";

const getId = (value) => String(value?._id ?? value);

function LoginScreen({ onLogin, onRegister }) {
    const [mode, setMode] = useState("signin");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const isSignup = mode === "signup";

    const submit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setNotice(null);

        try {
            if (isSignup) {
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match.");
                }
                await onRegister({ name, email, password });
                setMode("signin");
                setName("");
                setPassword("");
                setConfirmPassword("");
                setNotice("Account created successfully. Please sign in.");
            } else {
                await onLogin(email, password);
            }
        } catch (submitError) {
            setError(
                submitError.message ||
                    (isSignup
                        ? "Unable to create account."
                        : "Unable to sign in."),
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const switchMode = () => {
        setMode(isSignup ? "signin" : "signup");
        setError(null);
        setNotice(null);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-brand">
                    <span className="auth-brand-mark">✓</span>
                    <div>
                        <h1>Task Manager</h1>
                        <p>
                            {isSignup
                                ? "Create an account to get started."
                                : "Sign in to manage your projects and tasks."}
                        </p>
                    </div>
                </div>

                <form onSubmit={submit} className="auth-form">
                    {isSignup && (
                        <label>
                            Full name
                            <input
                                data-testid="signup-name"
                                type="text"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                autoComplete="name"
                                minLength={2}
                                maxLength={80}
                                required
                                placeholder="Your name"
                            />
                        </label>
                    )}

                    <label>
                        Email
                        <input
                            data-testid={
                                isSignup ? "signup-email" : "login-email"
                            }
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email"
                            required
                            placeholder="you@example.com"
                        />
                    </label>

                    <label>
                        Password
                        <input
                            data-testid={
                                isSignup ? "signup-password" : "login-password"
                            }
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            autoComplete={
                                isSignup ? "new-password" : "current-password"
                            }
                            minLength={isSignup ? 8 : undefined}
                            maxLength={128}
                            required
                            placeholder={
                                isSignup
                                    ? "At least 8 characters"
                                    : "Your password"
                            }
                        />
                    </label>

                    {isSignup && (
                        <label>
                            Confirm password
                            <input
                                data-testid="signup-confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(event) =>
                                    setConfirmPassword(event.target.value)
                                }
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={128}
                                required
                                placeholder="Enter your password again"
                            />
                        </label>
                    )}

                    {notice && (
                        <div className="auth-success" role="status">
                            {notice}
                        </div>
                    )}
                    {error && (
                        <div
                            className="auth-error"
                            role="alert"
                            data-testid={
                                isSignup ? "signup-error" : "login-error"
                            }
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="auth-submit"
                        disabled={isSubmitting}
                        data-testid={
                            isSignup ? "signup-submit" : "login-submit"
                        }
                    >
                        {isSubmitting
                            ? isSignup
                                ? "Creating account…"
                                : "Signing in…"
                            : isSignup
                              ? "Create account"
                              : "Sign in"}
                    </button>
                </form>

                <p className="auth-switch">
                    {isSignup
                        ? "Already have an account?"
                        : "New to Task Manager?"}{" "}
                    <button
                        type="button"
                        onClick={switchMode}
                        className="auth-link"
                    >
                        {isSignup ? "Sign in" : "Create an account"}
                    </button>
                </p>
            </div>
        </div>
    );
}

function App() {
    const [session, setSession] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [isInitializing, setIsInitializing] = useState(true);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [projectError, setProjectError] = useState(null);

    const handleUnauthorized = useCallback(() => {
        authService.clearSession();
        setSession(null);
        setProjects([]);
        setSelectedProjectId("");
        setAuthError(
            "Your session has expired or been logged out. Please sign in again.",
        );
    }, []);

    useEffect(() => {
        const restore = async () => {
            const restoredSession = await authService.restoreSession();
            setSession(restoredSession);
            setIsInitializing(false);
        };

        restore();

        window.addEventListener("auth:unauthorized", handleUnauthorized);
        return () =>
            window.removeEventListener("auth:unauthorized", handleUnauthorized);
    }, [handleUnauthorized]);

    const loadProjects = useCallback(
        async (token) => {
            setIsLoadingProjects(true);
            setProjectError(null);

            try {
                const data = await projectService.getProjects(token);
                const items = Array.isArray(data.items) ? data.items : [];
                setProjects(items);
                setSelectedProjectId((currentId) => {
                    if (
                        currentId &&
                        items.some((project) => getId(project) === currentId)
                    ) {
                        return currentId;
                    }
                    return items.length ? getId(items[0]) : "";
                });
            } catch (error) {
                if (error.status === 401) {
                    handleUnauthorized();
                } else {
                    setProjectError(
                        error.message || "Failed to load projects.",
                    );
                }
            } finally {
                setIsLoadingProjects(false);
            }
        },
        [handleUnauthorized],
    );

    useEffect(() => {
        if (session?.token) {
            loadProjects(session.token);
        }
    }, [session, loadProjects]);

    const handleLogin = async (email, password) => {
        setAuthError(null);
        const nextSession = await authService.login(email, password);
        setSession(nextSession);
    };

    const handleRegister = async (details) => {
        return authService.register(details);
    };

    const handleLogout = async () => {
        const token = session?.token;
        setSession(null);
        setProjects([]);
        setSelectedProjectId("");
        try {
            await authService.logout(token);
        } catch (_error) {
            // authService clears the local session even if the server logout fails.
        }
    };

    const selectedProject = useMemo(
        () =>
            projects.find((project) => getId(project) === selectedProjectId) ||
            null,
        [projects, selectedProjectId],
    );

    const memberNames = useMemo(() => {
        const names = {};

        // The API intentionally exposes member IDs rather than another user's
        // private profile data. The current user's name is safe to display.
        if (session?.user?._id) {
            names[getId(session.user)] = session.user.name;
        }

        return names;
    }, [session]);

    if (isInitializing) {
        return (
            <div className="auth-page">
                <div className="auth-loading">Restoring your session…</div>
            </div>
        );
    }

    if (!session) {
        return (
            <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />
        );
    }

    return (
        <div className="app-container">
            <header className="app-header">
                <div>
                    <strong>🚀 Task Manager</strong>
                    <span className="app-header-subtitle">Task Management</span>
                </div>

                <div className="app-header-user">
                    <div className="app-user-details">
                        <strong>{session.user.name}</strong>
                        <span>{session.user.role}</span>
                    </div>
                    <button
                        type="button"
                        className="logout-button"
                        onClick={handleLogout}
                        data-testid="logout-button"
                    >
                        Log out
                    </button>
                </div>
            </header>

            <main>
                {authError && (
                    <div className="app-alert app-alert-error" role="alert">
                        {authError}
                    </div>
                )}

                {session.user.role === "admin" && (
                    <AdminUserManagement
                        token={session.token}
                        currentUser={session.user}
                    />
                )}

                {isLoadingProjects ? (
                    <div className="app-state">Loading your projects…</div>
                ) : projectError ? (
                    <div className="app-state app-state-error" role="alert">
                        {projectError}
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => loadProjects(session.token)}
                        >
                            Retry
                        </button>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="app-state">
                        <h2>No projects available</h2>
                        <p>
                            Your authenticated account is valid, but you do not
                            currently have access to a project.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="project-toolbar">
                            <label htmlFor="project-select">Project</label>
                            <select
                                id="project-select"
                                data-testid="project-select"
                                value={selectedProjectId}
                                onChange={(event) =>
                                    setSelectedProjectId(event.target.value)
                                }
                            >
                                {projects.map((project) => (
                                    <option
                                        key={getId(project)}
                                        value={getId(project)}
                                    >
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedProject && (
                            <TaskManagement
                                projectId={selectedProjectId}
                                project={selectedProject}
                                currentUser={session.user}
                                token={session.token}
                                memberNames={memberNames}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
