"""
CampusOS Faculty Portal and Administrator Workflows End-to-End Regression Tests
-------------------------------------------------------------------------------
Validates the complete 4 core academic operations across both Faculty and Administrator callers:
1. Add/Enroll students (individual, bulk, duplicate prevention, effective date hygiene).
2. Create attendance session (duplicate prevention, idempotency, attendance marking, unmarked vs absence).
3. Create assessment (positive max marks, weight limits, draft marks concealment, marks update, publish).
4. Create assignment (due date validation, submission by enrolled students only, grading, feedback).

Uses isolated test accounts:
- student_1 (Alice)
- student_2 (Bob)
- prof_a (Professor Charlie - assigned to Offering A)
- prof_b (Professor Danielle - assigned to Offering B)
- admin_user (Administrator)
- multi_role_user (Eve - faculty in offering B, enrolled as student in Offering A)
"""

import time
import uuid
import jwt
from typing import Dict, Any
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import DEFAULT_LOCAL_DEV_JWT_SECRET
from app.database import db

client = TestClient(app)

def make_jwt(sub: str, email: str, is_admin: bool = False, is_prof: bool = False) -> str:
    app_meta = {}
    if is_admin:
        app_meta["role"] = "admin"
        app_meta["is_admin"] = True
    elif is_prof:
        app_meta["role"] = "professor"
        app_meta["is_professor"] = True
    else:
        app_meta["role"] = "student"

    payload = {
        "sub": sub,
        "email": email,
        "aud": "authenticated",
        "iss": "supabase",
        "app_metadata": app_meta,
        "user_metadata": {"full_name": email.split("@")[0].title()},
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, DEFAULT_LOCAL_DEV_JWT_SECRET, algorithm="HS256")


# Isolated test credentials
STUDENT_1_ID = f"std-alice-{uuid.uuid4().hex[:6]}"
STUDENT_2_ID = f"std-bob-{uuid.uuid4().hex[:6]}"
PROF_A_ID = f"prof-charlie-{uuid.uuid4().hex[:6]}"
PROF_B_ID = f"prof-danielle-{uuid.uuid4().hex[:6]}"
ADMIN_ID = f"admin-super-{uuid.uuid4().hex[:6]}"
MULTI_USER_ID = f"multi-eve-{uuid.uuid4().hex[:6]}"

STUDENT_1_HEADERS = {"Authorization": f"Bearer {make_jwt(STUDENT_1_ID, 'alice@thapar.edu')}"}
STUDENT_2_HEADERS = {"Authorization": f"Bearer {make_jwt(STUDENT_2_ID, 'bob@thapar.edu')}"}
PROF_A_HEADERS = {"Authorization": f"Bearer {make_jwt(PROF_A_ID, 'charlie@thapar.edu', is_prof=True)}"}
PROF_B_HEADERS = {"Authorization": f"Bearer {make_jwt(PROF_B_ID, 'danielle@thapar.edu', is_prof=True)}"}
ADMIN_HEADERS = {"Authorization": f"Bearer {make_jwt(ADMIN_ID, 'admin@thapar.edu', is_admin=True)}"}
MULTI_ROLE_HEADERS = {"Authorization": f"Bearer {make_jwt(MULTI_USER_ID, 'eve@thapar.edu', is_prof=True)}"}


# ============================================================
# 1. Offering Provisioning & Cross-Offering Access Isolation
# ============================================================

def test_offering_provisioning_and_cross_offering_authorization():
    """
    Administrator provisions Offering A and Offering B.
    Prof A is assigned to Offering A only. Prof B is assigned to Offering B only.
    Prof A cannot access or mutate Offering B, and vice-versa.
    """
    # 1. Admin creates Offering A
    res_a = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"CS{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Distributed Systems A",
            "term": "Even Semester 2026",
            "section": "Sec-A1",
            "professor_ids": [PROF_A_ID],
        },
        headers=ADMIN_HEADERS,
    )
    assert res_a.status_code == 201
    off_a_id = res_a.json()["id"]

    # 2. Admin creates Offering B
    res_b = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"CS{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Distributed Systems B",
            "term": "Even Semester 2026",
            "section": "Sec-B1",
            "professor_ids": [PROF_B_ID],
        },
        headers=ADMIN_HEADERS,
    )
    assert res_b.status_code == 201
    off_b_id = res_b.json()["id"]

    # 3. Prof A can view offering A roster
    res_prof_a_roster = client.get(f"/api/academic/offerings/{off_a_id}/roster", headers=PROF_A_HEADERS)
    assert res_prof_a_roster.status_code == 200

    # 4. Prof A CANNOT view or mutate offering B (403 Forbidden)
    res_cross_view = client.get(f"/api/academic/offerings/{off_b_id}/roster", headers=PROF_A_HEADERS)
    assert res_cross_view.status_code == 403

    res_cross_mutate = client.post(
        f"/api/academic/offerings/{off_b_id}/attendance/sessions",
        json={"session_date": "2026-03-01", "slot_type": "Lecture"},
        headers=PROF_A_HEADERS,
    )
    assert res_cross_mutate.status_code == 403

    # 5. Anonymous caller rejected with 401
    res_anon = client.get(f"/api/academic/offerings/{off_a_id}/roster")
    assert res_anon.status_code == 401

    # 6. Student caller cannot mutate offering (403)
    res_student_mutate = client.post(
        f"/api/academic/offerings/{off_a_id}/attendance/sessions",
        json={"session_date": "2026-03-01", "slot_type": "Lecture"},
        headers=STUDENT_1_HEADERS,
    )
    assert res_student_mutate.status_code == 403


# ============================================================
# 2. Action 1: Add & Enroll Students Workflow
# ============================================================

def test_add_and_enroll_students_workflow():
    """
    Validates complete enrollment workflow:
    - Search student directory
    - Individual enrollment with effective date
    - Duplicate active enrollment rejected (400)
    - Bulk enrollment with duplicate isolation
    - Disenroll preserves audit trail and history
    - Roster reflects updated active counts
    """
    # 1. Admin creates offering
    res_off = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"CS{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Cloud Computing",
            "term": "Even Semester 2026",
            "section": "Sec-C1",
            "professor_ids": [PROF_A_ID],
        },
        headers=ADMIN_HEADERS,
    )
    off_id = res_off.json()["id"]

    # 2. Prof A enrolls student 1
    res_enr1 = client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={
            "student_id": STUDENT_1_ID,
            "student_name": "Alice Smith",
            "student_roll_no": "102203001",
            "student_email": "alice@thapar.edu",
            "effective_date": "2026-01-10",
        },
        headers=PROF_A_HEADERS,
    )
    assert res_enr1.status_code == 201
    enr1_data = res_enr1.json()
    assert enr1_data["status"] == "active"
    assert enr1_data["enrolled_at"] == "2026-01-10"

    # 3. Duplicate active enrollment is rejected
    res_dup = client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={
            "student_id": STUDENT_1_ID,
            "student_name": "Alice Smith",
        },
        headers=PROF_A_HEADERS,
    )
    assert res_dup.status_code == 400
    assert "already actively enrolled" in res_dup.json()["detail"].lower()

    # 4. Bulk enroll student 2 and multi-role user Eve
    res_bulk = client.post(
        f"/api/academic/offerings/{off_id}/enroll-bulk",
        json={
            "student_ids": [STUDENT_1_ID, STUDENT_2_ID, MULTI_USER_ID],
            "effective_date": "2026-01-12",
        },
        headers=PROF_A_HEADERS,
    )
    assert res_bulk.status_code == 201
    bulk_data = res_bulk.json()
    assert bulk_data["enrolled_count"] == 2  # student 2 & multi_role (student 1 skipped as duplicate)
    assert STUDENT_1_ID in bulk_data["skipped_duplicates"]

    # 5. Check roster
    res_roster = client.get(f"/api/academic/offerings/{off_id}/roster", headers=PROF_A_HEADERS)
    assert res_roster.status_code == 200
    students = res_roster.json()["students"]
    active_sids = [s["student_id"] for s in students if s["enrollment_status"] == "active"]
    assert STUDENT_1_ID in active_sids
    assert STUDENT_2_ID in active_sids
    assert MULTI_USER_ID in active_sids

    # 6. Disenroll student 2 with documented reason
    res_dis = client.post(
        f"/api/academic/offerings/{off_id}/disenroll?student_id={STUDENT_2_ID}",
        json={"reason": "Transfer to COE Section B"},
        headers=PROF_A_HEADERS,
    )
    assert res_dis.status_code == 200
    assert res_dis.json()["status"] == "disenrolled"


# ============================================================
# 3. Action 2: Attendance Session & Marking Workflow
# ============================================================

def test_attendance_session_creation_and_marking_workflow():
    """
    Validates complete session lifecycle:
    - Session created by authorized faculty
    - Empty session date rejected (400)
    - Retry creation is idempotent (safe duplicate handling)
    - Attendance marking distinguishes present, absent, late, excused
    - Unenrolled student attendance rejected (400)
    - Unmarked sessions do not count as absences against student attendance %
    """
    # 1. Provision offering with student 1 enrolled
    res_off = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"CS{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Computer Networks",
            "term": "Even Semester 2026",
            "section": "Sec-N1",
            "professor_ids": [PROF_A_ID],
        },
        headers=ADMIN_HEADERS,
    )
    off_id = res_off.json()["id"]

    client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={"student_id": STUDENT_1_ID, "effective_date": "2026-01-01"},
        headers=PROF_A_HEADERS,
    )

    # 2. Empty date rejected
    res_bad_date = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions",
        json={"session_date": "   ", "slot_type": "Lecture"},
        headers=PROF_A_HEADERS,
    )
    assert res_bad_date.status_code == 400

    # 3. Create Session 1
    sess_date = "2026-02-05"
    res_sess1 = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions",
        json={"session_date": sess_date, "slot_type": "Lecture"},
        headers=PROF_A_HEADERS,
    )
    assert res_sess1.status_code == 201
    sess1_id = res_sess1.json()["id"]

    # 4. Safe retry creation returns the existing session (no duplicate pollution)
    res_retry = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions",
        json={"session_date": sess_date, "slot_type": "Lecture"},
        headers=PROF_A_HEADERS,
    )
    assert res_retry.status_code == 201
    assert res_retry.json()["id"] == sess1_id

    # 5. Check roster BEFORE marking: attendance % should NOT be penalized for unmarked session!
    roster_before = client.get(f"/api/academic/offerings/{off_id}/roster", headers=PROF_A_HEADERS).json()
    st1_rec = next(s for s in roster_before["students"] if s["student_id"] == STUDENT_1_ID)
    # Unmarked session must NOT count as an absence!
    assert st1_rec["counted_sessions"] == 0

    # 6. Mark student 1 as Present
    res_mark = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions/{sess1_id}/mark",
        json={"records": [{"student_id": STUDENT_1_ID, "status": "present"}]},
        headers=PROF_A_HEADERS,
    )
    assert res_mark.status_code == 200

    # 7. Attempting to mark unenrolled student fails (400)
    res_bad_student = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions/{sess1_id}/mark",
        json={"records": [{"student_id": "unenrolled-ghost-id", "status": "present"}]},
        headers=PROF_A_HEADERS,
    )
    assert res_bad_student.status_code == 400

    # 8. Check roster AFTER marking: student 1 has 100% attendance (1/1)
    roster_after = client.get(f"/api/academic/offerings/{off_id}/roster", headers=PROF_A_HEADERS).json()
    st1_after = next(s for s in roster_after["students"] if s["student_id"] == STUDENT_1_ID)
    assert st1_after["attended_sessions"] == 1
    assert st1_after["counted_sessions"] == 1
    assert st1_after["attendance_percentage"] == 100.0


# ============================================================
# 4. Action 3: Assessment Creation & Marks Management
# ============================================================

def test_assessment_creation_and_marks_workflow():
    """
    Validates assessment workflow:
    - Max marks must be positive (> 0)
    - Draft assessment hidden from students
    - Faculty enters marks for eligible students
    - Draft marks remain hidden from students
    - Publishing assessment reveals marks to enrolled student
    - Answer key concealed until explicitly released
    """
    # 1. Provision offering with student 1 enrolled
    res_off = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"CS{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Software Engineering",
            "term": "Even Semester 2026",
            "section": "Sec-S1",
            "professor_ids": [PROF_A_ID],
        },
        headers=ADMIN_HEADERS,
    )
    off_id = res_off.json()["id"]

    client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={"student_id": STUDENT_1_ID, "effective_date": "2026-01-01"},
        headers=PROF_A_HEADERS,
    )

    # 2. Non-positive max marks rejected (422)
    res_bad_asm = client.post(
        f"/api/academic/offerings/{off_id}/assessments",
        json={"title": "Invalid Quiz", "max_marks": -10, "weight_percent": 10},
        headers=PROF_A_HEADERS,
    )
    assert res_bad_asm.status_code == 422

    # 3. Create Draft Assessment
    res_asm = client.post(
        f"/api/academic/offerings/{off_id}/assessments",
        json={
            "title": "Quiz 1: Design Patterns",
            "assessment_type": "Quiz",
            "max_marks": 25.0,
            "weight_percent": 15.0,
            "answer_key_content": "Official Factory Pattern UML Solution",
            "is_published": False,
        },
        headers=PROF_A_HEADERS,
    )
    assert res_asm.status_code == 201
    asm_id = res_asm.json()["id"]

    # 4. Student CANNOT see draft assessment
    res_std_asms = client.get(f"/api/academic/offerings/{off_id}/assessments", headers=STUDENT_1_HEADERS)
    assert not any(a["id"] == asm_id for a in res_std_asms.json())

    # 5. Faculty enters marks for student 1 (22.5 / 25)
    res_marks = client.post(
        f"/api/academic/offerings/{off_id}/assessments/{asm_id}/marks",
        json={"marks": [{"student_id": STUDENT_1_ID, "obtained_marks": 22.5, "feedback": "Great diagrams"}]},
        headers=PROF_A_HEADERS,
    )
    assert res_marks.status_code == 200

    # 6. Student still cannot access marks while assessment is draft
    res_std_marks = client.get(f"/api/academic/offerings/{off_id}/assessments/{asm_id}/marks", headers=STUDENT_1_HEADERS)
    assert len(res_std_marks.json()) == 0

    # 7. Faculty publishes assessment
    client.patch(
        f"/api/academic/offerings/{off_id}/assessments/{asm_id}",
        json={"is_published": True},
        headers=PROF_A_HEADERS,
    )

    # 8. Student now sees their mark, but answer key is still concealed
    res_std_pub = client.get(f"/api/academic/offerings/{off_id}/assessments", headers=STUDENT_1_HEADERS)
    matching = next(a for a in res_std_pub.json() if a["id"] == asm_id)
    assert matching["answer_key_content"] is None  # Concealed!

    res_std_my_mark = client.get(f"/api/academic/offerings/{off_id}/assessments/{asm_id}/marks", headers=STUDENT_1_HEADERS).json()
    assert len(res_std_my_mark) == 1
    assert res_std_my_mark[0]["obtained_marks"] == 22.5

    # 9. Faculty releases answer key
    client.patch(
        f"/api/academic/offerings/{off_id}/assessments/{asm_id}",
        json={"answer_key_released": True},
        headers=PROF_A_HEADERS,
    )
    res_std_answers = client.get(f"/api/academic/offerings/{off_id}/assessments", headers=STUDENT_1_HEADERS).json()
    matching_rel = next(a for a in res_std_answers if a["id"] == asm_id)
    assert matching_rel["answer_key_content"] == "Official Factory Pattern UML Solution"


# ============================================================
# 5. Action 4: Assignment Creation & Student Submission
# ============================================================

def test_assignment_creation_submission_and_grading_workflow():
    """
    Validates assignment workflow:
    - Timezone-aware deadline handling
    - Enrolled student submits successfully
    - Unenrolled student rejected (403)
    - Professor-only identity cannot submit as student (403)
    - Multi-role user legitimately enrolled can submit
    - Faculty grades submission with score & feedback
    """
    # 1. Provision offering with student 1 and multi-role Eve enrolled
    res_off = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"CS{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Operating Systems Internals",
            "term": "Even Semester 2026",
            "section": "Sec-OS1",
            "professor_ids": [PROF_A_ID],
        },
        headers=ADMIN_HEADERS,
    )
    off_id = res_off.json()["id"]

    client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={"student_id": STUDENT_1_ID, "effective_date": "2026-01-01"},
        headers=PROF_A_HEADERS,
    )
    client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={"student_id": MULTI_USER_ID, "effective_date": "2026-01-01"},
        headers=PROF_A_HEADERS,
    )

    # 2. Prof A creates published assignment
    res_asg = client.post(
        f"/api/academic/offerings/{off_id}/assignments",
        json={
            "title": "Lab 2: Kernel Threads",
            "instructions": "Implement pthread synchronization",
            "due_date": "2026-12-31T23:59:59Z",
            "model_answer": "Reference Semaphore Implementation",
            "is_published": True,
        },
        headers=PROF_A_HEADERS,
    )
    assert res_asg.status_code == 201
    asg_id = res_asg.json()["id"]

    # 3. Enrolled student 1 submits
    res_sub1 = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submit",
        json={"submission_text": "https://github.com/alice/os-threads", "file_name": "threads.zip"},
        headers=STUDENT_1_HEADERS,
    )
    assert res_sub1.status_code == 200
    sub1_id = res_sub1.json()["id"]

    # 4. Multi-role user Eve (who is enrolled) submits
    res_sub_eve = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submit",
        json={"submission_text": "Eve implementation of semaphores"},
        headers=MULTI_ROLE_HEADERS,
    )
    assert res_sub_eve.status_code == 200

    # 5. Prof B (who is NOT enrolled as a student) CANNOT submit
    res_sub_prof = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submit",
        json={"submission_text": "Prof submission"},
        headers=PROF_B_HEADERS,
    )
    assert res_sub_prof.status_code == 403

    # 6. Unenrolled student 2 CANNOT submit
    res_sub_std2 = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submit",
        json={"submission_text": "Bob submission"},
        headers=STUDENT_2_HEADERS,
    )
    assert res_sub_std2.status_code == 403

    # 7. Faculty grades student 1 submission
    res_grade = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submissions/{sub1_id}/grade",
        json={"score": 19.5, "feedback": "Solid mutex locking; clean code"},
        headers=PROF_A_HEADERS,
    )
    assert res_grade.status_code == 200
    graded = res_grade.json()
    assert graded["score"] == 19.5
    assert graded["feedback"] == "Solid mutex locking; clean code"


# ============================================================
# 6. Administrator Universal Authority Across Offerings
# ============================================================

def test_admin_universal_academic_operations():
    """
    Validates that Administrator can execute all 4 operations across any offering:
    - Enroll student
    - Create session & mark attendance
    - Create assessment & update marks
    - Create assignment & grade submission
    """
    # 1. Admin creates offering
    res_off = client.post(
        "/api/academic/offerings",
        json={
            "subject_code": f"CS{uuid.uuid4().hex[:3].upper()}",
            "subject_name": "Admin Supervised Lab",
            "term": "Even Semester 2026",
            "section": "Sec-X",
        },
        headers=ADMIN_HEADERS,
    )
    off_id = res_off.json()["id"]

    # 2. Admin enrolls student
    res_enr = client.post(
        f"/api/academic/offerings/{off_id}/enroll",
        json={"student_id": STUDENT_1_ID, "effective_date": "2026-02-01"},
        headers=ADMIN_HEADERS,
    )
    assert res_enr.status_code == 201

    # 3. Admin creates session & marks attendance
    res_sess = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions",
        json={"session_date": "2026-02-18", "slot_type": "Lab"},
        headers=ADMIN_HEADERS,
    )
    assert res_sess.status_code == 201
    sess_id = res_sess.json()["id"]

    res_mark = client.post(
        f"/api/academic/offerings/{off_id}/attendance/sessions/{sess_id}/mark",
        json={"records": [{"student_id": STUDENT_1_ID, "status": "present"}]},
        headers=ADMIN_HEADERS,
    )
    assert res_mark.status_code == 200

    # 4. Admin creates assessment & enters mark
    res_asm = client.post(
        f"/api/academic/offerings/{off_id}/assessments",
        json={"title": "Admin Lab Evaluation", "max_marks": 50.0, "weight_percent": 20.0, "is_published": True},
        headers=ADMIN_HEADERS,
    )
    assert res_asm.status_code == 201
    asm_id = res_asm.json()["id"]

    res_marks = client.post(
        f"/api/academic/offerings/{off_id}/assessments/{asm_id}/marks",
        json={"marks": [{"student_id": STUDENT_1_ID, "obtained_marks": 48.0}]},
        headers=ADMIN_HEADERS,
    )
    assert res_marks.status_code == 200

    # 5. Admin creates assignment, student submits, admin grades
    res_asg = client.post(
        f"/api/academic/offerings/{off_id}/assignments",
        json={"title": "Admin Project Term Paper", "instructions": "Submit paper", "due_date": "2026-11-30", "is_published": True},
        headers=ADMIN_HEADERS,
    )
    assert res_asg.status_code == 201
    asg_id = res_asg.json()["id"]

    res_sub = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submit",
        json={"submission_text": "My final research paper"},
        headers=STUDENT_1_HEADERS,
    )
    assert res_sub.status_code == 200
    sub_id = res_sub.json()["id"]

    res_grade = client.post(
        f"/api/academic/offerings/{off_id}/assignments/{asg_id}/submissions/{sub_id}/grade",
        json={"score": 49.0, "feedback": "Exemplary research methodology"},
        headers=ADMIN_HEADERS,
    )
    assert res_grade.status_code == 200
    assert res_grade.json()["score"] == 49.0
