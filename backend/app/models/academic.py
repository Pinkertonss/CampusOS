from typing import Optional, List, Dict, Any
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


# ============================================================
# Academic Planning Engine Models
# ============================================================

class AttendanceWhatIfRequest(BaseModel):
    course_code: Optional[str] = None
    attended: int = Field(..., ge=0)
    total_held: int = Field(..., ge=0)
    attend_next_n: int = Field(0, ge=0)
    skip_next_m: int = Field(0, ge=0)
    target_percent: float = Field(75.0, ge=1.0, le=100.0)

class AttendanceWhatIfResponse(BaseModel):
    course_code: Optional[str] = None
    current_attended: int
    current_total_held: int
    current_percent: float
    current_status: str
    current_safe_bunks: int
    current_classes_needed: Optional[int] = None
    attend_next_n: int
    skip_next_m: int
    projected_attended: int
    projected_total_held: int
    projected_percent: float
    projected_status: str
    projected_safe_bunks: int
    projected_classes_needed: Optional[int] = None
    target_percent: float
    message: str

class AssessmentItem(BaseModel):
    id: Optional[str] = None
    name: str
    weight_percent: float = Field(..., ge=0.0, le=100.0)
    max_marks: float = Field(100.0, gt=0.0)
    obtained_marks: Optional[float] = None
    due_date: Optional[str] = None

class GradeWhatIfRequest(BaseModel):
    course_id: Optional[str] = None
    course_code: Optional[str] = None
    assessments: Optional[List[AssessmentItem]] = None
    target_total_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    hypothetical_scores: Optional[Dict[str, float]] = None
    grading_scale: Optional[Dict[str, float]] = None

class GradeWhatIfResponse(BaseModel):
    course_code: Optional[str] = None
    current_weighted_score: float
    completed_weight: float
    remaining_weight: float
    target_total_percent: Optional[float] = None
    required_percent_on_remaining: Optional[float] = None
    is_achievable: Optional[bool] = None
    projected_total_score: Optional[float] = None
    projected_letter_grade: Optional[str] = None
    message: str

class DailyActionItem(BaseModel):
    id: str
    category: str  # 'attendance' | 'deadline' | 'task'
    priority: str  # 'urgent' | 'high' | 'medium' | 'low'
    title: str
    course_code: Optional[str] = None
    current_percent: Optional[float] = None
    due_date: Optional[str] = None
    reason: str
    action_required: Optional[str] = None

class DailyPlanResponse(BaseModel):
    date: str
    total_actions: int
    urgent_count: int
    high_count: int
    actions: List[DailyActionItem]

class AcademicSummaryResponse(BaseModel):
    student_name: str
    roll_no: str
    branch: str
    semester: int
    overall_attendance_percent: float
    courses_at_risk_count: int
    total_courses: int
    courses: List[Dict[str, Any]]
    assessments_summary: Dict[str, Any]
