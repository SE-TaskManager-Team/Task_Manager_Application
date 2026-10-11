# Task Manager Application - Backend

This is the Node.js + Express backend foundation for the Task Manager Application, built in accordance with the API Contract Specification (docs/api-contract.md).

## Prerequisites
- Node.js (v18+ recommended)
- MongoDB (running locally or via MongoDB Atlas)

## Environment Setup
1. Copy the .env.example file to .env:
   `ash
   cp .env.example .env
   ``n2. Update the MONGODB_URI in .env to point to your MongoDB instance.

## Installation
`ash
cd backend
npm install
``n
## Running the Server

**Development Mode:**
`ash
npm run dev
``n
**Production Mode:**
`ash
npm start
``n
## Health Check
`ash
curl http://localhost:5000/api/health
``n
## Authentication and role-based access control

The backend now includes:
- `POST /api/auth/register` — public registration; always creates `teamMember` accounts.
- `POST /api/auth/login` — verifies the password and returns a one-hour HS256 bearer token.
- `POST /api/auth/logout` — revokes the current token through the MongoDB token blocklist.
- `GET /api/auth/me` — returns the authenticated account.
- `GET /api/users` — admin-only paginated user listing (supports `role` and `isActive` filters).
- `GET /api/users/:id` — admin or self.
- `PUT /api/users/:id` — users can update their own name/password; only admins can change roles or account activation.
- `PATCH /api/users/:id/deactivate` — admin-only account deactivation, with last-active-admin protection.

Passwords are hashed with Node.js `crypto.scrypt`; password hashes are excluded from API responses. Protected requests require `Authorization: Bearer <token>`. Role authorization is checked against the current user record in MongoDB, not a role value supplied by the client. JWT logout is checked against the blocklist on every authenticated request.

### Required environment variables

Set `MONGODB_URI` and a cryptographically random `JWT_SECRET` of at least 32 characters in `backend/.env`. Never commit `.env` or production secrets. Example secret generation: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

### Create the initial administrator

Public registration cannot create admins. After configuring `.env`, provide `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (at least 12 characters) in the environment and run `npm run create-admin` from `backend`. The script refuses to overwrite an existing account with that email.

### Tests

Run `npm install` then `npm test`. Security utility tests cover password hashing, token verification, and tampering. MongoDB-backed route integration tests require a test database and are still recommended before deployment.
