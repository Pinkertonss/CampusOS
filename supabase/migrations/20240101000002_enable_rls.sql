-- ============================================================
-- CampusOS · Migration 2 — Row Level Security policies
-- ============================================================

-- ========== Enable RLS on every table =======================

alter table public.profiles           enable row level security;
alter table public.courses            enable row level security;
alter table public.timetable_slots    enable row level security;
alter table public.attendance_records enable row level security;
alter table public.assessments        enable row level security;
alter table public.tasks              enable row level security;
alter table public.vault_items        enable row level security;
alter table public.campus_documents   enable row level security;
alter table public.document_chunks    enable row level security;
alter table public.listings           enable row level security;
alter table public.exchange_requests  enable row level security;
alter table public.impact_events      enable row level security;

-- ========== Helper: admin check =============================
-- Admins are identified by app_metadata.role = 'admin' set via
-- Supabase Dashboard → Authentication → Users → Edit user.
-- Usage in policies: public.is_admin()

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ============================================================
-- Personal tables: users CRUD only their own rows
-- ============================================================

-- ---- profiles ------------------------------------------------
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- ---- courses -------------------------------------------------
create policy "Users can view own courses"
  on public.courses for select
  using (auth.uid() = user_id);

create policy "Users can insert own courses"
  on public.courses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own courses"
  on public.courses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own courses"
  on public.courses for delete
  using (auth.uid() = user_id);

-- ---- timetable_slots -----------------------------------------
create policy "Users can view own timetable"
  on public.timetable_slots for select
  using (auth.uid() = user_id);

create policy "Users can insert own timetable"
  on public.timetable_slots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own timetable"
  on public.timetable_slots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own timetable"
  on public.timetable_slots for delete
  using (auth.uid() = user_id);

-- ---- attendance_records --------------------------------------
create policy "Users can view own attendance"
  on public.attendance_records for select
  using (auth.uid() = user_id);

create policy "Users can insert own attendance"
  on public.attendance_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update own attendance"
  on public.attendance_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own attendance"
  on public.attendance_records for delete
  using (auth.uid() = user_id);

-- ---- assessments ---------------------------------------------
create policy "Users can view own assessments"
  on public.assessments for select
  using (auth.uid() = user_id);

create policy "Users can insert own assessments"
  on public.assessments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own assessments"
  on public.assessments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own assessments"
  on public.assessments for delete
  using (auth.uid() = user_id);

-- ---- tasks ---------------------------------------------------
create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- ---- vault_items ---------------------------------------------
create policy "Users can view own vault items"
  on public.vault_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own vault items"
  on public.vault_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own vault items"
  on public.vault_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own vault items"
  on public.vault_items for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Marketplace tables: readable by all authenticated users,
-- writable only by owner
-- ============================================================

-- ---- listings ------------------------------------------------
create policy "Authenticated users can view all listings"
  on public.listings for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own listings"
  on public.listings for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own listings"
  on public.listings for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete own listings"
  on public.listings for delete
  using (auth.uid() = owner_id);

-- ---- exchange_requests ---------------------------------------
-- Requester can see their own requests; listing owner can also see
-- requests on their listings (to accept/decline them).
create policy "Requester can view own requests"
  on public.exchange_requests for select
  using (auth.uid() = requester_id);

create policy "Listing owner can view requests on their listings"
  on public.exchange_requests for select
  using (
    auth.uid() in (
      select owner_id from public.listings where id = listing_id
    )
  );

create policy "Authenticated users can create requests"
  on public.exchange_requests for insert
  with check (auth.uid() = requester_id);

-- Owner can accept/decline; requester can update their own
create policy "Owner or requester can update request"
  on public.exchange_requests for update
  using (
    auth.uid() = requester_id
    or auth.uid() in (
      select owner_id from public.listings where id = listing_id
    )
  );

create policy "Requester can delete own request"
  on public.exchange_requests for delete
  using (auth.uid() = requester_id);

-- ---- impact_events -------------------------------------------
-- Readable by all authenticated (community stats); insertable by system/admin
create policy "Authenticated users can view impact events"
  on public.impact_events for select
  using (auth.role() = 'authenticated');

create policy "Admin can insert impact events"
  on public.impact_events for insert
  with check (public.is_admin());

-- Also allow listing owners to log impact when completing an exchange
create policy "Listing owner can insert impact event"
  on public.impact_events for insert
  with check (
    auth.uid() in (
      select owner_id from public.listings where id = listing_id
    )
  );

-- ============================================================
-- Admin-only tables: readable by authenticated, writable by admin
-- ============================================================

-- ---- campus_documents ----------------------------------------
create policy "Authenticated users can view approved documents"
  on public.campus_documents for select
  using (auth.role() = 'authenticated');

create policy "Admin can insert documents"
  on public.campus_documents for insert
  with check (public.is_admin());

create policy "Admin can update documents"
  on public.campus_documents for update
  using (public.is_admin());

create policy "Admin can delete documents"
  on public.campus_documents for delete
  using (public.is_admin());

-- ---- document_chunks -----------------------------------------
create policy "Authenticated users can view chunks"
  on public.document_chunks for select
  using (auth.role() = 'authenticated');

create policy "Admin can insert chunks"
  on public.document_chunks for insert
  with check (public.is_admin());

create policy "Admin can update chunks"
  on public.document_chunks for update
  using (public.is_admin());

create policy "Admin can delete chunks"
  on public.document_chunks for delete
  using (public.is_admin());
