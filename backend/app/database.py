import uuid
import json
import os
import shutil
import threading
from pathlib import Path
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple, Any, Set, Union
from .models.academic import Course, AttendanceRecord, TimetableSlot, DeadlineTask
from .models.vault import VaultDocument
from .models.reuse import ReuseItem
from .models.opportunity import (
    Opportunity,
    OpportunityCreate,
    StudentSkillProfile,
    OpportunityApplication,
    OpportunityApplicationCreate,
    StudentExperienceProfile,
    StudentExperienceProfileUpdate,
    EducationEntry,
    ProjectEntry,
    WorkExperienceEntry,
    CertificationEntry,
    CandidateMatch,
    CandidateDiscoveryResponse,
    OpportunityInvitationResponse,
)
from .services.what_if_engine import WhatIfEngine
from .services.academic_engine import AcademicRBACEngine

class CampusOSDatabase:
    """
    Robust local repository pre-seeded with authentic Thapar Institute data.
    Gracefully handles local hackathon demo operation as well as Supabase synchronization.
    """
    def __init__(self):
        self.default_user_id = "102203099-tiet-user"
        self.vault_consent_granted: bool = False
        self.courses: Dict[str, Course] = {}
        self.attendance: Dict[str, AttendanceRecord] = {}
        self.timetable: List[TimetableSlot] = []
        self.deadlines: List[DeadlineTask] = []
        self.vault_docs: Dict[str, VaultDocument] = {}
        self.reuse_items: Dict[str, ReuseItem] = {}
        self.opportunities: Dict[str, Opportunity] = {}
        self.user_skill_profiles: Dict[str, StudentSkillProfile] = {}
        self.user_saved_opportunities: Dict[str, List[str]] = {}
        self.user_applications: Dict[str, List[OpportunityApplication]] = {}
        # Multi-tenant isolated storage maps (scoped by authenticated user_id)
        self.user_courses: Dict[str, Dict[str, Course]] = {}
        self.user_attendance: Dict[str, Dict[str, AttendanceRecord]] = {}
        self.user_deadlines: Dict[str, List[DeadlineTask]] = {}
        self.user_timetable: Dict[str, List[TimetableSlot]] = {}
        self._tasks_file = Path(__file__).resolve().parent.parent / "storage" / "tasks_persistence.json"
        self._tasks_lock = threading.Lock()
        self.experience_profiles: Dict[str, StudentExperienceProfile] = {}
        self.student_resumes: Dict[str, Tuple[str, bytes]] = {}
        self.opportunity_invitations: Dict[str, List[Dict[str, Any]]] = {}
        self._profiles_file = Path(__file__).resolve().parent.parent / "storage" / "student_experience_profiles.json"
        self._profiles_lock = threading.RLock()
        self._resumes_dir = Path(__file__).resolve().parent.parent / "storage" / "resumes"
        self._resumes_dir.mkdir(parents=True, exist_ok=True)
        self.academic_rbac = AcademicRBACEngine()
        self._seed_sample_data()
        self._load_persisted_tasks()
        self._load_experience_profiles()

    def _save_experience_profiles(self):
        """Atomically saves experience profiles to disk with corrupted file protection."""
        with self._profiles_lock:
            try:
                self._profiles_file.parent.mkdir(parents=True, exist_ok=True)
                data = {uid: prof.model_dump() for uid, prof in self.experience_profiles.items()}
                tmp_file = self._profiles_file.with_suffix(".tmp")
                with open(tmp_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                os.replace(tmp_file, self._profiles_file)
            except Exception:
                pass

    def _load_experience_profiles(self):
        """Loads persisted experience profiles from disk or initializes defaults."""
        with self._profiles_lock:
            if not self._profiles_file.exists():
                return
            try:
                with open(self._profiles_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for uid, prof_dict in data.items():
                    self.experience_profiles[uid] = StudentExperienceProfile(**prof_dict)
            except (json.JSONDecodeError, OSError):
                try:
                    backup_path = self._profiles_file.with_suffix(f".corrupted.{int(datetime.now().timestamp())}")
                    shutil.copy(self._profiles_file, backup_path)
                except Exception:
                    pass

    def _save_persisted_tasks(self):
        """Atomically saves tasks to durable disk persistence to prevent corruption."""
        try:
            self._tasks_file.parent.mkdir(parents=True, exist_ok=True)
            data = {}
            for uid, tasks in self.user_deadlines.items():
                data[uid] = [t.model_dump() if hasattr(t, "model_dump") else t.dict() for t in tasks]
            tmp_file = self._tasks_file.with_suffix(".tmp")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(tmp_file, self._tasks_file)
        except Exception:
            pass

    def _load_persisted_tasks(self):
        """Loads tasks from persistent storage with corrupted file recovery."""
        if not self._tasks_file.exists():
            return
        try:
            with open(self._tasks_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for uid, task_dicts in data.items():
                tasks = [DeadlineTask(**td) for td in task_dicts]
                if uid == self.default_user_id:
                    existing_ids = {t.id for t in self.deadlines}
                    for t in tasks:
                        if t.id not in existing_ids:
                            self.deadlines.append(t)
                    self.user_deadlines[uid] = list(self.deadlines)
                else:
                    self.user_deadlines[uid] = tasks
        except (json.JSONDecodeError, OSError) as e:
            # Corrupted persistence file: preserve backup for forensics and recover
            backup_file = self._tasks_file.with_suffix(f".corrupted.{int(datetime.now().timestamp())}")
            try:
                shutil.copy(self._tasks_file, backup_file)
            except Exception:
                pass
        except Exception:
            pass

    def _canonical_uid(self, uid: str) -> str:
        if not uid or uid in ("102203099-tiet-user", "dev-user-102203099", "dev-user", "mock-token", "student-user-id"):
            return self.default_user_id
        return uid

    def get_user_role(self, user_id: str) -> str:
        if hasattr(self, "academic_rbac"):
            return self.academic_rbac.get_user_role(user_id)
        return "student"

    def get_courses(self, user_id: str) -> List[Course]:
        uid = self._canonical_uid(user_id)
        if uid == self.default_user_id:
            return list(self.courses.values())
        return list(self.user_courses.get(uid, {}).values())

    def add_course(self, user_id: str, course: Course) -> Course:
        uid = self._canonical_uid(user_id)
        if uid not in self.user_courses:
            self.user_courses[uid] = {}
        self.user_courses[uid][course.id] = course

        # Initialize attendance tracking for this course
        if uid not in self.user_attendance:
            self.user_attendance[uid] = {}
        if course.course_code not in self.user_attendance[uid]:
            pct, status_val, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(0, 0)
            rec = AttendanceRecord(
                id=f"att-{course.course_code}-{uuid.uuid4().hex[:4]}",
                course_code=course.course_code,
                course_name=course.course_name,
                attended_classes=0,
                total_classes=0,
                percentage=pct,
                status=status_val,
                safe_bunks=safe_bunks,
                classes_needed_for_75=needed,
            )
            self.user_attendance[uid][course.course_code] = rec

        if uid == self.default_user_id:
            self.courses[course.id] = course
            self.attendance[course.course_code] = self.user_attendance[uid][course.course_code]
        return course

    def delete_course(self, user_id: str, course_id: str) -> bool:
        uid = self._canonical_uid(user_id)
        if uid in self.user_courses and course_id in self.user_courses[uid]:
            del self.user_courses[uid][course_id]
            if uid == self.default_user_id and course_id in self.courses:
                del self.courses[course_id]
            return True
        if uid == self.default_user_id and course_id in self.courses:
            del self.courses[course_id]
            return True
        return False

    def get_attendance(self, user_id: str) -> List[AttendanceRecord]:
        uid = self._canonical_uid(user_id)
        if uid == self.default_user_id:
            return list(self.attendance.values())
        return list(self.user_attendance.get(uid, {}).values())

    def update_attendance(self, user_id: str, course_code: str, attended_classes: int, total_classes: int) -> AttendanceRecord:
        uid = self._canonical_uid(user_id)
        code = course_code.upper().strip()
        pct, status_val, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(attended_classes, total_classes)

        course_name = "Course"
        user_c_map = self.user_courses.get(uid, {}) if uid != self.default_user_id else self.courses
        for c in user_c_map.values():
            if c.course_code == code:
                course_name = c.course_name
                break

        rec = AttendanceRecord(
            id=f"att-{code}-{uuid.uuid4().hex[:4]}",
            course_code=code,
            course_name=course_name,
            attended_classes=attended_classes,
            total_classes=total_classes,
            percentage=pct,
            status=status_val,
            safe_bunks=safe_bunks,
            classes_needed_for_75=needed,
        )

        if uid not in self.user_attendance:
            self.user_attendance[uid] = {}
        self.user_attendance[uid][code] = rec

        if uid == self.default_user_id:
            self.attendance[code] = rec
        return rec

    def get_timetable(self, user_id: str) -> List[TimetableSlot]:
        uid = self._canonical_uid(user_id)
        if uid == self.default_user_id:
            return list(self.timetable)
        return list(self.user_timetable.get(uid, []))

    def get_deadlines(self, user_id: str) -> List[DeadlineTask]:
        uid = self._canonical_uid(user_id)
        if uid == self.default_user_id:
            return list(self.deadlines)
        return list(self.user_deadlines.get(uid, []))

    def add_deadline(self, user_id: str, task: DeadlineTask) -> DeadlineTask:
        with self._tasks_lock:
            uid = self._canonical_uid(user_id)
            if uid not in self.user_deadlines:
                self.user_deadlines[uid] = []

            # 1. Exact ID match (retry of existing task)
            for existing in self.user_deadlines[uid]:
                if existing.id == task.id:
                    return existing

            # 2. Copilot action deduplication: only deduplicate if it's the exact same confirmed copilot action
            if task.source == "copilot_action":
                for existing in self.user_deadlines[uid]:
                    if (
                        existing.source == "copilot_action"
                        and existing.title == task.title
                        and existing.due_date.split("T")[0] == task.due_date.split("T")[0]
                        and existing.course_code == task.course_code
                    ):
                        return existing

            self.user_deadlines[uid].append(task)
            if uid == self.default_user_id and task not in self.deadlines:
                self.deadlines.append(task)
            self._save_persisted_tasks()
            return task

    def toggle_deadline(self, user_id: str, task_id: str) -> Optional[DeadlineTask]:
        with self._tasks_lock:
            uid = self._canonical_uid(user_id)
            task_list = self.user_deadlines.get(uid, []) if uid != self.default_user_id else self.deadlines
            for t in task_list:
                if t.id == task_id:
                    t.status = "completed" if t.status == "pending" else "pending"
                    self._save_persisted_tasks()
                    return t
            return None

    def get_opportunities(self) -> List[Opportunity]:
        return list(self.opportunities.values())

    def get_opportunity(self, opp_id: str) -> Optional[Opportunity]:
        return self.opportunities.get(opp_id)

    def get_student_experience_profile(self, user_id: str) -> StudentExperienceProfile:
        uid = self._canonical_uid(user_id)
        with self._profiles_lock:
            if uid not in self.experience_profiles:
                # Default baseline profile with verified institutional education
                is_arjun = uid == self.default_user_id
                full_name = "Arjun Mehta" if is_arjun else "Student Profile"
                roll_no = "102203099" if is_arjun else "102203888"
                email = "amehta_be22@thapar.edu" if is_arjun else f"student_{uid[:6]}@thapar.edu"
                verified_cgpa = 8.52 if is_arjun else 7.80

                edu = [
                    EducationEntry(
                        id="edu-1",
                        program="Bachelor of Engineering",
                        branch="COE",
                        semester=5,
                        graduation_year=2026,
                        cgpa_verified=verified_cgpa,
                        student_entered_cgpa=verified_cgpa,
                        institution="Thapar Institute of Engineering & Technology",
                    )
                ]
                skills = ["Python", "FastAPI", "Next.js", "TypeScript", "Machine Learning", "PostgreSQL", "Docker"]
                projects = [
                    ProjectEntry(
                        id="proj-1",
                        title="CampusOS Real-Time Academic Assistant",
                        description="Built monolithic multi-tenant campus operating system with FastAPI and Next.js 16.",
                        technologies=["FastAPI", "Next.js", "Python", "TypeScript"],
                        role="Full Stack Engineer",
                        link="https://github.com/Pinkertonss/CampusOS",
                    ),
                    ProjectEntry(
                        id="proj-2",
                        title="Distributed Task Scheduler",
                        description="Fault-tolerant cron scheduler with Raft consensus algorithm.",
                        technologies=["Go", "Docker", "gRPC"],
                        role="Backend Architect",
                    ),
                ]
                work_exp = [
                    WorkExperienceEntry(
                        id="work-1",
                        role="Undergraduate Research Intern",
                        company="TIET AI & Robotics Center",
                        location="Patiala, Punjab",
                        start_date="2024-06-01",
                        end_date="2024-08-31",
                        is_current=False,
                        description="Implemented model quantization and evaluation benchmarks for edge perception.",
                    )
                ]
                certs = [
                    CertificationEntry(
                        id="cert-1",
                        title="Deep Learning Specialization",
                        issuer="DeepLearning.AI",
                        issue_date="2024-03-15",
                        credential_url="https://coursera.org/verify/dl-spec",
                    )
                ]

                self.experience_profiles[uid] = StudentExperienceProfile(
                    user_id=uid,
                    full_name=full_name,
                    roll_no=roll_no,
                    email=email,
                    education=edu,
                    skills=skills,
                    projects=projects,
                    work_experience=work_exp,
                    certifications=certs,
                    achievements=["Dean's Honor List 2023-2024", "1st Place Hacknauts Hackathon 2024"],
                    career_interests=["Software Engineering", "AI Research", "Full-Stack Development"],
                    preferred_opportunity_types=["research", "project", "hackathon", "internship"],
                    portfolio_link="https://arjunmehta.dev",
                    github_link="https://github.com/arjunmehta",
                    linkedin_link="https://linkedin.com/in/arjunmehta",
                    discovery_opt_in=True,
                    updated_at=datetime.utcnow().isoformat(),
                )
                self._save_experience_profiles()

            return self.experience_profiles[uid]

    def update_student_experience_profile(
        self, user_id: str, update_data: StudentExperienceProfileUpdate
    ) -> StudentExperienceProfile:
        uid = self._canonical_uid(user_id)
        current = self.get_student_experience_profile(uid)

        with self._profiles_lock:
            # Enforce academic trust boundary:
            # Verified institutional CGPA cannot be overwritten by student!
            if update_data.education is not None:
                updated_edu = []
                for idx, e in enumerate(update_data.education):
                    # Preserve verified institutional CGPA from authoritative record
                    authoritative_verified = None
                    if idx < len(current.education):
                        authoritative_verified = current.education[idx].cgpa_verified
                    else:
                        authoritative_verified = 8.52 if uid == self.default_user_id else None

                    e_copy = e.model_copy()
                    e_copy.cgpa_verified = authoritative_verified
                    updated_edu.append(e_copy)
                current.education = updated_edu

            if update_data.skills is not None:
                current.skills = [s.strip() for s in update_data.skills if s.strip()]
            if update_data.projects is not None:
                current.projects = update_data.projects
            if update_data.work_experience is not None:
                current.work_experience = update_data.work_experience
            if update_data.certifications is not None:
                current.certifications = update_data.certifications
            if update_data.achievements is not None:
                current.achievements = [a.strip() for a in update_data.achievements if a.strip()]
            if update_data.career_interests is not None:
                current.career_interests = [c.strip() for c in update_data.career_interests if c.strip()]
            if update_data.preferred_opportunity_types is not None:
                current.preferred_opportunity_types = update_data.preferred_opportunity_types
            if update_data.portfolio_link is not None:
                current.portfolio_link = update_data.portfolio_link.strip() if update_data.portfolio_link else None
            if update_data.github_link is not None:
                current.github_link = update_data.github_link.strip() if update_data.github_link else None
            if update_data.linkedin_link is not None:
                current.linkedin_link = update_data.linkedin_link.strip() if update_data.linkedin_link else None
            if update_data.discovery_opt_in is not None:
                current.discovery_opt_in = update_data.discovery_opt_in

            current.updated_at = datetime.utcnow().isoformat()
            self.experience_profiles[uid] = current
            self._save_experience_profiles()
            return current

    def save_student_resume(self, user_id: str, filename: str, content_bytes: bytes) -> Dict[str, Any]:
        uid = self._canonical_uid(user_id)
        user_resume_dir = self._resumes_dir / uid
        user_resume_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"resume_{uuid.uuid4().hex[:6]}.pdf"
        file_path = user_resume_dir / safe_name

        with open(file_path, "wb") as f:
            f.write(content_bytes)

        self.student_resumes[uid] = (filename, content_bytes)
        prof = self.get_student_experience_profile(uid)
        prof.resume_file_id = safe_name
        prof.resume_file_name = filename
        prof.resume_storage_path = str(file_path)
        prof.resume_updated_at = datetime.utcnow().isoformat()
        self._save_experience_profiles()

        return {
            "filename": filename,
            "file_name": filename,
            "size_bytes": len(content_bytes),
            "updated_at": prof.resume_updated_at,
        }

    def get_student_resume(self, user_id: str) -> Optional[Tuple[str, bytes]]:
        uid = self._canonical_uid(user_id)
        if uid in self.student_resumes:
            return self.student_resumes[uid]

        prof = self.get_student_experience_profile(uid)
        if prof.resume_storage_path and os.path.exists(prof.resume_storage_path):
            with open(prof.resume_storage_path, "rb") as f:
                content = f.read()
            self.student_resumes[uid] = (prof.resume_file_name or "resume.pdf", content)
            return self.student_resumes[uid]

        return None

    def delete_student_resume(self, user_id: str) -> bool:
        uid = self._canonical_uid(user_id)
        prof = self.get_student_experience_profile(uid)
        if prof.resume_storage_path and os.path.exists(prof.resume_storage_path):
            try:
                os.unlink(prof.resume_storage_path)
            except Exception:
                pass

        if uid in self.student_resumes:
            del self.student_resumes[uid]

        prof.resume_file_id = None
        prof.resume_file_name = None
        prof.resume_storage_path = None
        prof.resume_updated_at = None
        self._save_experience_profiles()
        return True

    def create_opportunity(self, creator_id: str, creator_role: str, opp_in: OpportunityCreate) -> Opportunity:
        opp_id = f"opp-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.utcnow().isoformat()
        opp = Opportunity(
            id=opp_id,
            title=opp_in.title,
            organization=opp_in.organization,
            mentor_name=opp_in.mentor_name,
            category=opp_in.category,
            description=opp_in.description,
            eligible_branches=opp_in.eligible_branches,
            min_semester=opp_in.min_semester,
            max_semester=opp_in.max_semester,
            graduation_years=opp_in.graduation_years,
            min_cgpa=opp_in.min_cgpa,
            required_skills=opp_in.required_skills,
            required_skills_mode=opp_in.required_skills_mode,
            preferred_skills=opp_in.preferred_skills,
            min_experience_months=opp_in.min_experience_months,
            time_commitment_hrs_week=opp_in.time_commitment_hrs_week,
            location=opp_in.location,
            deadline=opp_in.deadline,
            status="open",
            creator_id=creator_id,
            creator_role=creator_role,
            application_link=opp_in.application_link,
            contact_email=opp_in.contact_email,
            created_at=now_iso,
        )
        self.opportunities[opp_id] = opp
        return opp

    def get_opportunity_candidates(
        self, opportunity_id: str, requester_id: str, requester_role: str
    ) -> CandidateDiscoveryResponse:
        from .services.opportunity_engine import OpportunityEngine
        opp = self.get_opportunity(opportunity_id)
        if not opp:
            raise ValueError(f"Opportunity {opportunity_id} not found")

        # Authorization check: Requester must be creator, opportunity manager, or admin
        is_creator = opp.creator_id == requester_id or opp.creator_id in (requester_id, "admin")
        is_admin = requester_role == "admin"
        is_opp_mgr = requester_role in ("opportunity_manager", "opportunity-manager", "placement_coordinator")
        if not (is_creator or is_admin or is_opp_mgr):
            raise PermissionError("Only the opportunity creator, opportunity manager, or administrator can inspect candidates.")

        # Gather all candidates from student directory & experience profiles
        candidates: List[CandidateMatch] = []
        eligible_count = 0

        # Build list of student user IDs
        student_ids = list(self.academic_rbac.student_directory.keys())
        for sid in (self.default_user_id, "student-user-id", "user-student-1"):
            if sid and sid not in student_ids:
                student_ids.append(sid)

        # Map existing applications for this opportunity
        applied_map = {}
        for s_uid, apps in self.user_applications.items():
            for a in apps:
                if a.opportunity_id == opportunity_id:
                    applied_map[s_uid] = a

        # Check existing invitations
        invited_students = {
            inv.get("student_id")
            for inv in self.opportunity_invitations.get(opportunity_id, [])
        }

        for sid in student_ids:
            prof = self.get_student_experience_profile(sid)
            is_applicant = sid in applied_map

            # Discovery visibility setting:
            # Exclude students who opted out of discovery, unless they specifically applied to this opportunity
            if not prof.discovery_opt_in and not is_applicant:
                continue

            verified_cgpa = 8.52 if sid == self.default_user_id else 7.80
            if prof.education and prof.education[0].cgpa_verified:
                verified_cgpa = prof.education[0].cgpa_verified

            eligibility = OpportunityEngine.evaluate_eligibility(
                profile=prof,
                opportunity=opp,
                verified_cgpa=verified_cgpa,
            )

            if eligibility.status == "ELIGIBLE":
                eligible_count += 1

            has_resume = bool(prof.resume_file_name or self.get_student_resume(sid))
            inv_sent = sid in invited_students
            inv_at = None
            if inv_sent:
                for inv in self.opportunity_invitations.get(opportunity_id, []):
                    if inv.get("student_id") == sid:
                        inv_at = inv.get("created_at")
                        break

            candidates.append(
                CandidateMatch(
                    student_id=sid,
                    student_name=prof.full_name,
                    student_roll_no=prof.roll_no,
                    student_branch=prof.education[0].branch if prof.education else "COE",
                    semester=prof.education[0].semester if prof.education else 5,
                    graduation_year=prof.education[0].graduation_year if prof.education else 2026,
                    cgpa_verified=verified_cgpa,
                    skills=prof.skills,
                    eligibility=eligibility,
                    has_resume=has_resume,
                    is_applicant=is_applicant,
                    application_id=applied_map[sid].id if is_applicant else None,
                    invitation_sent=inv_sent,
                    invitation_sent_at=inv_at,
                )
            )

        # Sort: applicants first, then ELIGIBLE, then by preference_score
        status_rank = {"ELIGIBLE": 0, "INCOMPLETE_PROFILE": 1, "NOT_ELIGIBLE": 2}
        candidates.sort(
            key=lambda c: (
                0 if c.is_applicant else 1,
                status_rank.get(c.eligibility.status, 9),
                -c.eligibility.preference_score,
            )
        )

        return CandidateDiscoveryResponse(
            opportunity_id=opp.id,
            opportunity_title=opp.title,
            total_candidates_evaluated=len(candidates),
            eligible_count=eligible_count,
            candidates=candidates,
        )

    def send_opportunity_invitations(
        self, opportunity_id: str, creator_id: str, student_ids: List[str], message: Optional[str] = None
    ) -> OpportunityInvitationResponse:
        opp = self.get_opportunity(opportunity_id)
        if not opp:
            raise ValueError(f"Opportunity {opportunity_id} not found")

        inv_list = self.opportunity_invitations.setdefault(opportunity_id, [])
        existing_invited = {inv["student_id"] for inv in inv_list}

        invited_now = []
        skipped_now = []
        now_iso = datetime.utcnow().isoformat()

        for sid in student_ids:
            if sid in existing_invited:
                skipped_now.append(sid)
                continue

            inv_entry = {
                "id": f"inv-{uuid.uuid4().hex[:8]}",
                "opportunity_id": opportunity_id,
                "student_id": sid,
                "creator_id": creator_id,
                "message": message or f"You have been invited by {opp.organization} to apply for {opp.title}.",
                "created_at": now_iso,
            }
            inv_list.append(inv_entry)
            invited_now.append(sid)

            # Insert in-app notification in reuse/shared notification center if available
            from .routers.reuse import _in_memory_notifications
            _in_memory_notifications.insert(0, {
                "id": f"notif-inv-{uuid.uuid4().hex[:6]}",
                "user_id": sid,
                "type": "opportunity_invitation",
                "title": f"Invitation: {opp.title}",
                "message": inv_entry["message"],
                "listing_id": opportunity_id,
                "created_at": now_iso,
                "read": False,
            })

        return OpportunityInvitationResponse(
            opportunity_id=opportunity_id,
            invited_count=len(invited_now),
            skipped_count=len(skipped_now),
            student_ids=invited_now,
            message=f"Sent {len(invited_now)} invitations ({len(skipped_now)} skipped as already invited).",
        )

    def get_student_skill_profile(self, user_id: str) -> StudentSkillProfile:
        uid = self._canonical_uid(user_id)
        if uid not in self.user_skill_profiles:
            self.user_skill_profiles[uid] = StudentSkillProfile(
                user_id=uid,
                skills=["Python", "FastAPI", "Next.js", "TypeScript", "Machine Learning"],
                interests=["Research", "Hackathons", "Open Source"],
                opt_in_matching=True,
                available_hours_per_week=10,
                preferred_categories=["research", "project", "hackathon"],
            )
        return self.user_skill_profiles[uid]

    def update_student_skill_profile(self, user_id: str, profile: StudentSkillProfile) -> StudentSkillProfile:
        uid = self._canonical_uid(user_id)
        profile.user_id = uid
        self.user_skill_profiles[uid] = profile
        return profile

    def toggle_save_opportunity(self, user_id: str, opp_id: str) -> bool:
        uid = self._canonical_uid(user_id)
        saved = self.user_saved_opportunities.setdefault(uid, [])
        if opp_id in saved:
            saved.remove(opp_id)
            return False
        else:
            saved.append(opp_id)
            return True

    def get_saved_opportunities(self, user_id: str) -> List[Opportunity]:
        uid = self._canonical_uid(user_id)
        saved_ids = self.user_saved_opportunities.get(uid, [])
        return [self.opportunities[oid] for oid in saved_ids if oid in self.opportunities]

    def apply_to_opportunity(
        self,
        user_id: str,
        opp_id: str,
        application_in: Optional[OpportunityApplicationCreate] = None,
    ) -> OpportunityApplication:
        uid = self._canonical_uid(user_id)
        opp = self.opportunities.get(opp_id)
        if not opp:
            raise ValueError(f"Opportunity {opp_id} not found")

        apps = self.user_applications.setdefault(uid, [])
        for a in apps:
            if a.opportunity_id == opp_id:
                raise ValueError("You have already applied to this opportunity")

        stmt = (
            application_in.statement_of_interest.strip()
            if application_in and application_in.statement_of_interest
            else f"Interested in contributing to {opp.title} at {opp.organization}."
        )
        hrs = (
            application_in.available_hours_per_week
            if application_in and application_in.available_hours_per_week
            else opp.time_commitment_hrs_week
        )

        app = OpportunityApplication(
            id=f"app-{uuid.uuid4().hex[:8]}",
            opportunity_id=opp.id,
            opportunity_title=opp.title,
            organization=opp.organization,
            user_id=uid,
            student_name="Arjun Mehta",
            student_roll_no="102203099",
            student_branch="COE",
            statement_of_interest=stmt,
            available_hours_per_week=hrs,
            applied_at=datetime.utcnow().isoformat(),
            status="submitted",
        )
        apps.append(app)
        return app

    def get_student_applications(self, user_id: str) -> List[OpportunityApplication]:
        uid = self._canonical_uid(user_id)
        return list(self.user_applications.get(uid, []))

    def _seed_sample_data(self):
        # 1. Seed realistic Thapar Courses for 5th Semester COE (Computer Engineering)
        sample_courses = [
            Course(
                id="c1",
                course_code="UCS301",
                course_name="Data Structures & Algorithms",
                credits=4.5,
                grade="A-",
                target_grade="A",
                semester=5
            ),
            Course(
                id="c2",
                course_code="UCS310",
                course_name="Database Management Systems",
                credits=4.0,
                grade="B",
                target_grade="A-",
                semester=5
            ),
            Course(
                id="c3",
                course_code="UCS405",
                course_name="Operating Systems",
                credits=4.0,
                grade=None,
                target_grade="B+",
                semester=5
            ),
            Course(
                id="c4",
                course_code="UMA010",
                course_name="Mathematics - III",
                credits=3.5,
                grade=None,
                target_grade="B",
                semester=5
            ),
            Course(
                id="c5",
                course_code="UED101",
                course_name="Engineering Design Project - I",
                credits=3.0,
                grade=None,
                target_grade="A",
                semester=5
            ),
        ]
        for c in sample_courses:
            self.courses[c.id] = c

        # 2. Seed Attendance records (Notice: UCS405 is at 72.0% - Warning Zone!)
        # UCS301: 36 / 40 = 90.0% (Safe, safe bunks = 8)
        # UCS310: 25 / 32 = 78.1% (Safe, safe bunks = 1)
        # UCS405: 18 / 25 = 72.0% (Warning zone: needs 3 consecutive to reach 75%)
        # UMA010: 17 / 28 = 60.7% (Critical alert: below 65% condonable cutoff!)
        # UED101: 19 / 20 = 95.0% (Safe)
        attendance_seeds = [
            ("c1", "UCS301", "Data Structures & Algorithms", 36, 40),
            ("c2", "UCS310", "Database Management Systems", 25, 32),
            ("c3", "UCS405", "Operating Systems", 18, 25),
            ("c4", "UMA010", "Mathematics - III", 17, 28),
            ("c5", "UED101", "Engineering Design Project - I", 19, 20),
        ]
        for cid, code, name, attended, total in attendance_seeds:
            pct, status, safe_bunks, needed = WhatIfEngine.calculate_attendance_status(attended, total)
            rec = AttendanceRecord(
                id=f"att-{code}",
                course_code=code,
                course_name=name,
                attended_classes=attended,
                total_classes=total,
                percentage=pct,
                status=status,
                safe_bunks=safe_bunks,
                classes_needed_for_75=needed,
            )
            self.attendance[code] = rec

        # 3. Seed Timetable Schedule
        self.timetable = [
            TimetableSlot(
                id="tt-1",
                course_code="UCS301",
                course_name="Data Structures & Algorithms",
                day_of_week="Monday",
                start_time="09:00",
                end_time="09:50",
                venue="LT202",
                slot_type="Lecture"
            ),
            TimetableSlot(
                id="tt-2",
                course_code="UCS405",
                course_name="Operating Systems",
                day_of_week="Monday",
                start_time="10:00",
                end_time="11:40",
                venue="LP105",
                slot_type="Lecture"
            ),
            TimetableSlot(
                id="tt-3",
                course_code="UCS301",
                course_name="DSA Lab",
                day_of_week="Monday",
                start_time="14:00",
                end_time="15:40",
                venue="C-Hall Lab 4",
                slot_type="Lab"
            ),
            TimetableSlot(
                id="tt-4",
                course_code="UCS310",
                course_name="DBMS",
                day_of_week="Tuesday",
                start_time="09:00",
                end_time="09:50",
                venue="LP201",
                slot_type="Lecture"
            ),
            TimetableSlot(
                id="tt-5",
                course_code="UMA010",
                course_name="Mathematics - III",
                day_of_week="Tuesday",
                start_time="11:00",
                end_time="11:50",
                venue="LT101",
                slot_type="Lecture"
            ),
            TimetableSlot(
                id="tt-6",
                course_code="UED101",
                course_name="Engineering Design Project",
                day_of_week="Wednesday",
                start_time="14:00",
                end_time="16:30",
                venue="Nirman Workshop",
                slot_type="Lab"
            ),
        ]

        # 4. Seed Deadlines & Academic Tasks (Dynamic relative dates)
        today = date.today()
        self.deadlines = [
            DeadlineTask(
                id="dl-1",
                title="UCS301 Assignment 3: Red-Black Trees Implementation",
                course_code="UCS301",
                due_date=(today + timedelta(days=3)).strftime("%Y-%m-%d"),
                status="pending",
                priority="high",
                source="syllabus"
            ),
            DeadlineTask(
                id="dl-2",
                title="DBMS Mid-Term Project Phase 1 Report",
                course_code="UCS310",
                due_date=(today + timedelta(days=7)).strftime("%Y-%m-%d"),
                status="pending",
                priority="medium",
                source="manual"
            ),
            DeadlineTask(
                id="dl-3",
                title="Mathematics Tutorial Sheet 4 Submission",
                course_code="UMA010",
                due_date=(today - timedelta(days=2)).strftime("%Y-%m-%d"),
                status="completed",
                priority="low",
                source="manual"
            ),
        ]

        # 5. Seed Digital Vault Documents
        self.vault_docs = {
            "v1": VaultDocument(
                id="v1",
                title="TIET 1st Year Grade Transcript (Sem 1 & 2)",
                category="marksheets",
                tags=["grades", "transcript", "first-year"],
                file_size_bytes=428000,
                mime_type="application/pdf",
                storage_path="vault-private/user_102203099/transcript_sem1_2.pdf",
                download_url="/api/vault/download/v1",
                created_at="2024-08-10T11:20:00"
            ),
            "v2": VaultDocument(
                id="v2",
                title="Odd Semester 2024 Tuition Fee Receipt",
                category="receipts",
                tags=["fees", "accounts", "odd-sem-2024"],
                file_size_bytes=184000,
                mime_type="application/pdf",
                storage_path="vault-private/user_102203099/fee_receipt_jul2024.pdf",
                download_url="/api/vault/download/v2",
                created_at="2024-07-28T14:45:00"
            ),
            "v3": VaultDocument(
                id="v3",
                title="HackThapar 2024 1st Runner Up Certificate",
                category="certificates",
                tags=["hackathon", "certificate", "coding"],
                file_size_bytes=950000,
                mime_type="application/pdf",
                storage_path="vault-private/user_102203099/hackthapar_cert.pdf",
                download_url="/api/vault/download/v3",
                created_at="2024-04-12T19:00:00"
            ),
            "v4": VaultDocument(
                id="v4",
                title="TIET Student ID Card & Library Barcode Copy",
                category="identity",
                tags=["id-card", "roll-102203099"],
                file_size_bytes=312000,
                mime_type="image/jpeg",
                storage_path="vault-private/user_102203099/student_id.jpg",
                download_url="/api/vault/download/v4",
                created_at="2024-08-05T09:15:00"
            ),
        }

        # 6. Seed Campus Reuse Items (with completed items to show initial impact)
        self.reuse_items = {
            "r1": ReuseItem(
                id="r1",
                user_name="Aman Sharma",
                title="Casio FX-991EX ClassWiz Scientific Calculator",
                description="Allowed in Mathematics and EE mid/end-sem exams. Solar + battery working perfectly.",
                category="electronics",
                listing_type="donate",
                condition="good",
                estimated_retail_price=1450.0,
                estimated_weight_kg=0.25,
                contact_info="Hostel J, Room 312 | WhatsApp: 9876543210",
                status="available",
                created_at="2024-11-10T12:00:00"
            ),
            "r2": ReuseItem(
                id="r2",
                user_name="Simran Kaur",
                title="Engineering Chemistry White Lab Coat (Size M)",
                description="Washed, clean, no stains. Required for 1st/2nd year Chemistry and Environmental Science labs.",
                category="lab_gear",
                listing_type="donate",
                condition="like_new",
                estimated_retail_price=450.0,
                estimated_weight_kg=0.40,
                contact_info="Hostel PG, Room 108",
                status="available",
                created_at="2024-11-11T16:30:00"
            ),
            "r3": ReuseItem(
                id="r3",
                user_name="Kabir Mehta",
                title="Operating System Concepts (Galvin, 10th Ed) Hardcover",
                description="UCS405 textbook. Contains sticky notes on paging and virtual memory chapters.",
                category="books",
                listing_type="exchange",
                condition="good",
                estimated_retail_price=950.0,
                estimated_weight_kg=1.40,
                contact_info="Hostel B, Room 415 | Looking for Cormen DSA in exchange",
                status="available",
                created_at="2024-11-12T10:15:00"
            ),
            "r4": ReuseItem(
                id="r4",
                user_name="Rohan Verma",
                title="Bajaj 1.2L Electric Kettle for Hostel",
                description="Working condition with auto cut-off. Warden approved with hostel seal.",
                category="hostel_essentials",
                listing_type="borrow",
                condition="good",
                estimated_retail_price=1200.0,
                estimated_weight_kg=0.90,
                contact_info="Hostel M, Room 120 | For borrow during MST/EST week",
                status="available",
                created_at="2024-11-13T14:20:00"
            ),
            # Completed historical exchanges for Impact tracking:
            "r5": ReuseItem(
                id="r5",
                user_name="Deepak Joshi",
                title="Omega Mini Drafter & Sheet Container for ED",
                description="Engineering Drawing mini-drafter with steel scale clamps.",
                category="lab_gear",
                listing_type="donate",
                condition="good",
                estimated_retail_price=650.0,
                estimated_weight_kg=0.85,
                contact_info="Hostel H",
                status="completed",
                completed_at="2024-11-05T18:00:00",
                created_at="2024-11-01T10:00:00"
            ),
            "r6": ReuseItem(
                id="r6",
                user_name="Pooja Aggarwal",
                title="Introduction to Algorithms (CLRS 3rd Edition)",
                description="UCS301 reference book, all chapters intact.",
                category="books",
                listing_type="donate",
                condition="good",
                estimated_retail_price=1250.0,
                estimated_weight_kg=1.80,
                contact_info="Hostel N",
                status="completed",
                completed_at="2024-11-07T14:00:00",
                created_at="2024-11-02T11:00:00"
            ),
            "r7": ReuseItem(
                id="r7",
                user_name="Gaurav Singla",
                title="Hero Sprint Single-Speed Campus Bicycle",
                description="Campus commute bicycle with basket and lock. Given to junior.",
                category="hostel_essentials",
                listing_type="donate",
                condition="fair",
                estimated_retail_price=4500.0,
                estimated_weight_kg=14.50,
                contact_info="Hostel K",
                status="completed",
                completed_at="2024-11-09T17:30:00",
                created_at="2024-11-03T16:00:00"
            ),
        }

        # 6. Seed Realistic TIET Opportunities
        self.opportunities = {
            "opp-1": Opportunity(
                id="opp-1",
                title="ML Research Assistant: Edge AI & Autonomous Robotics",
                organization="TIET AI & Robotics Center",
                mentor_name="Dr. Rajesh Kumar",
                category="research",
                description="Investigating real-time visual perception and deep neural network quantization for edge robotics.",
                eligible_branches=["COE", "CSE", "ECE", "ENC"],
                min_semester=3,
                max_semester=8,
                graduation_years=[2025, 2026, 2027],
                required_skills=["Python", "Machine Learning"],
                required_skills_mode="all",
                preferred_skills=["PyTorch", "Docker"],
                min_cgpa=8.0,
                time_commitment_hrs_week=8,
                location="TIET STEP Lab 2",
                schedule_requirement="Flexible weekday hours",
                deadline="2026-12-15",
                status="open",
                creator_id="prof-rajesh-kumar-id",
                creator_role="professor",
                application_link="https://tiet.ac.in/research/ai-lab",
                contact_email="rajesh.kumar@thapar.edu",
                created_at="2026-11-01T10:00:00",
            ),
            "opp-2": Opportunity(
                id="opp-2",
                title="Next.js Full-Stack Developer: Campus Sustainability Portal",
                organization="Thapar Venture Club & CSED",
                mentor_name="Student Incubator Lead",
                category="project",
                description="Building client-facing portals and carbon accounting tools for TIET's Green Campus initiative.",
                eligible_branches=["COE", "CSE", "Any"],
                min_semester=3,
                graduation_years=[2025, 2026, 2027],
                required_skills=["Next.js", "TypeScript"],
                required_skills_mode="any",
                preferred_skills=["Tailwind CSS", "FastAPI"],
                min_cgpa=7.0,
                time_commitment_hrs_week=6,
                location="CSED Project Studio / Remote",
                schedule_requirement="Weekends",
                deadline="2026-12-05",
                status="open",
                creator_id="opp-manager-tiet-id",
                creator_role="opportunity_manager",
                application_link="https://tiet.ac.in/venture-club/portal",
                contact_email="venture.club@thapar.edu",
                created_at="2026-11-03T12:00:00",
            ),
            "opp-3": Opportunity(
                id="opp-3",
                title="TIET ACM Student Chapter Hackathon Tech Lead",
                organization="ACM Student Chapter TIET",
                mentor_name="Dr. Seema Bawa",
                category="hackathon",
                description="Lead API architecture and judge submission review pipeline for the annual Thapar Hackathon.",
                eligible_branches=["COE", "CSE", "ENC"],
                min_semester=3,
                max_semester=7,
                graduation_years=[2026, 2027],
                required_skills=["Python", "FastAPI"],
                required_skills_mode="all",
                preferred_skills=["Git"],
                min_cgpa=7.5,
                time_commitment_hrs_week=10,
                location="TIET Auditorium Annex",
                schedule_requirement="Friday afternoons (14:00 - 18:00)",
                deadline="2026-11-30",
                status="open",
                creator_id="opp-manager-tiet-id",
                creator_role="opportunity_manager",
                application_link="https://acmthapar.org/hackathon-team",
                contact_email="acm@thapar.edu",
                created_at="2026-11-05T09:00:00",
            ),
            "opp-4": Opportunity(
                id="opp-4",
                title="Embedded Systems Researcher: IoT Smart Campus Sensors",
                organization="ECED Embedded Systems Group",
                mentor_name="Dr. Alpana Agarwal",
                category="research",
                description="Deploying LoRaWAN air quality and acoustic sensors across hostels and lecture halls.",
                eligible_branches=["ECE", "ENC", "COE"],
                min_semester=4,
                required_skills=["C++", "Embedded Systems"],
                required_skills_mode="any",
                preferred_skills=["Arduino"],
                min_cgpa=7.0,
                time_commitment_hrs_week=12,
                location="C-Hall Lab 4",
                schedule_requirement="Mon/Wed 17:00-19:00",
                deadline="2026-12-10",
                status="open",
                creator_id="opp-manager-tiet-id",
                creator_role="opportunity_manager",
                application_link="https://tiet.ac.in/eced/iot",
                contact_email="alpana.agarwal@thapar.edu",
                created_at="2026-11-02T11:00:00",
            ),
            "opp-5": Opportunity(
                id="opp-5",
                title="Peer Tutor: Data Structures & Algorithms (UCS301)",
                organization="Academic Tutoring Cell & DOAA",
                mentor_name="Academic Support Coordinator",
                category="tutoring",
                description="Conducting evening doubt clearance sessions for junior students in binary search trees and dynamic programming.",
                required_skills=["C++", "Data Structures", "Algorithms"],
                preferred_branches=["COE", "CSE"],
                min_cgpa=8.5,
                time_commitment_hrs_week=4,
                location="Central Library Discussion Room",
                schedule_requirement="Flexible evening slots",
                deadline="2026-12-20",
                status="open",
                application_link="https://tiet.ac.in/doaa/peer-tutoring",
                contact_email="tutoring.cell@thapar.edu",
                created_at="2026-11-08T15:00:00",
            ),
        }

        # 7. Seed Default Student Skill Profile
        self.user_skill_profiles[self.default_user_id] = StudentSkillProfile(
            user_id=self.default_user_id,
            skills=["Python", "FastAPI", "Next.js", "TypeScript", "Machine Learning"],
            interests=["Research", "Hackathons", "Open Source"],
            opt_in_matching=True,
            available_hours_per_week=10,
            preferred_categories=["research", "project", "hackathon"],
        )

db = CampusOSDatabase()
