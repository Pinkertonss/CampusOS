from typing import Optional, List, Dict
from pydantic import BaseModel, Field

# Thapar 10-point Letter Grade Scale
GRADE_POINTS: Dict[str, float] = {
    "A+": 10.0,
    "A": 10.0,
    "A-": 9.0,
    "B": 8.0,
    "B-": 7.0,
    "C": 6.0,
    "C-": 5.0,
    "D": 4.0,
    "E": 2.0,
    "F": 0.0,
}

class CourseBase(BaseModel):
    course_code: str = Field(...)
    course_name: str = Field(...)
    credits: float = Field(..., ge=1.0, le=8.0)
    grade: Optional[str] = Field(None)
    target_grade: Optional[str] = Field("A")
    semester: int = Field(5, ge=1, le=10)

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: str
    user_id: Optional[str] = None
    created_at: Optional[str] = None

class AttendanceBase(BaseModel):
    course_code: str
    course_name: str
    attended_classes: int = Field(..., ge=0)
    total_classes: int = Field(..., ge=0)

class AttendanceRecord(AttendanceBase):
    id: str
    percentage: float
    status: str # "safe" (>=75%), "warning" (65%-74.9%), "critical" (<65%)
    safe_bunks: int
    classes_needed_for_75: int

class WhatIfAttendanceRequest(BaseModel):
    course_code: str
    attended_classes: int = Field(..., ge=0)
    total_classes: int = Field(..., ge=1)
    upcoming_classes_to_attend: int = Field(0, ge=0)
    total_upcoming_classes: int = Field(0, ge=0)

class WhatIfAttendanceResponse(BaseModel):
    course_code: str
    current_percentage: float
    simulated_percentage: float
    safe_bunks_allowed: int
    classes_needed_for_75: int
    status_assessment: str
    advice: str

class CourseGradeScenario(BaseModel):
    course_code: str
    credits: float
    target_grade: str

class WhatIfGradeRequest(BaseModel):
    current_cgpa: float = Field(..., ge=0.0, le=10.0)
    completed_credits: float = Field(..., ge=0.0)
    target_cgpa: float = Field(..., ge=0.0, le=10.0)
    current_semester_courses: List[CourseGradeScenario]

class WhatIfGradeResponse(BaseModel):
    target_cgpa: float
    predicted_sgpa: float
    predicted_cgpa: float
    required_sgpa_for_target: float
    is_feasible: bool
    summary: str

class TimetableSlot(BaseModel):
    id: str
    course_code: str
    course_name: str
    day_of_week: str
    start_time: str
    end_time: str
    venue: str
    slot_type: str

class DeadlineTask(BaseModel):
    id: str
    title: str
    course_code: Optional[str] = None
    due_date: str
    status: str = "pending" # pending, completed
    priority: str = "medium" # low, medium, high
    source: str = "manual" # manual, copilot_action, syllabus

class DeadlineTaskCreate(BaseModel):
    title: str
    course_code: Optional[str] = None
    due_date: str
    priority: str = "medium"
    source: str = "manual"

class CSVImportResult(BaseModel):
    success: bool
    records_imported: int
    errors: List[str] = []
    message: str
