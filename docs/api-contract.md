# Task Manager Application - API Contract Specification
**Status:** Implementation Baseline

This document serves as the technical contract for the backend API, mapped directly to the submitted Software Requirements Specification (SRS), Software Architecture and Design (SAD), and Test Plan.

---

## 1. Architectural Deviations & Implementation Safeguards

### 1.1 SAD Deviation: Task Creation Route
The SAD (§4.3) explicitly lists `POST /api/tasks` as an example. This contract uses **`POST /api/projects/:projectId/tasks`** instead. By nesting task creation under projects, the API enforces a stricter RESTful hierarchy and ensures Role-Based Access Control (RBAC) validations naturally scope to the parent project.

### 1.2 Safeguard: Last Active Admin Protection
To prevent accidental system lockouts, operations that demote an admin (`PUT /api/users/:id`) or deactivate an admin (`PATCH /api/users/:id/deactivate`) MUST check the database. If the target is the *last active account with the `admin` role*, the server will reject the request with a `400 Bad Request`. 

*(Note: To preserve data integrity and relational audit trails per TM-NF-007, a user deletion endpoint is intentionally excluded. Accounts are deactivated instead of deleted.)*

### 1.3 Safeguard: Task Statuses & Transitions (TM-F-012)
Task statuses are strictly defined as: `todo`, `inProgress`, and `completed`.
- **Team Members (Assignees):** Must progress linearly: exactly `todo` → `inProgress`, and `inProgress` → `completed`. All other transitions, including backward or skipping steps, are blocked (`403 Forbidden`).
- **Team Leaders:** May move tasks to any valid status in any direction to allow for administrative corrections.

### 1.4 Safeguard: Assignment Restriction & Cleanup (TM-F-010, TM-F-007)
A task can only be assigned to a User who is actively listed in the `memberIds` array of the parent Project and has `isActive: true`. Attempts to assign non-members or deactivated users will return `400 Bad Request`.
- **Cleanup Rule:** If a member is removed from a project (`DELETE /api/projects/:id/members/:userId`) or their account is deactivated, any tasks currently assigned to them within that project MUST automatically revert to `assigneeId: null`.

### 1.5 Safeguard: Progress & Overdue Calculations
- **Progress:** Calculated dynamically as `(completed tasks / total tasks) * 100`. Returns `0` if total tasks is `0`.
- **Overdue Tasks:** A task is overdue if `deadline < currentTime` AND `status !== 'completed'`. This is a computed boolean property.

---

## 2. Global Conventions & Security

### 2.1 Authentication & Secure Logout
- **Header:** `Authorization: Bearer <jwt_token>`
- **Secure Logout (TM-SR-007):** Invoking `POST /api/auth/logout` places the JWT string into a MongoDB `TokenBlocklist` collection. The auth middleware verifies the JWT signature, mathematically validates expiration, and checks the MongoDB `TokenBlocklist` on every protected request, rejecting any blocklisted tokens (`401 Unauthorized`). The TTL index is used strictly for database cleanup and must never be relied on for security enforcement.

### 2.2 Pagination
All `GET` list endpoints accept `?page=1&limit=20` and return standard metadata:
```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 45,
    "page": 1,
    "pages": 3
  }
}
```

### 2.3 Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable reason."
  }
}
```

---

## 3. Strict Project Access Rules Matrix

To prevent data leakage, users will never see projects they are not explicitly authorized to view.

| Operation | Endpoint | Admin | Project's Team Leader | Project's Team Member | Non-Member |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **List** | `GET /api/projects` | Sees all projects | Sees projects they lead/joined | Sees projects they joined | Sees empty list (`[]`) |
| **Detail** | `GET /api/projects/:id`| Allow | Allow | Allow | Deny (`403`) |
| **Update** | `PUT /api/projects/:id` | Deny | Allow | Deny (`403`) | Deny (`403`) |
| **Delete** | `DELETE .../:id` | Deny | Allow | Deny (`403`) | Deny (`403`) |

---

## 4. Data Models

*   **User:** `{ _id, name, email, role (admin|teamLeader|teamMember), isActive, createdAt }` *(Note: passwordHash is strictly excluded from responses)*
*   **Project:** `{ _id, name, description, deadline, teamLeaderId, memberIds, createdAt }`
*   **Task:** `{ _id, title, description, priority (low|medium|high), deadline, status, projectId, assigneeId, createdById, isOverdue, createdAt }`
*   **Comment:** `{ _id, taskId, authorId, text, createdAt }`
*   **Notification:** `{ _id, recipientId, type (taskAssigned|statusChanged), taskId, message, isRead, createdAt }`

---

## 5. Endpoints

### 5.1 Authentication
*   **`POST /api/auth/register` (Public)**
    *   *Body:* `{ name, email, password }`
    *   *Rule:* Public registration strictly creates accounts with the `teamMember` role. The initial Admin must be created through a controlled setup/seed process, never public registration. Admins may subsequently promote users to `teamLeader`.
*   **`POST /api/auth/login` (Public)** *(Preserves SAD Example)*
    *   *Body:* `{ email, password }`
*   **`POST /api/auth/logout` (Auth)**
    *   *Action:* Adds JWT to blocklist.

### 5.2 Users
*   **`GET /api/users` (Admin)**
*   **`GET /api/users/:id` (Admin, Self)**
*   **`PUT /api/users/:id` (Admin, Self)**
    *   *Validation:* Self can only edit `name` and `password`. Attempts by Non-Admins to edit `role` or `isActive` yield `403 Forbidden` (Privilege Escalation block).
*   **`PATCH /api/users/:id/deactivate` (Admin)**
    *   *Action:* Sets `isActive: false` on the target user. Rejects if target is the last active Admin. Reassigns tasks assigned to this user to `null`.

### 5.3 Projects
*   **`POST /api/projects` (Team Leader)**
    *   *Action:* Caller becomes `teamLeaderId`.
*   **`GET /api/projects` (Auth)**
*   **`GET /api/projects/:id` (Access Matrix)**
*   **`PUT /api/projects/:id` (Project Leader)**
*   **`DELETE /api/projects/:id` (Project Leader)**
    *   *Cleanup:* Hard cascade delete. Removes Project, nested Tasks, and associated Comments/Notifications.
*   **`POST /api/projects/:id/members` (Project Leader)**
    *   *Body:* `{ userId }`
*   **`DELETE /api/projects/:id/members/:userId` (Project Leader)**
    *   *Action:* Removes user from project and sets any of their assigned tasks in this project to `assigneeId: null`.
*   **`GET /api/projects/:id/progress` (Project Members)**

### 5.4 Tasks
*   **`POST /api/projects/:projectId/tasks` (Project Leader)**
    *   *Body:* `{ title, description, priority, deadline, assigneeId }`
*   **`GET /api/projects/:projectId/tasks` (Project Members)**
    *   *Filters (TM-F-014, TM-F-018):* `?status=...`, `?priority=...`, `?deadline=YYYY-MM-DD`, `?overdue=true`, `?assigneeId=...`
    *   *Sorting (TM-F-014):* `?sortBy=deadline|priority|status` and `?order=asc|desc`. For priority sorting explicitly: ascending is `low`, `medium`, `high`; descending is `high`, `medium`, `low`.
*   **`GET /api/tasks/:id` (Project Members)**
*   **`GET /api/tasks/my` (Auth)**
    *   *Action:* Returns tasks where caller is `assigneeId` across all projects.
*   **`PUT /api/tasks/:id` (Project Leader)**
*   **`DELETE /api/tasks/:id` (Project Leader)**
    *   *Cleanup:* Hard cascade delete. Removes Task and associated Comments/Notifications.
*   **`PATCH /api/tasks/:id/status` (Assignee, Project Leader)** *(Preserves SAD Example)*
    *   *Body:* `{ status }` (Subject to transition safeguards).
    *   *Action:* After a valid status change, creates the appropriate `statusChanged` notification for the relevant recipient (e.g., the project teamLeader). Avoids creating duplicate notifications when the submitted status matches the current status.
*   **`PATCH /api/tasks/:id/assign` (Project Leader)**
    *   *Body:* `{ assigneeId }` (Triggers `taskAssigned` notification).

### 5.5 Comments, Notifications, Search, Dashboard
*   **`POST /api/tasks/:taskId/comments` (Project Members)**
*   **`GET /api/tasks/:taskId/comments` (Project Members)**
*   **`GET /api/notifications` (Auth - Self)**
    *   *Polling Note:* Clients should poll this every 60s for updates.
*   **`PATCH /api/notifications/:id/read` (Auth - Self)**
*   **`GET /api/dashboard` (Auth)**
    *   *Action:* Returns role-aggregated stats (Admin sees system totals, Leader sees project stats, Member sees personal task stats).
*   **`GET /api/search` (Auth)**
    *   *Query:* `?q=keyword` (Returns authorized tasks and projects).

---

## 6. SRS Traceability Matrix

| Feature | Endpoint(s) | SRS Ref | Test Case |
| :--- | :--- | :--- | :--- |
| Registration | `POST /api/auth/register` | TM-F-001 | TC-REG-01 |
| Auth/Login | `POST /api/auth/login` | TM-F-002 | TC-AUTH-01 |
| Logout | `POST /api/auth/logout` | TM-F-003 | TC-AUTH-02 |
| User Mgmt | `GET / PUT / PATCH /api/users` | TM-F-004 | TC-USER-01 |
| Project Creation | `POST /api/projects` | TM-F-005 | TC-PROJ-01 |
| Project Edits | `PUT / DELETE /api/projects/:id` | TM-F-006 | TC-PROJ-02 |
| Member Mgmt | `POST / DELETE /api/projects/:id/members` | TM-F-007 | TC-PROJ-03 |
| Task Creation | `POST /api/projects/:projectId/tasks` | TM-F-008, 009 | TC-TASK-01, 02 |
| Task Assignment | `PATCH /api/tasks/:id/assign` | TM-F-010 | TC-TASK-03 |
| View My Tasks | `GET /api/tasks/my` | TM-F-011 | TC-TASK-04 |
| Update Status | `PATCH /api/tasks/:id/status` | TM-F-012 | TC-TASK-05 |
| Task Edits | `PUT / DELETE /api/tasks/:id` | TM-F-013 | TC-TASK-06 |
| Task Filter/Sort | `GET /api/projects/:id/tasks?status=...` | TM-F-014 | TC-TASK-07 |
| Project Progress | `GET /api/projects/:id/progress` | TM-F-015 | TC-PROJ-04 |
| Comments | `POST / GET /api/tasks/:id/comments` | TM-F-016 | TC-COM-01 |
| Notifications | `GET / PATCH /api/notifications` | TM-F-017 | TC-NOTIF-01 |
| Overdue Tasks | `GET /api/projects/:id/tasks?overdue=true`| TM-F-018 | TC-TASK-08 |
| Dashboard | `GET /api/dashboard` | TM-F-019 | TC-DASH-01 |
| Search | `GET /api/search` | TM-F-020 | TC-SEARCH-01 |
