"""
Phase 2 Academic Persistence & Model Alignment Tests
---------------------------------------------------
Validates:
1. Invariant enforcement:
   - Attendance: 0 <= attended <= total; rejects attended > total with 400, negative counters with 400.
   - Courses: Alphanumeric code validation (400), non-empty name (400), duplicate prevention (409 Conflict).
   - Tasks: Non-empty title (400), priority validation (400), date format validation (400).
2. Durable state persistence:
   - Task completion/reopening toggle persists across sequential reads.
   - User-isolated persistence: User A and User B maintain separate courses, attendance, and deadlines.
3. CSV Import reliability:
   - Row-level error reporting on invalid attendance invariants (e.g., attended > total).
   - Row-level error reporting on duplicate course codes in the batch.
   - Valid course and attendance CSVs persist cleanly into student store.
4. What-if read-only guarantee:
   - What-if simulation endpoints do NOT mutate underlying stored academic records.
5. Date alignment:
   - Academic deadlines and daily plan reference dates are current (2026), not stale 2024 fixtures.
"""

import io
import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

USER_A_TOKEN = {"Authorization": "Bearer test-user-alice"}
USER_B_TOKEN = {"Authorization": "Bearer test-user-bob"}


# ============================================================
# 1. Invariant & Validation Tests
# ============================================================

def test_attendance_invariants_enforced():
    """Rejects negative counts or attended > total with 400 Bad Request."""
    # 1. Attended > total
    res1 = client.post(
        "/api/academic/attendance/update",
        params={"course_code": "UCS301", "attended_classes": 25, "total_classes": 20},
        headers=USER_A_TOKEN,
    )
    assert res1.status_code == 400
    assert "Attended classes cannot exceed total classes" in res1.json()["detail"]

    # 2. Negative attended
    res2 = client.post(
        "/api/academic/attendance/update",
        params={"course_code": "UCS301", "attended_classes": -5, "total_classes": 20},
        headers=USER_A_TOKEN,
    )
    assert res2.status_code == 400
    assert "cannot be negative" in res2.json()["detail"]

    # 3. Negative total
    res3 = client.post(
        "/api/academic/attendance/update",
        params={"course_code": "UCS301", "attended_classes": 0, "total_classes": -10},
        headers=USER_A_TOKEN,
    )
    assert res3.status_code == 400
    assert "cannot be negative" in res3.json()["detail"]

    # 4. Valid update succeeds
    res_valid = client.post(
        "/api/academic/attendance/update",
        params={"course_code": "UCS301", "attended_classes": 18, "total_classes": 20},
        headers=USER_A_TOKEN,
    )
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["attended_classes"] == 18
    assert data["total_classes"] == 20
    assert data["percentage"] == 90.0
    assert data["status"] == "safe"


def test_course_validation_and_duplicate_prevention():
    """Enforces valid course format and prevents duplicate course registration (409 Conflict)."""
    # Invalid code (empty / special characters)
    bad_res = client.post(
        "/api/academic/courses",
        json={"course_code": "!!", "course_name": "Invalid Course", "credits": 4.0},
        headers=USER_A_TOKEN,
    )
    assert bad_res.status_code == 400

    # Register Course X for Alice
    c_payload = {
        "course_code": "UCS990",
        "course_name": "Advanced Cloud Computing",
        "credits": 4.0,
        "target_grade": "A",
        "semester": 5,
    }
    create_res = client.post("/api/academic/courses", json=c_payload, headers=USER_A_TOKEN)
    assert create_res.status_code == 200

    # Duplicate registration for Alice fails with 409 Conflict
    dup_res = client.post("/api/academic/courses", json=c_payload, headers=USER_A_TOKEN)
    assert dup_res.status_code == 409
    assert "already registered" in dup_res.json()["detail"]

    # Course registration for Bob with same code succeeds (multi-tenant isolated)
    bob_res = client.post("/api/academic/courses", json=c_payload, headers=USER_B_TOKEN)
    assert bob_res.status_code == 200


def test_deadline_validation_and_status_toggle():
    """Enforces deadline fields validation and verifies durable completion state toggle."""
    # 1. Empty title fails
    bad_title = client.post(
        "/api/academic/deadlines",
        json={"title": "   ", "due_date": "2026-11-20", "priority": "high"},
        headers=USER_A_TOKEN,
    )
    assert bad_title.status_code == 400

    # 2. Invalid priority fails
    bad_prio = client.post(
        "/api/academic/deadlines",
        json={"title": "Valid Title", "due_date": "2026-11-20", "priority": "critical_extreme"},
        headers=USER_A_TOKEN,
    )
    assert bad_prio.status_code == 400

    # 3. Invalid date format fails
    bad_date = client.post(
        "/api/academic/deadlines",
        json={"title": "Valid Title", "due_date": "not-a-date", "priority": "high"},
        headers=USER_A_TOKEN,
    )
    assert bad_date.status_code == 400

    # 4. Valid deadline creation
    new_dl = client.post(
        "/api/academic/deadlines",
        json={"title": "Operating Systems Lab Report", "due_date": "2026-11-25", "priority": "high", "course_code": "UCS405"},
        headers=USER_A_TOKEN,
    ).json()
    task_id = new_dl["id"]
    assert new_dl["status"] == "pending"

    # 5. Toggle status to completed
    toggle_1 = client.patch(f"/api/academic/deadlines/{task_id}/toggle", headers=USER_A_TOKEN)
    assert toggle_1.status_code == 200
    assert toggle_1.json()["status"] == "completed"

    # Re-fetch deadlines to verify persistence
    deadlines = client.get("/api/academic/deadlines", headers=USER_A_TOKEN).json()
    matching = next(d for d in deadlines if d["id"] == task_id)
    assert matching["status"] == "completed"

    # 6. Toggle status back to pending
    toggle_2 = client.patch(f"/api/academic/deadlines/{task_id}/toggle", headers=USER_A_TOKEN)
    assert toggle_2.status_code == 200
    assert toggle_2.json()["status"] == "pending"


# ============================================================
# 2. Multi-Tenant Academic Persistence Tests
# ============================================================

def test_multi_tenant_academic_persistence():
    """Verifies that two students maintain separate persistent academic records with no leakage."""
    # Alice updates attendance for UCS310
    client.post(
        "/api/academic/attendance/update",
        params={"course_code": "UCS310", "attended_classes": 30, "total_classes": 32},
        headers=USER_A_TOKEN,
    )

    # Bob updates attendance for UCS310 with completely different numbers
    client.post(
        "/api/academic/attendance/update",
        params={"course_code": "UCS310", "attended_classes": 15, "total_classes": 32},
        headers=USER_B_TOKEN,
    )

    # Re-fetch Alice's attendance
    alice_att = client.get("/api/academic/attendance", headers=USER_A_TOKEN).json()
    alice_rec = next(r for r in alice_att if r["course_code"] == "UCS310")
    assert alice_rec["attended_classes"] == 30
    assert alice_rec["status"] == "safe"

    # Re-fetch Bob's attendance
    bob_att = client.get("/api/academic/attendance", headers=USER_B_TOKEN).json()
    bob_rec = next(r for r in bob_att if r["course_code"] == "UCS310")
    assert bob_rec["attended_classes"] == 15
    assert bob_rec["status"] == "critical"


# ============================================================
# 3. CSV Import Reliability & Row-Level Error Tests
# ============================================================

def test_csv_import_attendance_with_row_errors():
    """Imports attendance CSV and verifies row-level errors for invariant violations and duplicates."""
    csv_content = (
        "course_code,attended,total\n"
        "UCS301,20,25\n"
        "UCS310,35,30\n"  # Error: attended > total
        "UCS301,10,15\n"  # Error: duplicate in batch
        "UMA010,-2,20\n"   # Error: negative attended
        "UED101,18,20\n"   # Valid
    )
    files = {"file": ("attendance.csv", csv_content.encode("utf-8"), "text/csv")}
    res = client.post(
        "/api/academic/import-csv",
        files=files,
        data={"import_type": "attendance"},
        headers=USER_A_TOKEN,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["records_imported"] == 2  # UCS301 (row 1) and UED101 (row 5)
    assert len(data["errors"]) == 3
    assert any("cannot exceed total" in err for err in data["errors"])
    assert any("Duplicate course code" in err for err in data["errors"])
    assert any("cannot be negative" in err for err in data["errors"])


def test_csv_import_empty_file_fails():
    """Empty CSV file upload returns 400 Bad Request."""
    files = {"file": ("empty.csv", b"", "text/csv")}
    res = client.post(
        "/api/academic/import-csv",
        files=files,
        data={"import_type": "attendance"},
        headers=USER_A_TOKEN,
    )
    assert res.status_code == 400


# ============================================================
# 4. Read-Only What-If Simulation Guarantee
# ============================================================

def test_what_if_endpoints_do_not_mutate_state():
    """Verifies that mathematical simulation endpoints never mutate stored records."""
    # Check baseline attendance
    before_att = client.get("/api/academic/attendance", headers=USER_A_TOKEN).json()
    before_dict = {r["course_code"]: (r["attended_classes"], r["total_classes"]) for r in before_att}

    # Run what-if simulations
    sim_res1 = client.post(
        "/api/academic/what-if/attendance",
        json={"course_code": "UCS301", "attended_classes": 10, "total_classes": 40, "upcoming_classes_to_attend": 15, "total_upcoming_classes": 15},
    )
    assert sim_res1.status_code == 200

    sim_res2 = client.post(
        "/academics/attendance/what-if",
        json={"course_code": "UCS301", "attended": 5, "total_held": 50, "attend_next_n": 10, "skip_next_m": 2},
        headers=USER_A_TOKEN,
    )
    assert sim_res2.status_code == 200

    # Verify stored records have NOT changed
    after_att = client.get("/api/academic/attendance", headers=USER_A_TOKEN).json()
    after_dict = {r["course_code"]: (r["attended_classes"], r["total_classes"]) for r in after_att}
    assert before_dict == after_dict


# ============================================================
# 5. Date Hygiene (Current Year 2026)
# ============================================================

def test_academic_deadlines_date_hygiene():
    """Verifies that default seeded deadlines and daily plan reference dates are current (2026)."""
    deadlines = client.get("/api/academic/deadlines", headers={"Authorization": "Bearer dev-user-102203099"}).json()
    assert len(deadlines) >= 3
    current_year = str(date.today().year)
    # None of the deadlines should be from 2024
    for dl in deadlines:
        assert not dl["due_date"].startswith("2024-"), f"Stale 2024 deadline found: {dl}"

    daily_plan = client.get("/academics/daily-plan", headers={"Authorization": "Bearer dev-user-102203099"}).json()
    assert daily_plan["date"].startswith(current_year)
