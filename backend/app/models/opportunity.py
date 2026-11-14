from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ============================================================
# 1. Student Experience Profile Models
# ============================================================

class EducationEntry(BaseModel):
    id: Optional[str] = None
    program: str = "Bachelor of Engineering"
    branch: str = "COE"
    semester: int = 5
    graduation_year: int = 2026
    cgpa_verified: Optional[float] = None  # Read-only; populated strictly from institutional records
    student_entered_cgpa: Optional[float] = None
    institution: str = "Thapar Institute of Engineering & Technology"


class ProjectEntry(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    technologies: List[str] = Field(default_factory=list)
    role: str = "Lead Developer"
    link: Optional[str] = None


class WorkExperienceEntry(BaseModel):
    id: Optional[str] = None
    role: str
    company: str
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    is_current: bool = False
    description: str = ""


class CertificationEntry(BaseModel):
    id: Optional[str] = None
    title: str
    issuer: str
    issue_date: str
    credential_url: Optional[str] = None


class StudentExperienceProfile(BaseModel):
    user_id: str
    full_name: str = "Arjun Mehta"
    roll_no: str = "102203099"
    email: str = "amehta_be22@thapar.edu"
    education: List[EducationEntry] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    projects: List[ProjectEntry] = Field(default_factory=list)
    work_experience: List[WorkExperienceEntry] = Field(default_factory=list)
    certifications: List[CertificationEntry] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    career_interests: List[str] = Field(default_factory=list)
    preferred_opportunity_types: List[str] = Field(default_factory=list)
    portfolio_link: Optional[str] = None
    github_link: Optional[str] = None
    linkedin_link: Optional[str] = None
    resume_file_id: Optional[str] = None
    resume_file_name: Optional[str] = None
    resume_storage_path: Optional[str] = None
    resume_updated_at: Optional[str] = None
    discovery_opt_in: bool = True  # Controls candidate discovery by opportunity creators
    resume_sharing_opt_in: bool = False  # Controls explicit resume sharing with discovered opportunities
    updated_at: Optional[str] = None


class StudentExperienceProfileUpdate(BaseModel):
    education: Optional[List[EducationEntry]] = None
    skills: Optional[List[str]] = None
    projects: Optional[List[ProjectEntry]] = None
    work_experience: Optional[List[WorkExperienceEntry]] = None
    certifications: Optional[List[CertificationEntry]] = None
    achievements: Optional[List[str]] = None
    career_interests: Optional[List[str]] = None
    preferred_opportunity_types: Optional[List[str]] = None
    portfolio_link: Optional[str] = None
    github_link: Optional[str] = None
    linkedin_link: Optional[str] = None
    discovery_opt_in: Optional[bool] = None
    resume_sharing_opt_in: Optional[bool] = None


# Backward-compatibility alias
class StudentSkillProfile(BaseModel):
    user_id: str
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    opt_in_matching: bool = True
    available_hours_per_week: int = 10
    preferred_categories: List[str] = Field(default_factory=list)


class StudentSkillProfileUpdate(BaseModel):
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    opt_in_matching: Optional[bool] = None
    available_hours_per_week: Optional[int] = None
    preferred_categories: Optional[List[str]] = None


# ============================================================
# 2. Opportunity & Structured Criteria Models
# ============================================================

class OpportunityCreate(BaseModel):
    title: str
    organization: str
    mentor_name: Optional[str] = None
    category: str = "research"  # "research" | "hackathon" | "project" | "club" | "tutoring"
    description: str
    eligible_branches: List[str] = Field(default_factory=lambda: ["Any"])
    min_semester: Optional[int] = None
    max_semester: Optional[int] = None
    graduation_years: Optional[List[int]] = None
    min_cgpa: Optional[float] = None
    required_skills: List[str] = Field(default_factory=list)
    required_skills_mode: str = "any"  # "all" | "any"
    preferred_skills: List[str] = Field(default_factory=list)
    preferred_qualifications: List[str] = Field(default_factory=list)
    min_experience_months: Optional[int] = 0
    time_commitment_hrs_week: int = 5
    location: str = "TIET Campus"
    deadline: Optional[str] = None
    application_deadline: Optional[str] = None
    role_type: Optional[str] = None
    stipend: Optional[str] = None
    criteria: Optional[Dict[str, Any]] = None
    application_link: Optional[str] = None
    contact_email: Optional[str] = None


class OpportunityUpdate(BaseModel):
    title: Optional[str] = None
    organization: Optional[str] = None
    mentor_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    eligible_branches: Optional[List[str]] = None
    min_semester: Optional[int] = None
    max_semester: Optional[int] = None
    graduation_years: Optional[List[int]] = None
    min_cgpa: Optional[float] = None
    required_skills: Optional[List[str]] = None
    required_skills_mode: Optional[str] = None
    preferred_skills: Optional[List[str]] = None
    preferred_qualifications: Optional[List[str]] = None
    min_experience_months: Optional[int] = None
    time_commitment_hrs_week: Optional[int] = None
    location: Optional[str] = None
    deadline: Optional[str] = None
    application_deadline: Optional[str] = None
    role_type: Optional[str] = None
    stipend: Optional[str] = None
    criteria: Optional[Dict[str, Any]] = None
    status: Optional[str] = None  # "open", "closed", "archived"
    application_link: Optional[str] = None
    contact_email: Optional[str] = None


class Opportunity(BaseModel):
    id: str
    title: str
    organization: str
    mentor_name: Optional[str] = None
    category: str
    description: str
    eligible_branches: List[str] = Field(default_factory=lambda: ["Any"])
    min_semester: Optional[int] = None
    max_semester: Optional[int] = None
    graduation_years: Optional[List[int]] = None
    min_cgpa: Optional[float] = None
    required_skills: List[str] = Field(default_factory=list)
    required_skills_mode: str = "any"  # "all" | "any"
    preferred_skills: List[str] = Field(default_factory=list)
    preferred_qualifications: List[str] = Field(default_factory=list)
    min_experience_months: Optional[int] = 0
    time_commitment_hrs_week: int = 5
    location: str = "TIET Campus"
    role_type: Optional[str] = None
    stipend: Optional[str] = None
    criteria: Optional[Dict[str, Any]] = None
    schedule_requirement: Optional[str] = None
    deadline: Optional[str] = None
    application_deadline: Optional[str] = None
    status: str = "open"  # "open" | "closed" | "archived"
    creator_id: str = "admin"
    creator_role: str = "admin"
    application_link: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: str


# ============================================================
# 3. Deterministic Eligibility & Matching Models
# ============================================================

class OpportunityEligibility(BaseModel):
    status: str  # "ELIGIBLE" | "NOT_ELIGIBLE" | "INCOMPLETE_PROFILE"
    mandatory_passed: bool = True
    reasons: List[str] = Field(default_factory=list)
    missing_requirements: List[str] = Field(default_factory=list)
    missing_profile_fields: List[str] = Field(default_factory=list)
    matched_mandatory_skills: List[str] = Field(default_factory=list)
    missing_mandatory_skills: List[str] = Field(default_factory=list)
    matched_preferred_skills: List[str] = Field(default_factory=list)
    missing_preferred_skills: List[str] = Field(default_factory=list)
    preference_score: float = 0.0  # 0 to 100 based on preferred skills and categories
    explanation: str
    manual_review_required: bool = False


class OpportunityRecommendation(BaseModel):
    opportunity: Opportunity
    eligibility: OpportunityEligibility
    match_score: float
    skill_match_percent: float
    matched_skills: List[str]
    missing_skills: List[str]
    schedule_compatible: bool
    schedule_collision_warning: Optional[str] = None
    academic_advisory: Optional[str] = None
    recommendation_reason: str


class OpportunityRecommendationResponse(BaseModel):
    student_id: str
    total_evaluated: int
    recommendations: List[OpportunityRecommendation]
    student_skills: List[str]
    opt_in_matching: bool


# ============================================================
# 4. Applications & Creator Discovery Models
# ============================================================

class OpportunityApplicationCreate(BaseModel):
    statement_of_interest: Optional[str] = None
    available_hours_per_week: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    share_resume_with_reviewers: bool = True


class OpportunityApplication(BaseModel):
    id: str
    opportunity_id: str
    opportunity_title: str
    organization: str
    user_id: str
    student_name: str
    student_roll_no: str
    student_branch: str
    statement_of_interest: str
    available_hours_per_week: int
    applied_at: str
    status: str = "submitted"  # "submitted" | "under_review" | "shortlisted" | "accepted"
    share_resume_with_reviewers: bool = True


class CandidateMatch(BaseModel):
    student_id: str
    student_name: str
    student_roll_no: str
    student_branch: str
    semester: int
    graduation_year: Optional[int] = None
    cgpa_verified: Optional[float] = None
    skills: List[str] = Field(default_factory=list)
    eligibility: OpportunityEligibility
    has_resume: bool = False
    resume_sharing_opt_in: bool = False
    is_applicant: bool = False
    application_id: Optional[str] = None
    invitation_sent: bool = False
    invitation_sent_at: Optional[str] = None


class CandidateDiscoveryResponse(BaseModel):
    opportunity_id: str
    opportunity_title: str
    total_candidates_evaluated: int
    eligible_count: int
    not_eligible_count: int = 0
    incomplete_profile_count: int = 0
    manual_review_count: int = 0
    candidates: List[CandidateMatch]


class OpportunityInvitationRequest(BaseModel):
    student_ids: List[str] = Field(default_factory=list)
    candidate_ids: Optional[List[str]] = None
    message: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.student_ids and self.candidate_ids:
            self.student_ids = list(self.candidate_ids)


class OpportunityInvitationResponse(BaseModel):
    opportunity_id: str
    invited_count: int
    skipped_count: int
    student_ids: List[str]
    message: str
