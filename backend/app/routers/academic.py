import csv
import io
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..core.auth import get_current_user_id, get_optional_user_id
from ..core.supabase import get_supabase_client
from ..database import db
from ..models.academic import (
    Course,
    CourseCreate,
    AttendanceRecord,
    WhatIfAttendanceRequest,
    WhatIfAttendanceResponse,
    WhatIfGradeRequest,
    WhatIfGradeResponse,
    TimetableSlot,
    DeadlineTask,
    DeadlineTaskCreate,
    CSVImportResult,
    AttendanceWhatIfRequest,
    AttendanceWhatIfResponse,
    GradeWhatIfRequest,
    GradeWhatIfResponse,
    DailyPlanResponse,
    DailyActionItem,
    AcademicSummaryResponse,
    AssessmentItem,
)
from ..services.what_if_engine import WhatIfEngine
from ..services.planner import (
    AttendanceEngine,
    GradeEngine,
    ActionPlanEngine,
    DEFAULT_GRADING_SCALE,
)

# Router for legacy / frontend endpoints (/api/academic/...)
router = APIRouter(prefix="/api/academic", tags=["Academic Dashboard"])

# Router for official REST academic endpoints (/academics/...)
academics_router = APIRouter(prefix="/academics", tags=["Academic Planning Engine"])


# ============================================================
# Helper: Fetch Student Data from Supabase with In-Memory Fallback
# ============================================================

def _to_db_user_id(uid: str) -> str:
    if not uid:
        return "00000000-0000-0000-0000-000102203099"
    if uid in ("102203099-tiet-user", "dev-user-102203099", "dev-user", "mock-token"):
        return "00000000-0000-0000-0000-000102203099"
    try:
        return str(uuid.UUID(str(uid)))
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, str(uid)))


def _fetch_student_data(user_id: str) -> Dict[str, Any]:
    """
    Fetches courses, attendance, assessments, and tasks for user_id.
    Queries Supabase if available; gracefully falls back to seeded in-memory store.
    """
    client = get_supabase_client()
    db_uid = _to_db_user_id(user_id)
    profile = {
        "full_name": "Arjun Mehta",
        "roll_no": "102203099",
        "branch": "COE",
        "semester": 5,
    }
    courses_list: List[Dict[str, Any]] = []
    attendance_map: Dict[str, Dict[str, Any]] = {}
    assessments_list: List[Dict[str, Any]] = []
    tasks_list: List[Dict[str, Any]] = []

    # Attempt Supabase query if client is present
    if client:
        try:
            p_res = client.table("profiles").select("*").in_("user_id", [user_id, db_uid]).execute()
            if p_res.data:
                profile.update(p_res.data[0])

            c_res = client.table("courses").select("*").in_("user_id", [user_id, db_uid]).execute()
            if c_res.data:
                courses_list = c_res.data

            a_res = client.table("attendance_records").select("*").in_("user_id", [user_id, db_uid]).execute()
            if a_res.data:
                for rec in a_res.data:
                    cid = rec.get("course_id") or rec.get("course_code")
                    if cid not in attendance_map:
                        attendance_map[cid] = {"records": []}
                    attendance_map[cid]["records"].append(rec)

            ass_res = client.table("assessments").select("*").in_("user_id", [user_id, db_uid]).execute()
            if ass_res.data:
                assessments_list = ass_res.data

            t_res = client.table("tasks").select("*").in_("user_id", [user_id, db_uid]).execute()
            if t_res.data:
                tasks_list = t_res.data
        except Exception:
            pass

    # Fallback to user-isolated in-memory db if Supabase returned empty
    if not courses_list:
        for c in db.get_courses(user_id):
            courses_list.append({
                "id": c.id,
                "code": c.course_code,
                "name": c.course_name,
                "credits": c.credits,
                "grade": c.grade,
                "target_grade": c.target_grade,
                "semester": c.semester,
            })

    if not attendance_map:
        for att in db.get_attendance(user_id):
            code = att.course_code
            attendance_map[code] = {
                "attended": att.attended_classes,
                "total_held": att.total_classes,
                "records": [
                    {"status": "present"} for _ in range(att.attended_classes)
                ] + [
                    {"status": "absent"} for _ in range(max(0, att.total_classes - att.attended_classes))
                ]
            }

    if not assessments_list:
        today = date.today()
        assessments_list = [
            # UCS301 - Data Structures & Algorithms (100% total weight)
            {"id": "ass-ucs301-1", "course_code": "UCS301", "name": "MST-1", "weight_percent": 20.0, "max_marks": 30.0, "obtained_marks": 24.0, "due_date": (today - timedelta(days=40)).isoformat()},
            {"id": "ass-ucs301-2", "course_code": "UCS301", "name": "MST-2", "weight_percent": 20.0, "max_marks": 30.0, "obtained_marks": 21.0, "due_date": (today - timedelta(days=15)).isoformat()},
            {"id": "ass-ucs301-3", "course_code": "UCS301", "name": "Assignment 1", "weight_percent": 5.0, "max_marks": 20.0, "obtained_marks": 18.0, "due_date": (today - timedelta(days=45)).isoformat()},
            {"id": "ass-ucs301-4", "course_code": "UCS301", "name": "Assignment 2", "weight_percent": 5.0, "max_marks": 20.0, "obtained_marks": 16.0, "due_date": (today - timedelta(days=20)).isoformat()},
            {"id": "ass-ucs301-5", "course_code": "UCS301", "name": "End Semester Exam", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None, "due_date": (today + timedelta(days=20)).isoformat()},

            # UCS310 - Database Management Systems (100% total weight)
            {"id": "ass-ucs310-1", "course_code": "UCS310", "name": "Mid Semester Test", "weight_percent": 30.0, "max_marks": 30.0, "obtained_marks": 23.0, "due_date": (today - timedelta(days=35)).isoformat()},
            {"id": "ass-ucs310-2", "course_code": "UCS310", "name": "Lab & Quizzes", "weight_percent": 20.0, "max_marks": 20.0, "obtained_marks": 16.0, "due_date": (today - timedelta(days=10)).isoformat()},
            {"id": "ass-ucs310-3", "course_code": "UCS310", "name": "End Semester Exam", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None, "due_date": (today + timedelta(days=18)).isoformat()},

            # UCS405 - Operating Systems (100% total weight)
            {"id": "ass-ucs405-1", "course_code": "UCS405", "name": "Mid Semester Test", "weight_percent": 30.0, "max_marks": 30.0, "obtained_marks": 21.0, "due_date": (today - timedelta(days=38)).isoformat()},
            {"id": "ass-ucs405-2", "course_code": "UCS405", "name": "Lab Evaluation", "weight_percent": 20.0, "max_marks": 25.0, "obtained_marks": 18.0, "due_date": (today - timedelta(days=12)).isoformat()},
            {"id": "ass-ucs405-3", "course_code": "UCS405", "name": "End Semester Exam", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None, "due_date": (today + timedelta(days=22)).isoformat()},

            # UMA010 - Mathematics - III (100% total weight)
            {"id": "ass-uma010-1", "course_code": "UMA010", "name": "Mid Semester Test", "weight_percent": 30.0, "max_marks": 30.0, "obtained_marks": 17.0, "due_date": (today - timedelta(days=36)).isoformat()},
            {"id": "ass-uma010-2", "course_code": "UMA010", "name": "Tutorial Quizzes", "weight_percent": 20.0, "max_marks": 20.0, "obtained_marks": 12.0, "due_date": (today - timedelta(days=14)).isoformat()},
            {"id": "ass-uma010-3", "course_code": "UMA010", "name": "End Semester Exam", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None, "due_date": (today + timedelta(days=15)).isoformat()},

            # UED101 - Engineering Design Project - I (100% total weight)
            {"id": "ass-ued101-1", "course_code": "UED101", "name": "Mid-Term Project Review", "weight_percent": 30.0, "max_marks": 30.0, "obtained_marks": 27.0, "due_date": (today - timedelta(days=30)).isoformat()},
            {"id": "ass-ued101-2", "course_code": "UED101", "name": "Continuous Sessional Work", "weight_percent": 20.0, "max_marks": 20.0, "obtained_marks": 18.0, "due_date": (today - timedelta(days=8)).isoformat()},
            {"id": "ass-ued101-3", "course_code": "UED101", "name": "End Semester Prototype & Viva", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None, "due_date": (today + timedelta(days=25)).isoformat()},
        ]

    if not tasks_list:
        for t in db.get_deadlines(user_id):
            tasks_list.append({
                "id": t.id,
                "title": t.title,
                "due_date": t.due_date,
                "status": t.status,
                "priority": t.priority,
            })

    return {
        "profile": profile,
        "courses": courses_list,
        "attendance": attendance_map,
        "assessments": assessments_list,
        "tasks": tasks_list,
    }


# ============================================================
# 1. GET /academics/summary
# ============================================================

@academics_router.get("/summary", response_model=AcademicSummaryResponse)
@router.get("/summary", response_model=AcademicSummaryResponse)
def get_academic_summary(user_id: str = Depends(get_current_user_id)):
    """
    Returns an academic summary for the authenticated student:
    - Overall attendance percentage across courses
    - Count of courses at risk (< 75% or < 65%)
    - Course-by-course breakdown with safe bunks & classes needed
    - Assessments summary with current weighted score
    """
    data = _fetch_student_data(user_id)
    profile = data["profile"]
    courses = data["courses"]
    attendance_data = data["attendance"]
    assessments = data["assessments"]

    processed_courses: List[Dict[str, Any]] = []
    total_percent_sum = 0.0
    courses_at_risk = 0

    for c in courses:
        code = c.get("code") or c.get("course_code") or ""
        cid = c.get("id") or code

        att_entry = attendance_data.get(cid) or attendance_data.get(code)
        if att_entry and "records" in att_entry:
            stats = AttendanceEngine.process_records(att_entry["records"], target_percent=75.0)
            attended = stats["attended"]
            total_held = stats["total_held"]
            percent = stats["percent"]
            status_val = stats["status"]
            safe_bunks = stats["safe_bunks_remaining"]
            needed = stats["classes_needed_to_reach_target"]
        elif att_entry:
            attended = int(att_entry.get("attended", 0))
            total_held = int(att_entry.get("total_held", 0))
            percent = AttendanceEngine.calculate_current_percent(attended, total_held)
            status_val = AttendanceEngine.evaluate_status(percent, 75.0)
            safe_bunks = AttendanceEngine.calculate_safe_bunks_remaining(attended, total_held, 75.0)
            needed = AttendanceEngine.calculate_classes_needed_to_reach_target(attended, total_held, 75.0)
        else:
            attended = 0
            total_held = 0
            percent = 100.0
            status_val = "safe"
            safe_bunks = 0
            needed = 0

        total_percent_sum += percent
        if percent < 75.0:
            courses_at_risk += 1

        processed_courses.append({
            "id": str(cid),
            "code": code,
            "name": c.get("name") or c.get("course_name") or code,
            "credits": c.get("credits", 4.0),
            "attended": attended,
            "total_held": total_held,
            "percentage": percent,
            "status": status_val,
            "safe_bunks_remaining": safe_bunks,
            "classes_needed_for_75": needed,
        })

    overall_att = round(total_percent_sum / len(courses), 2) if courses else 100.0
    assess_info = GradeEngine.calculate_current_weighted_score(assessments)

    return AcademicSummaryResponse(
        student_name=profile.get("full_name", "Arjun Mehta"),
        roll_no=profile.get("roll_no", "102203099"),
        branch=profile.get("branch", "COE"),
        semester=profile.get("semester", 5),
        overall_attendance_percent=overall_att,
        courses_at_risk_count=courses_at_risk,
        total_courses=len(processed_courses),
        courses=processed_courses,
        assessments_summary=assess_info,
    )


# ============================================================
# 2. POST /academics/attendance/what-if
# ============================================================

@academics_router.post("/attendance/what-if", response_model=AttendanceWhatIfResponse)
@router.post("/attendance/what-if", response_model=AttendanceWhatIfResponse)
def attendance_what_if_endpoint(
    req: AttendanceWhatIfRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Simulates attendance projection:
    - current_percent = 100*a/t
    - classes_needed_to_reach_target = ceil((T*t - 100*a)/(100 - T))
    - safe_bunks_remaining = floor(100*a/T - t)
    - projected_percent after attending n and skipping m classes
    """
    res = AttendanceEngine.what_if(
        attended=req.attended,
        total_held=req.total_held,
        attend_next_n=req.attend_next_n,
        skip_next_m=req.skip_next_m,
        target_percent=req.target_percent,
    )

    proj_pct = res["projected_percent"]
    curr_pct = res["current_percent"]
    proj_status = res["projected_status"]
    proj_bunks = res["projected_safe_bunks"]
    proj_needed = res["projected_classes_needed"]

    if proj_pct >= req.target_percent:
        message = (
            f"Projected attendance is {proj_pct}% ({proj_status}). "
            f"You will have {proj_bunks} safe bunk(s) remaining."
        )
    else:
        message = (
            f"Projected attendance is {proj_pct}% ({proj_status}). "
            f"You will need to attend {proj_needed} consecutive class(es) to reach {req.target_percent}%."
        )

    return AttendanceWhatIfResponse(
        course_code=req.course_code,
        current_attended=res["current_attended"],
        current_total_held=res["current_total_held"],
        current_percent=curr_pct,
        current_status=res["current_status"],
        current_safe_bunks=res["current_safe_bunks"],
        current_classes_needed=res["current_classes_needed"],
        attend_next_n=req.attend_next_n,
        skip_next_m=req.skip_next_m,
        projected_attended=res["projected_attended"],
        projected_total_held=res["projected_total_held"],
        projected_percent=proj_pct,
        projected_status=proj_status,
        projected_safe_bunks=proj_bunks,
        projected_classes_needed=proj_needed,
        target_percent=req.target_percent,
        message=message,
    )


# ============================================================
# 3. POST /academics/grades/what-if
# ============================================================

@academics_router.post("/grades/what-if", response_model=GradeWhatIfResponse)
@router.post("/grades/what-if", response_model=GradeWhatIfResponse)
def grades_what_if_endpoint(
    req: GradeWhatIfRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Grade What-If calculation:
    - Computes current_weighted_score from completed assessments
    - required_on_remaining(target_total_percent): score percentage required on remaining weight
      and whether it's achievable (>100% means impossible)
    - what_if(hypothetical_scores): projected total score + letter grade based on configurable scale
    """
    assessments_data: List[Dict[str, Any]] = []

    if req.assessments:
        for a in req.assessments:
            assessments_data.append(a.model_dump())
    else:
        data = _fetch_student_data(user_id)
        assessments_data = data["assessments"]
        if req.course_code:
            assessments_data = [
                a for a in assessments_data if a.get("course_code") == req.course_code
            ]
            if not assessments_data:
                # Provide standard fallback assessment breakdown so any course can be simulated
                today = date.today()
                code = req.course_code.upper()
                assessments_data = [
                    {"id": f"ass-{code}-mst", "course_code": code, "name": "Mid Semester Test", "weight_percent": 30.0, "max_marks": 30.0, "obtained_marks": 22.5, "due_date": (today - timedelta(days=30)).isoformat()},
                    {"id": f"ass-{code}-sess", "course_code": code, "name": "Continuous Assessment", "weight_percent": 20.0, "max_marks": 20.0, "obtained_marks": 16.0, "due_date": (today - timedelta(days=10)).isoformat()},
                    {"id": f"ass-{code}-est", "course_code": code, "name": "End Semester Exam", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None, "due_date": (today + timedelta(days=20)).isoformat()},
                ]

    weighted_info = GradeEngine.calculate_current_weighted_score(assessments_data)
    curr_score = weighted_info["current_weighted_score"]
    completed_w = weighted_info["completed_weight"]
    rem_w = weighted_info["remaining_weight"]

    req_percent = None
    is_achievable = None
    msg_parts: List[str] = []

    if req.target_total_percent is not None:
        req_info = GradeEngine.calculate_required_on_remaining(
            curr_score, rem_w, req.target_total_percent
        )
        req_percent = req_info["required_percent_on_remaining"]
        is_achievable = req_info["is_achievable"]
        msg_parts.append(req_info["message"])

    projected_score = curr_score
    projected_grade = GradeEngine.get_letter_grade(curr_score, req.grading_scale)

    if req.hypothetical_scores:
        sim_res = GradeEngine.what_if(
            assessments_data,
            req.hypothetical_scores,
            req.target_total_percent,
            req.grading_scale,
        )
        projected_score = sim_res["projected_total_score"]
        projected_grade = sim_res["projected_letter_grade"]
        msg_parts.append(
            f"Projected total score is {projected_score}% (Grade: {projected_grade})."
        )
    elif req.target_total_percent is None:
        msg_parts.append(
            f"Current weighted score is {curr_score}% across {completed_w}% completed weight."
        )

    return GradeWhatIfResponse(
        course_code=req.course_code,
        current_weighted_score=curr_score,
        completed_weight=completed_w,
        remaining_weight=rem_w,
        target_total_percent=req.target_total_percent,
        required_percent_on_remaining=req_percent,
        is_achievable=is_achievable,
        projected_total_score=projected_score,
        projected_letter_grade=projected_grade,
        message=" ".join(msg_parts),
    )


# ============================================================
# 4. GET /academics/daily-plan
# ============================================================

@academics_router.get("/daily-plan", response_model=DailyPlanResponse)
@router.get("/daily-plan", response_model=DailyPlanResponse)
def get_daily_plan(
    reference_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """
    Builds a prioritized action plan:
    - Upcoming deadlines (next 7 days)
    - Courses at risk on attendance (< 75% or < 65%)
    - Pending academic tasks
    Each with a plain-English reason and urgency ordering.
    """
    data = _fetch_student_data(user_id)
    courses = data["courses"]
    attendance_data = data["attendance"]
    assessments = data["assessments"]
    tasks = data["tasks"]

    ref_d = date.today()
    if reference_date:
        try:
            ref_d = datetime.strptime(reference_date, "%Y-%m-%d").date()
        except Exception:
            pass

    courses_att: List[Dict[str, Any]] = []
    for c in courses:
        code = c.get("code") or c.get("course_code") or ""
        cid = c.get("id") or code
        att_entry = attendance_data.get(cid) or attendance_data.get(code)

        if att_entry and "records" in att_entry:
            stats = AttendanceEngine.process_records(att_entry["records"])
            a = stats["attended"]
            t = stats["total_held"]
        elif att_entry:
            a = int(att_entry.get("attended", 0))
            t = int(att_entry.get("total_held", 0))
        else:
            a, t = 0, 0

        courses_att.append({
            "course_code": code,
            "course_name": c.get("name") or c.get("course_name") or code,
            "attended_classes": a,
            "total_classes": t,
        })

    actions = ActionPlanEngine.generate_daily_plan(
        courses_attendance=courses_att,
        assessments=assessments,
        tasks=tasks,
        target_percent=75.0,
        reference_date=ref_d,
    )

    urgent_count = sum(1 for a in actions if a["priority"] == "urgent")
    high_count = sum(1 for a in actions if a["priority"] == "high")

    formatted_actions: List[DailyActionItem] = [
        DailyActionItem(
            id=a["id"],
            category=a["category"],
            priority=a["priority"],
            title=a["title"],
            course_code=a.get("course_code"),
            current_percent=a.get("current_percent"),
            due_date=a.get("due_date"),
            reason=a["reason"],
            action_required=a.get("action_required"),
        )
        for a in actions
    ]

    return DailyPlanResponse(
        date=ref_d.isoformat(),
        total_actions=len(formatted_actions),
        urgent_count=urgent_count,
        high_count=high_count,
        actions=formatted_actions,
    )


# ============================================================
# ============================================================
# Academic Management Endpoints (Secured & Tenant Isolated)
# ============================================================

@router.get("/courses", response_model=List[Course])
def get_courses(user_id: str = Depends(get_current_user_id)):
    """Returns courses belonging to the authenticated student."""
    return db.get_courses(user_id)

@router.post("/courses", response_model=Course)
def add_course(course_in: CourseCreate, user_id: str = Depends(get_current_user_id)):
    """Registers a new course for the authenticated student with duplicate check."""
    code = course_in.course_code.upper().strip()
    name = course_in.course_name.strip()

    if not code or len(code) < 2 or not code.isalnum():
        raise HTTPException(
            status_code=400,
            detail="Invalid course code. Must be alphanumeric and at least 2 characters.",
        )
    if not name:
        raise HTTPException(status_code=400, detail="Course name cannot be empty.")

    # Duplicate check per tenant
    existing_courses = db.get_courses(user_id)
    if any(c.course_code == code for c in existing_courses):
        raise HTTPException(
            status_code=409,
            detail=f"Course '{code}' is already registered for this student account.",
        )

    course_id = f"c-{uuid.uuid4().hex[:6]}"
    course = Course(
        id=course_id,
        course_code=code,
        course_name=name,
        credits=course_in.credits,
        grade=course_in.grade,
        target_grade=course_in.target_grade,
        semester=course_in.semester,
    )

    client = get_supabase_client()
    if client:
        try:
            db_uid = _to_db_user_id(user_id)
            client.table("courses").insert({
                "id": str(uuid.uuid4()),
                "user_id": db_uid,
                "code": code,
                "name": name,
                "credits": int(course_in.credits),
                "target_attendance": 75.0,
            }).execute()
        except Exception:
            pass

    return db.add_course(user_id, course)

@router.delete("/courses/{course_id}")
def delete_course(course_id: str, user_id: str = Depends(get_current_user_id)):
    """Deletes a course owned by the authenticated student."""
    client = get_supabase_client()
    if client:
        try:
            db_uid = _to_db_user_id(user_id)
            client.table("courses").delete().in_("user_id", [user_id, db_uid]).or_(f"id.eq.{course_id},code.eq.{course_id.upper()}").execute()
        except Exception:
            pass

    success = db.delete_course(user_id, course_id)
    if success:
        return {"success": True, "message": "Course deleted"}
    raise HTTPException(status_code=404, detail="Course not found or not owned by student")

@router.get("/attendance", response_model=List[AttendanceRecord])
def get_attendance(user_id: str = Depends(get_current_user_id)):
    """Returns attendance records for the authenticated student."""
    return db.get_attendance(user_id)

@router.post("/attendance/update", response_model=AttendanceRecord)
def update_attendance(
    course_code: str,
    attended_classes: int,
    total_classes: int,
    user_id: str = Depends(get_current_user_id)
):
    """
    Updates attendance for a course owned by the authenticated student.
    Enforces invariant: 0 <= attended_classes <= total_classes.
    """
    if attended_classes < 0:
        raise HTTPException(status_code=400, detail="Attended classes cannot be negative")
    if total_classes < 0:
        raise HTTPException(status_code=400, detail="Total classes cannot be negative")
    if attended_classes > total_classes:
        raise HTTPException(status_code=400, detail="Attended classes cannot exceed total classes")

    code = course_code.upper().strip()

    client = get_supabase_client()
    if client:
        try:
            db_uid = _to_db_user_id(user_id)
            client.table("courses").update({
                "attended_classes": attended_classes,
                "total_classes": total_classes,
            }).in_("user_id", [user_id, db_uid]).eq("code", code).execute()
        except Exception:
            pass

    return db.update_attendance(user_id, code, attended_classes, total_classes)

@router.post("/what-if/attendance", response_model=WhatIfAttendanceResponse)
def simulate_attendance(req: WhatIfAttendanceRequest):
    """Read-only mathematical simulation of projected attendance."""
    return WhatIfEngine.simulate_attendance(req)

@router.post("/what-if/grades", response_model=WhatIfGradeResponse)
def simulate_grades(req: WhatIfGradeRequest):
    """Read-only mathematical simulation of projected grades."""
    return WhatIfEngine.simulate_grades(req)

@router.get("/timetable", response_model=List[TimetableSlot])
def get_timetable(user_id: str = Depends(get_current_user_id)):
    """Returns the timetable slots for the authenticated student."""
    return db.get_timetable(user_id)

@router.get("/deadlines", response_model=List[DeadlineTask])
def get_deadlines(user_id: str = Depends(get_current_user_id)):
    """Returns deadlines and tasks belonging to the authenticated student."""
    return sorted(db.get_deadlines(user_id), key=lambda x: x.due_date)

@router.post("/deadlines", response_model=DeadlineTask)
def create_deadline(task_in: DeadlineTaskCreate, user_id: str = Depends(get_current_user_id)):
    """Creates a new deadline task for the authenticated student with validation."""
    title = task_in.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Task title cannot be empty")

    if task_in.priority not in ("urgent", "high", "medium", "low"):
        raise HTTPException(status_code=400, detail="Invalid priority. Must be urgent, high, medium, or low")

    # Validate due_date format
    date_str = task_in.due_date.strip()
    try:
        # Check standard ISO or YYYY-MM-DD
        if "T" in date_str:
            datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        else:
            datetime.strptime(date_str[:10], "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid due_date format. Must be YYYY-MM-DD or ISO 8601")

    task = DeadlineTask(
        id=f"task-{uuid.uuid4().hex[:6]}",
        title=title,
        course_code=task_in.course_code.upper().strip() if task_in.course_code else None,
        due_date=date_str,
        status="pending",
        priority=task_in.priority,
        source=task_in.source,
    )

    client = get_supabase_client()
    if client:
        try:
            db_uid = _to_db_user_id(user_id)
            client.table("tasks").insert({
                "id": str(uuid.uuid4()),
                "user_id": db_uid,
                "title": title,
                "due_date": date_str[:10],
                "source": task_in.source if task_in.source in ("manual", "notice", "assessment", "copilot_action") else "manual",
                "status": "pending",
                "priority": task_in.priority,
                "course_code": task.course_code,
            }).execute()
        except Exception:
            pass

    return db.add_deadline(user_id, task)

@router.patch("/deadlines/{task_id}/toggle", response_model=DeadlineTask)
def toggle_deadline_status(task_id: str, user_id: str = Depends(get_current_user_id)):
    """Toggles task status between pending and completed for the authenticated student."""
    task = db.toggle_deadline(user_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not owned by student")

    client = get_supabase_client()
    if client:
        try:
            db_uid = _to_db_user_id(user_id)
            new_status = "done" if task.status == "completed" else "pending"
            client.table("tasks").update({"status": new_status}).in_("user_id", [user_id, db_uid]).eq("id", task_id).execute()
        except Exception:
            pass

    return task

@router.post("/import-csv", response_model=CSVImportResult)
async def import_academic_csv(
    file: UploadFile = File(...),
    import_type: str = Form("attendance"),
    user_id: str = Depends(get_current_user_id),
):
    """
    Parses and imports academic records strictly into the authenticated student's store.
    Validates row-level invariants, checks for duplicates, and reports row errors.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")

        decoded = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(decoded))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="Invalid CSV format: no headers found.")

        imported_count = 0
        errors: List[str] = []
        seen_batch_codes = set()

        for idx, row in enumerate(reader, start=1):
            try:
                if import_type == "attendance":
                    code_raw = row.get("course_code") or row.get("code") or row.get("Subject Code")
                    if not code_raw or not code_raw.strip():
                        errors.append(f"Row {idx}: Missing course code")
                        continue

                    code = code_raw.upper().strip()
                    if code in seen_batch_codes:
                        errors.append(f"Row {idx}: Duplicate course code '{code}' in import batch")
                        continue

                    att_val = row.get("attended") or row.get("attended_classes")
                    tot_val = row.get("total") or row.get("total_classes")

                    if att_val is None or tot_val is None:
                        errors.append(f"Row {idx}: Missing attendance counters for '{code}'")
                        continue

                    try:
                        attended = int(att_val)
                        total = int(tot_val)
                    except ValueError:
                        errors.append(f"Row {idx}: Attendance counters must be integers for '{code}'")
                        continue

                    if attended < 0 or total < 0:
                        errors.append(f"Row {idx}: Attendance numbers cannot be negative for '{code}'")
                        continue

                    if attended > total:
                        errors.append(f"Row {idx}: Attended classes ({attended}) cannot exceed total classes ({total}) for '{code}'")
                        continue

                    db.update_attendance(user_id, code, attended, total)
                    seen_batch_codes.add(code)
                    imported_count += 1

                elif import_type == "courses":
                    code_raw = row.get("course_code") or row.get("code")
                    name_raw = row.get("course_name") or row.get("name")

                    if not code_raw or not code_raw.strip():
                        errors.append(f"Row {idx}: Missing course code")
                        continue
                    if not name_raw or not name_raw.strip():
                        errors.append(f"Row {idx}: Missing course name")
                        continue

                    code = code_raw.upper().strip()
                    if code in seen_batch_codes:
                        errors.append(f"Row {idx}: Duplicate course code '{code}' in import batch")
                        continue

                    credits_raw = row.get("credits", 4.0)
                    try:
                        credits = float(credits_raw)
                        if credits < 1.0 or credits > 8.0:
                            errors.append(f"Row {idx}: Credits ({credits}) must be between 1.0 and 8.0 for '{code}'")
                            continue
                    except ValueError:
                        errors.append(f"Row {idx}: Credits must be a valid number for '{code}'")
                        continue

                    grade = row.get("grade")
                    target = row.get("target_grade", "A")

                    cid = f"c-{uuid.uuid4().hex[:6]}"
                    c_obj = Course(
                        id=cid,
                        course_code=code,
                        course_name=name_raw.strip(),
                        credits=credits,
                        grade=grade.strip() if grade else None,
                        target_grade=target.strip() if target else "A",
                        semester=5,
                    )
                    db.add_course(user_id, c_obj)
                    seen_batch_codes.add(code)
                    imported_count += 1
                else:
                    errors.append(f"Unknown import type: {import_type}")
                    break
            except Exception as e:
                errors.append(f"Row {idx}: Error processing row - {str(e)}")

        return CSVImportResult(
            success=(imported_count > 0 or len(errors) == 0),
            records_imported=imported_count,
            errors=errors,
            message=f"Successfully imported {imported_count} {import_type} record(s)." if imported_count > 0 else "No records imported."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")
