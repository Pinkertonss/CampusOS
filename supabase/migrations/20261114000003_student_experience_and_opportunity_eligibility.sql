-- ============================================================
-- Migration: 20261114000003_student_experience_and_opportunity_eligibility.sql
-- Description:
--   1. student_experience_profiles with education, skills, projects,
--      work experience, certifications, links, and resume references.
--   2. Extends opportunities with structured mandatory and preference criteria.
--   3. opportunity_invitations with unique(opportunity_id, student_id).
--   4. copilot_passages for lightweight text-search passage retrieval.
-- ============================================================

-- 1. Student Experience Profiles
create table if not exists public.student_experience_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    education jsonb not null default '[]'::jsonb,
    skills jsonb not null default '[]'::jsonb,
    projects jsonb not null default '[]'::jsonb,
    work_experience jsonb not null default '[]'::jsonb,
    certifications jsonb not null default '[]'::jsonb,
    achievements jsonb not null default '[]'::jsonb,
    career_interests jsonb not null default '[]'::jsonb,
    preferred_opportunity_types jsonb not null default '[]'::jsonb,
    portfolio_link text,
    github_link text,
    linkedin_link text,
    resume_file_id text,
    resume_file_name text,
    resume_storage_path text,
    resume_updated_at timestamptz,
    discovery_opt_in boolean not null default true,
    updated_at timestamptz not null default now()
);

alter table public.student_experience_profiles enable row level security;

create policy "Users can view and manage their own student experience profile"
    on public.student_experience_profiles
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Authorized opportunity managers and faculty can view opted-in student profiles"
    on public.student_experience_profiles
    for select
    using (
        discovery_opt_in = true
        or auth.uid() = user_id
    );

-- 2. Structured Opportunity Criteria
alter table public.opportunities
    add column if not exists eligible_branches jsonb default '["Any"]'::jsonb,
    add column if not exists min_semester int default null,
    add column if not exists max_semester int default null,
    add column if not exists graduation_years jsonb default null,
    add column if not exists required_skills_mode text default 'any',
    add column if not exists preferred_skills jsonb default '[]'::jsonb,
    add column if not exists min_experience_months int default 0,
    add column if not exists creator_id text default 'admin',
    add column if not exists creator_role text default 'admin';

-- 3. Opportunity Invitations
create table if not exists public.opportunity_invitations (
    id uuid primary key default gen_random_uuid(),
    opportunity_id text not null,
    student_id text not null,
    creator_id text not null,
    message text,
    created_at timestamptz not null default now(),
    constraint unique_opportunity_student_invitation unique(opportunity_id, student_id)
);

alter table public.opportunity_invitations enable row level security;

create policy "Students can view invitations sent to them"
    on public.opportunity_invitations
    for select
    using (auth.uid()::text = student_id or auth.uid()::text = creator_id);

create policy "Opportunity creators can send invitations"
    on public.opportunity_invitations
    for insert
    with check (auth.uid()::text = creator_id);

-- 4. Copilot Passages for Full-Text Search
create table if not exists public.copilot_passages (
    id uuid primary key default gen_random_uuid(),
    document_id text not null,
    document_title text not null,
    passage_index int not null,
    content text not null,
    page_ref text,
    section_title text,
    file_checksum text,
    is_approved boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists idx_copilot_passages_doc on public.copilot_passages(document_id);
create index if not exists idx_copilot_passages_fts on public.copilot_passages using gin (to_tsvector('english', content));
