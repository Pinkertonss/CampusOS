-- ============================================================
-- CampusOS · Migration 1 — Create all tables
-- ============================================================

-- --------------------------------------------------------
-- 1. profiles
-- --------------------------------------------------------
create table public.profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  full_name  text not null,
  roll_no    text not null,
  branch     text not null,
  semester   int  not null default 1,
  consent_given boolean not null default false,
  created_at timestamptz not null default now(),

  constraint profiles_user_id_unique unique (user_id)
);

-- --------------------------------------------------------
-- 2. courses
-- --------------------------------------------------------
create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  code              text not null,
  name              text not null,
  credits           int  not null default 3,
  target_attendance numeric(5,2) not null default 75.00,
  created_at        timestamptz not null default now(),

  constraint courses_user_code_unique unique (user_id, code)
);

-- --------------------------------------------------------
-- 3. timetable_slots
-- --------------------------------------------------------
create table public.timetable_slots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),  -- 0=Mon … 6=Sun
  start_time time not null,
  end_time   time not null,
  room       text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------
-- 4. attendance_records
-- --------------------------------------------------------
create table public.attendance_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  date       date not null,
  status     text not null check (status in ('present', 'absent', 'cancelled')),
  created_at timestamptz not null default now(),

  constraint attendance_one_per_course_date unique (user_id, course_id, date)
);

-- --------------------------------------------------------
-- 5. assessments
-- --------------------------------------------------------
create table public.assessments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  name            text not null,
  weight_percent  numeric(5,2) not null,
  max_marks       numeric(7,2) not null,
  obtained_marks  numeric(7,2),           -- null = not yet graded
  due_date        date,                    -- null = no deadline (e.g. classwork)
  created_at      timestamptz not null default now()
);

-- --------------------------------------------------------
-- 6. tasks
-- --------------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  due_date    date,
  source      text not null check (source in ('manual', 'notice', 'assessment')),
  source_ref  text,                        -- e.g. assessment id or notice url
  status      text not null default 'pending' check (status in ('pending', 'done')),
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------
-- 7. vault_items
-- --------------------------------------------------------
create table public.vault_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  category     text not null check (category in ('notes', 'certificate', 'academic', 'other')),
  storage_path text not null,              -- Supabase Storage path
  mime_type    text not null,
  size_bytes   bigint not null default 0,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------
-- 8. campus_documents  (admin-managed corpus for RAG)
-- --------------------------------------------------------
create table public.campus_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  source_label text not null,              -- e.g. "Academic Section", "Dean Office"
  storage_path text,                        -- optional blob in campus-docs bucket
  uploaded_by  uuid references auth.users(id) on delete set null,
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------
-- 9. document_chunks  (RAG vector store)
-- --------------------------------------------------------
-- Using 768 dimensions (Gemini text-embedding-004 default).
-- Change to 1536 if using OpenAI text-embedding-3-small / ada-002.
create table public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.campus_documents(id) on delete cascade,
  chunk_index  int  not null,
  content      text not null,
  page_ref     text,                        -- e.g. "p.3", "Section 4.2"
  embedding    vector(768),                 -- set dimension to match your model
  created_at   timestamptz not null default now(),

  constraint chunks_doc_index_unique unique (document_id, chunk_index)
);

-- Index for fast cosine-similarity search
create index on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- --------------------------------------------------------
-- 10. listings  (Campus Reuse marketplace)
-- --------------------------------------------------------
create table public.listings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  category    text not null check (category in ('book', 'calculator', 'labcoat', 'other')),
  mode        text not null check (mode in ('exchange', 'donate', 'borrow')),
  status      text not null default 'available' check (status in ('available', 'reserved', 'completed')),
  condition   text,                         -- e.g. "Good", "Like New", "Fair"
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------
-- 11. exchange_requests
-- --------------------------------------------------------
create table public.exchange_requests (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed')),
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------
-- 12. impact_events
-- --------------------------------------------------------
create table public.impact_events (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  event_type   text not null check (event_type in ('exchange', 'donation', 'loan')),
  completed_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
