import uuid
import json
import io
import csv
from pathlib import Path
from datetime import datetime, date, timezone, timedelta
import zoneinfo
from typing import List, Dict, Optional, Any, Tuple, Union
from fastapi import HTTPException, status
from ..models.academic_rbac import (
    Subject,
    SubjectOffering,
    SubjectOfferingCreate,
    StudentEnrollment,
    StudentDirectoryItem,
    AttendanceSession,
    SessionAttendanceRecord,
    AttendanceRecordItem,
    Assessment,
    AssessmentCreate,
    AssessmentUpdate,
    StudentAssessmentMark,
    StudentMarkItem,
    OfferingAssignment,
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentSubmission,
    OfferingAnnouncement,
    RosterStudent,
    RosterResponse,
    AcademicAuditLog,
)

IST_TIMEZONE = zoneinfo.ZoneInfo("Asia/Kolkata")


def parse_and_normalize_utc(dt_val: Union[str, datetime], date_only_end_of_day: bool = True) -> datetime:
    """
    Normalizes ISO datetime string or date-only string or datetime object to offset-aware UTC.
    - If date-only string ('YYYY-MM-DD'), sets time to 23:59:59.999999 in IST if date_only_end_of_day=True, then converts to UTC.
    - If datetime string without offset (naive), treats as IST and converts to UTC.
    - If datetime string with offset (e.g. +05:30 or Z), parses and converts to UTC.
    - Raises HTTPException 400 Bad Request if string is malformed or invalid.
    """
    if isinstance(dt_val, datetime):
        if dt_val.tzinfo is None:
            dt_val = dt_val.replace(tzinfo=IST_TIMEZONE)
        return dt_val.astimezone(timezone.utc)

    if not isinstance(dt_val, str) or not dt_val.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid due date value: '{dt_val}'.",
        )

    s = dt_val.strip()
    # Check date-only pattern YYYY-MM-DD
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        try:
            d = date.fromisoformat(s)
            if date_only_end_of_day:
                dt = datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=IST_TIMEZONE)
            else:
                dt = datetime(d.year, d.month, d.day, 0, 0, 0, 0, tzinfo=IST_TIMEZONE)
            return dt.astimezone(timezone.utc)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Malformed date-only format '{s}': {e}",
            )

    cleaned = s
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST_TIMEZONE)
        return dt.astimezone(timezone.utc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid due date format '{s}': {e}",
        )


class AcademicRBACEngine:
    """
    Enterprise-grade Academic RBAC Engine providing:
    - Subject Catalog & Offering Scoping
    - Professor Teaching Assignments & Section Isolation
    - Student Directory & Enrollment Lifecycle
    - Attendance Sessions with Historical Tracking
    - Assessment & Marks Lifecycle with Draft & Answer Key Gating
    - Assignment Lifecycle with Submission Versioning & Model Answers
    - Deterministic Academic & Attendance Support Rules
    - Formula-Safe CSV Roster Export
    - Immutable Academic Audit Trail
    - Durable File Persistence
    """

    def __init__(self, persistence_file: Optional[Path] = None):
        self.persistence_file = (
            persistence_file
            or Path(__file__).resolve().parent.parent.parent / "storage" / "academic_offerings_persistence.json"
        )
        self.subjects: Dict[str, Subject] = {}
        self.subject_offerings: Dict[str, SubjectOffering] = {}
        self.offering_professors: Dict[str, List[str]] = {}
        self.offering_prof_roles: Dict[str, Dict[str, str]] = {}  # offering_id -> {prof_id: role}
        self.student_directory: Dict[str, StudentDirectoryItem] = {}
        self.user_roles: Dict[str, Dict[str, str]] = {}
        self.offering_enrollments: Dict[str, Dict[str, StudentEnrollment]] = {}
        self.attendance_sessions: Dict[str, List[AttendanceSession]] = {}
        self.session_attendance_records: Dict[str, Dict[str, SessionAttendanceRecord]] = {}
        self.offering_assessments: Dict[str, List[Assessment]] = {}
        self.student_assessment_marks: Dict[str, Dict[str, StudentAssessmentMark]] = {}
        self.offering_assignments: Dict[str, List[OfferingAssignment]] = {}
        self.assignment_submissions: Dict[str, Dict[str, AssignmentSubmission]] = {}
        self.offering_announcements: Dict[str, List[OfferingAnnouncement]] = {}
        self.academic_audit_logs: List[AcademicAuditLog] = []

        self._seed_default_data()
        self._load_persisted_data()

    # ============================================================
    # Persistence Helpers
    # ============================================================

    def _save_persisted_data(self):
        try:
            self.persistence_file.parent.mkdir(parents=True, exist_ok=True)
            data = {
                "subjects": {k: v.model_dump() for k, v in self.subjects.items()},
                "subject_offerings": {k: v.model_dump() for k, v in self.subject_offerings.items()},
                "offering_professors": self.offering_professors,
                "offering_prof_roles": self.offering_prof_roles,
                "student_directory": {k: v.model_dump() for k, v in self.student_directory.items()},
                "user_roles": self.user_roles,
                "offering_enrollments": {
                    off_id: {sid: enr.model_dump() for sid, enr in enrs.items()}
                    for off_id, enrs in self.offering_enrollments.items()
                },
                "attendance_sessions": {
                    off_id: [s.model_dump() for s in sess]
                    for off_id, sess in self.attendance_sessions.items()
                },
                "session_attendance_records": {
                    sess_id: {sid: rec.model_dump() for sid, rec in recs.items()}
                    for sess_id, recs in self.session_attendance_records.items()
                },
                "offering_assessments": {
                    off_id: [a.model_dump() for a in asms]
                    for off_id, asms in self.offering_assessments.items()
                },
                "student_assessment_marks": {
                    asm_id: {sid: m.model_dump() for sid, m in marks.items()}
                    for asm_id, marks in self.student_assessment_marks.items()
                },
                "offering_assignments": {
                    off_id: [asg.model_dump() for asg in asgs]
                    for off_id, asgs in self.offering_assignments.items()
                },
                "assignment_submissions": {
                    asg_id: {sid: sub.model_dump() for sid, sub in subs.items()}
                    for asg_id, subs in self.assignment_submissions.items()
                },
                "offering_announcements": {
                    off_id: [ann.model_dump() for ann in anns]
                    for off_id, anns in self.offering_announcements.items()
                },
                "academic_audit_logs": [log.model_dump() for log in self.academic_audit_logs],
            }
            with open(self.persistence_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass

    def _load_persisted_data(self):
        if not self.persistence_file.exists():
            return
        try:
            with open(self.persistence_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            if "subjects" in data:
                self.subjects = {k: Subject(**v) for k, v in data["subjects"].items()}
            if "subject_offerings" in data:
                self.subject_offerings = {k: SubjectOffering(**v) for k, v in data["subject_offerings"].items()}
            if "offering_professors" in data:
                self.offering_professors = data["offering_professors"]
            if "offering_prof_roles" in data:
                self.offering_prof_roles = data["offering_prof_roles"]
            if "student_directory" in data:
                self.student_directory = {k: StudentDirectoryItem(**v) for k, v in data["student_directory"].items()}
            if "user_roles" in data:
                self.user_roles = data["user_roles"]
            if "offering_enrollments" in data:
                self.offering_enrollments = {
                    off_id: {sid: StudentEnrollment(**enr) for sid, enr in enrs.items()}
                    for off_id, enrs in data["offering_enrollments"].items()
                }
            if "attendance_sessions" in data:
                self.attendance_sessions = {
                    off_id: [AttendanceSession(**s) for s in sess]
                    for off_id, sess in data["attendance_sessions"].items()
                }
            if "session_attendance_records" in data:
                self.session_attendance_records = {
                    sess_id: {sid: SessionAttendanceRecord(**rec) for sid, rec in recs.items()}
                    for sess_id, recs in data["session_attendance_records"].items()
                }
            if "offering_assessments" in data:
                self.offering_assessments = {
                    off_id: [Assessment(**a) for a in asms]
                    for off_id, asms in data["offering_assessments"].items()
                }
            if "student_assessment_marks" in data:
                self.student_assessment_marks = {
                    asm_id: {sid: StudentAssessmentMark(**m) for sid, m in marks.items()}
                    for asm_id, marks in data["student_assessment_marks"].items()
                }
            if "offering_assignments" in data:
                self.offering_assignments = {
                    off_id: [OfferingAssignment(**asg) for asg in asgs]
                    for off_id, asgs in data["offering_assignments"].items()
                }
            if "assignment_submissions" in data:
                self.assignment_submissions = {
                    asg_id: {sid: AssignmentSubmission(**sub) for sid, sub in subs.items()}
                    for asg_id, subs in data["assignment_submissions"].items()
                }
            if "offering_announcements" in data:
                self.offering_announcements = {
                    off_id: [OfferingAnnouncement(**ann) for ann in anns]
                    for off_id, anns in data["offering_announcements"].items()
                }
            if "academic_audit_logs" in data:
                self.academic_audit_logs = [AcademicAuditLog(**log) for log in data["academic_audit_logs"]]
        except Exception:
            pass

    # ============================================================
    # Seed Data Initialization
    # ============================================================

    def _seed_default_data(self):
        # 1. User Roles
        self.user_roles = {
            "admin-00000000-0000-0000-0000-000000000001": {"role": "admin", "status": "active"},
            "prof-rajesh-kumar-id": {"role": "professor", "status": "active"},
            "prof-sunita-sharma-id": {"role": "professor", "status": "active"},
            "opp-manager-tiet-id": {"role": "opportunity_manager", "status": "active"},
            "102203099-tiet-user": {"role": "student", "status": "active"},
            "00000000-0000-0000-0000-000102203088": {"role": "student", "status": "active"},
            "102203077-student-id": {"role": "student", "status": "active"},
            "102203066-student-id": {"role": "student", "status": "active"},
            "102203055-student-id": {"role": "student", "status": "active"},
        }

        # 2. Student Directory
        self.student_directory = {
            "102203099-tiet-user": StudentDirectoryItem(
                student_id="102203099-tiet-user",
                full_name="Arjun Mehta",
                roll_no="102203099",
                email="amehta_be22@thapar.edu",
                branch="COE",
                semester=5,
            ),
            "00000000-0000-0000-0000-000102203088": StudentDirectoryItem(
                student_id="00000000-0000-0000-0000-000102203088",
                full_name="Rohan Verma",
                roll_no="102203088",
                email="peer_student@thapar.edu",
                branch="COE",
                semester=5,
            ),
            "102203077-student-id": StudentDirectoryItem(
                student_id="102203077-student-id",
                full_name="Priya Sharma",
                roll_no="102203077",
                email="psharma_be22@thapar.edu",
                branch="COE",
                semester=5,
            ),
            "102203066-student-id": StudentDirectoryItem(
                student_id="102203066-student-id",
                full_name="Aman Gill",
                roll_no="102203066",
                email="agill_be22@thapar.edu",
                branch="COE",
                semester=5,
            ),
            "102203055-student-id": StudentDirectoryItem(
                student_id="102203055-student-id",
                full_name="Simran Kaur",
                roll_no="102203055",
                email="skaur_be22@thapar.edu",
                branch="ENC",
                semester=5,
            ),
        }

        # 3. Subjects
        self.subjects = {
            "sub-ucs301": Subject(id="sub-ucs301", code="UCS301", name="Data Structures & Algorithms", credits=4.5, department="CSED"),
            "sub-ucs310": Subject(id="sub-ucs310", code="UCS310", name="Database Management Systems", credits=4.0, department="CSED"),
            "sub-ucs405": Subject(id="sub-ucs405", code="UCS405", name="Operating Systems", credits=4.0, department="CSED"),
            "sub-uma010": Subject(id="sub-uma010", code="UMA010", name="Mathematics-II", credits=3.5, department="SMAT"),
        }

        # 4. Offerings
        self.subject_offerings = {
            "off-ucs301-secA": SubjectOffering(
                id="off-ucs301-secA",
                subject_id="sub-ucs301",
                subject_code="UCS301",
                subject_name="Data Structures & Algorithms",
                term="Even Semester 2026",
                section="Section A",
                attendance_threshold=75.0,
                grade_policy="standard_10_point",
                professor_ids=["prof-rajesh-kumar-id"],
                professor_names=["Dr. Rajesh Kumar"],
                enrolled_count=3,
                created_at="2026-01-02T10:00:00",
            ),
            "off-ucs301-secB": SubjectOffering(
                id="off-ucs301-secB",
                subject_id="sub-ucs301",
                subject_code="UCS301",
                subject_name="Data Structures & Algorithms",
                term="Even Semester 2026",
                section="Section B",
                attendance_threshold=75.0,
                grade_policy="standard_10_point",
                professor_ids=["prof-sunita-sharma-id"],
                professor_names=["Dr. Sunita Sharma"],
                enrolled_count=2,
                created_at="2026-01-02T10:00:00",
            ),
            "off-ucs310-secA": SubjectOffering(
                id="off-ucs310-secA",
                subject_id="sub-ucs310",
                subject_code="UCS310",
                subject_name="Database Management Systems",
                term="Even Semester 2026",
                section="Section A",
                attendance_threshold=75.0,
                grade_policy="standard_10_point",
                professor_ids=["prof-rajesh-kumar-id"],
                professor_names=["Dr. Rajesh Kumar"],
                enrolled_count=1,
                created_at="2026-01-02T10:00:00",
            ),
        }

        # 5. Teaching Assignments
        self.offering_professors = {
            "off-ucs301-secA": ["prof-rajesh-kumar-id"],
            "off-ucs301-secB": ["prof-sunita-sharma-id"],
            "off-ucs310-secA": ["prof-rajesh-kumar-id"],
        }
        self.offering_prof_roles = {
            "off-ucs301-secA": {"prof-rajesh-kumar-id": "primary"},
            "off-ucs301-secB": {"prof-sunita-sharma-id": "primary"},
            "off-ucs310-secA": {"prof-rajesh-kumar-id": "primary"},
        }

        # 6. Enrollments
        self.offering_enrollments = {
            "off-ucs301-secA": {
                "102203099-tiet-user": StudentEnrollment(
                    id="enr-ucs301-1",
                    offering_id="off-ucs301-secA",
                    student_id="102203099-tiet-user",
                    student_name="Arjun Mehta",
                    student_roll_no="102203099",
                    student_email="amehta_be22@thapar.edu",
                    status="active",
                    enrolled_at="2026-01-05T09:00:00",
                ),
                "00000000-0000-0000-0000-000102203088": StudentEnrollment(
                    id="enr-ucs301-2",
                    offering_id="off-ucs301-secA",
                    student_id="00000000-0000-0000-0000-000102203088",
                    student_name="Rohan Verma",
                    student_roll_no="102203088",
                    student_email="peer_student@thapar.edu",
                    status="active",
                    enrolled_at="2026-01-05T09:00:00",
                ),
                "102203066-student-id": StudentEnrollment(
                    id="enr-ucs301-3",
                    offering_id="off-ucs301-secA",
                    student_id="102203066-student-id",
                    student_name="Aman Gill",
                    student_roll_no="102203066",
                    student_email="agill_be22@thapar.edu",
                    status="active",
                    enrolled_at="2026-01-05T09:00:00",
                ),
            },
            "off-ucs301-secB": {
                "102203077-student-id": StudentEnrollment(
                    id="enr-ucs301-4",
                    offering_id="off-ucs301-secB",
                    student_id="102203077-student-id",
                    student_name="Priya Sharma",
                    student_roll_no="102203077",
                    student_email="psharma_be22@thapar.edu",
                    status="active",
                    enrolled_at="2026-01-05T09:00:00",
                ),
                "102203055-student-id": StudentEnrollment(
                    id="enr-ucs301-5",
                    offering_id="off-ucs301-secB",
                    student_id="102203055-student-id",
                    student_name="Simran Kaur",
                    student_roll_no="102203055",
                    student_email="skaur_be22@thapar.edu",
                    status="active",
                    enrolled_at="2026-01-05T09:00:00",
                ),
            },
            "off-ucs310-secA": {
                "102203099-tiet-user": StudentEnrollment(
                    id="enr-ucs310-1",
                    offering_id="off-ucs310-secA",
                    student_id="102203099-tiet-user",
                    student_name="Arjun Mehta",
                    student_roll_no="102203099",
                    student_email="amehta_be22@thapar.edu",
                    status="active",
                    enrolled_at="2026-01-05T09:00:00",
                ),
            },
        }

        # 7. Attendance Sessions & Records
        s1 = AttendanceSession(
            id="sess-ucs301-1",
            offering_id="off-ucs301-secA",
            session_date="2026-01-08",
            slot_type="Lecture",
            is_cancelled=False,
            created_by="prof-rajesh-kumar-id",
            created_at="2026-01-08T09:00:00",
            records_count=3,
        )
        s2 = AttendanceSession(
            id="sess-ucs301-2",
            offering_id="off-ucs301-secA",
            session_date="2026-01-15",
            slot_type="Lecture",
            is_cancelled=False,
            created_by="prof-rajesh-kumar-id",
            created_at="2026-01-15T09:00:00",
            records_count=3,
        )
        s3 = AttendanceSession(
            id="sess-ucs301-3",
            offering_id="off-ucs301-secA",
            session_date="2026-01-22",
            slot_type="Lab",
            is_cancelled=False,
            created_by="prof-rajesh-kumar-id",
            created_at="2026-01-22T09:00:00",
            records_count=3,
        )
        s4 = AttendanceSession(
            id="sess-ucs301-4",
            offering_id="off-ucs301-secA",
            session_date="2026-01-29",
            slot_type="Lecture",
            is_cancelled=False,
            created_by="prof-rajesh-kumar-id",
            created_at="2026-01-29T09:00:00",
            records_count=3,
        )
        self.attendance_sessions["off-ucs301-secA"] = [s1, s2, s3, s4]

        # Records:
        # Arjun: 4/4 = 100%
        # Rohan: 1/4 = 25% (critical attendance support!)
        # Aman: 3/4 = 75%
        self.session_attendance_records["sess-ucs301-1"] = {
            "102203099-tiet-user": SessionAttendanceRecord(id="att-rec-1", session_id="sess-ucs301-1", student_id="102203099-tiet-user", student_name="Arjun Mehta", student_roll_no="102203099", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-08T09:50:00"),
            "00000000-0000-0000-0000-000102203088": SessionAttendanceRecord(id="att-rec-2", session_id="sess-ucs301-1", student_id="00000000-0000-0000-0000-000102203088", student_name="Rohan Verma", student_roll_no="102203088", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-08T09:50:00"),
            "102203066-student-id": SessionAttendanceRecord(id="att-rec-3", session_id="sess-ucs301-1", student_id="102203066-student-id", student_name="Aman Gill", student_roll_no="102203066", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-08T09:50:00"),
        }
        self.session_attendance_records["sess-ucs301-2"] = {
            "102203099-tiet-user": SessionAttendanceRecord(id="att-rec-4", session_id="sess-ucs301-2", student_id="102203099-tiet-user", student_name="Arjun Mehta", student_roll_no="102203099", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-15T09:50:00"),
            "00000000-0000-0000-0000-000102203088": SessionAttendanceRecord(id="att-rec-5", session_id="sess-ucs301-2", student_id="00000000-0000-0000-0000-000102203088", student_name="Rohan Verma", student_roll_no="102203088", status="absent", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-15T09:50:00"),
            "102203066-student-id": SessionAttendanceRecord(id="att-rec-6", session_id="sess-ucs301-2", student_id="102203066-student-id", student_name="Aman Gill", student_roll_no="102203066", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-15T09:50:00"),
        }
        self.session_attendance_records["sess-ucs301-3"] = {
            "102203099-tiet-user": SessionAttendanceRecord(id="att-rec-7", session_id="sess-ucs301-3", student_id="102203099-tiet-user", student_name="Arjun Mehta", student_roll_no="102203099", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-22T09:50:00"),
            "00000000-0000-0000-0000-000102203088": SessionAttendanceRecord(id="att-rec-8", session_id="sess-ucs301-3", student_id="00000000-0000-0000-0000-000102203088", student_name="Rohan Verma", student_roll_no="102203088", status="absent", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-22T09:50:00"),
            "102203066-student-id": SessionAttendanceRecord(id="att-rec-9", session_id="sess-ucs301-3", student_id="102203066-student-id", student_name="Aman Gill", student_roll_no="102203066", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-22T09:50:00"),
        }
        self.session_attendance_records["sess-ucs301-4"] = {
            "102203099-tiet-user": SessionAttendanceRecord(id="att-rec-10", session_id="sess-ucs301-4", student_id="102203099-tiet-user", student_name="Arjun Mehta", student_roll_no="102203099", status="present", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-29T09:50:00"),
            "00000000-0000-0000-0000-000102203088": SessionAttendanceRecord(id="att-rec-11", session_id="sess-ucs301-4", student_id="00000000-0000-0000-0000-000102203088", student_name="Rohan Verma", student_roll_no="102203088", status="absent", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-29T09:50:00"),
            "102203066-student-id": SessionAttendanceRecord(id="att-rec-12", session_id="sess-ucs301-4", student_id="102203066-student-id", student_name="Aman Gill", student_roll_no="102203066", status="absent", marked_by="prof-rajesh-kumar-id", updated_at="2026-01-29T09:50:00"),
        }

        # 8. Assessments & Marks
        asm1 = Assessment(
            id="asm-ucs301-quiz1",
            offering_id="off-ucs301-secA",
            title="Quiz 1: Asymptotic Analysis & Binary Search Trees",
            assessment_type="Quiz",
            max_marks=20.0,
            weight_percent=10.0,
            due_date="2026-01-25T18:00:00",
            is_published=True,
            answer_key_content="Q1: AVL tree balance factor is between -1 and +1.\nQ2: Time complexity of Red-Black tree search is O(log n).",
            answer_key_released=False,
            created_by="prof-rajesh-kumar-id",
            created_at="2026-01-10T12:00:00",
        )
        asm2 = Assessment(
            id="asm-ucs301-mst",
            offering_id="off-ucs301-secA",
            title="Mid-Semester Test (MST)",
            assessment_type="MST",
            max_marks=60.0,
            weight_percent=30.0,
            due_date="2026-03-10T14:00:00",
            is_published=False,  # Draft
            answer_key_content="Confidential Faculty MST Solutions Key",
            answer_key_released=False,
            created_by="prof-rajesh-kumar-id",
            created_at="2026-01-12T12:00:00",
        )
        self.offering_assessments["off-ucs301-secA"] = [asm1, asm2]

        self.student_assessment_marks["asm-ucs301-quiz1"] = {
            "102203099-tiet-user": StudentAssessmentMark(
                id="mark-1",
                assessment_id="asm-ucs301-quiz1",
                student_id="102203099-tiet-user",
                student_name="Arjun Mehta",
                student_roll_no="102203099",
                obtained_marks=18.5,
                status="graded",
                feedback="Excellent derivation of AVL rotations.",
                graded_by="prof-rajesh-kumar-id",
                updated_at="2026-01-26T15:00:00",
            ),
            "00000000-0000-0000-0000-000102203088": StudentAssessmentMark(
                id="mark-2",
                assessment_id="asm-ucs301-quiz1",
                student_id="00000000-0000-0000-0000-000102203088",
                student_name="Rohan Verma",
                student_roll_no="102203088",
                obtained_marks=6.0,
                status="graded",
                feedback="Needs substantial review of tree balancing conditions.",
                graded_by="prof-rajesh-kumar-id",
                updated_at="2026-01-26T15:00:00",
            ),
            "102203066-student-id": StudentAssessmentMark(
                id="mark-3",
                assessment_id="asm-ucs301-quiz1",
                student_id="102203066-student-id",
                student_name="Aman Gill",
                student_roll_no="102203066",
                obtained_marks=14.0,
                status="graded",
                feedback="Good understanding, minor calculation error in Question 3.",
                graded_by="prof-rajesh-kumar-id",
                updated_at="2026-01-26T15:00:00",
            ),
        }

        # 9. Assignments & Submissions
        asg1 = OfferingAssignment(
            id="asg-ucs301-1",
            offering_id="off-ucs301-secA",
            title="Lab Assignment 1: Red-Black Tree Implementation",
            instructions="Implement Red-Black tree insertion and deletion algorithms in C++ or Python with unit tests verifying balance invariants.",
            due_date="2026-02-15T23:59:00",
            allowed_formats=["pdf", "zip", "cpp", "py"],
            max_file_size_mb=10,
            allow_late=True,
            allow_resubmission=True,
            is_published=True,
            model_answer="Verified implementation available at faculty Git repo: https://github.com/tiet-csed/ucs301-rb-tree-reference",
            model_answer_released=False,
            created_by="prof-rajesh-kumar-id",
            created_at="2026-01-14T10:00:00",
            submissions_count=1,
        )
        self.offering_assignments["off-ucs301-secA"] = [asg1]

        self.assignment_submissions["asg-ucs301-1"] = {
            "102203099-tiet-user": AssignmentSubmission(
                id="sub-1",
                assignment_id="asg-ucs301-1",
                student_id="102203099-tiet-user",
                student_name="Arjun Mehta",
                student_roll_no="102203099",
                submission_text="Implemented balanced tree with automated stress tests.",
                file_name="arjun_mehta_rb_tree.zip",
                storage_path="/submissions/asg-ucs301-1/102203099-tiet-user_v1.zip",
                submitted_at="2026-02-14T16:30:00",
                version=1,
                is_late=False,
                score=19.0,
                feedback="Outstanding test coverage and edge case handling.",
                graded_by="prof-rajesh-kumar-id",
                graded_at="2026-02-16T11:00:00",
            )
        }

        # 10. Announcements
        self.offering_announcements["off-ucs301-secA"] = [
            OfferingAnnouncement(
                id="ann-1",
                offering_id="off-ucs301-secA",
                title="Welcome to UCS301 Even Semester 2026",
                content="Lectures will be held in Hall LP-108 on Mondays and Wednesdays. Review lecture slides on DSA portal.",
                target_group="all",
                target_student_ids=[],
                created_by="prof-rajesh-kumar-id",
                created_at="2026-01-06T10:00:00",
            )
        ]

        # 11. Initial Audit Log
        self.academic_audit_logs.append(
            AcademicAuditLog(
                id="audit-init-1",
                timestamp="2026-01-02T10:00:00",
                actor_id="admin-00000000-0000-0000-0000-000000000001",
                actor_role="admin",
                action="SYSTEM_INIT",
                offering_id="off-ucs301-secA",
                resource_id="off-ucs301-secA",
                details={"message": "Initialized academic offerings and baseline roles"},
                reason="System provisioning",
            )
        )

    # ============================================================
    # User Roles & Audit Trail
    # ============================================================

    def get_user_role(self, user_id: str) -> str:
        record = self.user_roles.get(user_id)
        if record and record.get("status") == "active":
            return record.get("role", "student")
        return "student"

    def list_user_roles(self) -> List[Dict[str, Any]]:
        result = []
        for uid, r in self.user_roles.items():
            result.append({
                "user_id": uid,
                "role": r.get("role", "student"),
                "status": r.get("status", "active"),
            })
        return result

    def update_user_role(
        self, actor_id: str, actor_role: str, target_user_id: str, new_role: str, status_val: str = "active"
    ) -> Dict[str, Any]:
        """
        Updates a user's role.
        CRITICAL INVARIANT: Cannot demote or deactivate the last active administrator!
        """
        existing = self.user_roles.get(target_user_id, {"role": "student", "status": "active"})
        current_role = existing.get("role")
        current_status = existing.get("status")

        if current_role == "admin" and current_status == "active":
            if new_role != "admin" or status_val != "active":
                # Count other active admins
                other_active_admins = [
                    uid for uid, r in self.user_roles.items()
                    if uid != target_user_id and r.get("role") == "admin" and r.get("status") == "active"
                ]
                if not other_active_admins:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot demote or deactivate the last active administrator.",
                    )

        self.user_roles[target_user_id] = {
            "role": new_role,
            "status": status_val,
        }

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="ROLE_CHANGE",
            offering_id=None,
            resource_id=target_user_id,
            details={"previous_role": current_role, "new_role": new_role, "status": status_val},
            reason=f"Administrator updated role of {target_user_id}",
        )
        self._save_persisted_data()
        return {"user_id": target_user_id, "role": new_role, "status": status_val}

    def create_admin_account(
        self,
        email: str,
        full_name: str,
        user_id: Optional[str] = None,
        actor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Provisions a new administrator account in user_roles and emits an audit event.
        """
        uid = user_id or f"admin-{uuid.uuid4().hex[:12]}"
        self.user_roles[uid] = {
            "role": "admin",
            "status": "active",
            "email": email,
            "full_name": full_name,
        }

        self.log_audit(
            actor_id=actor_id or uid,
            actor_role="admin",
            action="CREATE_ADMIN_ACCOUNT",
            offering_id=None,
            resource_id=uid,
            details={"email": email, "full_name": full_name},
            reason=f"Administrator account provisioned for {full_name} ({email})",
        )
        self._save_persisted_data()
        return {
            "user_id": uid,
            "email": email,
            "full_name": full_name,
            "role": "admin",
            "status": "active",
            "token": "dev-admin" if uid == "admin-00000000-0000-0000-0000-000000000001" else f"admin-token-{uid}",
            "message": f"Administrator account successfully provisioned for {full_name}",
        }

    def log_audit(
        self,
        actor_id: str,
        actor_role: str,
        action: str,
        offering_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None,
    ) -> AcademicAuditLog:
        """
        Appends an immutable audit entry to academic_audit_logs.
        """
        entry = AcademicAuditLog(
            id=f"audit-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now().isoformat(),
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            offering_id=offering_id,
            resource_id=resource_id,
            details=details or {},
            reason=reason,
        )
        self.academic_audit_logs.append(entry)
        self._save_persisted_data()
        return entry

    def get_audit_logs(self, offering_id: Optional[str] = None, limit: int = 100) -> List[AcademicAuditLog]:
        logs = list(reversed(self.academic_audit_logs))
        if offering_id:
            logs = [l for l in logs if l.offering_id == offering_id]
        return logs[:limit]

    # ============================================================
    # Subjects & Subject Offerings
    # ============================================================

    def list_subjects(self) -> List[Subject]:
        return list(self.subjects.values())

    def list_offerings(self, user_id: str, role: str, is_admin: bool) -> List[SubjectOffering]:
        all_offs = list(self.subject_offerings.values())
        if is_admin:
            return all_offs
        if role == "professor":
            # Return only offerings where professor is assigned
            return [o for o in all_offs if user_id in self.offering_professors.get(o.id, [])]
        # Student role: return only offerings where student is enrolled
        enrolled_off_ids = {
            off_id for off_id, enrs in self.offering_enrollments.items()
            if user_id in enrs and enrs[user_id].status == "active"
        }
        return [o for o in all_offs if o.id in enrolled_off_ids]

    def get_offering(self, offering_id: str) -> SubjectOffering:
        off = self.subject_offerings.get(offering_id)
        if not off:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Offering '{offering_id}' not found")
        return off

    def create_offering(self, actor_id: str, data: SubjectOfferingCreate) -> SubjectOffering:
        new_id = f"off-{data.subject_code.lower()}-{uuid.uuid4().hex[:6]}"
        prof_names = []
        for pid in data.professor_ids:
            if pid == "prof-rajesh-kumar-id":
                prof_names.append("Dr. Rajesh Kumar")
            elif pid == "prof-sunita-sharma-id":
                prof_names.append("Dr. Sunita Sharma")
            else:
                prof_names.append(f"Professor {pid[:8]}")

        off = SubjectOffering(
            id=new_id,
            subject_id=f"sub-{data.subject_code.lower()}",
            subject_code=data.subject_code.upper(),
            subject_name=data.subject_name,
            term=data.term,
            section=data.section,
            attendance_threshold=data.attendance_threshold,
            grade_policy=data.grade_policy,
            professor_ids=data.professor_ids,
            professor_names=prof_names,
            enrolled_count=0,
            created_at=datetime.now().isoformat(),
        )
        self.subject_offerings[new_id] = off
        self.offering_professors[new_id] = list(data.professor_ids)
        self.offering_prof_roles[new_id] = {pid: "primary" for pid in data.professor_ids}
        self.offering_enrollments[new_id] = {}
        self.attendance_sessions[new_id] = []
        self.offering_assessments[new_id] = []
        self.offering_assignments[new_id] = []
        self.offering_announcements[new_id] = []

        self.log_audit(
            actor_id=actor_id,
            actor_role="admin",
            action="CREATE_OFFERING",
            offering_id=new_id,
            resource_id=new_id,
            details=data.model_dump(),
            reason=f"Created offering {data.subject_code} ({data.section})",
        )
        self._save_persisted_data()
        return off

    def assign_professor_to_offering(
        self, actor_id: str, actor_role: str, offering_id: str, professor_id: str, role_title: str = "primary"
    ) -> SubjectOffering:
        off = self.get_offering(offering_id)
        if offering_id not in self.offering_professors:
            self.offering_professors[offering_id] = []
        if offering_id not in self.offering_prof_roles:
            self.offering_prof_roles[offering_id] = {}

        if professor_id not in self.offering_professors[offering_id]:
            self.offering_professors[offering_id].append(professor_id)

        self.offering_prof_roles[offering_id][professor_id] = role_title
        off.professor_ids = list(self.offering_professors[offering_id])

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="TEACHING_ASSIGNMENT",
            offering_id=offering_id,
            resource_id=professor_id,
            details={"professor_id": professor_id, "role": role_title},
            reason=f"Assigned professor {professor_id} to offering {offering_id}",
        )
        self._save_persisted_data()
        return off

    def is_professor_assigned(self, offering_id: str, professor_id: str) -> bool:
        return professor_id in self.offering_professors.get(offering_id, [])

    def is_student_enrolled(self, offering_id: str, student_id: str, require_active: bool = False) -> bool:
        enr = self.offering_enrollments.get(offering_id, {}).get(student_id)
        if not enr:
            return False
        if require_active and enr.status != "active":
            return False
        return True

    # ============================================================
    # Student Directory & Enrollment Management
    # ============================================================

    def search_student_directory(self, query: str = "") -> List[StudentDirectoryItem]:
        q = query.strip().lower()
        if not q:
            return list(self.student_directory.values())
        results = []
        for s in self.student_directory.values():
            if (
                q in s.full_name.lower()
                or q in s.roll_no.lower()
                or q in s.email.lower()
                or q in s.student_id.lower()
            ):
                results.append(s)
        return results

    def get_enrollments(self, offering_id: str) -> List[StudentEnrollment]:
        self.get_offering(offering_id)
        return list(self.offering_enrollments.get(offering_id, {}).values())

    def enroll_student(
        self,
        actor_id: str,
        actor_role: str,
        offering_id: str,
        student_id: str,
        student_name: Optional[str] = None,
        student_roll_no: Optional[str] = None,
        student_email: Optional[str] = None,
        effective_date: Optional[str] = None,
    ) -> StudentEnrollment:
        off = self.get_offering(offering_id)
        if offering_id not in self.offering_enrollments:
            self.offering_enrollments[offering_id] = {}

        existing = self.offering_enrollments[offering_id].get(student_id)
        if existing and existing.status == "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student '{student_id}' is already actively enrolled in offering '{offering_id}'.",
            )

        # Lookup directory or fallback
        dir_item = self.student_directory.get(student_id)
        name = student_name or (dir_item.full_name if dir_item else f"Student {student_id[:8]}")
        roll = student_roll_no or (dir_item.roll_no if dir_item else student_id[-9:])
        email = student_email or (dir_item.email if dir_item else f"{student_id}@thapar.edu")

        # If re-enrolling a previously disenrolled student, create or update record
        enr_id = existing.id if existing else f"enr-{uuid.uuid4().hex[:8]}"
        enrolled_dt = effective_date or datetime.now().isoformat()
        enr = StudentEnrollment(
            id=enr_id,
            offering_id=offering_id,
            student_id=student_id,
            student_name=name,
            student_roll_no=roll,
            student_email=email,
            status="active",
            enrolled_at=enrolled_dt,
            disenrolled_at=None,
            disenroll_reason=None,
        )
        self.offering_enrollments[offering_id][student_id] = enr

        # Update offering count
        active_count = sum(1 for e in self.offering_enrollments[offering_id].values() if e.status == "active")
        off.enrolled_count = active_count

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="ENROLLMENT",
            offering_id=offering_id,
            resource_id=student_id,
            details={"student_id": student_id, "student_name": name, "roll_no": roll, "effective_date": enrolled_dt},
            reason=f"Enrolled student {roll} in offering {offering_id}",
        )
        self._save_persisted_data()
        return enr

    def bulk_enroll_students(
        self,
        actor_id: str,
        actor_role: str,
        offering_id: str,
        student_ids: List[str],
        effective_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        off = self.get_offering(offering_id)
        if offering_id not in self.offering_enrollments:
            self.offering_enrollments[offering_id] = {}

        enrolled_dt = effective_date or datetime.now().isoformat()
        enrolled_list: List[StudentEnrollment] = []
        skipped: List[str] = []

        for sid in student_ids:
            existing = self.offering_enrollments[offering_id].get(sid)
            if existing and existing.status == "active":
                skipped.append(sid)
                continue

            dir_item = self.student_directory.get(sid)
            name = dir_item.full_name if dir_item else f"Student {sid[:8]}"
            roll = dir_item.roll_no if dir_item else sid[-9:]
            email = dir_item.email if dir_item else f"{sid}@thapar.edu"

            enr_id = existing.id if existing else f"enr-{uuid.uuid4().hex[:8]}"
            enr = StudentEnrollment(
                id=enr_id,
                offering_id=offering_id,
                student_id=sid,
                student_name=name,
                student_roll_no=roll,
                student_email=email,
                status="active",
                enrolled_at=enrolled_dt,
                disenrolled_at=None,
                disenroll_reason=None,
            )
            self.offering_enrollments[offering_id][sid] = enr
            enrolled_list.append(enr)

            self.log_audit(
                actor_id=actor_id,
                actor_role=actor_role,
                action="ENROLLMENT",
                offering_id=offering_id,
                resource_id=sid,
                details={"student_id": sid, "student_name": name, "roll_no": roll, "effective_date": enrolled_dt},
                reason=f"Bulk enrolled student {roll} in offering {offering_id}",
            )

        active_count = sum(1 for e in self.offering_enrollments[offering_id].values() if e.status == "active")
        off.enrolled_count = active_count
        self._save_persisted_data()
        return {
            "enrolled_count": len(enrolled_list),
            "enrolled_students": enrolled_list,
            "skipped_duplicates": skipped,
        }

    def disenroll_student(
        self, actor_id: str, actor_role: str, offering_id: str, student_id: str, reason: str, effective_date: Optional[str] = None
    ) -> StudentEnrollment:
        off = self.get_offering(offering_id)
        enr = self.offering_enrollments.get(offering_id, {}).get(student_id)
        if not enr or enr.status != "active":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Active enrollment for student '{student_id}' not found in offering '{offering_id}'.",
            )

        eff_date = effective_date or datetime.now().isoformat()
        enr.status = "disenrolled"
        enr.disenrolled_at = eff_date
        enr.disenroll_reason = reason

        active_count = sum(1 for e in self.offering_enrollments[offering_id].values() if e.status == "active")
        off.enrolled_count = active_count

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="DISENROLLMENT",
            offering_id=offering_id,
            resource_id=student_id,
            details={"student_id": student_id, "effective_date": eff_date, "reason": reason},
            reason=reason,
        )
        self._save_persisted_data()
        return enr

    # ============================================================
    # Attendance Management
    # ============================================================

    def list_attendance_sessions(self, offering_id: str) -> List[AttendanceSession]:
        self.get_offering(offering_id)
        return self.attendance_sessions.get(offering_id, [])

    def create_attendance_session(
        self, actor_id: str, actor_role: str, offering_id: str, session_date: str, slot_type: str = "Lecture"
    ) -> AttendanceSession:
        self.get_offering(offering_id)
        if not session_date or not session_date.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session date cannot be empty.",
            )

        clean_date = session_date.strip()
        clean_slot = slot_type.strip() if slot_type else "Lecture"

        if offering_id not in self.attendance_sessions:
            self.attendance_sessions[offering_id] = []

        # Prevent accidental duplicates and make retries safe
        for existing in self.attendance_sessions[offering_id]:
            if (
                not existing.is_cancelled
                and existing.session_date == clean_date
                and existing.slot_type.lower() == clean_slot.lower()
            ):
                return existing

        sess = AttendanceSession(
            id=f"sess-{uuid.uuid4().hex[:8]}",
            offering_id=offering_id,
            session_date=clean_date,
            slot_type=clean_slot,
            is_cancelled=False,
            created_by=actor_id,
            created_at=datetime.now().isoformat(),
            records_count=0,
        )
        self.attendance_sessions[offering_id].append(sess)
        self.session_attendance_records[sess.id] = {}

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="CREATE_ATTENDANCE_SESSION",
            offering_id=offering_id,
            resource_id=sess.id,
            details={"session_date": clean_date, "slot_type": clean_slot},
            reason=f"Created {clean_slot} session on {clean_date}",
        )
        self._save_persisted_data()
        return sess

    def get_session(self, offering_id: str, session_id: str) -> Optional[AttendanceSession]:
        self.get_offering(offering_id)
        sessions = self.attendance_sessions.get(offering_id, [])
        for s in sessions:
            if s.id == session_id:
                return s
        return None

    def get_session_records(self, session_id: str, offering_id: Optional[str] = None) -> List[SessionAttendanceRecord]:
        if offering_id:
            sess = self.get_session(offering_id, session_id)
            if not sess:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session '{session_id}' not found in offering '{offering_id}'.",
                )
        return list(self.session_attendance_records.get(session_id, {}).values())

    def mark_attendance(
        self, actor_id: str, actor_role: str, offering_id: str, session_id: str, records: List[AttendanceRecordItem]
    ) -> List[SessionAttendanceRecord]:
        self.get_offering(offering_id)
        target_session = self.get_session(offering_id, session_id)
        if not target_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' not found in offering '{offering_id}'.",
            )

        if target_session.is_cancelled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot mark attendance for cancelled session '{session_id}'.",
            )

        # Atomic pre-validation of all students
        enrollments = self.offering_enrollments.get(offering_id, {})
        session_dt_str = target_session.session_date[:10] if target_session.session_date else None

        for item in records:
            enr = enrollments.get(item.student_id)
            if not enr or enr.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Student '{item.student_id}' is not actively enrolled in offering '{offering_id}'.",
                )
            if session_dt_str:
                if enr.enrolled_at and enr.enrolled_at[:10] > session_dt_str:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Student '{item.student_id}' was enrolled on {enr.enrolled_at[:10]} after session date {session_dt_str}.",
                    )
                if enr.disenrolled_at and enr.disenrolled_at[:10] < session_dt_str:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Student '{item.student_id}' was disenrolled on {enr.disenrolled_at[:10]} prior to session date {session_dt_str}.",
                    )

        if session_id not in self.session_attendance_records:
            self.session_attendance_records[session_id] = {}

        updated_records = []
        for item in records:
            enr = enrollments[item.student_id]
            student_name = enr.student_name
            student_roll = enr.student_roll_no

            prev = self.session_attendance_records[session_id].get(item.student_id)
            if prev and prev.status != item.status:
                self.log_audit(
                    actor_id=actor_id,
                    actor_role=actor_role,
                    action="ATTENDANCE_CORRECTION",
                    offering_id=offering_id,
                    resource_id=session_id,
                    details={
                        "student_id": item.student_id,
                        "previous_status": prev.status,
                        "new_status": item.status,
                        "correction_reason": item.correction_reason,
                    },
                    reason=item.correction_reason or "Faculty attendance correction",
                )

            rec_id = prev.id if prev else f"att-rec-{uuid.uuid4().hex[:8]}"
            rec = SessionAttendanceRecord(
                id=rec_id,
                session_id=session_id,
                student_id=item.student_id,
                student_name=student_name,
                student_roll_no=student_roll,
                status=item.status,
                correction_reason=item.correction_reason,
                marked_by=actor_id,
                updated_at=datetime.now().isoformat(),
            )
            self.session_attendance_records[session_id][item.student_id] = rec
            updated_records.append(rec)

        target_session.records_count = len(self.session_attendance_records[session_id])
        self._save_persisted_data()
        return updated_records

    # ============================================================
    # Assessments & Marks Management
    # ============================================================

    def list_assessments(self, offering_id: str, is_student: bool = False) -> List[Assessment]:
        self.get_offering(offering_id)
        asms = self.offering_assessments.get(offering_id, [])
        if not is_student:
            return asms

        # Student view: only published assessments; hide answer key unless released
        student_asms = []
        for a in asms:
            if not a.is_published:
                continue
            copied = a.model_copy()
            if not a.answer_key_released:
                copied.answer_key_content = None
            student_asms.append(copied)
        return student_asms

    def create_assessment(
        self, actor_id: str, actor_role: str, offering_id: str, data: AssessmentCreate
    ) -> Assessment:
        self.get_offering(offering_id)
        if offering_id not in self.offering_assessments:
            self.offering_assessments[offering_id] = []

        asm_id = f"asm-{uuid.uuid4().hex[:8]}"
        asm = Assessment(
            id=asm_id,
            offering_id=offering_id,
            title=data.title,
            assessment_type=data.assessment_type,
            max_marks=data.max_marks,
            weight_percent=data.weight_percent,
            due_date=data.due_date,
            is_published=data.is_published,
            answer_key_content=data.answer_key_content,
            answer_key_released=False,
            created_by=actor_id,
            created_at=datetime.now().isoformat(),
        )
        self.offering_assessments[offering_id].append(asm)
        self.student_assessment_marks[asm_id] = {}

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="CREATE_ASSESSMENT",
            offering_id=offering_id,
            resource_id=asm_id,
            details=data.model_dump(),
            reason=f"Created assessment {data.title} ({data.assessment_type})",
        )
        self._save_persisted_data()
        return asm

    def update_assessment(
        self, actor_id: str, actor_role: str, offering_id: str, assessment_id: str, data: AssessmentUpdate
    ) -> Assessment:
        self.get_offering(offering_id)
        target = None
        for a in self.offering_assessments.get(offering_id, []):
            if a.id == assessment_id:
                target = a
                break
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assessment '{assessment_id}' not found")

        audit_actions = []
        if data.is_published is not None and data.is_published != target.is_published:
            audit_actions.append(f"is_published -> {data.is_published}")
            target.is_published = data.is_published
            self.log_audit(
                actor_id=actor_id,
                actor_role=actor_role,
                action="PUBLISH_ASSESSMENT" if data.is_published else "UNPUBLISH_ASSESSMENT",
                offering_id=offering_id,
                resource_id=assessment_id,
                details={"is_published": data.is_published},
                reason=f"Professor toggled publication to {data.is_published}",
            )

        if data.answer_key_released is not None and data.answer_key_released != target.answer_key_released:
            audit_actions.append(f"answer_key_released -> {data.answer_key_released}")
            target.answer_key_released = data.answer_key_released
            self.log_audit(
                actor_id=actor_id,
                actor_role=actor_role,
                action="RELEASE_ANSWER_KEY" if data.answer_key_released else "RECALL_ANSWER_KEY",
                offering_id=offering_id,
                resource_id=assessment_id,
                details={"answer_key_released": data.answer_key_released},
                reason=f"Professor toggled answer key release to {data.answer_key_released}",
            )

        if data.title is not None:
            target.title = data.title
        if data.max_marks is not None:
            target.max_marks = data.max_marks
        if data.weight_percent is not None:
            target.weight_percent = data.weight_percent
        if data.due_date is not None:
            target.due_date = data.due_date
        if data.answer_key_content is not None:
            target.answer_key_content = data.answer_key_content

        self._save_persisted_data()
        return target

    def get_assessment_marks(
        self, offering_id: str, assessment_id: str, is_student: bool = False, student_id: Optional[str] = None
    ) -> List[StudentAssessmentMark]:
        self.get_offering(offering_id)
        # Find assessment to check publication
        asm = None
        for a in self.offering_assessments.get(offering_id, []):
            if a.id == assessment_id:
                asm = a
                break
        if not asm:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assessment '{assessment_id}' not found")

        marks_map = self.student_assessment_marks.get(assessment_id, {})
        if is_student:
            if not asm.is_published:
                return []
            if student_id and student_id in marks_map:
                return [marks_map[student_id]]
            return []

        return list(marks_map.values())

    def update_marks(
        self, actor_id: str, actor_role: str, offering_id: str, assessment_id: str, items: List[StudentMarkItem]
    ) -> List[StudentAssessmentMark]:
        self.get_offering(offering_id)
        asm = None
        for a in self.offering_assessments.get(offering_id, []):
            if a.id == assessment_id:
                asm = a
                break
        if not asm:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assessment '{assessment_id}' not found")

        enrollments = self.offering_enrollments.get(offering_id, {})
        # Pre-validate all items before mutating state (atomic failure)
        for item in items:
            if item.obtained_marks is not None:
                if item.obtained_marks < 0 or item.obtained_marks > asm.max_marks:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Obtained marks {item.obtained_marks} must be between 0 and maximum marks ({asm.max_marks}).",
                    )
            enr = enrollments.get(item.student_id)
            if not enr or enr.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Student '{item.student_id}' is not actively enrolled in offering '{offering_id}'.",
                )

        if assessment_id not in self.student_assessment_marks:
            self.student_assessment_marks[assessment_id] = {}

        updated_marks = []
        for item in items:
            enr = enrollments[item.student_id]
            student_name = enr.student_name
            student_roll = enr.student_roll_no

            prev = self.student_assessment_marks[assessment_id].get(item.student_id)
            if prev and prev.obtained_marks != item.obtained_marks:
                self.log_audit(
                    actor_id=actor_id,
                    actor_role=actor_role,
                    action="MARK_CORRECTION",
                    offering_id=offering_id,
                    resource_id=assessment_id,
                    details={
                        "student_id": item.student_id,
                        "previous_marks": prev.obtained_marks,
                        "new_marks": item.obtained_marks,
                        "correction_reason": item.correction_reason,
                    },
                    reason=item.correction_reason or "Faculty marks adjustment",
                )

            mark_id = prev.id if prev else f"mark-{uuid.uuid4().hex[:8]}"
            mark = StudentAssessmentMark(
                id=mark_id,
                assessment_id=assessment_id,
                student_id=item.student_id,
                student_name=student_name,
                student_roll_no=student_roll,
                obtained_marks=item.obtained_marks,
                status=item.status,
                feedback=item.feedback,
                correction_reason=item.correction_reason,
                graded_by=actor_id,
                updated_at=datetime.now().isoformat(),
            )
            self.student_assessment_marks[assessment_id][item.student_id] = mark
            updated_marks.append(mark)

        self._save_persisted_data()
        return updated_marks

    # ============================================================
    # Assignments & Submissions Management
    # ============================================================

    def list_assignments(self, offering_id: str, is_student: bool = False) -> List[OfferingAssignment]:
        self.get_offering(offering_id)
        asgs = self.offering_assignments.get(offering_id, [])
        if not is_student:
            return asgs

        student_asgs = []
        for asg in asgs:
            if not asg.is_published:
                continue
            copied = asg.model_copy()
            if not asg.model_answer_released:
                copied.model_answer = None
            student_asgs.append(copied)
        return student_asgs

    def create_assignment(
        self, actor_id: str, actor_role: str, offering_id: str, data: AssignmentCreate
    ) -> OfferingAssignment:
        self.get_offering(offering_id)
        if offering_id not in self.offering_assignments:
            self.offering_assignments[offering_id] = []

        asg_id = f"asg-{uuid.uuid4().hex[:8]}"
        asg = OfferingAssignment(
            id=asg_id,
            offering_id=offering_id,
            title=data.title,
            instructions=data.instructions,
            due_date=data.due_date,
            allowed_formats=data.allowed_formats,
            max_file_size_mb=data.max_file_size_mb,
            allow_late=data.allow_late,
            allow_resubmission=data.allow_resubmission,
            is_published=data.is_published,
            model_answer=data.model_answer,
            model_answer_released=False,
            created_by=actor_id,
            created_at=datetime.now().isoformat(),
            submissions_count=0,
        )
        self.offering_assignments[offering_id].append(asg)
        self.assignment_submissions[asg_id] = {}

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="CREATE_ASSIGNMENT",
            offering_id=offering_id,
            resource_id=asg_id,
            details=data.model_dump(),
            reason=f"Created assignment {data.title}",
        )
        self._save_persisted_data()
        return asg

    def update_assignment(
        self, actor_id: str, actor_role: str, offering_id: str, assignment_id: str, data: AssignmentUpdate
    ) -> OfferingAssignment:
        self.get_offering(offering_id)
        target = None
        for a in self.offering_assignments.get(offering_id, []):
            if a.id == assignment_id:
                target = a
                break
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignment '{assignment_id}' not found")

        if data.is_published is not None and data.is_published != target.is_published:
            target.is_published = data.is_published
            self.log_audit(
                actor_id=actor_id,
                actor_role=actor_role,
                action="PUBLISH_ASSIGNMENT" if data.is_published else "UNPUBLISH_ASSIGNMENT",
                offering_id=offering_id,
                resource_id=assignment_id,
                details={"is_published": data.is_published},
                reason=f"Professor toggled assignment publication to {data.is_published}",
            )

        if data.model_answer_released is not None and data.model_answer_released != target.model_answer_released:
            target.model_answer_released = data.model_answer_released
            self.log_audit(
                actor_id=actor_id,
                actor_role=actor_role,
                action="RELEASE_MODEL_ANSWER" if data.model_answer_released else "RECALL_MODEL_ANSWER",
                offering_id=offering_id,
                resource_id=assignment_id,
                details={"model_answer_released": data.model_answer_released},
                reason=f"Professor toggled model answer release to {data.model_answer_released}",
            )

        if data.title is not None:
            target.title = data.title
        if data.instructions is not None:
            target.instructions = data.instructions
        if data.due_date is not None:
            target.due_date = data.due_date
        if data.allowed_formats is not None:
            target.allowed_formats = data.allowed_formats
        if data.max_file_size_mb is not None:
            target.max_file_size_mb = data.max_file_size_mb
        if data.allow_late is not None:
            target.allow_late = data.allow_late
        if data.allow_resubmission is not None:
            target.allow_resubmission = data.allow_resubmission
        if data.model_answer is not None:
            target.model_answer = data.model_answer

        self._save_persisted_data()
        return target

    def submit_assignment(
        self,
        student_id: str,
        offering_id: str,
        assignment_id: str,
        submission_text: Optional[str] = None,
        file_name: Optional[str] = None,
        storage_path: Optional[str] = None,
    ) -> AssignmentSubmission:
        self.get_offering(offering_id)
        target = None
        for a in self.offering_assignments.get(offering_id, []):
            if a.id == assignment_id:
                target = a
                break
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignment '{assignment_id}' not found")

        if not target.is_published:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot submit to an unpublished assignment.")

        # Enforce active student enrollment invariant
        enr = self.offering_enrollments.get(offering_id, {}).get(student_id)
        if not enr or enr.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Student '{student_id}' is not actively enrolled in offering '{offering_id}'.",
            )

        # Check late submission rules with timezone-normalized timestamps
        now_utc = datetime.now(timezone.utc)
        is_late = False
        due_utc = parse_and_normalize_utc(target.due_date, date_only_end_of_day=True)
        if now_utc > due_utc:
            if not target.allow_late:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Late submissions are strictly not permitted for this assignment.",
                )
            is_late = True

        if assignment_id not in self.assignment_submissions:
            self.assignment_submissions[assignment_id] = {}

        existing = self.assignment_submissions[assignment_id].get(student_id)
        if existing and not target.allow_resubmission:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Resubmissions are disabled for this assignment.",
            )

        new_version = (existing.version + 1) if existing else 1
        student_name = enr.student_name
        student_roll = enr.student_roll_no

        sub_id = existing.id if existing else f"sub-{uuid.uuid4().hex[:8]}"
        sub = AssignmentSubmission(
            id=sub_id,
            assignment_id=assignment_id,
            student_id=student_id,
            student_name=student_name,
            student_roll_no=student_roll,
            submission_text=submission_text,
            file_name=file_name,
            storage_path=storage_path or f"/submissions/{assignment_id}/{student_id}_v{new_version}",
            submitted_at=now_utc.isoformat(),
            version=new_version,
            is_late=is_late,
            score=existing.score if existing else None,
            feedback=existing.feedback if existing else None,
            graded_by=existing.graded_by if existing else None,
            graded_at=existing.graded_at if existing else None,
        )
        self.assignment_submissions[assignment_id][student_id] = sub
        target.submissions_count = len(self.assignment_submissions[assignment_id])

        self.log_audit(
            actor_id=student_id,
            actor_role="student",
            action="ASSIGNMENT_SUBMISSION",
            offering_id=offering_id,
            resource_id=assignment_id,
            details={"version": new_version, "is_late": is_late, "file_name": file_name},
            reason=f"Student submitted assignment {target.title} (v{new_version})",
        )
        self._save_persisted_data()
        return sub

    def get_assignment_submissions(
        self, offering_id: str, assignment_id: str, is_student: bool = False, student_id: Optional[str] = None
    ) -> List[AssignmentSubmission]:
        self.get_offering(offering_id)
        subs = self.assignment_submissions.get(assignment_id, {})
        if is_student:
            if student_id and student_id in subs:
                return [subs[student_id]]
            return []
        return list(subs.values())

    def grade_submission(
        self,
        actor_id: str,
        actor_role: str,
        offering_id: str,
        assignment_id: str,
        submission_id: str,
        score: float,
        feedback: Optional[str] = None,
    ) -> AssignmentSubmission:
        self.get_offering(offering_id)
        subs = self.assignment_submissions.get(assignment_id, {})
        target = None
        for s in subs.values():
            if s.id == submission_id:
                target = s
                break
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Submission '{submission_id}' not found")

        target.score = score
        target.feedback = feedback
        target.graded_by = actor_id
        target.graded_at = datetime.now().isoformat()

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="GRADE_SUBMISSION",
            offering_id=offering_id,
            resource_id=submission_id,
            details={"student_id": target.student_id, "score": score, "feedback": feedback},
            reason=f"Faculty graded submission for {target.student_name}",
        )
        self._save_persisted_data()
        return target

    # ============================================================
    # Offering Announcements
    # ============================================================

    def list_announcements(
        self, offering_id: str, is_student: bool = False, student_id: Optional[str] = None
    ) -> List[OfferingAnnouncement]:
        self.get_offering(offering_id)
        anns = self.offering_announcements.get(offering_id, [])
        if not is_student or not student_id:
            return anns

        # Filter for student: target_group == 'all' OR target_student_ids contains student_id
        # OR student matches support category
        visible = []
        for a in anns:
            if a.target_group == "all":
                visible.append(a)
            elif a.target_group == "selected" and student_id in a.target_student_ids:
                visible.append(a)
            elif a.target_group in ("low_attendance", "academic_support"):
                # Compute student's support status
                roster = self.get_roster(offering_id, search=student_id)
                if roster.students:
                    st = roster.students[0]
                    if a.target_group == "low_attendance" and st.needs_attendance_support:
                        visible.append(a)
                    elif a.target_group == "academic_support" and st.needs_academic_support:
                        visible.append(a)
        return visible

    def create_announcement(
        self,
        actor_id: str,
        actor_role: str,
        offering_id: str,
        title: str,
        content: str,
        target_group: str = "all",
        target_student_ids: Optional[List[str]] = None,
    ) -> OfferingAnnouncement:
        self.get_offering(offering_id)
        if offering_id not in self.offering_announcements:
            self.offering_announcements[offering_id] = []

        ann_id = f"ann-{uuid.uuid4().hex[:8]}"
        ann = OfferingAnnouncement(
            id=ann_id,
            offering_id=offering_id,
            title=title,
            content=content,
            target_group=target_group,
            target_student_ids=target_student_ids or [],
            created_by=actor_id,
            created_at=datetime.now().isoformat(),
        )
        self.offering_announcements[offering_id].append(ann)

        self.log_audit(
            actor_id=actor_id,
            actor_role=actor_role,
            action="CREATE_ANNOUNCEMENT",
            offering_id=offering_id,
            resource_id=ann_id,
            details={"title": title, "target_group": target_group},
            reason=f"Published announcement {title}",
        )
        self._save_persisted_data()
        return ann

    # ============================================================
    # Enrolled-Student Roster & Support Rules
    # ============================================================

    def get_roster(
        self,
        offering_id: str,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,  # "active", "disenrolled", "all"
        support_filter: Optional[str] = None,  # "attendance_support", "academic_support", "all"
        sort_by: str = "roll_no",  # "name", "roll_no", "attendance", "score"
        sort_order: str = "asc",
        page: int = 1,
        page_size: int = 50,
    ) -> RosterResponse:
        off = self.get_offering(offering_id)
        enrollments = list(self.offering_enrollments.get(offering_id, {}).values())
        sessions = self.attendance_sessions.get(offering_id, [])
        assessments = [a for a in self.offering_assessments.get(offering_id, []) if a.is_published]
        assignments = [a for a in self.offering_assignments.get(offering_id, []) if a.is_published]

        roster_students: List[RosterStudent] = []

        for enr in enrollments:
            # 1. Attendance Calculation respecting enrollment dates
            # Counted sessions = sessions on or after enrolled_at (and before disenrolled_at if disenrolled),
            # non-cancelled, non-excused
            attended_count = 0
            counted_count = 0

            enrolled_date_str = enr.enrolled_at[:10]
            disenrolled_date_str = enr.disenrolled_at[:10] if enr.disenrolled_at else None

            for s in sessions:
                if s.is_cancelled:
                    continue
                sess_date = s.session_date
                # If session was held before student enrolled, ignore
                if sess_date < enrolled_date_str:
                    continue
                # If session held after disenrollment, ignore
                if disenrolled_date_str and sess_date > disenrolled_date_str:
                    continue

                rec = self.session_attendance_records.get(s.id, {}).get(enr.student_id)
                if rec:
                    if rec.status in ("excused", "unmarked"):
                        # Excused and unmarked sessions do not count against student
                        continue
                    counted_count += 1
                    if rec.status in ("present", "late"):
                        attended_count += 1
                # If rec is None (session attendance unmarked), do not silently mark absent

            if counted_count > 0:
                att_pct = round((attended_count / counted_count) * 100.0, 1)
                if att_pct >= off.attendance_threshold:
                    att_status = "safe"
                elif att_pct >= (off.attendance_threshold - 5.0):
                    att_status = "warning"
                else:
                    att_status = "critical"
            else:
                att_pct = None
                att_status = "no_data"

            # 2. Assessment Marks Calculation
            marks_dict: Dict[str, Optional[float]] = {}
            total_obtained = 0.0
            total_possible = 0.0
            weighted_obtained = 0.0
            weighted_possible = 0.0
            has_low_assessment_score = False

            for asm in assessments:
                mark_rec = self.student_assessment_marks.get(asm.id, {}).get(enr.student_id)
                obt = mark_rec.obtained_marks if mark_rec else None
                marks_dict[asm.title] = obt
                if obt is not None:
                    total_obtained += obt
                    total_possible += asm.max_marks
                    pct_score = (obt / asm.max_marks) * 100.0 if asm.max_marks > 0 else 0
                    if pct_score < 40.0:
                        has_low_assessment_score = True
                    if asm.weight_percent > 0:
                        weighted_obtained += (obt / asm.max_marks) * asm.weight_percent
                        weighted_possible += asm.weight_percent

            weighted_score = None
            if weighted_possible > 0:
                weighted_score = round((weighted_obtained / weighted_possible) * 100.0, 1)
            elif total_possible > 0:
                weighted_score = round((total_obtained / total_possible) * 100.0, 1)

            # Grade estimation (standard 10-point TIET)
            calc_grade = None
            if weighted_score is not None:
                if weighted_score >= 90:
                    calc_grade = "A+"
                elif weighted_score >= 80:
                    calc_grade = "A"
                elif weighted_score >= 70:
                    calc_grade = "B"
                elif weighted_score >= 60:
                    calc_grade = "C"
                elif weighted_score >= 50:
                    calc_grade = "D"
                elif weighted_score >= 40:
                    calc_grade = "E"
                else:
                    calc_grade = "F"

            # 3. Missing Assignments Calculation
            missing_asgs = 0
            for asg in assignments:
                sub = self.assignment_submissions.get(asg.id, {}).get(enr.student_id)
                if not sub:
                    missing_asgs += 1

            # 4. Support Criteria Evaluation
            needs_att_support = bool(att_pct is not None and att_pct < off.attendance_threshold)
            needs_acad_support = bool(
                (weighted_score is not None and weighted_score < 50.0)
                or missing_asgs > 0
                or has_low_assessment_score
            )

            support_reasons = []
            if needs_att_support:
                support_reasons.append(f"Attendance {att_pct}% is below threshold ({off.attendance_threshold}%)")
            if missing_asgs > 0:
                support_reasons.append(f"Missing {missing_asgs} published assignment(s)")
            if weighted_score is not None and weighted_score < 50.0:
                support_reasons.append(f"Cumulative performance ({weighted_score}%) is below 50%")
            elif has_low_assessment_score:
                support_reasons.append("Scored below 40% on one or more assessments")

            dir_item = self.student_directory.get(enr.student_id)
            branch = dir_item.branch if dir_item else "COE"
            semester = dir_item.semester if dir_item else 5

            roster_students.append(
                RosterStudent(
                    student_id=enr.student_id,
                    student_name=enr.student_name,
                    student_roll_no=enr.student_roll_no,
                    student_email=enr.student_email,
                    branch=branch,
                    semester=semester,
                    enrollment_status=enr.status,
                    enrolled_at=enr.enrolled_at,
                    disenrolled_at=enr.disenrolled_at,
                    attended_sessions=attended_count,
                    counted_sessions=counted_count,
                    attendance_percentage=att_pct,
                    attendance_status=att_status,
                    assessment_marks=marks_dict,
                    total_obtained_marks=round(total_obtained, 1),
                    total_possible_marks=round(total_possible, 1),
                    weighted_score=weighted_score,
                    calculated_grade=calc_grade,
                    missing_assignments_count=missing_asgs,
                    needs_attendance_support=needs_att_support,
                    needs_academic_support=needs_acad_support,
                    support_reasons=support_reasons,
                )
            )

        # Filters
        filtered = roster_students
        if status_filter and status_filter != "all":
            filtered = [s for s in filtered if s.enrollment_status == status_filter]

        if support_filter == "attendance_support":
            filtered = [s for s in filtered if s.needs_attendance_support]
        elif support_filter == "academic_support":
            filtered = [s for s in filtered if s.needs_academic_support]

        if search and search.strip():
            sq = search.strip().lower()
            filtered = [
                s for s in filtered
                if (sq in s.student_name.lower() or sq in s.student_roll_no.lower() or sq in s.student_email.lower())
            ]

        # Sorting
        rev = (sort_order.lower() == "desc")
        if sort_by == "name":
            filtered.sort(key=lambda x: x.student_name.lower(), reverse=rev)
        elif sort_by == "attendance":
            filtered.sort(key=lambda x: (x.attendance_percentage is not None, x.attendance_percentage or 0), reverse=rev)
        elif sort_by == "score":
            filtered.sort(key=lambda x: (x.weighted_score is not None, x.weighted_score or 0), reverse=rev)
        else:  # roll_no
            filtered.sort(key=lambda x: x.student_roll_no, reverse=rev)

        # Pagination
        total_count = len(filtered)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_students = filtered[start_idx:end_idx]

        return RosterResponse(
            offering_id=off.id,
            subject_code=off.subject_code,
            subject_name=off.subject_name,
            term=off.term,
            section=off.section,
            total_students=total_count,
            page=page,
            page_size=page_size,
            attendance_threshold=off.attendance_threshold,
            students=page_students,
        )

    def export_roster_csv(self, offering_id: str) -> str:
        """
        Exports offering roster to RFC 4180 CSV.
        SECURITY REQUIREMENT: Formula injection protection.
        Any string cell beginning with '=', '+', '-', or '@' must be sanitized by prepending a single quote.
        """
        roster = self.get_roster(offering_id, status_filter="all", page=1, page_size=1000)

        def sanitize(val: Any) -> str:
            if val is None:
                return ""
            s = str(val).strip()
            if s.startswith(("=", "+", "-", "@")):
                return f"'{s}"
            return s

        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\r\n")

        headers = [
            "Roll Number",
            "Student Name",
            "Email",
            "Branch",
            "Semester",
            "Enrollment Status",
            "Attended Sessions",
            "Counted Sessions",
            "Attendance Percentage",
            "Attendance Status",
            "Weighted Score",
            "Calculated Grade",
            "Missing Assignments",
            "Attendance Support",
            "Academic Support",
            "Support Reasons",
        ]
        writer.writerow(headers)

        for s in roster.students:
            writer.writerow([
                sanitize(s.student_roll_no),
                sanitize(s.student_name),
                sanitize(s.student_email),
                sanitize(s.branch),
                sanitize(s.semester),
                sanitize(s.enrollment_status),
                sanitize(s.attended_sessions),
                sanitize(s.counted_sessions),
                sanitize(f"{s.attendance_percentage}%" if s.attendance_percentage is not None else "N/A"),
                sanitize(s.attendance_status),
                sanitize(f"{s.weighted_score}%" if s.weighted_score is not None else "N/A"),
                sanitize(s.calculated_grade or "N/A"),
                sanitize(s.missing_assignments_count),
                sanitize("YES" if s.needs_attendance_support else "NO"),
                sanitize("YES" if s.needs_academic_support else "NO"),
                sanitize("; ".join(s.support_reasons) if s.support_reasons else "None"),
            ])

        return output.getvalue()
