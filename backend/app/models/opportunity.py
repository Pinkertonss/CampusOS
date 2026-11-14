from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


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


class Opportunity(BaseModel):
    id: str
    title: str
    organization: str
    mentor_name: Optional[str] = None
    category: str  # "research" | "hackathon" | "project" | "club" | "tutoring"
    description: str
    required_skills: List[str]
    preferred_branches: List[str] = Field(default_factory=lambda: ["COE", "CSE", "ECE", "ENC", "Any"])
    min_cgpa: Optional[float] = None
    time_commitment_hrs_week: int = 5
    location: str
    schedule_requirement: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "open"  # "open" | "closed"
    application_link: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: str


class OpportunityRecommendation(BaseModel):
    opportunity: Opportunity
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


class OpportunityApplicationCreate(BaseModel):
    statement_of_interest: Optional[str] = None
    available_hours_per_week: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


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

