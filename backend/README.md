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