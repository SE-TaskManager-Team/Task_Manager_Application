# Task Manager Application

A modern, role-based, full-stack collaborative project and task management web application built for the **Software Engineering Mini-Project** course at **PES University**.

---

## 1. Project Overview

The **Task Manager Application** is designed to streamline team collaboration, milestone planning, and task execution within engineering teams. The application enforces a strict hierarchical security model with role-based access control (RBAC), end-to-end auditability, linear task lifecycle progression, and real-time status visibility across projects and members.

### Key Objectives
* **Role-Based Workflows:** Distinct permission tiers for Administrators, Team Leaders, and Team Members.
* **Project & Task Lifecycle Management:** Scoped project administration, deadline tracking, task assignment, and priority queues.
* **RESTful Architecture:** Secure, token-authenticated backend API with centralized error handling and envelope-based responses.
* **High Reliability:** Full automated test coverage across authentication, authorization, business logic invariants, and React UI components.

---

## 2. Team Members (Team 4)

| Name | SRN | Email |
| :--- | :--- | :--- |
| **Rehana N** | `PES2UG24CS678` | rehanapcbm1c@gmail.com |
| **Rohit S Rajan** | `PES2UG25CS821` | rohitspes2@gmail.com |
| **Krassveen Robert** | `PES2UG24CS639` | crosswinrobert7@gmail.com |
| **Aisiri Shetty** | `PES2UG24CS623` | aisiri1003@gmail.com |

* **Course:** Software Engineering Mini-Project  
* **Course Coordinator:** Dhiroj Kumar Behera  

---

## 3. User Roles and Permissions

The system implements three mutually exclusive user roles defined in `backend/src/models/User.js`:

| Role | Scope & Permissions | Access Restrictions |
| :--- | :--- | :--- |
| **Administrator (`admin`)** | Full platform oversight. Can list all registered users, promote/demote roles (`teamLeader`, `teamMember`), and deactivate accounts. Has visibility into all system projects. | Protected from self-demotion and self-deactivation. The last active admin in the system cannot be demoted or deactivated. |
| **Team Leader (`teamLeader`)** | Full authority over owned projects. Can create, edit, and delete projects, manage member rosters, create/delete tasks, assign/reassign members, and adjust task statuses in any direction. | Cannot access platform-wide user management or modify projects led by other leaders. |
| **Team Member (`teamMember`)** | Default role upon self-registration. Can view assigned projects and tasks, view the team task board, and update the status of tasks assigned specifically to them. | Limited to linear status progression (`todo` $\rightarrow$ `inProgress` $\rightarrow$ `completed`). Cannot delete tasks, reassign members, or manage projects. |

---

## 4. Verified Technology Stack

### Backend
* **Runtime & Framework:** Node.js (CommonJS), Express.js `^5.3.0`
* **Database & ODM:** MongoDB, Mongoose `^9.11.1`
* **Security & Middleware:** Helmet `^8.3.0`, CORS `^2.8.6`, Morgan `^1.12.1`, Dotenv `^18.0.7`
* **Authentication:** Node.js native `crypto.scrypt` password hashing, HS256 JWT signing, MongoDB Token Blocklist
* **Testing:** Jest `^30.5.2`, Supertest `^7.3.1`
* **Development Process Manager:** Nodemon `^3.1.14`

### Frontend
* **Library & Runtime:** React `^19.3.0`, React DOM `^19.3.0` (ES Modules)
* **Build Tooling & Dev Server:** Vite `^8.3.4`, `@vitejs/plugin-react` `^6.1.2`
* **Testing & DOM Simulation:** Vitest `^5.0.4`, JSDOM `^30.1.2`, `@testing-library/react` `^16.3.3`, `@testing-library/jest-dom` `^7.0.1`

### Infrastructure & CI/CD
* **Continuous Integration:** GitHub Actions (`.github/workflows/backend-ci.yml`) targeting Node.js 24 on `ubuntu-latest`.

---

## 5. Project Directory Structure

```text
Task_Manager_Application/
├── .github/
│   └── workflows/
│       ├── backend-ci.yml          # GitHub Actions automated backend CI pipeline
│       └── README.md
├── backend/
│   ├── __tests__/                  # Backend integration and unit test suites
│   │   ├── d.test.js               # Database connection and graceful exit tests
│   │   ├── deadline.test.js        # Project and task deadline validation tests
│   │   ├── health.test.js          # Health endpoint checks (200 / 503 degraded)
│   │   ├── project.test.js         # Project management RBAC and CRUD tests
│   │   ├── security.test.js        # Scrypt hashing and JWT signature/tamper tests
│   │   ├── task.model.test.js      # Task Mongoose schema validation tests
│   │   └── task.routes.test.js     # Task CRUD, filters, sorting, and linear state tests
│   ├── scripts/
│   │   └── createAdmin.js          # CLI script to bootstrap the initial system administrator
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js               # Mongoose MongoDB connection handler
│   │   ├── middleware/
│   │   │   ├── auth.js             # Bearer token verification and RBAC middleware
│   │   │   └── errorHandler.js     # Centralized 404 and 500 JSON error handlers
│   │   ├── models/
│   │   │   ├── Comment.js          # Task comment schema (audit trail)
│   │   │   ├── Notification.js     # System notification schema
│   │   │   ├── Project.js          # Project schema (leader and member references)
│   │   │   ├── Task.js             # Task schema (status, priority, deadline, assignee)
│   │   │   ├── TokenBlocklist.js   # JWT logout revocation collection
│   │   │   └── User.js             # User credentials, roles, and status schema
│   │   ├── routes/
│   │   │   ├── authRoutes.js       # Register, login, logout, me endpoints
│   │   │   ├── healthRoutes.js     # System and database health check
│   │   │   ├── projectRoutes.js    # Project CRUD and member assignment routes
│   │   │   ├── taskRoutes.js       # Task management and lifecycle routes
│   │   │   └── userRoutes.js       # Admin user management and account deactivation
│   │   ├── utils/
│   │   │   └── security.js         # Cryptographic scrypt hashing and JWT utilities
│   │   ├── app.js                  # Express application setup, routes, and middleware
│   │   └── README.md
│   ├── package.json                # Backend scripts and dependencies
│   ├── package-lock.json
│   ├── README.md                   # Backend setup reference
│   └── server.js                   # Application entry point (connects DB and listens)
├── docs/
│   ├── api-contract.md             # REST API Contract Specification (SRS/SAD mapped)
│   ├── TEAMNUM4_SAD_Task Manager Application.pdf       # Software Architecture & Design
│   ├── TEAMNUM4_SRS_Task_Manager_Application.pdf       # Software Requirements Specification
│   └── TEAMNUM4_TestPlan_Task Manager Application.pdf  # Software Test Plan
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── tasks/
│   │   │       ├── MyTasksView.jsx         # User's cross-project personal task view
│   │   │       ├── Pagination.jsx          # Paginated task list controls
│   │   │       ├── TaskAssignModal.jsx     # Team leader task assignment dialog
│   │   │       ├── TaskBadges.jsx          # Status and priority badges
│   │   │       ├── TaskCreateModal.jsx     # Task creation modal
│   │   │       ├── TaskDeleteModal.jsx     # Task deletion confirmation modal
│   │   │       ├── TaskDetailsModal.jsx    # Read-only task detail inspection modal
│   │   │       ├── TaskEditModal.jsx       # Task editing modal
│   │   │       ├── TaskFilters.jsx         # Status, priority, deadline filter toolbar
│   │   │       ├── TaskList.jsx            # Project task grid and table layout
│   │   │       ├── TaskManagement.jsx      # Primary task management container
│   │   │       └── TaskStatusModal.jsx     # Linear status transition modal
│   │   ├── services/
│   │   │   └── taskService.js      # Frontend API client for /api/projects/:id/tasks
│   │   ├── styles/
│   │   │   └── tasks.css           # Styling for task management interface
│   │   ├── test/
│   │   │   ├── setup.js            # Testing-library JSDOM environment bootstrap
│   │   │   ├── TaskBadges.test.jsx
│   │   │   ├── TaskFilters.test.jsx
│   │   │   ├── TaskList.test.jsx
│   │   │   ├── TaskModals.test.jsx
│   │   │   └── taskService.test.js # Unit tests for frontend task API client
│   │   ├── App.jsx                 # Root UI component with navigation & task container
│   │   ├── main.jsx                # React DOM entry point
│   │   └── README.md
│   ├── index.html                  # Single-page application HTML entry
│   ├── package.json                # Frontend scripts and dependencies
│   ├── package-lock.json
│   └── vite.config.js              # Vite configuration (port 3000, /api proxy)
├── tests/
│   ├── integration/                # Reserved for cross-boundary integration tests
│   ├── unit/                       # Reserved for shared unit tests
│   └── README.md
├── .gitignore                      # Git exclusion rules
└── README.md                       # Project root documentation (this file)
```

---

## 6. Prerequisites

Ensure you have the following installed locally:
* **Node.js:** v18.0.0 or higher (v24 LTS recommended)
* **npm:** v9.0.0 or higher
* **MongoDB:** Community Edition running locally (`mongodb://localhost:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI (required for running the live backend server).

---

## 7. Environment Configuration

### Backend Configuration (`backend/.env`)

Create a `.env` file inside the `backend/` directory:

```bash
# Server Port (default is 5000)
PORT=5000

# MongoDB Connection String (Local or Atlas)
MONGODB_URI=mongodb://localhost:27017/task_manager

# Cryptographic JWT Secret (must be at least 32 characters)
JWT_SECRET=c2VjdXJlX3Rhc2tfbWFuYWdlcl9qd3Rfc2VjcmV0X2tleV9leGFtcGxlXzIwMjY=
```

> [!IMPORTANT]
> To generate a secure random 32+ character JWT secret, run:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> Never commit actual `.env` files or hardcode production credentials in version control.

### Frontend Configuration
* The frontend uses Vite's built-in development proxy configured in `frontend/vite.config.js`:
  ```javascript
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
  ```
* All requests dispatched by the frontend to `/api/*` are forwarded automatically to `http://localhost:5000`. **No frontend `.env` file is required for local development.**

---

## 8. Installation & Setup

Open two separate terminals (one for the backend and one for the frontend).

### Terminal 1: Backend Setup & Launch

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. *(Optional)* Bootstrap the initial Administrator account:
   Public registration cannot assign the `admin` role. To initialize the platform admin, supply the bootstrap credentials as environment variables and run:
   ```bash
   # Linux / macOS
   ADMIN_NAME="System Admin" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="SuperSecretPassword123" npm run create-admin

   # Windows (PowerShell)
   $env:ADMIN_NAME="System Admin"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="SuperSecretPassword123"; npm run create-admin
   ```
   *Note: `ADMIN_PASSWORD` must be at least 12 characters.*

3. Start the backend server:
   ```bash
   # Development mode with auto-reload:
   npm run dev

   # Production mode:
   npm start
   ```
   When connected to MongoDB, the backend starts listening at: `http://localhost:5000`

   > [!NOTE]
   > **Live Server Verification Note:** During the repository audit, a local MongoDB service was not running on port 27017, so the live background daemon was not kept active. However, all Express route logic, database error handling, and health responses (`200` healthy vs `503` degraded) are fully verified through the automated Jest test suite (`npm test`), which runs independently using mocks.

4. Verify server health (when MongoDB is running):
   ```bash
   curl http://localhost:5000/api/health
   ```
   Expected response:
   ```json
   {
     "success": true,
     "data": {
       "status": "healthy",
       "timestamp": "...",
       "database": { "status": "connected", "readyState": 1 },
       "uptime": 1.25
     }
   }
   ```

---

### Terminal 2: Frontend Setup & Launch

1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   # or
   npm start
   ```
   *(Verified: Vite dev server compiles and answers on `http://localhost:3000` with `200 OK`).*

3. Open your browser and navigate to:
   **`http://localhost:3000`**

---

## 9. API Specification & Implementation Status

All API endpoints follow the standard response envelope documented in [`docs/api-contract.md`](docs/api-contract.md):
* **Success:** `{ "success": true, "data": { ... } }`
* **Error:** `{ "success": false, "error": { "code": "...", "message": "..." } }`

### Implemented & Verified Endpoints

The following endpoints are implemented in `backend/src/routes/`, mounted in `backend/src/app.js`, and verified with automated test suites:

| Category | Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/health` | Public | Returns server uptime and MongoDB connection state (`200` or `503`). |
| **Auth** | `POST` | `/api/auth/register` | Public | Registers a new account. Always assigns the `teamMember` role. |
| | `POST` | `/api/auth/login` | Public | Authenticates credentials and returns a 1-hour HS256 Bearer JWT. |
| | `POST` | `/api/auth/logout` | Authenticated | Revokes the current token via the MongoDB blocklist. |
| | `GET` | `/api/auth/me` | Authenticated | Returns the profile of the authenticated user. |
| **Users** | `GET` | `/api/users` | Admin | Paginated list of users with optional `role` and `isActive` filters. |
| | `GET` | `/api/users/:id` | Admin or Self | Retrieves a single user profile. |
| | `PUT` | `/api/users/:id` | Admin or Self | Self can update name/password; Admin can update role/status. |
| | `PATCH` | `/api/users/:id/deactivate` | Admin | Deactivates an account. Enforces last-active-admin protection. |
| **Projects** | `POST` | `/api/projects` | Team Leader | Creates a project; creator becomes its Team Leader. |
| | `GET` | `/api/projects` | Authenticated | Lists visible projects (all for Admin; owned/member for others). |
| | `GET` | `/api/projects/:id` | Project Member | Fetches full project details. |
| | `PUT` | `/api/projects/:id` | Team Leader | Updates project name, description, or deadline. |
| | `DELETE` | `/api/projects/:id` | Team Leader | Deletes project and cascades task unassignment/cleanup. |
| | `POST` | `/api/projects/:id/members` | Team Leader | Adds an active user to the project roster. |
| | `DELETE` | `/api/projects/:id/members/:userId` | Team Leader | Removes a member and unassigns their tasks within this project. |
| **Tasks** | `POST` | `/api/projects/:projectId/tasks` | Team Leader | Creates a task scoped to the project. |
| | `GET` | `/api/projects/:projectId/tasks` | Project Member | Lists project tasks with filtering, sorting, and pagination. |
| | `GET` | `/api/tasks/:id` | Project Member | Fetches single task details. |
| | `GET` | `/api/tasks/my` | Authenticated | Returns all tasks assigned to the current user across projects. |
| | `PUT` | `/api/tasks/:id` | Team Leader | Updates task title, description, priority, or deadline. |
| | `PATCH` | `/api/tasks/:id/status` | Assignee or Leader | Assignee: linear `todo` $\rightarrow$ `inProgress` $\rightarrow$ `completed`. Leader: arbitrary. |
| | `PATCH` | `/api/tasks/:id/assign` | Team Leader | Assigns/reassigns task to a project member, or sets to `null`. |
| | `DELETE` | `/api/tasks/:id` | Team Leader | Deletes task; cascades comment/notification deletion. |

---

### Endpoints Documented in API Contract but Not Yet Implemented (Planned Milestone)

The following endpoints are specified in [`docs/api-contract.md`](docs/api-contract.md) Section 7. Their Mongoose schemas exist in `backend/src/models/`, but their Express routes are **not yet mounted in `backend/src/app.js`**:

| Documented Endpoint | HTTP Method | Target Model | Current Implementation Status |
| :--- | :--- | :--- | :--- |
| `/api/tasks/:id/comments` | `POST` | `backend/src/models/Comment.js` | Schema defined. Route unmounted. Scheduled for milestone 2. |
| `/api/tasks/:id/comments` | `GET` | `backend/src/models/Comment.js` | Schema defined. Route unmounted. Scheduled for milestone 2. |
| `/api/notifications` | `GET` | `backend/src/models/Notification.js` | Schema defined. Route unmounted. Scheduled for milestone 2. |
| `/api/notifications/:id/read` | `PATCH` | `backend/src/models/Notification.js` | Schema defined. Route unmounted. Scheduled for milestone 2. |

---

## 10. Automated Testing & Verification

The project includes unit and integration tests across both the backend and frontend.

### Running Backend Tests
From the `backend/` directory:
```bash
npm test
```
* **Test Runner:** Jest (`jest --runInBand`)
* **Test Location:** `backend/__tests__/`
* **Test Results (Verified from actual execution):**
  * `__tests__/task.routes.test.js`: Task CRUD, filters, sorting, assignment rules, linear status transitions.
  * `__tests__/health.test.js`: Health endpoint responses on connected vs. disconnected database states.
  * `__tests__/project.test.js`: Project creation, membership validation, and authorization boundaries.
  * `__tests__/deadline.test.js`: Strict `YYYY-MM-DD` date validation.
  * `__tests__/security.test.js`: Scrypt password hashing, timing-safe checks, and JWT tampering verification.
  * `__tests__/task.model.test.js`: Mongoose task schema validation and defaults.
  * `__tests__/d.test.js`: Database connection failure handling.
  * **Summary:** **7 test suites passed, 187 tests passed (0 failed).**

### Running Frontend Tests
From the `frontend/` directory:
```bash
npm test
```
* **Test Runner:** Vitest (`vitest run`)
* **Test Location:** `frontend/src/test/`
* **Test Results (Verified from actual execution):**
  * `src/test/taskService.test.js` (9 tests): API client queries, pagination parameters, and response parsing.
  * `src/test/TaskFilters.test.jsx` (3 tests): Filter inputs, status/priority triggers, and reset behaviors.
  * `src/test/TaskBadges.test.jsx` (4 tests): Status badge coloring and overdue calculation badges.
  * `src/test/TaskList.test.jsx` (6 tests): Empty state rendering, task cards, and action buttons.
  * `src/test/TaskModals.test.jsx` (8 tests): Create, edit, assign, status, and delete modal dialog workflows.
  * **Summary:** **5 test files passed, 30 tests passed (0 failed).**

### Production Build Verification
From the `frontend/` directory:
```bash
npm run build
```
* **Build Tool:** Vite
* **Output:** Pre-rendered static assets in `frontend/dist/`
* **Result (Verified):** Clean compilation without syntax or bundling errors.

---

## 11. Security Implementation Highlights

1. **Cryptographic Password Storage:** Passwords hashed using Node.js native `crypto.scrypt` with a cryptographically secure 16-byte salt (format: `scrypt$salt$derivedKey`).
2. **Timing-Safe Verification:** Password and JWT signature comparisons utilize `crypto.timingSafeEqual` to prevent side-channel timing attacks.
3. **Stateless JWTs with Immediate Revocation:** Tokens are issued with a 1-hour expiration and signed via HMAC-SHA256 (`HS256`). Token blocklisting is stored in MongoDB with automated TTL indexes for instant logout invalidation.
4. **Authoritative Authorization:** User role verification checks the current database record upon every request, preventing client-side token tampering or privilege elevation.
5. **Last Admin Safeguard:** Prevents lockout by blocking the demotion or deactivation of the last active administrator.
6. **HTTP Header Hardening:** `helmet` applies essential security headers (CSP, HSTS, X-Content-Type-Options, etc.).

---

## 12. Project Documentation Links

All architectural and testing specifications are documented in the [`docs/`](docs/) directory:
* [API Contract Specification](docs/api-contract.md)
* [Software Requirements Specification (SRS)](docs/TEAMNUM4_SRS_Task_Manager_Application.pdf)
* [Software Architecture & Design (SAD)](docs/TEAMNUM4_SAD_Task%20Manager%20Application.pdf)
* [Software Test Plan (STP)](docs/TEAMNUM4_TestPlan_Task%20Manager%20Application.pdf)

---

## 13. Current Status & Known Scope Notes

* **Task Management Module:** Fully functional with comprehensive automated test coverage (backend APIs and frontend React UI).
* **Authentication Backend:** Authentication backend endpoints are fully implemented and verified.
* **Comments & Notifications:** Mongoose schemas are implemented in `backend/src/models/Comment.js` and `backend/src/models/Notification.js`; corresponding routes and controllers are scheduled for milestone 2.
