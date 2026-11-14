import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.planner import AttendanceEngine, GradeEngine
from app.models.reuse import ListingCreate, ExchangeRequestCreate
from app.routers.reuse import (
    create_reuse_listing,
    request_exchange_item,
    accept_exchange_request,
    confirm_exchange_completion,
)

client = TestClient(app)


def test_csv_template_endpoint():
    """Verify GET /api/academic/import-csv-template returns proper RFC 4180 CSV templates."""
    res_att = client.get("/api/academic/import-csv-template?template_type=attendance")
    assert res_att.status_code == 200
    assert "text/csv" in res_att.headers["content-type"]
    assert "thapar_attendance_template.csv" in res_att.headers.get("content-disposition", "")
    assert "course_code,course_name,attended,total" in res_att.text

    res_crs = client.get("/api/academic/import-csv-template?template_type=courses")
    assert res_crs.status_code == 200
    assert "text/csv" in res_crs.headers["content-type"]
    assert "thapar_courses_template.csv" in res_crs.headers.get("content-disposition", "")
    assert "course_code,course_name,credits,target_grade" in res_crs.text


def test_borrow_mode_completion_restores_listing_available():
    """
    Verify that completing a loan (borrow mode) records return/handover
    and restores the listing status to 'available', preventing permanent archival of lent items.
    """
    owner_id = "test-owner-borrow-uuid"
    borrower_id = "test-borrower-uuid"

    listing_in = ListingCreate(
        title="Scientific Calculator fx-991CW",
        description="Available for mid-sem exam loan",
        category="calculator",
        mode="borrow",
        condition="like_new",
    )
    listing = create_reuse_listing(listing_in, user_id=owner_id)
    assert listing.mode == "borrow"
    assert listing.status == "available"

    # Borrower requests
    req = request_exchange_item(
        listing.id,
        req_body=ExchangeRequestCreate(notes="Need for exam"),
        user_id=borrower_id,
    )
    assert req.status == "pending"

    # Owner accepts -> reserved
    accepted_req = accept_exchange_request(req.id, user_id=owner_id)
    assert accepted_req.status == "accepted"

    # Complete handover and return (instant completion)
    completed_req = confirm_exchange_completion(req.id, instant=True, user_id=owner_id)
    assert completed_req.status == "completed"

    # Fetch listing -> status should be restored to 'available' for future lending!
    res = client.get(f"/api/reuse/listings/{listing.id}")
    assert res.status_code == 200
    assert res.json()["status"] == "available"


def test_attendance_engine_excused_late_and_enrollment_date():
    """Verify attendance engine handles excused, late, and enrollment date filters."""
    records = [
        {"session_date": "2024-08-01", "status": "present"},  # Before enrollment -> ignored
        {"session_date": "2024-08-15", "status": "present"},  # Attended
        {"session_date": "2024-08-20", "status": "late"},     # Counted as attended
        {"session_date": "2024-08-25", "status": "absent"},   # Absent
        {"session_date": "2024-08-30", "status": "excused"},  # Excused -> not in total held
        {"session_date": "2024-09-05", "status": "cancelled"},# Cancelled -> not in total held
    ]

    stats = AttendanceEngine.process_records(
        records,
        target_percent=75.0,
        enrollment_date="2024-08-10",
    )

    # Counted sessions = 3 (present on 15th, late on 20th, absent on 25th)
    # Attended = 2 (present on 15th + late on 20th)
    assert stats["total_held"] == 3
    assert stats["attended"] == 2
    assert stats["excused"] == 1
    assert stats["cancelled"] == 1
    assert stats["percent"] == 66.67
    assert stats["status"] == "warning"


def test_grade_engine_distinguishes_earned_vs_graded_performance():
    """Verify GradeEngine calculates earned weighted contribution and graded performance separately."""
    assessments = [
        {"name": "MST-1", "weight_percent": 25.0, "max_marks": 50.0, "obtained_marks": 40.0}, # 80% on 25% weight = 20.0
        {"name": "MST-2", "weight_percent": 25.0, "max_marks": 50.0, "obtained_marks": 45.0}, # 90% on 25% weight = 22.5
        {"name": "End-Sem", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None}, # Pending
    ]

    res = GradeEngine.calculate_current_weighted_score(assessments)
    assert res["current_weighted_score"] == 42.5  # 20.0 + 22.5
    assert res["completed_weight"] == 50.0
    assert res["remaining_weight"] == 50.0
    # Average performance across graded assessments alone: 42.5 / 50.0 * 100 = 85.0%
    assert res["graded_performance_percent"] == 85.0


def test_reuse_impact_returns_estimation_assumptions():
    """Verify /api/reuse/impact returns clear documentation of environmental and financial estimation assumptions."""
    res = client.get("/api/reuse/impact")
    assert res.status_code == 200
    data = res.json()
    assert "estimation_assumptions" in data
    assumptions = data["estimation_assumptions"]
    assert "basis" in assumptions
    assert "carbon_intensity" in assumptions
    assert "textbook_factor" in assumptions
