-- ============================================================
-- CampusOS · Seed Data
-- ============================================================
-- Realistic sample data for one demo student at Thapar Institute.
--
-- IMPORTANT: This file references a demo user UUID. In production,
-- users are created through Supabase Auth. For local dev:
--   1. Sign up a user via the Supabase Auth UI / API
--   2. Replace the UUID below with the real user's auth.users.id
--   OR use the backend's dev-mode fallback (Bearer dev-user-102203099)
-- ============================================================

-- Demo user UUID (deterministic for reproducibility)
-- In dev mode, create this user in Supabase Auth first, or use the
-- backend's in-memory data store which doesn't require Supabase.

do $$
declare
  demo_uid  uuid := '00000000-0000-0000-0000-000102203099';

  -- Course IDs (deterministic)
  c_daa     uuid := '11111111-1111-1111-1111-111111111001';
  c_cn      uuid := '11111111-1111-1111-1111-111111111002';
  c_os      uuid := '11111111-1111-1111-1111-111111111003';
  c_cd      uuid := '11111111-1111-1111-1111-111111111004';
  c_se      uuid := '11111111-1111-1111-1111-111111111005';
  c_ps      uuid := '11111111-1111-1111-1111-111111111006';

  d         date;       -- loop variable for attendance dates
  dow       int;        -- day of week (0=Sun … 6=Sat in extract, but we adjust)
begin

  -- ========================================================
  -- 1. PROFILE
  -- ========================================================
  insert into public.profiles (user_id, full_name, roll_no, branch, semester, consent_given)
  values (demo_uid, 'Arjun Mehta', '102203099', 'COE', 5, true);

  -- ========================================================
  -- 2. COURSES  (6 courses, 5th semester COE @ TIET)
  -- ========================================================
  insert into public.courses (id, user_id, code, name, credits, target_attendance) values
    (c_daa, demo_uid, 'UCS503', 'Design & Analysis of Algorithms', 4, 75),
    (c_cn,  demo_uid, 'UCS505', 'Computer Networks',               4, 75),
    (c_os,  demo_uid, 'UCS507', 'Operating Systems',               4, 75),
    (c_cd,  demo_uid, 'UCS509', 'Compiler Design',                 3, 75),
    (c_se,  demo_uid, 'UCS511', 'Software Engineering',            3, 75),
    (c_ps,  demo_uid, 'UMA502', 'Probability & Statistics',        3, 75);

  -- ========================================================
  -- 3. TIMETABLE  (Mon–Fri schedule)
  -- ========================================================
  -- weekday: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
  insert into public.timetable_slots (user_id, course_id, weekday, start_time, end_time, room) values
    -- Monday
    (demo_uid, c_daa, 0, '08:00', '08:50', 'LH-101'),
    (demo_uid, c_cn,  0, '09:00', '09:50', 'LH-202'),
    (demo_uid, c_os,  0, '11:00', '11:50', 'LH-101'),
    (demo_uid, c_se,  0, '14:00', '14:50', 'D-301'),
    -- Tuesday
    (demo_uid, c_ps,  1, '08:00', '08:50', 'LH-303'),
    (demo_uid, c_cd,  1, '09:00', '09:50', 'LH-202'),
    (demo_uid, c_daa, 1, '10:00', '10:50', 'LH-101'),
    (demo_uid, c_cn,  1, '14:00', '15:50', 'Lab-C1'),  -- 2-hr lab
    -- Wednesday
    (demo_uid, c_os,  2, '08:00', '08:50', 'LH-101'),
    (demo_uid, c_se,  2, '09:00', '09:50', 'D-301'),
    (demo_uid, c_daa, 2, '11:00', '11:50', 'LH-101'),
    (demo_uid, c_ps,  2, '14:00', '14:50', 'LH-303'),
    -- Thursday
    (demo_uid, c_cd,  3, '08:00', '08:50', 'LH-202'),
    (demo_uid, c_cn,  3, '09:00', '09:50', 'LH-202'),
    (demo_uid, c_os,  3, '10:00', '11:50', 'Lab-A2'),  -- 2-hr lab
    (demo_uid, c_ps,  3, '14:00', '14:50', 'LH-303'),
    -- Friday
    (demo_uid, c_daa, 4, '08:00', '08:50', 'LH-101'),
    (demo_uid, c_cd,  4, '09:00', '09:50', 'LH-202'),
    (demo_uid, c_se,  4, '10:00', '10:50', 'D-301'),
    (demo_uid, c_os,  4, '14:00', '14:50', 'LH-101');

  -- ========================================================
  -- 4. ATTENDANCE  (Sep 2 – Nov 8, 2024 ≈ 10 weeks)
  -- ========================================================
  -- Target attendance percentages (some intentionally below 75%):
  --   DAA:  ~80%  (OK)
  --   CN:   ~72%  (WARNING — below 75%)
  --   OS:   ~88%  (good)
  --   CD:   ~65%  (CRITICAL — well below 75%)
  --   SE:   ~83%  (OK)
  --   P&S:  ~70%  (WARNING)
  --
  -- We generate attendance per weekday class occurrence.
  -- The pattern uses a pseudo-random approach based on date to stay deterministic.

  for d in select generate_series('2024-09-02'::date, '2024-11-08'::date, '1 day'::interval)::date
  loop
    dow := extract(isodow from d)::int;  -- 1=Mon, 2=Tue, …, 5=Fri

    -- Skip weekends
    continue when dow > 5;

    -- Monday classes: DAA, CN, OS, SE
    if dow = 1 then
      -- DAA (80%): absent if day-of-month mod 5 = 0
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_daa, d,
        case when extract(day from d)::int % 5 = 0 then 'absent' else 'present' end);
      -- CN (72%): absent if mod 3 = 0 or mod 7 = 0
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_cn, d,
        case when extract(day from d)::int % 3 = 0 or extract(day from d)::int % 11 = 0 then 'absent' else 'present' end);
      -- OS (88%): absent only if mod 8 = 0
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_os, d,
        case when extract(day from d)::int % 8 = 0 then 'absent' else 'present' end);
      -- SE (83%): absent if mod 6 = 0
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_se, d,
        case when extract(day from d)::int % 6 = 0 then 'absent' else 'present' end);
    end if;

    -- Tuesday classes: P&S, CD, DAA, CN(lab)
    if dow = 2 then
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_ps, d,
        case when extract(day from d)::int % 3 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_cd, d,
        case when extract(day from d)::int % 3 = 0 or extract(day from d)::int % 5 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_daa, d,
        case when extract(day from d)::int % 5 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_cn, d,
        case when extract(day from d)::int % 4 = 0 then 'absent' else 'present' end);
    end if;

    -- Wednesday classes: OS, SE, DAA, P&S
    if dow = 3 then
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_os, d,
        case when extract(day from d)::int % 9 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_se, d,
        case when extract(day from d)::int % 7 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_daa, d,
        case when extract(day from d)::int % 6 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_ps, d,
        case when extract(day from d)::int % 4 = 0 then 'absent' else 'present' end);
    end if;

    -- Thursday classes: CD, CN, OS(lab), P&S
    if dow = 4 then
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_cd, d,
        case when extract(day from d)::int % 2 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_cn, d,
        case when extract(day from d)::int % 5 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_os, d,
        case when extract(day from d)::int % 10 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_ps, d,
        case when extract(day from d)::int % 3 = 0 then 'absent' else 'present' end);
    end if;

    -- Friday classes: DAA, CD, SE, OS
    if dow = 5 then
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_daa, d,
        case when extract(day from d)::int % 7 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_cd, d,
        case when extract(day from d)::int % 3 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_se, d,
        case when extract(day from d)::int % 8 = 0 then 'absent' else 'present' end);
      insert into public.attendance_records (user_id, course_id, date, status)
      values (demo_uid, c_os, d,
        case when extract(day from d)::int % 11 = 0 then 'absent' else 'present' end);
    end if;

  end loop;

  -- ========================================================
  -- 5. ASSESSMENTS  (MSTs, assignments, quizzes)
  -- ========================================================
  -- MST-1 (already graded), MST-2 (some graded), assignments, end-sem (upcoming)

  insert into public.assessments (user_id, course_id, name, weight_percent, max_marks, obtained_marks, due_date) values
    -- DAA
    (demo_uid, c_daa, 'MST-1',       20, 30, 24,   '2024-09-20'),
    (demo_uid, c_daa, 'MST-2',       20, 30, 21,   '2024-10-25'),
    (demo_uid, c_daa, 'Assignment 1', 5, 20, 18,   '2024-09-15'),
    (demo_uid, c_daa, 'Assignment 2', 5, 20, 16,   '2024-10-20'),
    (demo_uid, c_daa, 'End Semester', 50, 100, null, '2024-12-05'),

    -- CN
    (demo_uid, c_cn, 'MST-1',        20, 30, 18,   '2024-09-20'),
    (demo_uid, c_cn, 'MST-2',        20, 30, 22,   '2024-10-25'),
    (demo_uid, c_cn, 'Lab Eval 1',   10, 25, 20,   '2024-10-01'),
    (demo_uid, c_cn, 'Lab Eval 2',   10, 25, null,  '2024-11-15'),
    (demo_uid, c_cn, 'End Semester',  40, 100, null, '2024-12-06'),

    -- OS
    (demo_uid, c_os, 'MST-1',        20, 30, 27,   '2024-09-21'),
    (demo_uid, c_os, 'MST-2',        20, 30, 25,   '2024-10-26'),
    (demo_uid, c_os, 'Lab Eval 1',   10, 30, 28,   '2024-10-03'),
    (demo_uid, c_os, 'Assignment 1',  5, 15, 13,   '2024-09-30'),
    (demo_uid, c_os, 'End Semester',  45, 100, null, '2024-12-07'),

    -- CD
    (demo_uid, c_cd, 'MST-1',        20, 30, 15,   '2024-09-22'),
    (demo_uid, c_cd, 'MST-2',        20, 30, 19,   '2024-10-27'),
    (demo_uid, c_cd, 'Assignment 1', 10, 20, 12,   '2024-10-05'),
    (demo_uid, c_cd, 'End Semester',  50, 100, null, '2024-12-08'),

    -- SE
    (demo_uid, c_se, 'MST-1',        15, 25, 20,   '2024-09-23'),
    (demo_uid, c_se, 'MST-2',        15, 25, 22,   '2024-10-28'),
    (demo_uid, c_se, 'Project Phase 1', 20, 50, 42, '2024-10-15'),
    (demo_uid, c_se, 'Project Phase 2', 20, 50, null, '2024-11-25'),
    (demo_uid, c_se, 'End Semester',  30, 75, null,  '2024-12-09'),

    -- P&S
    (demo_uid, c_ps, 'MST-1',        25, 40, 28,   '2024-09-24'),
    (demo_uid, c_ps, 'MST-2',        25, 40, 24,   '2024-10-29'),
    (demo_uid, c_ps, 'Tutorial Sheet', 10, 30, 22,  '2024-10-10'),
    (demo_uid, c_ps, 'End Semester',  40, 100, null, '2024-12-10');

  -- ========================================================
  -- 6. TASKS
  -- ========================================================
  insert into public.tasks (user_id, title, due_date, source, source_ref, status) values
    (demo_uid, 'Submit DAA Assignment 3',         '2024-11-15', 'assessment', null,              'pending'),
    (demo_uid, 'OS Lab Report — Process Scheduling', '2024-11-12', 'assessment', null,            'pending'),
    (demo_uid, 'SE Project Phase 2 Submission',   '2024-11-25', 'assessment', null,              'pending'),
    (demo_uid, 'Apply for Minor degree form',     '2024-11-20', 'notice',     'https://thapar.edu/notices/minor-degree-2024', 'pending'),
    (demo_uid, 'Register for Hackathon',          '2024-11-10', 'manual',     null,              'done'),
    (demo_uid, 'CN Lab Eval 2 prep',              '2024-11-15', 'assessment', null,              'pending'),
    (demo_uid, 'Return library books',            '2024-11-18', 'manual',     null,              'pending'),
    (demo_uid, 'MST-2 CD revision',              '2024-10-27', 'assessment', null,              'done');

  -- ========================================================
  -- 7. VAULT ITEMS  (sample stored documents)
  -- ========================================================
  insert into public.vault_items (user_id, title, category, storage_path, mime_type, size_bytes) values
    (demo_uid, 'DAA Lecture Notes — Week 1-4',    'notes',       demo_uid || '/notes/daa_notes_w1-4.pdf',   'application/pdf', 2048576),
    (demo_uid, 'Class 12 Marksheet',              'academic',    demo_uid || '/academic/class12_marks.pdf',  'application/pdf', 1024000),
    (demo_uid, 'Hackathon Certificate — CodeFest','certificate', demo_uid || '/certs/codefest_cert.pdf',     'application/pdf',  512000),
    (demo_uid, 'OS Lab Manual',                   'notes',       demo_uid || '/notes/os_lab_manual.pdf',     'application/pdf', 3145728);

  -- ========================================================
  -- 8. CAMPUS DOCUMENTS  (RAG corpus — approved notices)
  -- ========================================================
  insert into public.campus_documents (id, title, source_label, storage_path, uploaded_by, is_approved) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'Academic Calendar 2024-25',           'Academic Section',  'calendar_2024_25.pdf',  null, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'Attendance & Detention Policy',       'Dean of Students',  'attendance_policy.pdf', null, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'Hostel Rules & Regulations 2024',     'Chief Warden',      'hostel_rules.pdf',      null, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa004', 'Examination Guidelines',              'COE Office',        'exam_guidelines.pdf',   null, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa005', 'Library Borrowing Policy',            'Central Library',   'library_policy.pdf',    null, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa006', 'Anti-Ragging Committee Notice',       'Dean of Students',  'anti_ragging.pdf',      null, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa007', 'Minor Degree Registration Nov 2024',  'Academic Section',  'minor_degree_nov.pdf',  null, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa008', 'Placement Cell Guidelines 2024-25',   'T&P Cell',          'placement_guidelines.pdf', null, true);

  -- ========================================================
  -- 9. DOCUMENT CHUNKS  (text chunks, embeddings left null
  --    for now — populate via the embedding pipeline)
  -- ========================================================
  insert into public.document_chunks (document_id, chunk_index, content, page_ref) values
    -- Academic Calendar
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 0,
     'Odd Semester 2024-25: Classes begin August 5, 2024. MST-1: September 16-21. MST-2: October 21-26. Last teaching day: November 22. End Semester Exams: December 2-14. Winter break: December 16 - January 5.',
     'p.1'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 1,
     'Even Semester 2024-25: Classes begin January 6, 2025. MST-1: February 17-22. MST-2: March 24-29. Last teaching day: April 25. End Semester Exams: May 1-14.',
     'p.1'),
    -- Attendance Policy
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 0,
     'Minimum attendance requirement is 75% in each course. Students with attendance below 75% will be detained and not allowed to appear in end-semester examinations. Medical leave must be applied within 7 days with supporting documents to the Dean of Students office.',
     'Section 2.1'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 1,
     'Attendance shortage up to 10% may be condoned by the Dean on genuine medical grounds with valid documentation. Below 65% attendance leads to automatic detention with no possibility of condonation. Students can check their attendance on WebKiosk.',
     'Section 2.3'),
    -- Hostel Rules
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 0,
     'Hostel curfew timings: Entry closes at 10:30 PM on weekdays and 11:00 PM on weekends. Late entry requires prior written permission from the warden. Visitors are allowed in the common room only between 4:00 PM and 7:00 PM.',
     'Rule 5'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 1,
     'Mess timings: Breakfast 7:30-9:30 AM, Lunch 12:00-2:00 PM, Snacks 4:30-6:00 PM, Dinner 7:30-9:30 PM. Mess rebate must be applied at least 3 days in advance for a minimum of 7 consecutive days.',
     'Rule 8'),
    -- Exam Guidelines
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa004', 0,
     'Students must carry their Thapar ID card to every examination. Use of mobile phones or smart watches is strictly prohibited in the examination hall. Any student found using unfair means will be awarded zero marks and may face disciplinary action including rustication.',
     'Section 3'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa004', 1,
     'Re-appear examination: Students who fail in up to 4 subjects can appear in the re-appear exam held before the next semester. The re-appear fee is ₹1,000 per subject. Maximum marks obtainable in re-appear is capped at 50% for theory papers.',
     'Section 5'),
    -- Library Policy
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa005', 0,
     'Undergraduate students can borrow up to 4 books for a period of 14 days. Overdue fine is ₹5 per day per book. Reference books and journals cannot be borrowed and must be used within the library premises. Library hours: 8:00 AM to 11:00 PM on all working days.',
     'p.2'),
    -- Anti-Ragging
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa006', 0,
     'Ragging in any form is a punishable offense under UGC regulations. Complaints can be filed via the anti-ragging helpline (1800-180-5522), email antiragging@thapar.edu, or directly to the Anti-Ragging Committee. The institute has zero tolerance policy and offenders face immediate suspension.',
     'p.1'),
    -- Minor Degree
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa007', 0,
     'Applications for Minor Degree registration are open for 3rd and 5th semester students. Deadline: November 20, 2024. Eligible branches: CSE, COE, ECE, EE, ME, CE. Students must have a CGPA of 7.0 or above with no active backlogs. Apply through the Academic Section portal.',
     'p.1'),
    -- Placement Guidelines
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa008', 0,
     'Training & Placement Cell registration opens in 7th semester. Students must have minimum 60% aggregate (no active backlogs) to participate. Dream offer policy: Students placed in a company offering less than ₹8 LPA can sit for companies offering ₹8 LPA or above. Super-dream category is ₹16 LPA and above.',
     'Section 1'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa008', 1,
     'Pre-placement talk attendance is mandatory for registered students. Missing a PPT without prior intimation leads to debarment from that company. Offer acceptance must be communicated within 48 hours. Internship PPOs are treated as placement offers.',
     'Section 3');

  -- ========================================================
  -- 10. LISTINGS  (Campus Reuse marketplace items)
  -- ========================================================
  -- Some from demo user, some from a second fictional user
  insert into public.listings (owner_id, title, description, category, mode, status, condition) values
    (demo_uid, 'Engineering Mathematics — B.S. Grewal', 'Used for 1st & 2nd semester. Some highlighting, otherwise good condition.', 'book', 'exchange', 'available', 'Good'),
    (demo_uid, 'Casio fx-991EX Scientific Calculator',  'Works perfectly. Upgrading to CAS model.', 'calculator', 'donate', 'available', 'Like New'),
    (demo_uid, 'Chemistry Lab Coat (M)',                 'White lab coat, used for 2 semesters. Washed and clean.', 'labcoat', 'donate', 'completed', 'Fair');

  -- ========================================================
  -- 11. IMPACT EVENTS  (completed exchanges)
  -- ========================================================
  -- Record impact for the completed lab coat donation
  insert into public.impact_events (listing_id, event_type, completed_at)
  select id, 'donation', now() - interval '5 days'
  from public.listings
  where title = 'Chemistry Lab Coat (M)' and owner_id = demo_uid
  limit 1;

end $$;
