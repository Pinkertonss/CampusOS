-- ============================================================
-- CampusOS · Migration 6 — Academic RBAC, Offerings & Teaching Scopes
-- ============================================================

-- 1. User Roles & Account Status
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('student', 'professor', 'admin')),
  status      text not null default 'active' check (status in ('active', 'suspended', 'inactive')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid,

  constraint user_roles_user_role_unique unique (user_id, role)
);

-- 2. Catalog Subjects
create table if not exists public.subjects (
  id          text primary key,
  code        text not null unique,
  name        text not null,
  credits     numeric(3,1) not null default 4.0 check (credits >= 1.0 and credits <= 10.0),
  department  text not null default 'COE',
  created_at  timestamptz not null default now()
);

-- 3. Subject Offerings (Delivery scoped by term and section)
create table if not exists public.subject_offerings (
  id                    text primary key,
  subject_id            text not null references public.subjects(id) on delete cascade,
  term                  text not null, -- e.g. 'Even Semester 2026'
  section               text not null, -- e.g. 'A', 'B', 'C'
  attendance_threshold  numeric(5,2) not null default 75.00 check (attendance_threshold >= 50.0 and attendance_threshold <= 100.0),
  grade_policy          text not null default 'standard_10_point',
  created_at            timestamptz not null default now(),

  constraint subject_offering_term_section_unique unique (subject_id, term, section)
);

-- 4. Teaching Assignments (Professor to Offering)
create table if not exists public.offering_professors (
  id           text primary key default gen_random_uuid()::text,
  offering_id  text not null references public.subject_offerings(id) on delete cascade,
  professor_id text not null,
  role         text not null default 'primary' check (role in ('primary', 'co_instructor', 'ta')),
  assigned_at  timestamptz not null default now(),
  assigned_by  text,

  constraint offering_professor_unique unique (offering_id, professor_id)
);

-- 5. Student Enrollments
create table if not exists public.offering_enrollments (
  id                text primary key default gen_random_uuid()::text,
  offering_id       text not null references public.subject_offerings(id) on delete cascade,
  student_id        text not null,
  status            text not null default 'active' check (status in ('active', 'dropped', 'disenrolled')),
  enrolled_at       timestamptz not null default now(),
  disenrolled_at    timestamptz,
  disenroll_reason  text,

  constraint offering_student_enrollment_unique unique (offering_id, student_id)
);

-- 6. Attendance Sessions & Records
create table if not exists public.attendance_sessions (
  id            text primary key default gen_random_uuid()::text,
  offering_id   text not null references public.subject_offerings(id) on delete cascade,
  session_date  date not null,
  slot_type     text not null default 'Lecture' check (slot_type in ('Lecture', 'Lab', 'Tutorial', 'Extra')),
  is_cancelled  boolean not null default false,
  created_by    text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.session_attendance_records (
  id                 text primary key default gen_random_uuid()::text,
  session_id         text not null references public.attendance_sessions(id) on delete cascade,
  student_id         text not null,
  status             text not null check (status in ('present', 'absent', 'late', 'excused')),
  correction_reason  text,
  marked_by          text not null,
  updated_at         timestamptz not null default now(),

  constraint session_student_attendance_unique unique (session_id, student_id)
);

-- 7. Assessments & Student Marks
create table if not exists public.offering_assessments (
  id                   text primary key default gen_random_uuid()::text,
  offering_id          text not null references public.subject_offerings(id) on delete cascade,
  title                text not null,
  assessment_type      text not null check (assessment_type in ('Quiz', 'MST', 'EST', 'Assignment', 'Lab Exam', 'Project')),
  max_marks            numeric(7,2) not null check (max_marks > 0),
  weight_percent       numeric(5,2) not null default 0.0 check (weight_percent >= 0 and weight_percent <= 100),
  due_date             timestamptz,
  is_published         boolean not null default false,
  answer_key_content   text,
  answer_key_released  boolean not null default false,
  created_by           text not null,
  created_at           timestamptz not null default now()
);

create table if not exists public.student_assessment_marks (
  id                 text primary key default gen_random_uuid()::text,
  assessment_id      text not null references public.offering_assessments(id) on delete cascade,
  student_id         text not null,
  obtained_marks     numeric(7,2),
  status             text not null default 'not_graded' check (status in ('graded', 'not_graded', 'absent', 'exempt')),
  feedback           text,
  correction_reason  text,
  graded_by          text,
  updated_at         timestamptz not null default now(),

  constraint assessment_student_mark_unique unique (assessment_id, student_id)
);

-- 8. Assignments & Submissions
create table if not exists public.offering_assignments (
  id                     text primary key default gen_random_uuid()::text,
  offering_id            text not null references public.subject_offerings(id) on delete cascade,
  title                  text not null,
  instructions           text not null,
  due_date               timestamptz not null,
  allowed_formats        text[] not null default array['pdf', 'docx', 'zip', 'txt'],
  max_file_size_mb       int not null default 10 check (max_file_size_mb > 0 and max_file_size_mb <= 50),
  allow_late             boolean not null default true,
  allow_resubmission     boolean not null default true,
  is_published           boolean not null default false,
  model_answer           text,
  model_answer_released  boolean not null default false,
  created_by             text not null,
  created_at             timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id               text primary key default gen_random_uuid()::text,
  assignment_id    text not null references public.offering_assignments(id) on delete cascade,
  student_id       text not null,
  submission_text  text,
  file_name        text,
  storage_path     text,
  submitted_at     timestamptz not null default now(),
  version          int not null default 1,
  is_late          boolean not null default false,
  score            numeric(7,2),
  feedback         text,
  graded_by        text,
  graded_at        timestamptz,

  constraint assignment_student_submission_version_unique unique (assignment_id, student_id, version)
);

-- 9. Offering Announcements
create table if not exists public.offering_announcements (
  id                  text primary key default gen_random_uuid()::text,
  offering_id         text not null references public.subject_offerings(id) on delete cascade,
  title               text not null,
  content             text not null,
  target_group        text not null default 'all' check (target_group in ('all', 'selected', 'low_attendance', 'academic_support')),
  target_student_ids  text[] default array[]::text[],
  created_by          text not null,
  created_at          timestamptz not null default now()
);

-- 10. Academic Audit Logs (Append-only)
create table if not exists public.academic_audit_logs (
  id           text primary key default gen_random_uuid()::text,
  timestamp    timestamptz not null default now(),
  actor_id     text not null,
  actor_role   text not null,
  action       text not null,
  offering_id  text,
  resource_id  text,
  details      jsonb not null default '{}'::jsonb,
  reason       text
);

-- Indexes for performance & tenant isolation
create index if not exists idx_subject_offerings_subject on public.subject_offerings(subject_id);
create index if not exists idx_offering_professors_prof on public.offering_professors(professor_id);
create index if not exists idx_offering_enrollments_student on public.offering_enrollments(student_id);
create index if not exists idx_attendance_sessions_offering on public.attendance_sessions(offering_id);
create index if not exists idx_session_attendance_student on public.session_attendance_records(student_id);
create index if not exists idx_assessments_offering on public.offering_assessments(offering_id);
create index if not exists idx_marks_student on public.student_assessment_marks(student_id);
create index if not exists idx_assignments_offering on public.offering_assignments(offering_id);
create index if not exists idx_submissions_student on public.assignment_submissions(student_id);
create index if not exists idx_audit_offering on public.academic_audit_logs(offering_id);
