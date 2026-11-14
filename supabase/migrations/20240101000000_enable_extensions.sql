-- ============================================================
-- CampusOS · Migration 0 — Enable extensions
-- ============================================================

-- pgvector for RAG embeddings (cosine similarity search)
create extension if not exists vector with schema public;

-- pgcrypto for gen_random_uuid() (available by default in Supabase,
-- but explicit is safer for local dev / self-hosted)
create extension if not exists pgcrypto with schema public;
