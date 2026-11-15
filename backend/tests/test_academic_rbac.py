import pytest
import io
import csv
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import db

client = TestClient(app)

# Test Tokens
ADMIN_TOKEN = "dev-admin"
PROF_RAJESH_TOKEN = "dev-professor-1"  # assigned to off-ucs301-secA and off-ucs310-secA
PROF_SUNITA_TOKEN = "dev-professor-2"  # assigned to off-ucs301-secB
STUDENT_ARJUN_TOKEN = "dev-user-102203099"  # enrolled in off-ucs301-secA and off-ucs310-secA
STUDENT_ROHAN_TOKEN = "dev-peer"  # enrolled in off-ucs301-secA (low attendance / needs support)
STUDENT_OTHER_TOKEN = "test-unassigned-student"  # not enrolled initially


# ============================================================
# 1. Anonymous Access Rejection (401)
# ============================================================

def test_anonymous_requests_rejected_with_401():
    """Unauthenticated calls must be rejected with 401 Unauthorized."""
    res1 = client.get("/api/academic/offerings")
    assert res1.status_code == 401

    res2 = client.post("/api/academic/offerings", json={
        "subject_code": "UCS999",
        "subject_name": "Test Subject",
        "term": "Even Semester 2026",
        "section": "Section A",
    })
    assert res2.status_code == 401

    res3 = client.get("/api/academic/offerings/off-ucs301-secA/roster")
    assert res3.status_code == 401


# ============================================================
# 2. Student Role Isolation & Self-Access Only
# ============================================================

def test_student_can_only_view_enrolled_offerings():
    """Students can only list offerings they are enrolled in."""
    res = client.get("/api/academic/offerings", headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"})
    assert res.status_code == 200
    offerings = res.json()
    off_ids = {o["id"] for o in offerings}
    # Arjun is enrolled in Sec A, NOT Sec B
    assert "off-ucs301-secA" in off_ids
    assert "off-ucs301-secB" not in off_ids


def test_student_cannot_view_unenrolled_offering_details():
    """Student attempting to view an offering they are not enrolled in receives 403 Forbidden."""
    res = client.get(
        "/api/academic/offerings/off-ucs301-secB",
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


def test_student_cannot_mutate_academic_operations():
    """Students cannot create attendance sessions, mark attendance, or modify marks."""
    # 1. Cannot create attendance session
    res_att = client.post(
        "/api/academic/offerings/off-ucs301-secA/attendance/sessions",
        json={"session_date": "2026-03-01", "slot_type": "Lecture"},
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_att.status_code == 403

    # 2. Cannot enroll students
    res_enr = client.post(
        "/api/academic/offerings/off-ucs301-secA/enroll",
        json={"student_id": "test-student-id"},
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_enr.status_code == 403

    # 3. Cannot view full roster
    res_roster = client.get(
        "/api/academic/offerings/off-ucs301-secA/roster",
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_roster.status_code == 403


# ============================================================
# 3. Section Isolation for Professors (Section A vs Section B)
# ============================================================

def test_professor_assigned_offering_access():
    """Prof Rajesh can access off-ucs301-secA."""
    res = client.get(
        "/api/academic/offerings/off-ucs301-secA",
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res.status_code == 200
    assert res.json()["section"] == "Section A"


def test_section_isolation_rejects_cross_section_professor_access():
    """
    CRITICAL INVARIANT:
    Prof Rajesh is assigned to Section A only.
    Accessing Section B must be rejected with 403 Forbidden!
    """
    res_view = client.get(
        "/api/academic/offerings/off-ucs301-secB",
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_view.status_code == 403

    # Cannot create attendance in Sec B
    res_att = client.post(
        "/api/academic/offerings/off-ucs301-secB/attendance/sessions",
        json={"session_date": "2026-03-02", "slot_type": "Lecture"},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_att.status_code == 403

    # Prof Sunita (Sec B) cannot access Sec A
    res_sunita_secA = client.get(
        "/api/academic/offerings/off-ucs301-secA/roster",
        headers={"Authorization": f"Bearer {PROF_SUNITA_TOKEN}"},
    )
    assert res_sunita_secA.status_code == 403


# ============================================================
# 4. Administrator Universal Access & Role Management
# ============================================================

def test_admin_universal_access():
    """Administrator can view all offerings, manage assignments, and view audit logs."""
    # List all offerings
    res = client.get("/api/academic/offerings", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
    assert res.status_code == 200
    all_offs = res.json()
    off_ids = {o["id"] for o in all_offs}
    assert "off-ucs301-secA" in off_ids
    assert "off-ucs301-secB" in off_ids

    # View Sec A and Sec B rosters
    res_a = client.get("/api/academic/offerings/off-ucs301-secA/roster", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
    assert res_a.status_code == 200
    res_b = client.get("/api/academic/offerings/off-ucs301-secB/roster", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
    assert res_b.status_code == 200


def test_cannot_demote_or_deactivate_last_active_admin():
    """Invariant: System must reject demoting or deactivating the last active administrator."""
    default_admin_id = "admin-00000000-0000-0000-0000-000000000001"
    db.academic_rbac.user_roles[default_admin_id] = {"role": "admin", "status": "active"}
    
    # Ensure only the default admin is active for this invariant test
    extra_admins = [
        uid for uid, item in db.academic_rbac.user_roles.items()
        if uid != default_admin_id and item.get("role") == "admin" and item.get("status") == "active"
    ]
    for uid in extra_admins:
        db.academic_rbac.user_roles[uid]["status"] = "inactive"

    # Attempt to demote the sole active admin
    res = client.post(
        "/api/academic/users/roles",
        json={
            "user_id": default_admin_id,
            "role": "student",
            "status": "active",
        },
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert res.status_code == 400
    assert "last active administrator" in res.json()["detail"].lower()

    # Restore extra admins status
    for uid in extra_admins:
        db.academic_rbac.user_roles[uid]["status"] = "active"


# ============================================================
# 5. Student Directory & Enrollment Management
# ============================================================

def test_student_directory_search():
    """Professors can search student directory by name, roll no, or email."""
    res = client.get(
        "/api/academic/students/directory?query=Arjun",
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res.status_code == 200
    results = res.json()
    assert len(results) >= 1
    assert any(s["roll_no"] == "102203099" for s in results)


def test_duplicate_active_enrollment_prevented():
    """Attempting to enroll a student who is already active in an offering returns 400 Bad Request."""
    res = client.post(
        "/api/academic/offerings/off-ucs301-secA/enroll",
        json={"student_id": "102203099-tiet-user"},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res.status_code == 400
    assert "already actively enrolled" in res.json()["detail"].lower()


def test_enroll_and_disenroll_lifecycle_preserves_history():
    """Enroll a new student, verify active status, disenroll with reason, confirm records preserved."""
    test_student_id = "test-student-999"
    # 1. Enroll
    res_enr = client.post(
        "/api/academic/offerings/off-ucs301-secA/enroll",
        json={
            "student_id": test_student_id,
            "student_name": "Test Student 999",
            "student_roll_no": "102203999",
            "student_email": "test999@thapar.edu",
        },
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_enr.status_code == 201
    enr_data = res_enr.json()
    assert enr_data["status"] == "active"

    # 2. Disenroll with reason
    res_dis = client.post(
        f"/api/academic/offerings/off-ucs301-secA/disenroll?student_id={test_student_id}",
        json={"reason": "Branch change to Computer Science (COPC)", "effective_date": "2026-02-01"},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_dis.status_code == 200
    dis_data = res_dis.json()
    assert dis_data["status"] == "disenrolled"
    assert dis_data["disenroll_reason"] == "Branch change to Computer Science (COPC)"
    assert dis_data["disenrolled_at"] == "2026-02-01"


# ============================================================
# 6. Attendance Sessions & Historical Records
# ============================================================

def test_create_session_and_mark_attendance():
    """Professor creates a session and marks attendance records."""
    # 1. Create session
    sess_res = client.post(
        "/api/academic/offerings/off-ucs301-secA/attendance/sessions",
        json={"session_date": "2026-02-12", "slot_type": "Lecture"},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert sess_res.status_code == 201
    sess_id = sess_res.json()["id"]

    # 2. Mark attendance
    mark_res = client.post(
        f"/api/academic/offerings/off-ucs301-secA/attendance/sessions/{sess_id}/mark",
        json={
            "records": [
                {"student_id": "102203099-tiet-user", "status": "present"},
                {"student_id": "00000000-0000-0000-0000-000102203088", "status": "absent"},
            ]
        },
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert mark_res.status_code == 200
    records = mark_res.json()
    assert len(records) == 2


def test_attendance_correction_records_reason_and_audit():
    """Updating existing attendance logs correction reason in audit."""
    sess_res = client.post(
        "/api/academic/offerings/off-ucs301-secA/attendance/sessions",
        json={"session_date": "2026-02-19", "slot_type": "Tutorial"},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    sess_id = sess_res.json()["id"]

    # Mark as absent
    client.post(
        f"/api/academic/offerings/off-ucs301-secA/attendance/sessions/{sess_id}/mark",
        json={"records": [{"student_id": "102203099-tiet-user", "status": "absent"}]},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )

    # Correct to present with reason
    corr_res = client.post(
        f"/api/academic/offerings/off-ucs301-secA/attendance/sessions/{sess_id}/mark",
        json={
            "records": [
                {
                    "student_id": "102203099-tiet-user",
                    "status": "present",
                    "correction_reason": "Medical certificate verified by department",
                }
            ]
        },
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert corr_res.status_code == 200
    rec = corr_res.json()[0]
    assert rec["status"] == "present"
    assert rec["correction_reason"] == "Medical certificate verified by department"


# ============================================================
# 7. Assessment Gating & Answer Key Concealment
# ============================================================

def test_draft_assessments_hidden_from_students():
    """Students cannot see draft assessments; only published ones."""
    res = client.get(
        "/api/academic/offerings/off-ucs301-secA/assessments",
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res.status_code == 200
    asms = res.json()
    # asm-ucs301-mst is draft; student must NOT see it
    for a in asms:
        assert a["is_published"] is True
        assert a["id"] != "asm-ucs301-mst"


def test_answer_key_concealed_from_students_until_released():
    """Answer keys remain null for students until released by professor."""
    # 1. Professor creates an assessment with secret answer key
    create_res = client.post(
        "/api/academic/offerings/off-ucs301-secA/assessments",
        json={
            "title": "Quiz 2: Graph Algorithms",
            "assessment_type": "Quiz",
            "max_marks": 25.0,
            "weight_percent": 10.0,
            "is_published": True,
            "answer_key_content": "Secret graph solutions: Dijkstra uses min-priority queue.",
        },
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert create_res.status_code == 201
    asm_id = create_res.json()["id"]

    # 2. Student views assessments before release: answer key must be concealed
    res_st = client.get(
        "/api/academic/offerings/off-ucs301-secA/assessments",
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_st.status_code == 200
    asms = res_st.json()
    quiz = next((a for a in asms if a["id"] == asm_id), None)
    assert quiz is not None
    assert quiz["answer_key_content"] is None
    assert quiz["answer_key_released"] is False

    # 3. Professor releases answer key
    res_rel = client.patch(
        f"/api/academic/offerings/off-ucs301-secA/assessments/{asm_id}",
        json={"answer_key_released": True},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_rel.status_code == 200
    assert res_rel.json()["answer_key_released"] is True

    # 4. Student views assessments after release: answer key is now visible
    res_st2 = client.get(
        "/api/academic/offerings/off-ucs301-secA/assessments",
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_st2.status_code == 200
    quiz2 = next((a for a in res_st2.json() if a["id"] == asm_id), None)
    assert quiz2["answer_key_content"] is not None
    assert "Dijkstra" in quiz2["answer_key_content"]


def test_assessment_marks_range_validation():
    """Obtained marks cannot exceed max marks or be negative."""
    # Max marks is 20.0 for Quiz 1
    res_invalid = client.post(
        "/api/academic/offerings/off-ucs301-secA/assessments/asm-ucs301-quiz1/marks",
        json={"marks": [{"student_id": "102203099-tiet-user", "obtained_marks": 25.0}]},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_invalid.status_code == 400
    assert "between 0 and maximum marks" in res_invalid.json()["detail"]


# ============================================================
# 8. Assignment Submissions & Model Answers
# ============================================================

def test_assignment_submission_and_versioning():
    """Enrolled student can submit work; resubmission increments version."""
    # Student submits assignment
    res_sub1 = client.post(
        "/api/academic/offerings/off-ucs301-secA/assignments/asg-ucs301-1/submit",
        json={
            "submission_text": "Updated balanced tree implementation v2",
            "file_name": "arjun_mehta_rb_tree_v2.zip",
        },
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_sub1.status_code == 200
    sub_data = res_sub1.json()
    assert sub_data["version"] >= 2
    assert sub_data["student_id"] == "102203099-tiet-user"


def test_model_answer_concealment_and_release():
    """Model answers remain hidden from students until professor releases them."""
    # 1. Professor creates an assignment with model answer
    create_res = client.post(
        "/api/academic/offerings/off-ucs301-secA/assignments",
        json={
            "title": "Lab Assignment 2: Dynamic Programming Solutions",
            "instructions": "Solve 0/1 Knapsack and Matrix Chain Multiplication.",
            "due_date": "2026-03-20T23:59:00",
            "allowed_formats": ["pdf", "zip"],
            "max_file_size_mb": 10,
            "allow_late": True,
            "allow_resubmission": True,
            "is_published": True,
            "model_answer": "Reference DP state transition: dp[i][w] = max(dp[i-1][w], val[i] + dp[i-1][w-wt[i]])",
        },
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert create_res.status_code == 201
    asg_id = create_res.json()["id"]

    # 2. Student view initially: model answer must be hidden
    res_st = client.get(
        "/api/academic/offerings/off-ucs301-secA/assignments",
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_st.status_code == 200
    asgs = res_st.json()
    asg = next((a for a in asgs if a["id"] == asg_id), None)
    assert asg is not None
    assert asg["model_answer"] is None
    assert asg["model_answer_released"] is False

    # 3. Professor releases model answer
    res_patch = client.patch(
        f"/api/academic/offerings/off-ucs301-secA/assignments/{asg_id}",
        json={"model_answer_released": True},
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["model_answer_released"] is True

    # 4. Student view now includes model answer
    res_st2 = client.get(
        "/api/academic/offerings/off-ucs301-secA/assignments",
        headers={"Authorization": f"Bearer {STUDENT_ARJUN_TOKEN}"},
    )
    assert res_st2.status_code == 200
    asg2 = next((a for a in res_st2.json() if a["id"] == asg_id), None)
    assert asg2["model_answer"] is not None
    assert "dp[i][w]" in asg2["model_answer"]


# ============================================================
# 9. Roster Support Identification & Formula-Safe CSV Export
# ============================================================

def test_roster_support_identification():
    """
    Roster correctly flags students needing attendance and academic support:
    - Rohan Verma: 25% attendance (< 75%) -> needs_attendance_support=True
    - Rohan Verma: Quiz 1 score 6/20 (30%) + missing assignment -> needs_academic_support=True
    """
    res = client.get(
        "/api/academic/offerings/off-ucs301-secA/roster",
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res.status_code == 200
    roster = res.json()
    students = roster["students"]
    rohan = next((s for s in students if s["student_roll_no"] == "102203088"), None)
    assert rohan is not None
    assert rohan["needs_attendance_support"] is True
    assert rohan["needs_academic_support"] is True
    assert len(rohan["support_reasons"]) >= 2


def test_roster_csv_export_formula_injection_prevention():
    """
    CSV export strictly prefixes any cell starting with '=', '+', '-', or '@'
    with a single quote to prevent spreadsheet formula injection.
    """
    # Enroll a student with a formula injection name to test security sanitizer
    client.post(
        "/api/academic/offerings/off-ucs301-secA/enroll",
        json={
            "student_id": "test-formula-user",
            "student_name": "=cmd|' /C calc'!A0",
            "student_roll_no": "+102203888",
            "student_email": "@eval(evil.js)",
        },
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )

    res_csv = client.get(
        "/api/academic/offerings/off-ucs301-secA/roster/export-csv",
        headers={"Authorization": f"Bearer {PROF_RAJESH_TOKEN}"},
    )
    assert res_csv.status_code == 200
    assert res_csv.headers["content-type"].startswith("text/csv")
    csv_text = res_csv.text

    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    # Find our test formula student row
    formula_row = next((r for r in rows if "calc" in str(r)), None)
    assert formula_row is not None
    # Check that name, roll, and email were sanitized with leading single quote
    assert formula_row[1].startswith("'=")
    assert formula_row[0].startswith("'+")
    assert formula_row[2].startswith("'@")


# ============================================================
# 10. Immutable Audit Trail Inspection
# ============================================================

def test_audit_logs_contain_faculty_and_admin_mutations():
    """Admin can inspect immutable academic audit log."""
    res = client.get("/api/academic/audit-logs", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) > 0
    actions = {l["action"] for l in logs}
    assert any("ENROLLMENT" in a or "SESSION" in a or "ASSESSMENT" in a for a in actions)


# ============================================================
# 11. Administrator Account Creation & Provisioning
# ============================================================

def test_create_admin_account_with_institutional_key():
    """Users can create an administrator account using the institutional key."""
    res = client.post(
        "/api/academic/admin/create-account",
        json={
            "email": "dean_academic@thapar.edu",
            "full_name": "Dr. Manpreet Singh (Dean)",
            "admin_secret_key": "TIET-ADMIN-2026",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "admin"
    assert data["email"] == "dean_academic@thapar.edu"
    assert data["token"]

    # Verify that the new admin token can access administrator-only audit logs
    admin_res = client.get(
        "/api/academic/audit-logs",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert admin_res.status_code == 200

    # Cleanup created user from engine
    db.academic_rbac.user_roles.pop(data["user_id"], None)
    db.academic_rbac._save_persisted_data()


def test_create_admin_account_with_existing_admin():
    """An existing administrator can provision another administrator account."""
    res = client.post(
        "/api/academic/admin/create-account",
        json={
            "email": "deputy_registrar@thapar.edu",
            "full_name": "Deputy Registrar Academic",
        },
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "admin"

    # Cleanup created user from engine
    db.academic_rbac.user_roles.pop(data["user_id"], None)
    db.academic_rbac._save_persisted_data()


def test_create_admin_account_unauthorized_rejected():
    """Attempting to create an admin account without credentials or wrong key returns 403."""
    res = client.post(
        "/api/academic/admin/create-account",
        json={
            "email": "unauthorized_hacker@thapar.edu",
            "full_name": "Intruder",
            "admin_secret_key": "wrong-key",
        },
    )
    assert res.status_code == 403

