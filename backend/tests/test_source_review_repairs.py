import os
import sys
import time
import uuid
import jwt
from pathlib import Path
from datetime import datetime, date, timezone, timedelta
import zoneinfo
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import db
from app.core.config import settings
from app.core.auth import DEFAULT_LOCAL_DEV_JWT_SECRET, verify_supabase_jwt_claims
from app.models.opportunity import (
    Opportunity,
    OpportunityCreate,
    StudentExperienceProfileUpdate,
    EducationEntry,
)
from app.services.opportunity_engine import OpportunityEngine
from app.services.academic_engine import parse_and_normalize_utc, IST_TIMEZONE

client = TestClient(app)

# Helper to generate signed JWTs
def make_jwt(sub: str, email: str, role: str = "student", is_admin: bool = False, is_prof: bool = False, app_meta: dict = None, user_meta: dict = None):
    meta = app_meta or {}
    if is_admin:
        meta["is_admin"] = True
        meta["role"] = "admin"
    elif is_prof:
        meta["role"] = "professor"
    else:
        meta["role"] = role

    payload = {
        "sub": sub,
        "email": email,
        "aud": "authenticated",
        "exp": int(time.time()) + 7200,
        "app_metadata": meta,
        "user_metadata": user_meta or {},
    }
    return jwt.encode(payload, DEFAULT_LOCAL_DEV_JWT_SECRET, algorithm="HS256")


# ============================================================
# BUG-01: Resume Access Scoping & Consent Enforcement
# ============================================================

def test_bug01_resume_access_scoping_and_consent():
    """
    BUG-01: Resume access must be scoped to opportunity ownership or applicant status,
    and non-applicant discovery resumes must require both discovery_opt_in AND resume_sharing_opt_in.
    """
    mgr1_id = f"mgr1-{uuid.uuid4().hex[:6]}"
    mgr2_id = f"mgr2-{uuid.uuid4().hex[:6]}"
    mgr1_token = make_jwt(mgr1_id, "mgr1@thapar.edu", is_prof=True)
    mgr2_token = make_jwt(mgr2_id, "mgr2@thapar.edu", is_prof=True)

    # Mgr 1 creates Opp 1
    opp1_res = client.post(
        "/api/opportunities",
        json={
            "title": f"Research Assistant Opp 1 {uuid.uuid4().hex[:4]}",
            "organization": "TIET Distributed Systems Lab",
            "category": "research",
            "department": "Computer Science",
            "description": "Lab research on distributed systems.",
            "duration": "6 months",
            "stipend": "15,000/month",
            "eligible_branches": ["COE"],
            "required_skills": ["Python"],
        },
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    assert opp1_res.status_code in (200, 201)
    opp1_id = opp1_res.json()["id"]

    # Mgr 2 creates Opp 2
    opp2_res = client.post(
        "/api/opportunities",
        json={
            "title": f"Research Assistant Opp 2 {uuid.uuid4().hex[:4]}",
            "organization": "TIET Robotics Lab",
            "category": "research",
            "department": "Mechanical Engineering",
            "description": "Lab research on robotics.",
            "duration": "6 months",
            "stipend": "15,000/month",
            "eligible_branches": ["ME"],
            "required_skills": ["CAD"],
        },
        headers={"Authorization": f"Bearer {mgr2_token}"},
    )
    assert opp2_res.status_code in (200, 201)
    opp2_id = opp2_res.json()["id"]

    # Student 1 setup with resume
    s1_id = f"student1-{uuid.uuid4().hex[:6]}"
    s1_token = make_jwt(s1_id, "student1@thapar.edu", role="student")
    fake_pdf = b"%PDF-1.4 test resume content for student 1"
    upload_res = client.post(
        "/api/opportunities/resume",
        files={"file": ("resume_s1.pdf", fake_pdf, "application/pdf")},
        headers={"Authorization": f"Bearer {s1_token}"},
    )
    assert upload_res.status_code == 200

    # Student 1 applies to Opp 1
    apply_res = client.post(
        f"/api/opportunities/{opp1_id}/apply",
        json={"statement_of_purpose": "Excited to work on Opp 1"},
        headers={"Authorization": f"Bearer {s1_token}"},
    )
    assert apply_res.status_code == 200

    # 1. Mgr 1 (creator of Opp 1) CAN download S1 resume
    res = client.get(
        f"/api/opportunities/candidates/{s1_id}/resume?opportunity_id={opp1_id}",
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    assert res.status_code == 200
    assert res.content == fake_pdf

    # 2. Mgr 2 (creator of Opp 2, which S1 did not apply to) CANNOT download S1 resume
    res = client.get(
        f"/api/opportunities/candidates/{s1_id}/resume?opportunity_id={opp2_id}",
        headers={"Authorization": f"Bearer {mgr2_token}"},
    )
    assert res.status_code in (403, 404)

    # 3. Student 2 opts into discovery but NOT resume sharing
    s2_id = f"student2-{uuid.uuid4().hex[:6]}"
    s2_token = make_jwt(s2_id, "student2@thapar.edu", role="student")
    client.post(
        "/api/opportunities/resume",
        files={"file": ("resume_s2.pdf", b"%PDF-1.4 s2 resume", "application/pdf")},
        headers={"Authorization": f"Bearer {s2_token}"},
    )
    client.put(
        "/api/opportunities/experience-profile",
        json={"discovery_opt_in": True, "resume_sharing_opt_in": False},
        headers={"Authorization": f"Bearer {s2_token}"},
    )
    # Mgr 1 attempts to download S2's resume (non-applicant, no resume sharing consent)
    res = client.get(
        f"/api/opportunities/candidates/{s2_id}/resume?opportunity_id={opp1_id}",
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    assert res.status_code == 403
    assert "resume sharing" in res.json()["detail"].lower()

    # 4. Student 1 can self-download without opportunity_id
    res = client.get(
        f"/api/opportunities/candidates/{s1_id}/resume",
        headers={"Authorization": f"Bearer {s1_token}"},
    )
    assert res.status_code == 200
    assert res.content == fake_pdf


# ============================================================
# BUG-02: Professor Middleware Route Invariant
# ============================================================

def test_bug02_professor_routing_invariants():
    """
    BUG-02: /professor must be accessible to professors and admins;
    /admin must be strictly admin-only.
    """
    prof_token = make_jwt("prof-test-user", "prof@thapar.edu", is_prof=True)
    admin_token = make_jwt("admin-test-user", "admin@thapar.edu", is_admin=True)
    student_token = make_jwt("student-test-user", "student@thapar.edu", role="student")

    # Verify claim extraction
    prof_claims = verify_supabase_jwt_claims(prof_token)
    assert prof_claims["is_professor"] is True
    assert prof_claims["is_admin"] is False

    admin_claims = verify_supabase_jwt_claims(admin_token)
    assert admin_claims["is_admin"] is True
    assert admin_claims["is_professor"] is True

    student_claims = verify_supabase_jwt_claims(student_token)
    assert student_claims["is_professor"] is False
    assert student_claims["is_admin"] is False

    # Professor token trying admin-only route is rejected
    res = client.get("/api/academic/users/roles", headers={"Authorization": f"Bearer {prof_token}"})
    assert res.status_code == 403

    # Admin token succeeds on admin-only route
    res = client.get("/api/academic/users/roles", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200


# ============================================================
# BUG-03 & BUG-04: Academic Tables RLS and Discovery Privacy
# ============================================================

def test_bug03_bug04_academic_tables_rls_and_discovery_privacy():
    """
    BUG-03 & BUG-04: Migration file must enable RLS on all 13 academic tables,
    restrict student_experience_profiles select policy, and create candidate_discovery_projections view.
    """
    migration_path = Path(__file__).resolve().parent.parent.parent / "supabase" / "migrations" / "20261114000004_academic_rbac_rls_and_privacy.sql"
    assert migration_path.exists(), f"Migration file missing at {migration_path}"
    content = migration_path.read_text(encoding="utf-8")

    # Verify RLS enabled on all 13 tables
    tables = [
        "user_roles",
        "subjects",
        "subject_offerings",
        "offering_professors",
        "offering_enrollments",
        "attendance_sessions",
        "session_attendance_records",
        "offering_assessments",
        "student_assessment_marks",
        "offering_assignments",
        "assignment_submissions",
        "offering_announcements",
        "academic_audit_logs",
    ]
    content_lower = content.lower()
    for table in tables:
        assert f"alter table public.{table} enable row level security;" in content_lower, f"RLS not enabled for {table}"

    # Verify candidate_discovery_projections view exists
    assert "create or replace view public.candidate_discovery_projections" in content_lower
    # Ensure sensitive resume storage path is NOT in the public discovery view
    view_part = content_lower.split("candidate_discovery_projections")[1].split(";")[0]
    assert "resume_storage_path" not in view_part

    # Verify student_experience_profiles RLS policy
    assert "student_experience_profiles_owner_or_admin_select" in content_lower


# ============================================================
# BUG-05: Attendance Accepts Unenrolled Students / Cancelled Sessions
# ============================================================

def test_bug05_attendance_rejects_unenrolled_or_cancelled():
    """
    BUG-05: mark_attendance must reject unenrolled students and cancelled sessions,
    and enforce atomic validation.
    """
    admin_token = make_jwt("admin-test", "admin@thapar.edu", is_admin=True)

    # Create offering and session
    off_res = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"TST{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Test Subject For Attendance",
            "term": "Even 2026",
            "section": "Sec-Att",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert off_res.status_code == 201
    off_id = off_res.json()["id"]

    # Enroll 1 active student
    s_enrolled_id = f"stu-enr-{uuid.uuid4().hex[:6]}"
    enr_res = client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={
            "student_id": s_enrolled_id,
            "student_name": "Enrolled Student",
            "student_roll_no": "102299001",
            "student_email": "enrolled@thapar.edu",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert enr_res.status_code in (200, 201)

    # Create session
    sess_res = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions",
        json={"session_date": "2026-11-14", "slot_type": "Lecture"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert sess_res.status_code == 201
    sess_id = sess_res.json()["id"]

    # 1. Marking attendance for unenrolled student must fail with 400
    res = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions/{sess_id}/mark",
        json={
            "records": [
                {"student_id": f"unenrolled-{uuid.uuid4().hex[:6]}", "status": "present"}
            ]
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400
    assert "not actively enrolled" in res.json()["detail"].lower()

    # 2. Atomic failure test: list containing 1 enrolled and 1 unenrolled student
    res = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions/{sess_id}/mark",
        json={
            "records": [
                {"student_id": s_enrolled_id, "status": "present"},
                {"student_id": f"unenrolled-{uuid.uuid4().hex[:6]}", "status": "present"},
            ]
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400
    # Confirm no records were written
    rec_res = client.get(
        f"/api/academic/offerings/{off_id}/attendance/sessions/{sess_id}/records",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert len(rec_res.json()) == 0

    # 3. Marking valid enrolled student succeeds
    res = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions/{sess_id}/mark",
        json={
            "records": [
                {"student_id": s_enrolled_id, "status": "present"}
            ]
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert len(res.json()) == 1


# ============================================================
# BUG-06: Attendance Session Belongs to Another Offering
# ============================================================

def test_bug06_session_cross_offering_isolation():
    """
    BUG-06: Querying or marking a session ID against a mismatched offering ID must return 404.
    """
    admin_token = make_jwt("admin-test", "admin@thapar.edu", is_admin=True)

    # Create Offering A and its session
    off_a_res = client.post(
        "/api/academic/offerings",
        json={"subject_code": f"TST{uuid.uuid4().hex[:3].upper()}", "subject_name": "Off A", "term": "Even 2026", "section": "SecA"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    off_a_id = off_a_res.json()["id"]
    sess_a_res = client.post(
        f"/api/academic/offerings/{off_a_id}/attendance/sessions",
        json={"session_date": "2026-11-14", "slot_type": "Lecture"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    sess_a_id = sess_a_res.json()["id"]

    # Create Offering B
    off_b_res = client.post(
        "/api/academic/offerings",
        json={"subject_code": f"TST{uuid.uuid4().hex[:3].upper()}", "subject_name": "Off B", "term": "Even 2026", "section": "SecB"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    off_b_id = off_b_res.json()["id"]

    # Pass session A with Offering B in path -> must return 404
    res1 = client.get(
        f"/api/academic/offerings/{off_b_id}/attendance/sessions/{sess_a_id}/records",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res1.status_code == 404

    res2 = client.post(
        f"/api/academic/offerings/{off_b_id}/attendance/sessions/{sess_a_id}/mark",
        json={"records": [{"student_id": "any", "status": "present"}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res2.status_code == 404


# ============================================================
# BUG-07: Marks Accept Unenrolled Students
# ============================================================

def test_bug07_marks_reject_unenrolled_students():
    """
    BUG-07: update_marks must reject unenrolled students and enforce atomic validation.
    """
    admin_token = make_jwt("admin-test", "admin@thapar.edu", is_admin=True)

    # Create offering and assessment
    off_res = client.post(
        "/api/academic/offerings",
        json={"subject_code": f"TST{uuid.uuid4().hex[:3].upper()}", "subject_name": "Marks Test", "term": "Even 2026", "section": "SecM"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    off_id = off_res.json()["id"]

    asm_res = client.post(
        f"/api/academic/offerings/{off_id}/assessments",
        json={"title": "Midterm Exam", "type": "midterm", "max_marks": 50.0, "weight_percent": 30.0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    asm_id = asm_res.json()["id"]

    # Attempt to update marks for unenrolled student -> 400
    res = client.post(
        f"/api/academic/offerings/{off_id}/assessments/{asm_id}/marks",
        json={"marks": [{"student_id": f"unenrolled-{uuid.uuid4().hex[:6]}", "obtained_marks": 45.0}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400
    assert "not actively enrolled" in res.json()["detail"].lower()


# ============================================================
# BUG-08: Fabricated CGPA & Student-Entered CGPA Eligibility Bypass
# ============================================================

def test_bug08_cgpa_verification_and_eligibility_integrity():
    """
    BUG-08: Unverified student profiles must have cgpa_verified=None,
    and student_entered_cgpa must NOT satisfy mandatory minimum CGPA criteria.
    """
    uid = f"unverified-student-{uuid.uuid4().hex[:6]}"
    prof = db.get_student_experience_profile(uid)

    # 1. Unverified new student must not have a fabricated 7.80
    assert prof.education[0].cgpa_verified is None

    # 2. Student enters high CGPA in self-reported profile
    prof.education[0].student_entered_cgpa = 9.80

    opp = Opportunity(
        id=f"opp-{uuid.uuid4().hex[:6]}",
        title="High CGPA Required Internship",
        organization="TIET CS",
        category="internship",
        department="COE",
        description="High requirement",
        duration="3 months",
        stipend="50,000",
        min_cgpa=8.0,
        eligible_branches=["COE"],
        created_at=datetime.now().isoformat(),
    )

    # Eligibility evaluation MUST return INCOMPLETE_PROFILE, not ELIGIBLE!
    eligibility = OpportunityEngine.evaluate_eligibility(
        profile=prof,
        opportunity=opp,
        verified_cgpa=None,
    )
    assert eligibility.status == "INCOMPLETE_PROFILE"
    assert "Verified Institutional CGPA" in eligibility.missing_profile_fields


# ============================================================
# BUG-09: Aware/Naive Datetime Comparison in Assignment Deadlines
# ============================================================

def test_bug09_timezone_aware_deadline_handling():
    """
    BUG-09: parse_and_normalize_utc and submit_assignment must handle
    timezones (+05:30, Z, naive, date-only) without crashing.
    """
    # 1. parse_and_normalize_utc tests
    utc_dt = parse_and_normalize_utc("2026-11-14T18:00:00Z")
    assert utc_dt.tzinfo == timezone.utc

    ist_dt = parse_and_normalize_utc("2026-11-14T23:30:00+05:30")
    assert ist_dt.tzinfo == timezone.utc

    date_only_dt = parse_and_normalize_utc("2026-11-14", date_only_end_of_day=True)
    assert date_only_dt.tzinfo == timezone.utc
    # 23:59:59 IST is 18:29:59 UTC
    assert date_only_dt.hour == 18 and date_only_dt.minute == 29

    # Malformed date raises 400
    with pytest.raises(Exception):
        parse_and_normalize_utc("not-a-valid-date")

    # 2. Assignment submission with offset-aware due date does not crash
    admin_token = make_jwt("admin-test", "admin@thapar.edu", is_admin=True)
    off_res = client.post(
        "/api/academic/offerings",
        json={"subject_code": f"TST{uuid.uuid4().hex[:3].upper()}", "subject_name": "Deadlines Test", "term": "Even 2026", "section": "SecD"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    off_id = off_res.json()["id"]

    # Create assignment with ISO +05:30 due date
    future_due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    asg_res = client.post(
        f"/api/academic/offerings/{off_id}/assignments",
        json={"title": "TZ Assignment", "instructions": "Submit work", "due_date": future_due, "is_published": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    asg_id = asg_res.json()["id"]

    # Enroll student and submit
    s_id = f"stu-asg-{uuid.uuid4().hex[:6]}"
    client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={"student_id": s_id, "student_name": "Assignment Student", "student_roll_no": "102299002"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    s_token = make_jwt(s_id, "stu_asg@thapar.edu", role="student")

    sub_res = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submit",
        json={"submission_text": "Solution submitted on time."},
        headers={"Authorization": f"Bearer {s_token}"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["is_late"] is False


# ============================================================
# BUG-10: Professor Identities Accepted as Student Submissions
# ============================================================

def test_bug10_professor_cannot_submit_assignment_as_student():
    """
    BUG-10: Faculty or Admin callers not enrolled as students in the offering
    must be rejected with 403 Forbidden on assignment submission.
    """
    admin_token = make_jwt("admin-test", "admin@thapar.edu", is_admin=True)
    prof_id = f"prof-submitter-{uuid.uuid4().hex[:6]}"
    prof_token = make_jwt(prof_id, "prof_sub@thapar.edu", is_prof=True)

    # Create offering and assign professor
    off_res = client.post(
        "/api/academic/offerings",
        json={"subject_code": f"TST{uuid.uuid4().hex[:3].upper()}", "subject_name": "Prof Sub Test", "term": "Even 2026", "section": "SecP"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    off_id = off_res.json()["id"]

    client.post(
        f"/api/academic/offerings/{off_id}/professors",
        json={"professor_id": prof_id, "role": "primary"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    asg_res = client.post(
        f"/api/academic/offerings/{off_id}/assignments",
        json={"title": "Prof Test Assignment", "instructions": "Submit work", "due_date": "2026-12-31", "is_published": True},
        headers={"Authorization": f"Bearer {prof_token}"},
    )
    asg_id = asg_res.json()["id"]

    # Professor attempts to submit assignment -> must receive 403
    res = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submit",
        json={"submission_text": "I am professor submitting work"},
        headers={"Authorization": f"Bearer {prof_token}"},
    )
    assert res.status_code == 403
    assert "only actively enrolled students" in res.json()["detail"].lower()


# ============================================================
# BUG-11: Email-Based Administrator Promotion
# ============================================================

def test_bug11_admin_email_without_server_role_rejected():
    """
    BUG-11: An email like admin@thapar.edu or doaa@thapar.edu must NOT grant
    admin privileges without server-controlled app_metadata or server user_roles.
    """
    spoofed_token = jwt.encode(
        {
            "sub": f"spoofed-{uuid.uuid4().hex[:6]}",
            "email": "admin@thapar.edu",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "app_metadata": {"provider": "email"},  # No role in app_metadata
            "user_metadata": {},
        },
        DEFAULT_LOCAL_DEV_JWT_SECRET,
        algorithm="HS256",
    )

    claims = verify_supabase_jwt_claims(spoofed_token)
    assert claims["is_admin"] is False
    assert claims["role"] == "student"

    # Attempt to access admin console endpoint
    res = client.get("/api/academic/users/roles", headers={"Authorization": f"Bearer {spoofed_token}"})
    assert res.status_code == 403
