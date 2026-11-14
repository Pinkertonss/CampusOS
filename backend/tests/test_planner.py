"""
Unit Tests for Academic Planning Engine
----------------------------------------
Covers mathematical formulas, edge cases (t=0, exactly at target, target=100, impossible grades),
and authenticated FastAPI endpoints.
"""

import math
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.planner import (
    AttendanceEngine,
    GradeEngine,
    ActionPlanEngine,
)

client = TestClient(app)
AUTH_HEADER = {"Authorization": "Bearer dev-user-102203099"}


# ============================================================
# 1. ATTENDANCE FORMULA UNIT TESTS & EDGE CASES
# ============================================================

def test_attendance_percent_normal():
    # 18 attended out of 24 held
    pct = AttendanceEngine.calculate_current_percent(18, 24)
    assert pct == 75.0


def test_attendance_edge_case_t_zero():
    """Edge Case: t = 0 (no classes held yet)."""
    pct = AttendanceEngine.calculate_current_percent(0, 0)
    assert pct == 100.0

    needed = AttendanceEngine.calculate_classes_needed_to_reach_target(0, 0, target_percent=75.0)
    assert needed == 0

    safe_bunks = AttendanceEngine.calculate_safe_bunks_remaining(0, 0, target_percent=75.0)
    assert safe_bunks == 0


def test_attendance_edge_case_exactly_at_target():
    """Edge Case: exactly at target attendance (75.0%)."""
    # 15 / 20 = 75.0%
    pct = AttendanceEngine.calculate_current_percent(15, 20)
    assert pct == 75.0

    needed = AttendanceEngine.calculate_classes_needed_to_reach_target(15, 20, target_percent=75.0)
    assert needed == 0

    # floor(100 * 15 / 75 - 20) = floor(20 - 20) = 0
    safe_bunks = AttendanceEngine.calculate_safe_bunks_remaining(15, 20, target_percent=75.0)
    assert safe_bunks == 0


def test_attendance_classes_needed_formula():
    """
    Formula: ceil((T*t - 100*a) / (100 - T))
    For a=18, t=25, T=75:
    numerator = 75 * 25 - 1800 = 1875 - 1800 = 75
    denominator = 100 - 75 = 25
    needed = ceil(75 / 25) = 3
    """
    needed = AttendanceEngine.calculate_classes_needed_to_reach_target(18, 25, target_percent=75.0)
    assert needed == 3

    # Verification: attending 3 more classes -> (18 + 3) / (25 + 3) = 21 / 28 = 75.0%
    assert (21 / 28) * 100 == 75.0


def test_attendance_safe_bunks_formula():
    """
    Formula: floor(100*a / T - t)
    For a=20, t=20, T=75:
    floor(2000 / 75 - 20) = floor(26.666 - 20) = floor(6.666) = 6
    """
    safe_bunks = AttendanceEngine.calculate_safe_bunks_remaining(20, 20, target_percent=75.0)
    assert safe_bunks == 6

    # Missing 6 classes -> 20 / (20 + 6) = 20 / 26 = 76.92% (>= 75.0%)
    # Missing 7 classes -> 20 / 27 = 74.07% (< 75.0%)
    assert (20 / 26) * 100 >= 75.0
    assert (20 / 27) * 100 < 75.0


def test_attendance_edge_case_target_100():
    """Edge Case: Target = 100%."""
    # When a == t (never missed a class), student is at 100%
    needed_full = AttendanceEngine.calculate_classes_needed_to_reach_target(10, 10, target_percent=100.0)
    assert needed_full == 0

    # When a < t (student missed at least one class), reaching 100% is impossible!
    # (a + x) / (t + x) < 1.0 for any finite x.
    needed_impossible = AttendanceEngine.calculate_classes_needed_to_reach_target(9, 10, target_percent=100.0)
    assert needed_impossible is None

    # Safe bunks at target 100% must be 0
    safe_bunks = AttendanceEngine.calculate_safe_bunks_remaining(10, 10, target_percent=100.0)
    assert safe_bunks == 0


def test_attendance_cancelled_classes_ignored():
    """Cancelled classes do not count toward total held classes."""
    records = [
        {"status": "present"},
        {"status": "present"},
        {"status": "absent"},
        {"status": "cancelled"},
        {"status": "cancelled"},
    ]
    stats = AttendanceEngine.process_records(records, target_percent=75.0)
    assert stats["attended"] == 2
    assert stats["total_held"] == 3  # cancelled not counted!
    assert stats["cancelled"] == 2
    # 2/3 = 66.67%
    assert stats["percent"] == 66.67
    assert stats["status"] == "warning"


def test_attendance_what_if():
    """Tests what_if projection after attending n and skipping m classes."""
    # Currently 15/22 = 68.18%
    # Attend next 4, skip next 1 -> (15 + 4) / (22 + 4 + 1) = 19 / 27 = 70.37%
    res = AttendanceEngine.what_if(
        attended=15,
        total_held=22,
        attend_next_n=4,
        skip_next_m=1,
        target_percent=75.0,
    )
    assert res["current_percent"] == 68.18
    assert res["projected_attended"] == 19
    assert res["projected_total_held"] == 27
    assert res["projected_percent"] == 70.37
    assert res["projected_status"] == "warning"


# ============================================================
# 2. GRADE FORMULA UNIT TESTS & EDGE CASES
# ============================================================

def test_grades_current_weighted_score():
    assessments = [
        {"name": "MST-1", "weight_percent": 20.0, "max_marks": 30.0, "obtained_marks": 24.0},
        {"name": "MST-2", "weight_percent": 20.0, "max_marks": 30.0, "obtained_marks": 21.0},
        {"name": "End-Sem", "weight_percent": 60.0, "max_marks": 100.0, "obtained_marks": None},
    ]
    # MST-1: (24/30) * 20 = 16.0%
    # MST-2: (21/30) * 20 = 14.0%
    # Total current = 30.0% out of 40% completed weight
    res = GradeEngine.calculate_current_weighted_score(assessments)
    assert res["current_weighted_score"] == 30.0
    assert res["completed_weight"] == 40.0
    assert res["remaining_weight"] == 60.0


def test_grades_required_on_remaining_achievable():
    """
    Current score = 30.0%, remaining weight = 60.0%.
    Target total = 75.0%.
    Needed = 75.0 - 30.0 = 45.0%.
    Required on remaining = (45.0 / 60.0) * 100 = 75.0%.
    Achievable = True.
    """
    res = GradeEngine.calculate_required_on_remaining(
        current_weighted_score=30.0,
        remaining_weight=60.0,
        target_total_percent=75.0,
    )
    assert res["is_achievable"] is True
    assert res["required_percent_on_remaining"] == 75.0


def test_grades_edge_case_impossible_target():
    """
    Current score = 25.0%, remaining weight = 50.0%.
    Max possible final score = 25.0 + 50.0 = 75.0%.
    Student sets target = 85.0%.
    Needed = 85.0 - 25.0 = 60.0%.
    Required on remaining = (60.0 / 50.0) * 100 = 120.0% (> 100%).
    Achievable = False!
    """
    res = GradeEngine.calculate_required_on_remaining(
        current_weighted_score=25.0,
        remaining_weight=50.0,
        target_total_percent=85.0,
    )
    assert res["is_achievable"] is False
    assert res["required_percent_on_remaining"] == 120.0
    assert res["max_possible_score"] == 75.0


def test_grades_edge_case_already_secured():
    """Target already achieved by completed assessments."""
    res = GradeEngine.calculate_required_on_remaining(
        current_weighted_score=60.0,
        remaining_weight=40.0,
        target_total_percent=50.0,
    )
    assert res["is_achievable"] is True
    assert res["required_percent_on_remaining"] == 0.0


def test_grades_edge_case_no_remaining_weight():
    """All assessments completed (remaining weight = 0)."""
    # Case A: target met
    res_met = GradeEngine.calculate_required_on_remaining(
        current_weighted_score=82.0,
        remaining_weight=0.0,
        target_total_percent=80.0,
    )
    assert res_met["is_achievable"] is True

    # Case B: target not met and no assessments left
    res_unmet = GradeEngine.calculate_required_on_remaining(
        current_weighted_score=72.0,
        remaining_weight=0.0,
        target_total_percent=80.0,
    )
    assert res_unmet["is_achievable"] is False


def test_grades_what_if_simulation():
    assessments = [
        {"name": "MST-1", "weight_percent": 25.0, "max_marks": 50.0, "obtained_marks": 40.0}, # (40/50)*25 = 20.0
        {"name": "End-Sem", "weight_percent": 75.0, "max_marks": 100.0, "obtained_marks": None},
    ]
    # If student scores 80% on End-Sem: 20.0 + (0.80 * 75.0) = 20.0 + 60.0 = 80.0% -> 'A'
    res = GradeEngine.what_if(
        assessments=assessments,
        hypothetical_scores={"End-Sem": 80.0},
    )
    assert res["current_weighted_score"] == 20.0
    assert res["projected_total_score"] == 80.0
    assert res["projected_letter_grade"] == "A"


# ============================================================
# 3. DAILY ACTION PLAN TESTS
# ============================================================

def test_daily_action_plan_prioritization():
    today = date(2024, 11, 10)
    courses_att = [
        {"course_code": "UCS509", "course_name": "Compiler Design", "attended_classes": 13, "total_classes": 20}, # 65% -> warning
        {"course_code": "UCS503", "course_name": "DAA", "attended_classes": 16, "total_classes": 20}, # 80% -> safe
        {"course_code": "UCS505", "course_name": "CN", "attended_classes": 12, "total_classes": 20}, # 60% -> critical (<65%)
    ]
    assessments = [
        {"id": "a1", "name": "DAA Assignment 3", "course_code": "UCS503", "due_date": "2024-11-12", "obtained_marks": None, "weight_percent": 5.0},
        {"id": "a2", "name": "Far Away Quiz", "course_code": "UCS503", "due_date": "2024-12-25", "obtained_marks": None, "weight_percent": 10.0},
    ]
    tasks = [
        {"id": "t1", "title": "Apply for Minor degree form", "due_date": "2024-11-15", "status": "pending"},
        {"id": "t2", "title": "Completed Homework", "due_date": "2024-11-05", "status": "completed"},
    ]

    actions = ActionPlanEngine.generate_daily_plan(
        courses_attendance=courses_att,
        assessments=assessments,
        tasks=tasks,
        target_percent=75.0,
        reference_date=today,
    )

    # Must contain critical attendance for UCS505
    crit_action = next((a for a in actions if a["id"] == "att-crit-UCS505"), None)
    assert crit_action is not None
    assert crit_action["priority"] == "urgent"
    assert "Attendance in UCS505" in crit_action["reason"]

    # Must contain warning attendance for UCS509
    warn_action = next((a for a in actions if a["id"] == "att-warn-UCS509"), None)
    assert warn_action is not None
    assert warn_action["priority"] == "high"

    # Must contain DAA Assignment 3 (due in 2 days)
    assess_action = next((a for a in actions if a["id"] == "assess-a1" or "DAA Assignment 3" in a["title"]), None)
    assert assess_action is not None
    assert assess_action["priority"] == "urgent"

    # Far away quiz (> 7 days) should not be in the immediate 7-day action list
    far_action = next((a for a in actions if a["id"] == "assess-a2" or "Far Away Quiz" in a["title"]), None)
    assert far_action is None

    # Completed task should be excluded
    completed_task = next((a for a in actions if a["id"] == "task-t2" or "Completed Homework" in a["title"]), None)
    assert completed_task is None


# ============================================================
# 4. FASTAPI AUTHENTICATED ROUTER ENDPOINT TESTS
# ============================================================

def test_academics_unauthorized_without_token():
    """Unauthenticated calls to /academics/* must return 401."""
    res_sum = client.get("/academics/summary")
    assert res_sum.status_code == 401

    res_plan = client.get("/academics/daily-plan")
    assert res_plan.status_code == 401

    res_att = client.post("/academics/attendance/what-if", json={"attended": 10, "total_held": 15})
    assert res_att.status_code == 401

    res_grd = client.post("/academics/grades/what-if", json={"target_total_percent": 80.0})
    assert res_grd.status_code == 401


def test_get_academics_summary_authenticated():
    res = client.get("/academics/summary", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert "overall_attendance_percent" in data
    assert "courses" in data
    assert len(data["courses"]) > 0
    assert "assessments_summary" in data


def test_post_attendance_what_if_authenticated():
    payload = {
        "course_code": "UCS405",
        "attended": 18,
        "total_held": 25,
        "attend_next_n": 4,
        "skip_next_m": 0,
        "target_percent": 75.0,
    }
    res = client.post("/academics/attendance/what-if", json=payload, headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data["current_percent"] == 72.0
    # (18 + 4) / 29 = 22 / 29 = 75.86%
    assert data["projected_percent"] == 75.86
    assert data["projected_status"] == "safe"
    assert data["projected_safe_bunks"] >= 0


def test_post_grades_what_if_authenticated():
    payload = {
        "course_code": "UCS301",
        "target_total_percent": 80.0,
        "hypothetical_scores": {
            "End Semester": 85.0,
        },
    }
    res = client.post("/academics/grades/what-if", json=payload, headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert "current_weighted_score" in data
    assert "projected_total_score" in data
    assert "projected_letter_grade" in data
    assert "is_achievable" in data


def test_post_grades_what_if_all_courses_and_slider_matching():
    """Verify grade simulation runs successfully across all enrolled courses and unseeded courses."""
    test_courses = ["UCS301", "UCS310", "UCS405", "UMA010", "UED101", "UCS999"]
    for code in test_courses:
        payload = {
            "course_code": code,
            "target_total_percent": 85.0,
            "hypothetical_scores": {
                "End Semester": 90.0,
            },
        }
        res = client.post("/academics/grades/what-if", json=payload, headers=AUTH_HEADER)
        assert res.status_code == 200, f"Failed for course {code}"
        data = res.json()
        assert data["course_code"] == code
        assert data["completed_weight"] > 0, f"Course {code} should have completed assessments"
        assert data["remaining_weight"] > 0, f"Course {code} should have remaining weight"
        assert data["projected_total_score"] > data["current_weighted_score"], (
            f"Course {code} hypothetical score did not project an increase: "
            f"current={data['current_weighted_score']}, projected={data['projected_total_score']}"
        )
        assert data["projected_letter_grade"] in ["A+", "A", "A-", "B", "B-", "C", "D", "E"]


def test_get_daily_plan_authenticated():
    res = client.get("/academics/daily-plan?reference_date=2024-11-10", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert "date" in data
    assert "total_actions" in data
    assert "actions" in data
    assert isinstance(data["actions"], list)
    if data["actions"]:
        # Verify plain-English reasons are provided
        assert any(len(a["reason"]) > 10 for a in data["actions"])
