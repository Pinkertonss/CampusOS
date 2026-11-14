from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ============================================================
# 1. Subject & Offering Models
# ============================================================

class Subject(BaseModel):
    id: str
    code: str
    name: str
    credits: float = 4.0
    department: str = "COE"

class SubjectOffering(BaseModel):
    id: str
    subject_id: str
    subject_code: str
    subject_name: str
    term: str
    section: str
    attendance_threshold: float = 75.0
    grade_policy: str = "standard_10_point"
    professor_ids: List[str] = []
    professor_names: List[str] = []
    enrolled_count: int = 0
    created_at: str

class SubjectOfferingCreate(BaseModel):
    subject_code: str
    subject_name: str
    term: str
    section: str
    attendance_threshold: float = 75.0
    grade_policy: str = "standard_10_point"
    professor_ids: List[str] = []

class TeachingAssignmentRequest(BaseModel):
    professor_id: str
    role: str = "primary"

# ============================================================
# 2. Enrollment Models
# ============================================================

class StudentEnrollment(BaseModel):
    id: str
    offering_id: str
    student_id: str
    student_name: str
    student_roll_no: str
    student_email: str
    status: str = "active"  # "active" | "dropped" | "disenrolled"
    enrolled_at: str
    disenrolled_at: Optional[str] = None
    disenroll_reason: Optional[str] = None

class EnrollStudentRequest(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    student_roll_no: Optional[str] = None
    student_email: Optional[str] = None
    effective_date: Optional[str] = None

class BulkEnrollStudentRequest(BaseModel):
    student_ids: List[str]
    effective_date: Optional[str] = None

class BulkEnrollResponse(BaseModel):
    enrolled_count: int
    enrolled_students: List[StudentEnrollment]
    skipped_duplicates: List[str]

class DisenrollStudentRequest(BaseModel):
    reason: str
    effective_date: Optional[str] = None

class StudentDirectoryItem(BaseModel):
    student_id: str
    full_name: str
    roll_no: str
    email: str
    branch: str
    semester: int

# ============================================================
# 3. Attendance Models
# ============================================================

class AttendanceSessionCreate(BaseModel):
    session_date: str
    slot_type: str = "Lecture"  # "Lecture" | "Lab" | "Tutorial" | "Extra"
    topic: Optional[str] = None
    room: Optional[str] = None
    start_time: Optional[str] = None

class AttendanceSession(BaseModel):
    id: str
    offering_id: str
    session_date: str
    slot_type: str
    topic: Optional[str] = None
    room: Optional[str] = None
    start_time: Optional[str] = None
    is_cancelled: bool = False
    cancellation_reason: Optional[str] = None
    created_by: str
    created_at: str
    records_count: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    total_enrolled: int = 0
    attendance_rate_percent: Optional[float] = None

class AttendanceSessionCancelRequest(BaseModel):
    is_cancelled: bool = True
    reason: Optional[str] = None

class BulkSessionMarkRequest(BaseModel):
    status: str = Field(..., pattern="^(present|absent|late|excused|unmarked)$")
    correction_reason: Optional[str] = None

class AttendanceRecordItem(BaseModel):
    student_id: str
    status: str  # "present" | "absent" | "late" | "excused"
    correction_reason: Optional[str] = None

class AttendanceMarkRequest(BaseModel):
    records: List[AttendanceRecordItem]

class SessionAttendanceRecord(BaseModel):
    id: str
    session_id: str
    student_id: str
    student_name: str
    student_roll_no: str
    status: str
    correction_reason: Optional[str] = None
    marked_by: str
    updated_at: str

class StudentSessionAttendanceItem(BaseModel):
    session_id: str
    session_date: str
    slot_type: str
    topic: Optional[str] = None
    room: Optional[str] = None
    start_time: Optional[str] = None
    status: str  # "present" | "absent" | "late" | "excused" | "unmarked"
    is_cancelled: bool = False
    cancellation_reason: Optional[str] = None
    correction_reason: Optional[str] = None
    updated_at: Optional[str] = None

class StudentSessionAttendanceResponse(BaseModel):
    offering_id: str
    student_id: str
    total_held_sessions: int
    attended_sessions: int
    attendance_percentage: float
    sessions: List[StudentSessionAttendanceItem]

# ============================================================
# 4. Assessment & Marks Models
# ============================================================

class AssessmentCreate(BaseModel):
    title: str
    assessment_type: str = "Quiz"  # Quiz, MST, EST, Assignment, Lab Exam, Project
    max_marks: float = Field(..., gt=0)
    weight_percent: float = Field(0.0, ge=0, le=100)
    due_date: Optional[str] = None
    answer_key_content: Optional[str] = None
    is_published: bool = False

class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    max_marks: Optional[float] = Field(None, gt=0)
    weight_percent: Optional[float] = Field(None, ge=0, le=100)
    due_date: Optional[str] = None
    is_published: Optional[bool] = None
    answer_key_content: Optional[str] = None
    answer_key_released: Optional[bool] = None

class Assessment(BaseModel):
    id: str
    offering_id: str
    title: str
    assessment_type: str
    max_marks: float
    weight_percent: float
    due_date: Optional[str] = None
    is_published: bool = False
    answer_key_content: Optional[str] = None
    answer_key_released: bool = False
    created_by: str
    created_at: str

class StudentMarkItem(BaseModel):
    student_id: str
    obtained_marks: Optional[float] = None
    status: str = "graded"  # graded, not_graded, absent, exempt
    feedback: Optional[str] = None
    correction_reason: Optional[str] = None

class MarksBulkUpdateRequest(BaseModel):
    marks: List[StudentMarkItem]

class StudentAssessmentMark(BaseModel):
    id: str
    assessment_id: str
    student_id: str
    student_name: str
    student_roll_no: str
    obtained_marks: Optional[float] = None
    status: str = "not_graded"
    feedback: Optional[str] = None
    correction_reason: Optional[str] = None
    graded_by: Optional[str] = None
    updated_at: str

# ============================================================
# 5. Assignment & Submissions Models
# ============================================================

class AssignmentCreate(BaseModel):
    title: str
    instructions: str
    due_date: str
    allowed_formats: List[str] = ["pdf", "docx", "zip", "txt"]
    max_file_size_mb: int = 10
    allow_late: bool = True
    allow_resubmission: bool = True
    model_answer: Optional[str] = None
    is_published: bool = False

class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[str] = None
    allowed_formats: Optional[List[str]] = None
    max_file_size_mb: Optional[int] = None
    allow_late: Optional[bool] = None
    allow_resubmission: Optional[bool] = None
    is_published: Optional[bool] = None
    model_answer: Optional[str] = None
    model_answer_released: Optional[bool] = None

class OfferingAssignment(BaseModel):
    id: str
    offering_id: str
    title: str
    instructions: str
    due_date: str
    allowed_formats: List[str]
    max_file_size_mb: int
    allow_late: bool
    allow_resubmission: bool
    is_published: bool
    model_answer: Optional[str] = None
    model_answer_released: bool = False
    created_by: str
    created_at: str
    submissions_count: int = 0

class AssignmentSubmissionCreate(BaseModel):
    submission_text: Optional[str] = None
    file_name: Optional[str] = None
    storage_path: Optional[str] = None

class AssignmentSubmission(BaseModel):
    id: str
    assignment_id: str
    student_id: str
    student_name: str
    student_roll_no: str
    submission_text: Optional[str] = None
    file_name: Optional[str] = None
    storage_path: Optional[str] = None
    submitted_at: str
    version: int = 1
    is_late: bool = False
    score: Optional[float] = None
    feedback: Optional[str] = None
    graded_by: Optional[str] = None
    graded_at: Optional[str] = None

class GradeSubmissionRequest(BaseModel):
    score: float
    feedback: Optional[str] = None

# ============================================================
# 6. Offering Announcements
# ============================================================

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    target_group: str = "all"  # all, selected, low_attendance, academic_support
    target_student_ids: List[str] = []

class OfferingAnnouncement(BaseModel):
    id: str
    offering_id: str
    title: str
    content: str
    target_group: str
    target_student_ids: List[str] = []
    created_by: str
    created_at: str

# ============================================================
# 7. Roster & Student Support Models
# ============================================================

class RosterStudent(BaseModel):
    student_id: str
    student_name: str
    student_roll_no: str
    student_email: str
    branch: str = "COE"
    semester: int = 5
    enrollment_status: str
    enrolled_at: str
    disenrolled_at: Optional[str] = None
    attended_sessions: int
    counted_sessions: int
    attendance_percentage: Optional[float] = None
    attendance_status: str  # "safe" | "warning" | "critical" | "no_data"
    assessment_marks: Dict[str, Optional[float]] = {}
    total_obtained_marks: float = 0.0
    total_possible_marks: float = 0.0
    weighted_score: Optional[float] = None
    calculated_grade: Optional[str] = None
    missing_assignments_count: int = 0
    needs_attendance_support: bool = False
    needs_academic_support: bool = False
    support_reasons: List[str] = []

class RosterResponse(BaseModel):
    offering_id: str
    subject_code: str
    subject_name: str
    term: str
    section: str
    total_students: int
    page: int
    page_size: int
    attendance_threshold: float
    students: List[RosterStudent]

# ============================================================
# 8. User Role Management & Audit Models
# ============================================================

class UserRoleUpdate(BaseModel):
    user_id: str
    role: str  # student, professor, admin
    status: str = "active"

class AdminAccountCreate(BaseModel):
    email: str
    full_name: str
    user_id: Optional[str] = None
    admin_secret_key: Optional[str] = None

class AdminAccountResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str = "admin"
    status: str = "active"
    token: str
    message: str

class AcademicAuditLog(BaseModel):
    id: str
    timestamp: str
    actor_id: str
    actor_role: str
    action: str  # ROLE_CHANGE, TEACHING_ASSIGNMENT, ENROLLMENT, DISENROLLMENT, ATTENDANCE_CORRECTION, MARK_CORRECTION, PUBLISH_RESULTS, RELEASE_ANSWER_KEY
    offering_id: Optional[str] = None
    resource_id: Optional[str] = None
    details: Dict[str, Any] = {}
    reason: Optional[str] = None
