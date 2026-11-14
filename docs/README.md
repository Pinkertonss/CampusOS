# CampusOS Architecture & Developer Notes

This directory contains developer documentation, architectural decisions, and security guidelines for the CampusOS pilot deployment at Thapar Institute of Engineering & Technology (TIET).

---

## Documents in this folder

- **[Architecture Overview](architecture.md)**: Technical breakdown of Next.js App Router, FastAPI backend, and Supabase database.
- **[Authentication & JWT Verification](auth_flow.md)**: Details on Supabase JWT verification flow from `Authorization: Bearer <token>` through FastAPI dependency.
- **[Database Migrations & RLS](../supabase/migrations/20240101_initial_schema.sql)**: Full PostgreSQL migration with Row Level Security and pgvector search function.

---

## Quick Reference Summary

| Concern | Implementation | Location |
|---|---|---|
| **Auth Verification** | Supabase JWT parsed and validated | `backend/app/core/auth.py` |
| **Supabase Client (Backend)** | Python SDK with Service Role / Anon key | `backend/app/core/supabase.py` |
| **Supabase Client (Frontend)** | Browser Client with session tracking | `frontend/src/lib/supabase.ts` |
| **Typed API Client** | Automatically attaches Supabase session token | `frontend/src/lib/api.ts` |
| **Attendance Calculations** | Thapar 75% Rule (Section 6.2) | `backend/app/services/what_if_engine.py` |
| **RAG Campus Copilot** | Grounded citation retrieval with fallback | `backend/app/services/rag_engine.py` |
| **Reuse Impact Tracking** | Economic & Environmental impact engine | `backend/app/services/impact_engine.py` |
