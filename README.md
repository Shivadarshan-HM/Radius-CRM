# Radius Studios CRM

A full-stack CRM for Radius Studios: leads, clients, projects, invoices, and contracts —
now with real authentication, a real database, and dashboard analytics.

```
radius-crm/
├── backend/     FastAPI + PostgreSQL + JWT auth
├── frontend/    React (Vite) + recharts
└── docker-compose.yml   local dev: Postgres + backend together
```

## Architecture

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, JWT auth (bcrypt password hashing).
  Single-operator by design — one admin account, created once via a bootstrap flow, no open signup.
- **Frontend**: React + Vite (a lightweight SPA, not Next.js — this app is a private
  dashboard behind a login, so there's no need for server-side rendering or a Node server
  in production; a static build deploys straight to Vercel).
- **Auth**: JWT bearer tokens. The frontend stores the token in `localStorage` and sends
  it as `Authorization: Bearer <token>` on every request. All data endpoints require it.

## Run it locally

**Fastest path — Docker:**
```bash
docker compose up --build
```
This starts Postgres + the backend on `http://localhost:8000`.

Then, in another terminal, run the frontend:
```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm install
npm run dev                # http://localhost:5173
```

Open `http://localhost:5173`. The first screen will ask you to create your admin
account (email + password) — that's the one-time bootstrap step. After that, registration
closes automatically; you just log in.

**Without Docker:** install PostgreSQL yourself, create a database, then:
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in DATABASE_URL, SECRET_KEY
uvicorn app.main:app --reload
```

## Deploying for real

### 1. Database — Render or Railway (matches the stack you already use)
Create a PostgreSQL instance. Copy the connection string it gives you.
If it starts with `postgres://`, that's fine — the backend rewrites it to `postgresql://`
automatically on startup.

### 2. Backend — Render or Railway
Deploy the `backend/` folder (it has a `Dockerfile`, so either platform can build it directly).
Set these environment variables:
- `DATABASE_URL` — from step 1
- `SECRET_KEY` — generate one: `openssl rand -hex 32`
- `ACCESS_TOKEN_EXPIRE_MINUTES` — `1440` (24h) is a sane default
- `FRONTEND_URLS` — your deployed frontend URL, e.g. `https://radius-crm.vercel.app`
  (comma-separate multiple origins if needed)

On first boot the backend creates its tables automatically and seeds Game of Fitness +
Mahaveer Electronics as clients/projects, matching what's already in your agency.

### 3. Frontend — Vercel
- Import the `frontend/` folder as the project root
- Framework preset: **Vite**
- Environment variable: `VITE_API_URL` = your backend's deployed URL from step 2
- Deploy

### 4. First login
Visit your deployed frontend. You'll land on "Create your admin account" — set your
real email and a strong password. That's your only login going forward; the register
endpoint returns `403` for anyone else after that, permanently.

## Things worth knowing before you rely on this

- **No email verification / password reset flow yet.** Since it's single-operator,
  if you forget your password the fix today is deleting the row from the `users` table
  directly in the database and re-running the bootstrap step. Worth adding a proper
  reset-via-email flow before you'd call this "done" done.
- **No automated DB migrations (Alembic).** Tables are created via `create_all` on
  startup, which is fine for one operator and a schema that isn't changing weekly, but
  if you start evolving the schema often, add Alembic so you're not manually
  patching production tables.
- **CORS** is locked to whatever's in `FRONTEND_URLS` — update it if you add a custom
  domain or a staging environment.
- **JWT expiry** is 24h by default — you'll be asked to log back in daily. Adjust
  `ACCESS_TOKEN_EXPIRE_MINUTES` if you'd rather stay logged in longer.
