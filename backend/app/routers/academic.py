import csv
import io
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
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
)
from ..services.what_if_engine import WhatIfEngine

router = APIRouter(prefix="/api/academic", tags=["Academic Dashboard"])

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
    
    # Also initialize attendance if not present
    if course.course_code not in db.attendance:
        pct, status, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(0, 0)
        db.attendance[course.course_code] = AttendanceRecord(
            id=f"att-{course.course_code}",
            course_code=course.course_code,
            course_name=course.course_name,
            attended_classes=0,
            total_classes=0,
            percentage=pct,
            status=status,
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
    
    # Find course name
    course_name = "Course"
    for c in db.courses.values():
        if c.course_code == code:
            course_name = c.course_name
            break
            
    pct, status, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(attended_classes, total_classes)
    record = AttendanceRecord(
        id=f"att-{code}",
        course_code=code,
        course_name=course_name,
        attended_classes=attended_classes,
        total_classes=total_classes,
        percentage=pct,
        status=status,
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
    import_type: str = Form("attendance") # "attendance" or "courses"
):
    try:
        content = await file.read()
        decoded = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        
        imported_count = 0
        errors = []
        
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
                    pct, status, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(attended, total)
                    db.attendance[code] = AttendanceRecord(
                        id=f"att-{code}",
                        course_code=code,
                        course_name=name.strip(),
                        attended_classes=attended,
                        total_classes=total,
                        percentage=pct,
                        status=status,
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
