import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, Header
from fastapi.responses import PlainTextResponse

from ..core.auth import (
    get_current_user_claims,
    require_admin_user,
    require_professor_or_admin,
    verify_supabase_jwt_claims,
)
from ..database import db
from ..models.academic_rbac import (
    Subject,
    SubjectOffering,
    SubjectOfferingCreate,
    TeachingAssignmentRequest,
    StudentEnrollment,
    EnrollStudentRequest,
    DisenrollStudentRequest,
    StudentDirectoryItem,
    AttendanceSession,
    AttendanceSessionCreate,
    AttendanceMarkRequest,
    SessionAttendanceRecord,
    Assessment,
    AssessmentCreate,
    AssessmentUpdate,
    MarksBulkUpdateRequest,
    StudentAssessmentMark,
    OfferingAssignment,
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentSubmissionCreate,
    AssignmentSubmission,
    GradeSubmissionRequest,
    AnnouncementCreate,
    OfferingAnnouncement,
    RosterResponse,
    UserRoleUpdate,
    AcademicAuditLog,
    AdminAccountCreate,
    AdminAccountResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/academic", tags=["Academic RBAC & Offerings"])


# ============================================================
# Authorization Helpers
# ============================================================

def _verify_offering_access(
    offering_id: str,
    claims: Dict[str, Any],
    require_manage: bool = False,
) -> None:
    """
    Enforces offering-scoped permissions:
    - Admin: full access to all offerings.
    - Professor: allowed only for offerings assigned to them.
    - Student: allowed only to view offerings where they are enrolled.
    """
    is_admin = bool(claims.get("is_admin"))
    if is_admin:
        return

    actor_id = str(claims["sub"])
    role = str(claims.get("role", "student"))

    if require_manage:
        # Only assigned professors (or admins) can manage
        if role != "professor" and not claims.get("is_professor"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions: Faculty or Administrator role required.",
            )
        if not db.academic_rbac.is_professor_assigned(offering_id, actor_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You are not assigned to manage offering '{offering_id}'.",
            )
        return

    # View permissions
    if role == "professor" or claims.get("is_professor"):
        if not db.academic_rbac.is_professor_assigned(offering_id, actor_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You are not assigned to view offering '{offering_id}'.",
            )
        return

    # Student check: must be enrolled
    if not db.academic_rbac.is_student_enrolled(offering_id, actor_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not enrolled in offering '{offering_id}'.",
        )


# ============================================================
# 1. Subjects & Offerings Endpoints
# ============================================================

@router.get("/subjects", response_model=List[Subject])
def list_catalog_subjects(claims: Dict[str, Any] = Depends(get_current_user_claims)):
    """List catalog subjects (accessible to all authenticated users)."""
    return db.academic_rbac.list_subjects()


@router.get("/offerings", response_model=List[SubjectOffering])
def list_offerings(claims: Dict[str, Any] = Depends(get_current_user_claims)):
    """
    List subject offerings scoped to actor:
    - Admin: all offerings
    - Professor: assigned offerings
    - Student: enrolled offerings
    """
    actor_id = str(claims["sub"])
    role = str(claims.get("role", "student"))
    is_admin = bool(claims.get("is_admin"))
    return db.academic_rbac.list_offerings(user_id=actor_id, role=role, is_admin=is_admin)


@router.post("/offerings", response_model=SubjectOffering, status_code=status.HTTP_201_CREATED)
def create_offering(
    payload: SubjectOfferingCreate,
    admin_claims: Dict[str, Any] = Depends(require_admin_user),
):
    """Administrator creates a new subject offering."""
    actor_id = str(admin_claims["sub"])
    return db.academic_rbac.create_offering(actor_id=actor_id, data=payload)


@router.get("/offerings/{offering_id}", response_model=SubjectOffering)
def get_offering_details(
    offering_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """Get details of a specific subject offering."""
    _verify_offering_access(offering_id, claims, require_manage=False)
    return db.academic_rbac.get_offering(offering_id)


@router.post("/offerings/{offering_id}/professors", response_model=SubjectOffering)
def assign_professor_to_offering(
    offering_id: str,
    payload: TeachingAssignmentRequest,
    admin_claims: Dict[str, Any] = Depends(require_admin_user),
):
    """Administrator assigns a professor to a subject offering."""
    actor_id = str(admin_claims["sub"])
    return db.academic_rbac.assign_professor_to_offering(
        actor_id=actor_id,
        actor_role="admin",
        offering_id=offering_id,
        professor_id=payload.professor_id,
        role_title=payload.role,
    )


# ============================================================
# 2. Student Directory & Enrollment Management
# ============================================================

@router.get("/students/directory", response_model=List[StudentDirectoryItem])
def search_student_directory(
    query: str = Query("", description="Search by name, roll no, or email"),
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """
    Searchable student directory for professors and administrators.
    Provides minimum necessary info for enrollment.
    """
    return db.academic_rbac.search_student_directory(query=query)


@router.get("/offerings/{offering_id}/enrollments", response_model=List[StudentEnrollment])
def get_offering_enrollments(
    offering_id: str,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """List active and historical enrollments for an assigned offering."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    return db.academic_rbac.get_enrollments(offering_id)


@router.post("/offerings/{offering_id}/enroll", response_model=StudentEnrollment, status_code=status.HTTP_201_CREATED)
def enroll_student_in_offering(
    offering_id: str,
    payload: EnrollStudentRequest,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Enroll a student individually into an assigned offering."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.enroll_student(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        student_id=payload.student_id,
        student_name=payload.student_name,
        student_roll_no=payload.student_roll_no,
        student_email=payload.student_email,
    )


@router.post("/offerings/{offering_id}/disenroll", response_model=StudentEnrollment)
def disenroll_student_from_offering(
    offering_id: str,
    student_id: str = Query(..., description="Student ID to disenroll"),
    payload: DisenrollStudentRequest = ...,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Disenroll a student with reason and effective date while preserving academic history."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.disenroll_student(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        student_id=student_id,
        reason=payload.reason,
        effective_date=payload.effective_date,
    )


# ============================================================
# 3. Attendance Management Endpoints
# ============================================================

@router.get("/offerings/{offering_id}/attendance/sessions", response_model=List[AttendanceSession])
def list_attendance_sessions(
    offering_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """List attendance sessions for an offering."""
    _verify_offering_access(offering_id, claims, require_manage=False)
    return db.academic_rbac.list_attendance_sessions(offering_id)


@router.post("/offerings/{offering_id}/attendance/sessions", response_model=AttendanceSession, status_code=status.HTTP_201_CREATED)
def create_attendance_session(
    offering_id: str,
    payload: AttendanceSessionCreate,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Professor creates a new attendance session for their assigned offering."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.create_attendance_session(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        session_date=payload.session_date,
        slot_type=payload.slot_type,
    )


@router.get("/offerings/{offering_id}/attendance/sessions/{session_id}/records", response_model=List[SessionAttendanceRecord])
def get_session_attendance_records(
    offering_id: str,
    session_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """Get attendance records for a specific session."""
    _verify_offering_access(offering_id, claims, require_manage=False)
    sess = db.academic_rbac.get_session(offering_id, session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found in offering '{offering_id}'.",
        )
    records = db.academic_rbac.get_session_records(session_id, offering_id=offering_id)
    is_admin = bool(claims.get("is_admin"))
    is_prof = bool(claims.get("is_professor") or claims.get("role") == "professor")
    if is_admin or is_prof:
        return records

    # Student only sees their own attendance record
    student_id = str(claims["sub"])
    return [r for r in records if r.student_id == student_id]


@router.post("/offerings/{offering_id}/attendance/sessions/{session_id}/mark", response_model=List[SessionAttendanceRecord])
def mark_session_attendance(
    offering_id: str,
    session_id: str,
    payload: AttendanceMarkRequest,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Record or correct attendance for students in an assigned offering session."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    sess = db.academic_rbac.get_session(offering_id, session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found in offering '{offering_id}'.",
        )
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.mark_attendance(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        session_id=session_id,
        records=payload.records,
    )


# ============================================================
# 4. Assessments & Marks Endpoints
# ============================================================

@router.get("/offerings/{offering_id}/assessments", response_model=List[Assessment])
def list_assessments(
    offering_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    List assessments for offering:
    - Professors/Admin: draft & published assessments with answers
    - Students: published only; answer keys hidden unless explicitly released
    """
    _verify_offering_access(offering_id, claims, require_manage=False)
    is_student = not (claims.get("is_admin") or claims.get("is_professor") or claims.get("role") == "professor")
    return db.academic_rbac.list_assessments(offering_id=offering_id, is_student=is_student)


@router.post("/offerings/{offering_id}/assessments", response_model=Assessment, status_code=status.HTTP_201_CREATED)
def create_assessment(
    offering_id: str,
    payload: AssessmentCreate,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Professor creates an assessment (draft or published)."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.create_assessment(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        data=payload,
    )


@router.patch("/offerings/{offering_id}/assessments/{assessment_id}", response_model=Assessment)
def update_assessment(
    offering_id: str,
    assessment_id: str,
    payload: AssessmentUpdate,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Update assessment metadata, publish state, or release answer key."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.update_assessment(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        assessment_id=assessment_id,
        data=payload,
    )


@router.get("/offerings/{offering_id}/assessments/{assessment_id}/marks", response_model=List[StudentAssessmentMark])
def get_assessment_marks(
    offering_id: str,
    assessment_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Get marks for an assessment:
    - Faculty/Admin: all student marks
    - Students: their own mark only (and only if assessment is published)
    """
    _verify_offering_access(offering_id, claims, require_manage=False)
    is_student = not (claims.get("is_admin") or claims.get("is_professor") or claims.get("role") == "professor")
    student_id = str(claims["sub"]) if is_student else None
    return db.academic_rbac.get_assessment_marks(
        offering_id=offering_id,
        assessment_id=assessment_id,
        is_student=is_student,
        student_id=student_id,
    )


@router.post("/offerings/{offering_id}/assessments/{assessment_id}/marks", response_model=List[StudentAssessmentMark])
def update_assessment_marks(
    offering_id: str,
    assessment_id: str,
    payload: MarksBulkUpdateRequest,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Bulk update or correct student marks with validation and audit trail."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.update_marks(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        assessment_id=assessment_id,
        items=payload.marks,
    )


# ============================================================
# 5. Assignments & Submissions Endpoints
# ============================================================

@router.get("/offerings/{offering_id}/assignments", response_model=List[OfferingAssignment])
def list_assignments(
    offering_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    List assignments:
    - Faculty/Admin: all assignments
    - Students: published only; model answers hidden unless released
    """
    _verify_offering_access(offering_id, claims, require_manage=False)
    is_student = not (claims.get("is_admin") or claims.get("is_professor") or claims.get("role") == "professor")
    return db.academic_rbac.list_assignments(offering_id=offering_id, is_student=is_student)


@router.post("/offerings/{offering_id}/assignments", response_model=OfferingAssignment, status_code=status.HTTP_201_CREATED)
def create_assignment(
    offering_id: str,
    payload: AssignmentCreate,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Professor creates a new assignment with submission rules and optional model answer."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.create_assignment(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        data=payload,
    )


@router.patch("/offerings/{offering_id}/assignments/{assignment_id}", response_model=OfferingAssignment)
def update_assignment(
    offering_id: str,
    assignment_id: str,
    payload: AssignmentUpdate,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Update assignment metadata, publish state, or release model answer."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.update_assignment(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        assignment_id=assignment_id,
        data=payload,
    )


@router.post("/offerings/{offering_id}/assignments/{assignment_id}/submit", response_model=AssignmentSubmission)
def submit_assignment(
    offering_id: str,
    assignment_id: str,
    payload: AssignmentSubmissionCreate,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """Enrolled student submits work for an assignment."""
    _verify_offering_access(offering_id, claims, require_manage=False)
    student_id = str(claims["sub"])
    if not db.academic_rbac.is_student_enrolled(offering_id, student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Only actively enrolled students can submit assignments for offering '{offering_id}'.",
        )
    return db.academic_rbac.submit_assignment(
        student_id=student_id,
        offering_id=offering_id,
        assignment_id=assignment_id,
        submission_text=payload.submission_text,
        file_name=payload.file_name,
        storage_path=payload.storage_path,
    )


@router.get("/offerings/{offering_id}/assignments/{assignment_id}/submissions", response_model=List[AssignmentSubmission])
def get_assignment_submissions(
    offering_id: str,
    assignment_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Get assignment submissions:
    - Faculty/Admin: all student submissions
    - Students: their own submission only
    """
    _verify_offering_access(offering_id, claims, require_manage=False)
    is_student = not (claims.get("is_admin") or claims.get("is_professor") or claims.get("role") == "professor")
    student_id = str(claims["sub"]) if is_student else None
    return db.academic_rbac.get_assignment_submissions(
        offering_id=offering_id,
        assignment_id=assignment_id,
        is_student=is_student,
        student_id=student_id,
    )


@router.post("/offerings/{offering_id}/assignments/{assignment_id}/submissions/{submission_id}/grade", response_model=AssignmentSubmission)
def grade_submission(
    offering_id: str,
    assignment_id: str,
    submission_id: str,
    payload: GradeSubmissionRequest,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Faculty grades student assignment submission with score and feedback."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.grade_submission(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        assignment_id=assignment_id,
        submission_id=submission_id,
        score=payload.score,
        feedback=payload.feedback,
    )


# ============================================================
# 6. Offering Announcements Endpoints
# ============================================================

@router.get("/offerings/{offering_id}/announcements", response_model=List[OfferingAnnouncement])
def list_offering_announcements(
    offering_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """List announcements for an offering (filtered by student target group)."""
    _verify_offering_access(offering_id, claims, require_manage=False)
    is_student = not (claims.get("is_admin") or claims.get("is_professor") or claims.get("role") == "professor")
    student_id = str(claims["sub"]) if is_student else None
    return db.academic_rbac.list_announcements(
        offering_id=offering_id,
        is_student=is_student,
        student_id=student_id,
    )


@router.post("/offerings/{offering_id}/announcements", response_model=OfferingAnnouncement, status_code=status.HTTP_201_CREATED)
def create_offering_announcement(
    offering_id: str,
    payload: AnnouncementCreate,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """Faculty posts an announcement to the offering or targeted student groups."""
    _verify_offering_access(offering_id, claims, require_manage=True)
    actor_id = str(claims["sub"])
    actor_role = "admin" if claims.get("is_admin") else "professor"
    return db.academic_rbac.create_announcement(
        actor_id=actor_id,
        actor_role=actor_role,
        offering_id=offering_id,
        title=payload.title,
        content=payload.content,
        target_group=payload.target_group,
        target_student_ids=payload.target_student_ids,
    )


# ============================================================
# 7. Roster & Support Identification Endpoints
# ============================================================

@router.get("/offerings/{offering_id}/roster", response_model=RosterResponse)
def get_offering_roster(
    offering_id: str,
    search: Optional[str] = Query(None, description="Search name, roll number, or email"),
    status_filter: Optional[str] = Query(None, description="active, disenrolled, all"),
    support_filter: Optional[str] = Query(None, description="attendance_support, academic_support, all"),
    sort_by: str = Query("roll_no", description="name, roll_no, attendance, score"),
    sort_order: str = Query("asc", description="asc, desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """
    Enrolled-student roster with calculated attendance %, marks, grades, and support identification.
    Strictly faculty or administrator access.
    """
    _verify_offering_access(offering_id, claims, require_manage=True)
    return db.academic_rbac.get_roster(
        offering_id=offering_id,
        search=search,
        status_filter=status_filter,
        support_filter=support_filter,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@router.get("/offerings/{offering_id}/roster/export-csv")
def export_roster_csv(
    offering_id: str,
    claims: Dict[str, Any] = Depends(require_professor_or_admin),
):
    """
    Export offering roster to CSV with formula injection prevention.
    Protected for faculty and administrators.
    """
    _verify_offering_access(offering_id, claims, require_manage=True)
    csv_content = db.academic_rbac.export_roster_csv(offering_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="roster_{offering_id}.csv"',
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


# ============================================================
# 8. User Roles & Academic Audit Endpoints
# ============================================================

@router.post("/admin/create-account", response_model=AdminAccountResponse, status_code=status.HTTP_201_CREATED)
def create_administrator_account(
    payload: AdminAccountCreate,
    authorization: Optional[str] = Header(None),
):
    """
    Creates/provisions a new administrator account.
    Authorized if:
    1. Caller is an active Administrator (Bearer token with is_admin=True), OR
    2. Caller provides valid institutional admin secret key ('TIET-ADMIN-2026').
    """
    is_authorized = False
    actor_id = "system-onboarding"

    # Check 1: Existing Admin session
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        try:
            claims = verify_supabase_jwt_claims(token)
            if claims.get("is_admin"):
                is_authorized = True
                actor_id = str(claims["sub"])
        except Exception:
            pass

    # Check 2: Institutional verification code
    if not is_authorized:
        institutional_code = "TIET-ADMIN-2026"
        if payload.admin_secret_key and payload.admin_secret_key.strip() == institutional_code:
            is_authorized = True
            actor_id = "institutional-invite"

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Valid administrator credentials or institutional admin key ('TIET-ADMIN-2026') required.",
        )

    res = db.academic_rbac.create_admin_account(
        email=payload.email,
        full_name=payload.full_name,
        user_id=payload.user_id,
        actor_id=actor_id,
    )
    return AdminAccountResponse(**res)


@router.get("/users/roles", response_model=List[Dict[str, Any]])
def list_user_roles(admin_claims: Dict[str, Any] = Depends(require_admin_user)):
    """Administrator lists all users and their assigned roles."""
    return db.academic_rbac.list_user_roles()


@router.post("/users/roles", response_model=Dict[str, Any])
def update_user_role(
    payload: UserRoleUpdate,
    admin_claims: Dict[str, Any] = Depends(require_admin_user),
):
    """
    Administrator updates user role.
    Prevents demoting or deactivating the last active administrator.
    """
    actor_id = str(admin_claims["sub"])
    return db.academic_rbac.update_user_role(
        actor_id=actor_id,
        actor_role="admin",
        target_user_id=payload.user_id,
        new_role=payload.role,
        status_val=payload.status,
    )


@router.get("/audit-logs", response_model=List[AcademicAuditLog])
def get_academic_audit_logs(
    offering_id: Optional[str] = Query(None, description="Filter audit logs by offering"),
    limit: int = Query(100, ge=1, le=1000),
    admin_claims: Dict[str, Any] = Depends(require_admin_user),
):
    """Administrator inspects the immutable academic audit log."""
    return db.academic_rbac.get_audit_logs(offering_id=offering_id, limit=limit)
