import pytest
from app.services.what_if_engine import WhatIfEngine
from app.models.academic import (
    WhatIfAttendanceRequest,
    WhatIfGradeRequest,
    CourseGradeScenario,
)

def test_attendance_safe_status():
    # 36 / 40 = 90% (Safe)
    pct, status, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(36, 40)
    assert pct == 90.0
    assert status == "safe"
    assert safe_bunks == 8  # 36 / (40 + 8) = 36 / 48 = 75.0%
    assert needed == 0

def test_attendance_warning_status():
    # 18 / 25 = 72% (Warning: 65% - 74.9%)
    pct, status, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(18, 25)
    assert pct == 72.0
    assert status == "warning"
    assert safe_bunks == 0
    # (18 + y) / (25 + y) >= 0.75  =>  y >= (18.75 - 18) / 0.25 = 3
    assert needed == 3

def test_attendance_critical_status():
    # 15 / 25 = 60% (Critical: <65% debarred)
    pct, status, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(15, 25)
    assert pct == 60.0
    assert status == "critical"
    assert safe_bunks == 0
    # (15 + y) / (25 + y) >= 0.75  =>  (18.75 - 15) / 0.25 = 15
    assert needed == 15

def test_simulate_attendance_upcoming():
    req = WhatIfAttendanceRequest(
        course_code="UCS405",
        attended_classes=18,
        total_classes=25,
        upcoming_classes_to_attend=5,
        total_upcoming_classes=5
    )
    res = WhatIfEngine.simulate_attendance(req)
    # (18 + 5) / (25 + 5) = 23 / 30 = 76.7%
    assert res.simulated_percentage == 76.7
    assert res.status_assessment == "safe"

def test_grade_what_if_feasible():
    req = WhatIfGradeRequest(
        current_cgpa=8.0,
        completed_credits=80.0,
        target_cgpa=8.2,
        current_semester_courses=[
            CourseGradeScenario(course_code="UCS301", credits=4.0, target_grade="A"),
            CourseGradeScenario(course_code="UCS310", credits=4.0, target_grade="A-"),
            CourseGradeScenario(course_code="UCS405", credits=4.0, target_grade="A"),
            CourseGradeScenario(course_code="UMA010", credits=4.0, target_grade="B"),
            CourseGradeScenario(course_code="UED101", credits=4.0, target_grade="A"),
        ]
    )
    res = WhatIfEngine.simulate_grades(req)
    assert res.is_feasible is True
    assert res.predicted_sgpa > 8.0
    assert res.predicted_cgpa > 8.0
