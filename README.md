# Task Manager Application

## 1. Project Overview

The Task Manager Application is a web-based application designed to help teams organize projects, assign tasks, track task progress, and collaborate more effectively.

The application provides role-based access so users can access features according to their assigned roles.

## 2. Objectives

- Organize projects and tasks in one place.
- Assign tasks to team members.
- Track task status and project progress.
- Help users find tasks using search, filters, and sorting.
- Provide comments and in-app notifications.
- Protect application features through authentication and role-based access control.

## 3. User Roles

- **Admin:** Manages user accounts and roles.
- **Team Leader:** Creates and manages projects, manages team members, and assigns tasks.
- **Team Member:** Views assigned tasks and updates task status.

## 4. Key Features

- User registration and login
- Project management
- Task creation and assignment
- Task status tracking
- Task search, filtering, and sorting
- Comments on tasks
- In-app notifications
- Project dashboard and progress tracking
- Overdue task indication
- Role-based access control

*Feature availability and implementation status should be verified against the current codebase.*

## 5. Technology Stack

The project is designed around the following technologies:

- **Frontend:** React.js
- **Backend:** Node.js and Express.js
- **Database:** MongoDB
- **Version Control:** Git and GitHub

## 6. Project Structure

```text
Task_Manager_Application/
├── .github/
│   └── workflows/
├── backend/
├── docs/
├── frontend/
├── tests/
├── .gitignore
└── README.md
```

- `frontend/` — Frontend application.
- `backend/` — Server-side application and API.
- `docs/` — Project documentation.
- `tests/` — Test-related files.
- `.github/workflows/` — GitHub Actions workflow files.

## 7. Installation and Setup

Setup instructions will be added after verifying the frontend and backend dependencies, environment variables, and database configuration.

Do not commit passwords, API keys, database credentials, or `.env` files containing secrets.

## 8. Testing

The project includes a `tests/` directory and GitHub Actions workflow files. The available tests and CI workflow should be reviewed to confirm how to run the test suite and interpret its results.

## 9. Project Documentation

The `docs/` directory contains project documentation. Refer to it for the software requirements, architecture and design, and testing information available for this project.

## 10. Project Status

This project is being developed as a Software Engineering mini-project by a team of four members.

Implementation status, setup instructions, and test results will be updated as the project progresses.
