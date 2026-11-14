# CampusOS Monorepo

> **One personalized platform that fixes fragmented campus information for Thapar Institute of Engineering & Technology (TIET).**

CampusOS combines academic intelligence, grounded campus policies, zero-knowledge privacy vaults, and circular campus economics into a unified monorepo.

---

## 📁 Monorepo Structure

```
CampusOS/
├── frontend/               # Next.js 14+ (App Router, TypeScript, Tailwind CSS, ESLint)
│   ├── src/
│   │   ├── app/            # App Router pages (/academic, /copilot, /vault, /reuse)
│   │   ├── components/     # UI components and Navigation sidebar
│   │   ├── lib/            # Typed API client (lib/api.ts) & Supabase client (lib/supabase.ts)
│   │   └── types/          # Shared TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   └── .env.example
├── backend/                # FastAPI (Python 3.14)
│   ├── app/
│   │   ├── main.py         # App entrypoint, CORS for localhost:3000, /health endpoint
│   │   ├── core/           # App settings, Supabase client, JWT auth dependency
│   │   ├── models/         # Typed Pydantic schemas (Academic, Copilot, Vault, Reuse)
│   │   ├── routers/        # Feature routers (academic, copilot, vault, reuse)
│   │   └── services/       # What-if engine, grounded RAG engine, impact engine
│   ├── data/               # Authentic TIET corpus (regulations, hostel rules, calendars)
│   ├── tests/              # 22 automated pytest tests (health, auth, what-if, RAG, impact)
│   ├── requirements.txt
│   └── .env.example
├── supabase/
│   └── migrations/         # SQL migration scripts (PostgreSQL, pgvector, RLS policies)
│       └── 20240101_initial_schema.sql
├── docs/                   # Developer documentation & architecture notes
│   ├── README.md
│   ├── architecture.md
│   └── auth_flow.md
├── scripts/
│   └── dev.sh              # Concurrent startup script for development
├── Makefile                # Unified monorepo commands
├── .env.example            # Monorepo environment template
└── pytest.ini
```

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js**: $\ge 18$ (Tested on v26)
- **Python**: $\ge 3.10$ (Tested on v3.14)

### 2. Environment Configuration
Copy `.env.example` into each respective directory:
```bash
# Monorepo root
cp .env.example .env

# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 3. Install Dependencies
```bash
# Using Makefile
make install

# Or manually:
python3 -m venv backend/venv
./backend/venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && cd ..
```

### 4. Run Development Servers
You can start both servers concurrently with a single command:
```bash
make dev
# Or execute: ./scripts/dev.sh
```

Or start each server independently in separate terminal windows:

#### Terminal 1 — Backend (FastAPI)
```bash
make dev-backend
# Or: ./backend/venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
```
- Server URL: **http://localhost:8000**
- Health Check: **http://localhost:8000/health**
- Interactive Swagger Docs: **http://localhost:8000/docs**

#### Terminal 2 — Frontend (Next.js)
```bash
make dev-frontend
# Or: cd frontend && npm run dev
```
- Web Application: **http://localhost:3000**

---

## 🔐 Authentication & Security Architecture

1. **Supabase JWT Verification**:
   The backend provides a dependency `get_current_user_id` in `backend/app/core/auth.py`. It inspects the `Authorization: Bearer <token>` header, verifies the signature against `SUPABASE_JWT_SECRET` or via the Supabase Auth API, and returns the authenticated `user_id`.
2. **Typed Frontend API Client**:
   `frontend/src/lib/api.ts` automatically attaches the active Supabase session token to all outgoing requests.
3. **Row Level Security (RLS)**:
   Every table in `supabase/migrations/20240101_initial_schema.sql` enforces `auth.uid() = user_id`.

---

## 🧪 Testing & Verification

Run the test suite across both frontend and backend:
```bash
make test
```

### Backend (`pytest`):
```bash
./backend/venv/bin/pytest -v -W ignore::DeprecationWarning
```
Verifies:
- Root `/health` endpoint returns `{"status": "ok"}`
- JWT verification dependency and `/api/auth/me` security
- Thapar 75% attendance rule and safe bunk math
- Grounded RAG citation verification and out-of-scope question rejection
- Actionable AI fee notice extraction
- Reuse marketplace circular economy impact metrics

### Frontend Build (`next build`):
```bash
make build
```
Compiles Next.js with TypeScript and verifies all App Router pages: `/`, `/academic`, `/copilot`, `/vault`, `/reuse`.
