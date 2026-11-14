# CampusOS Architecture Overview

CampusOS is built as a single-campus pilot for Thapar Institute of Engineering & Technology (TIET).

## Monorepo Layout

```
CampusOS/
├── frontend/               # Next.js 16 (App Router, TypeScript, Tailwind CSS)
│   ├── src/app/            # App Router pages (/academic, /copilot, /vault, /reuse)
│   ├── src/components/     # Navigation & UI components
│   ├── src/lib/            # Typed API client with auth headers & Supabase browser client
│   └── src/types/          # Shared TypeScript interfaces
├── backend/                # FastAPI (Python 3.14)
│   ├── app/
│   │   ├── main.py         # FastAPI application, CORS for localhost:3000, /health
│   │   ├── core/           # App settings, Supabase client, JWT auth dependency
│   │   ├── models/         # Typed Pydantic models (academic, copilot, vault, reuse)
│   │   ├── routers/        # Feature routers
│   │   └── services/       # What-if engine, RAG engine, impact engine
│   └── tests/              # 22 automated unit & integration tests
├── supabase/               # SQL migrations folder with pgvector & RLS policies
│   └── migrations/
│       └── 20240101_initial_schema.sql
└── docs/                   # Developer documentation & setup notes
```

## Module Responsibilities

1. **Academic Dashboard & What-if Planner**:
   - Manages courses, grades, SGPA/CGPA calculations, attendance monitoring.
   - Evaluates attendance against TIET Section 6.2 (75% mandatory cutoff, 65%-74.9% medical condonation warning, <65% detention).
   - Simulates future lecture attendance and grade target feasibility.

2. **Campus Copilot**:
   - Grounded RAG system over TIET ordinances, calendar, hostel regulations, and library rules.
   - Requires citations on every claim; declines out-of-scope questions.
   - Actionable AI detects deadlines inside official circulars and prompts student confirmation.

3. **Digital Vault**:
   - Private storage for academic credentials and transcripts.
   - Row Level Security ensures student isolation.

4. **Campus Reuse & Impact Tracking**:
   - Marketplace for calculators, lab coats, drafters, and textbooks.
   - Computes economic savings (₹), diverted landfill waste (kg), and avoided carbon footprint ($CO_2$).
