# CampusOS Architecture & Developer Documentation

This directory contains developer documentation, architectural decisions, and security guidelines for the CampusOS pilot deployment at Thapar Institute of Engineering & Technology (TIET).

---

## Documents in this folder

- **[Architecture Overview](architecture.md)**: Technical breakdown of Next.js App Router, FastAPI backend, and Supabase database.
- **[Authentication & JWT Verification](auth_flow.md)**: Details on Supabase JWT verification flow from `Authorization: Bearer <token>` through FastAPI dependency.
- **[Implementation Status](implementation-status.md)**: Current completion matrix tracking all 8 project phases.
- **[Latest Verification Report](verification/latest.md)**: Evidence-based verification report covering automated and deployed test runs.
- **[Copilot Document Ingestion](copilot_ingestion.md)**: Guide on indexing TIET ordinances and policies into vector embeddings.

---

## Feature Matrix Summary

| Concern | Implementation | Location |
|---|---|---|
| **Auth Verification** | Cryptographic HMAC/RSA signature & expiration checks | `backend/app/core/auth.py` |
| **Tenant Isolation** | Scoped multi-tenant maps & PostgreSQL RLS | Cross-route dependencies |
| **Attendance Math** | Thapar Section 6.2 (Safe, Warning, Critical) | `backend/app/services/planner.py` |
| **Decision Intelligence** | Cross-module schedule collision & focus banner | `backend/app/services/planner.py` |
| **Opportunity Matching** | Multi-factor skill, feasibility & collision scoring | `backend/app/services/opportunity_engine.py` |
| **RAG Campus Copilot** | Grounded citation retrieval with prompt injection defenses | `backend/app/services/rag_engine.py` |
| **Digital Vault** | Owner-isolated storage with streaming & safe filenames | `backend/app/routers/vault.py` |
| **Reuse Impact Tracking** | Two-party bilateral completion & SDG 12 engine | `backend/app/services/impact_engine.py` |
