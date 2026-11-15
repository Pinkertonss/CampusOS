-- CampusOS · Migration 4 — Academic RBAC Database-Level RLS & Profile Privacy Hardening
-- Enforces zero-trust database-level authorization across all academic, offering, and experience profile tables.

-- ============================================================
-- 1. Student Experience Profile Privacy Hardening (BUG-04)
-- ============================================================

-- Add explicit resume sharing consent column (distinct from candidate discovery visibility)
alter table public.student_experience_profiles
    add column if not exists resume_sharing_opt_in boolean not null default false;

-- Drop the overly broad select policy that exposed entire profile rows
drop policy if exists "Authorized opportunity managers and faculty can view opted-in student profiles"
    on public.student_experience_profiles;

-- Restrict full profile table SELECT strictly to profile owner or verified administrators
drop policy if exists "student_experience_profiles_owner_or_admin_select" on public.student_experience_profiles;
create policy "student_experience_profiles_owner_or_admin_select"
    on public.student_experience_profiles
    for select
    using (
        auth.uid() = user_id
        or exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid() and ur.role = 'admin' and ur.status = 'active'
        )
    );

-- Create secure minimal candidate discovery projection (excludes private storage paths and raw file IDs)
create or replace view public.candidate_discovery_projections with (security_invoker = true) as
select
    p.user_id as student_id,
    p.full_name as student_name,
    p.roll_no as student_roll_no,
    (p.education->0->>'branch') as student_branch,
    (p.education->0->>'semester')::int as semester,
    (p.education->0->>'graduation_year')::int as graduation_year,
    (p.education->0->>'cgpa_verified')::numeric as cgpa_verified,
    p.skills,
    p.career_interests,
    p.preferred_opportunity_types,
    p.discovery_opt_in,
    p.resume_sharing_opt_in,
    (p.resume_file_name is not null) as has_resume,
    p.updated_at
from public.student_experience_profiles p
where p.discovery_opt_in = true;

grant select on public.candidate_discovery_projections to authenticated;


-- ============================================================
-- 2. Academic RBAC Database-Level Row Level Security (BUG-03)
-- ============================================================

-- Helper functions for trusted role checks (avoids recursion)
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
    select exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role = 'admin' and status = 'active'
    );
$$;

create or replace function public.is_assigned_professor(p_offering_id text)
returns boolean language sql stable security definer as $$
    select exists (
        select 1 from public.offering_professors
        where offering_id = p_offering_id and professor_id = auth.uid()
    );
$$;

create or replace function public.is_enrolled_student(p_offering_id text)
returns boolean language sql stable security definer as $$
    select exists (
        select 1 from public.offering_enrollments
        where offering_id = p_offering_id and student_id = auth.uid() and status = 'active'
    );
$$;

-- Table 1: user_roles
alter table public.user_roles enable row level security;

create policy "user_roles_select_self_or_admin"
    on public.user_roles for select
    using (user_id = auth.uid() or public.is_admin());

create policy "user_roles_admin_manage"
    on public.user_roles for all
    using (public.is_admin())
    with check (public.is_admin());


-- Table 2: subjects
alter table public.subjects enable row level security;

create policy "subjects_select_authenticated"
    on public.subjects for select
    to authenticated
    using (true);

create policy "subjects_admin_manage"
    on public.subjects for all
    using (public.is_admin())
    with check (public.is_admin());


-- Table 3: subject_offerings
alter table public.subject_offerings enable row level security;

create policy "subject_offerings_select"
    on public.subject_offerings for select
    to authenticated
    using (true);

create policy "subject_offerings_admin_manage"
    on public.subject_offerings for all
    using (public.is_admin())
    with check (public.is_admin());


-- Table 4: offering_professors
alter table public.offering_professors enable row level security;

create policy "offering_professors_select"
    on public.offering_professors for select
    to authenticated
    using (true);

create policy "offering_professors_admin_manage"
    on public.offering_professors for all
    using (public.is_admin())
    with check (public.is_admin());


-- Table 5: offering_enrollments
alter table public.offering_enrollments enable row level security;

create policy "offering_enrollments_select"
    on public.offering_enrollments for select
    using (
        student_id = auth.uid()
        or public.is_assigned_professor(offering_id)
        or public.is_admin()
    );

create policy "offering_enrollments_faculty_admin_manage"
    on public.offering_enrollments for insert
    with check (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    );

create policy "offering_enrollments_faculty_admin_update"
    on public.offering_enrollments for update
    using (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    )
    with check (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    );


-- Table 6: attendance_sessions
alter table public.attendance_sessions enable row level security;

create policy "attendance_sessions_select"
    on public.attendance_sessions for select
    using (
        public.is_enrolled_student(offering_id)
        or public.is_assigned_professor(offering_id)
        or public.is_admin()
    );

create policy "attendance_sessions_faculty_admin_manage"
    on public.attendance_sessions for all
    using (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    )
    with check (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    );


-- Table 7: session_attendance_records
alter table public.session_attendance_records enable row level security;

create policy "session_attendance_records_select"
    on public.session_attendance_records for select
    using (
        student_id = auth.uid()
        or exists (
            select 1 from public.attendance_sessions s
            where s.id = session_id
            and (public.is_assigned_professor(s.offering_id) or public.is_admin())
        )
    );

create policy "session_attendance_records_faculty_admin_insert"
    on public.session_attendance_records for insert
    with check (
        exists (
            select 1 from public.attendance_sessions s
            where s.id = session_id
            and (public.is_assigned_professor(s.offering_id) or public.is_admin())
        )
    );

create policy "session_attendance_records_faculty_admin_update"
    on public.session_attendance_records for update
    using (
        exists (
            select 1 from public.attendance_sessions s
            where s.id = session_id
            and (public.is_assigned_professor(s.offering_id) or public.is_admin())
        )
    )
    with check (
        exists (
            select 1 from public.attendance_sessions s
            where s.id = session_id
            and (public.is_assigned_professor(s.offering_id) or public.is_admin())
        )
    );


-- Table 8: offering_assessments
alter table public.offering_assessments enable row level security;

create policy "offering_assessments_select"
    on public.offering_assessments for select
    using (
        (is_published = true and public.is_enrolled_student(offering_id))
        or public.is_assigned_professor(offering_id)
        or public.is_admin()
    );

create policy "offering_assessments_faculty_admin_manage"
    on public.offering_assessments for all
    using (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    )
    with check (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    );


-- Table 9: student_assessment_marks
alter table public.student_assessment_marks enable row level security;

create policy "student_assessment_marks_select"
    on public.student_assessment_marks for select
    using (
        (student_id = auth.uid() and status = 'published')
        or exists (
            select 1 from public.offering_assessments a
            where a.id = assessment_id
            and (public.is_assigned_professor(a.offering_id) or public.is_admin())
        )
    );

create policy "student_assessment_marks_faculty_admin_manage"
    on public.student_assessment_marks for all
    using (
        exists (
            select 1 from public.offering_assessments a
            where a.id = assessment_id
            and (public.is_assigned_professor(a.offering_id) or public.is_admin())
        )
    )
    with check (
        exists (
            select 1 from public.offering_assessments a
            where a.id = assessment_id
            and (public.is_assigned_professor(a.offering_id) or public.is_admin())
        )
    );


-- Table 10: offering_assignments
alter table public.offering_assignments enable row level security;

create policy "offering_assignments_select"
    on public.offering_assignments for select
    using (
        (is_published = true and public.is_enrolled_student(offering_id))
        or public.is_assigned_professor(offering_id)
        or public.is_admin()
    );

create policy "offering_assignments_faculty_admin_manage"
    on public.offering_assignments for all
    using (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    )
    with check (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    );


-- Table 11: assignment_submissions
alter table public.assignment_submissions enable row level security;

create policy "assignment_submissions_select"
    on public.assignment_submissions for select
    using (
        student_id = auth.uid()
        or exists (
            select 1 from public.offering_assignments a
            where a.id = assignment_id
            and (public.is_assigned_professor(a.offering_id) or public.is_admin())
        )
    );

create policy "assignment_submissions_student_insert"
    on public.assignment_submissions for insert
    with check (
        student_id = auth.uid()
        and exists (
            select 1 from public.offering_assignments a
            where a.id = assignment_id
            and a.is_published = true
            and public.is_enrolled_student(a.offering_id)
        )
    );

create policy "assignment_submissions_faculty_admin_grade"
    on public.assignment_submissions for update
    using (
        exists (
            select 1 from public.offering_assignments a
            where a.id = assignment_id
            and (public.is_assigned_professor(a.offering_id) or public.is_admin())
        )
    )
    with check (
        exists (
            select 1 from public.offering_assignments a
            where a.id = assignment_id
            and (public.is_assigned_professor(a.offering_id) or public.is_admin())
        )
    );


-- Table 12: offering_announcements
alter table public.offering_announcements enable row level security;

create policy "offering_announcements_select"
    on public.offering_announcements for select
    using (
        public.is_enrolled_student(offering_id)
        or public.is_assigned_professor(offering_id)
        or public.is_admin()
    );

create policy "offering_announcements_faculty_admin_manage"
    on public.offering_announcements for all
    using (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    )
    with check (
        public.is_assigned_professor(offering_id)
        or public.is_admin()
    );


-- Table 13: academic_audit_logs (Immutable Audit Trail)
alter table public.academic_audit_logs enable row level security;

create policy "academic_audit_logs_select"
    on public.academic_audit_logs for select
    using (
        public.is_admin()
        or (offering_id is not null and public.is_assigned_professor(offering_id))
    );

create policy "academic_audit_logs_insert"
    on public.academic_audit_logs for insert
    with check (true);

-- Explicitly disallow UPDATE and DELETE on audit logs for all ordinary users
-- (No update/delete policy defined, ensuring absolute immutability)
