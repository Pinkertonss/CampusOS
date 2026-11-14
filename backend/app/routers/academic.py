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

def _fetch_student_data(user_id: str) -> Dict[str, Any]:
    """
    Fetches courses, attendance, assessments, and tasks for user_id.
    Queries Supabase if available; gracefully falls back to seeded in-memory store.
    """
    client = get_supabase_client()
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
            p_res = client.table("profiles").select("*").eq("user_id", user_id).execute()
            if p_res.data:
                profile.update(p_res.data[0])

            c_res = client.table("courses").select("*").eq("user_id", user_id).execute()
            if c_res.data:
                courses_list = c_res.data

            a_res = client.table("attendance_records").select("*").eq("user_id", user_id).execute()
            if a_res.data:
                for rec in a_res.data:
                    cid = rec.get("course_id") or rec.get("course_code")
                    if cid not in attendance_map:
                        attendance_map[cid] = {"records": []}
                    attendance_map[cid]["records"].append(rec)

            ass_res = client.table("assessments").select("*").eq("user_id", user_id).execute()
            if ass_res.data:
                assessments_list = ass_res.data

            t_res = client.table("tasks").select("*").eq("user_id", user_id).execute()
            if t_res.data:
                tasks_list = t_res.data
        except Exception:
            pass

    # Fallback to in-memory db if Supabase returned empty
    if not courses_list:
        for c in db.courses.values():
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
        for code, att in db.attendance.items():
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
        assessments_list = [
            {"id": "ass-1", "course_code": "UCS301", "name": "MST-1", "weight_percent": 20.0, "max_marks": 30.0, "obtained_marks": 24.0, "due_date": "2024-09-20"},
            {"id": "ass-2", "course_code": "UCS301", "name": "MST-2", "weight_percent": 20.0, "max_marks": 30.0, "obtained_marks": 21.0, "due_date": "2024-10-25"},
            {"id": "ass-3", "course_code": "UCS301", "name": "Assignment 1", "weight_percent": 5.0, "max_marks": 20.0, "obtained_marks": 18.0, "due_date": "2024-09-15"},
            {"id": "ass-4", "course_code": "UCS301", "name": "Assignment 2", "weight_percent": 5.0, "max_marks": 20.0, "obtained_marks": 16.0, "due_date": "2024-10-20"},
            {"id": "ass-5", "course_code": "UCS301", "name": "End Semester", "weight_percent": 50.0, "max_marks": 100.0, "obtained_marks": None, "due_date": "2024-12-05"},
            {"id": "ass-6", "course_code": "UCS405", "name": "MST-1", "weight_percent": 20.0, "max_marks": 30.0, "obtained_marks": 18.0, "due_date": "2024-09-20"},
            {"id": "ass-7", "course_code": "UCS405", "name": "Lab Eval 2", "weight_percent": 10.0, "max_marks": 25.0, "obtained_marks": None, "due_date": (date.today() + timedelta(days=3)).isoformat()},
        ]

    if not tasks_list:
        for t in db.deadlines:
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
# Legacy Endpoints (Kept for full backward compatibility)
# ============================================================

@router.get("/courses", response_model=List[Course])
def get_courses():
    return list(db.courses.values())

@router.post("/courses", response_model=Course)
def add_course(course_in: CourseCreate):
    course_id = f"c-{uuid.uuid4().hex[:6]}"
    course = Course(
        id=course_id,
        course_code=course_in.course_code.upper().strip(),
        course_name=course_in.course_name.strip(),
        credits=course_in.credits,
        grade=course_in.grade,
        target_grade=course_in.target_grade,
        semester=course_in.semester,
    )
    db.courses[course_id] = course

    if course.course_code not in db.attendance:
        pct, status_val, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(0, 0)
        db.attendance[course.course_code] = AttendanceRecord(
            id=f"att-{course.course_code}",
            course_code=course.course_code,
            course_name=course.course_name,
            attended_classes=0,
            total_classes=0,
            percentage=pct,
            status=status_val,
            safe_bunks=safe_bunks,
            classes_needed_for_75=needed,
        )
    return course

@router.delete("/courses/{course_id}")
def delete_course(course_id: str):
    if course_id in db.courses:
        del db.courses[course_id]
        return {"success": True, "message": "Course deleted"}
    raise HTTPException(status_code=404, detail="Course not found")

@router.get("/attendance", response_model=List[AttendanceRecord])
def get_attendance():
    return list(db.attendance.values())

@router.post("/attendance/update", response_model=AttendanceRecord)
def update_attendance(course_code: str, attended_classes: int, total_classes: int):
    code = course_code.upper().strip()
    if attended_classes > total_classes:
        raise HTTPException(status_code=400, detail="Attended classes cannot exceed total classes")

    course_name = "Course"
    for c in db.courses.values():
        if c.course_code == code:
            course_name = c.course_name
            break

    pct, status_val, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(attended_classes, total_classes)
    record = AttendanceRecord(
        id=f"att-{code}",
        course_code=code,
        course_name=course_name,
        attended_classes=attended_classes,
        total_classes=total_classes,
        percentage=pct,
        status=status_val,
        safe_bunks=safe_bunks,
        classes_needed_for_75=needed,
    )
    db.attendance[code] = record
    return record

@router.post("/what-if/attendance", response_model=WhatIfAttendanceResponse)
def simulate_attendance(req: WhatIfAttendanceRequest):
    return WhatIfEngine.simulate_attendance(req)

@router.post("/what-if/grades", response_model=WhatIfGradeResponse)
def simulate_grades(req: WhatIfGradeRequest):
    return WhatIfEngine.simulate_grades(req)

@router.get("/timetable", response_model=List[TimetableSlot])
def get_timetable():
    return db.timetable

@router.get("/deadlines", response_model=List[DeadlineTask])
def get_deadlines():
    return sorted(db.deadlines, key=lambda x: x.due_date)

@router.post("/deadlines", response_model=DeadlineTask)
def create_deadline(task_in: DeadlineTaskCreate):
    task = DeadlineTask(
        id=f"task-{uuid.uuid4().hex[:6]}",
        title=task_in.title,
        course_code=task_in.course_code,
        due_date=task_in.due_date,
        status="pending",
        priority=task_in.priority,
        source=task_in.source,
    )
    db.deadlines.append(task)
    return task

@router.patch("/deadlines/{task_id}/toggle", response_model=DeadlineTask)
def toggle_deadline_status(task_id: str):
    for t in db.deadlines:
        if t.id == task_id:
            t.status = "completed" if t.status == "pending" else "pending"
            return t
    raise HTTPException(status_code=404, detail="Task not found")

@router.post("/import-csv", response_model=CSVImportResult)
async def import_academic_csv(
    file: UploadFile = File(...),
    import_type: str = Form("attendance")
):
    try:
        content = await file.read()
        decoded = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(decoded))

        imported_count = 0
        errors: List[str] = []

        for idx, row in enumerate(reader, start=1):
            try:
                if import_type == "attendance":
                    code = row.get("course_code") or row.get("code") or row.get("Subject Code")
                    name = row.get("course_name") or row.get("name") or row.get("Subject Name", "Course")
                    attended = int(row.get("attended") or row.get("attended_classes", 0))
                    total = int(row.get("total") or row.get("total_classes", 0))

                    if not code:
                        errors.append(f"Row {idx}: Missing course code")
                        continue

                    code = code.upper().strip()
                    pct, status_val, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(attended, total)
                    db.attendance[code] = AttendanceRecord(
                        id=f"att-{code}",
                        course_code=code,
                        course_name=name.strip(),
                        attended_classes=attended,
                        total_classes=total,
                        percentage=pct,
                        status=status_val,
                        safe_bunks=safe_bunks,
                        classes_needed_for_75=needed,
                    )
                    imported_count += 1

                elif import_type == "courses":
                    code = row.get("course_code") or row.get("code")
                    name = row.get("course_name") or row.get("name")
                    credits = float(row.get("credits", 4.0))
                    grade = row.get("grade") or None
                    target = row.get("target_grade", "A")

                    if not code or not name:
                        errors.append(f"Row {idx}: Missing course code or name")
                        continue

                    cid = f"c-{uuid.uuid4().hex[:6]}"
                    db.courses[cid] = Course(
                        id=cid,
                        course_code=code.upper().strip(),
                        course_name=name.strip(),
                        credits=credits,
                        grade=grade.strip() if grade else None,
                        target_grade=target.strip(),
                        semester=5,
                    )
                    imported_count += 1
            except Exception as e:
                errors.append(f"Row {idx}: Error processing row - {str(e)}")

        return CSVImportResult(
            success=True,
            records_imported=imported_count,
            errors=errors,
            message=f"Successfully imported {imported_count} {import_type} record(s)."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")
