# TaskMaster Pro — MERN Task Management MVP

## Requirements
Node.js 20+, npm, and a running MongoDB instance (local or Atlas).

## Start backend
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
Edit `server/.env` with your MongoDB URI. Do not commit secrets.

## Start frontend (new terminal)
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open http://localhost:5173.

## REST endpoints
- GET /api/health
- GET /api/tasks (optional `?status=todo`)
- POST /api/tasks
- PATCH /api/tasks/:id
- DELETE /api/tasks/:id

Example JSON: `{"title":"Build API","priority":"high","status":"todo"}`.

## Scope and security
Single-workspace educational MVP. No login or per-user authorization. Do not expose this API publicly without authentication, authorization, rate limiting, and further security review. MongoDB must not be publicly exposed. The backend validates schema values and restricts update fields. API listing is capped at 200 records.

## Quick manual checks
1. Start MongoDB, backend, and frontend; check `/api/health`.
2. Add a task; refresh and confirm persistence.
3. Change status; confirm dashboard counts update.
4. Edit title and delete task; refresh to verify.
5. Try empty title, invalid priority and malformed ID; expect validation errors.

## Deployment
Deploy the backend to a Node hosting provider with `MONGODB_URI`, `PORT`, `CLIENT_ORIGIN`; deploy `client` to a static host with `VITE_API_URL` set to the backend URL. Build frontend with `npm run build`. Add authentication before any public use.
