-- ============================================================
-- CampusOS · Migration 5 — Reconcile Academic Schema (Phase 2)
-- ============================================================
-- 1. Extend tasks table to support copilot/syllabus sources and priority
-- 2. Extend courses table with aggregate attendance counter columns
-- 3. Enforce invariant: 0 <= attended_classes <= total_classes
-- ============================================================

-- 1. tasks schema update
alter table public.tasks
  drop constraint if exists tasks_source_check;

alter table public.tasks
  add constraint tasks_source_check
  check (source in ('manual', 'notice', 'assessment', 'copilot_action', 'syllabus'));

alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('pending', 'done', 'completed'));

alter table public.tasks
  add column if not exists priority text not null default 'medium'
  check (priority in ('urgent', 'high', 'medium', 'low'));

alter table public.tasks
  add column if not exists course_code text;

-- 2. courses aggregate attendance counters (reconciliation between daily records & UI counters)
alter table public.courses
  add column if not exists attended_classes int not null default 0;

alter table public.courses
  add column if not exists total_classes int not null default 0;

alter table public.courses
  drop constraint if exists courses_attendance_counters_valid;

alter table public.courses
  add constraint courses_attendance_counters_valid
  check (attended_classes >= 0 and total_classes >= 0 and attended_classes <= total_classes);
