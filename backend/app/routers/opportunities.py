from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..core.auth import get_current_user_id
from ..database import db
from ..models.opportunity import (
    Opportunity,
    OpportunityRecommendationResponse,
    StudentSkillProfile,
    StudentSkillProfileUpdate,
)
from ..services.opportunity_engine import OpportunityEngine
from ..services.planner import AttendanceEngine

router = APIRouter(prefix="/api/opportunities", tags=["Opportunity Matching"])
public_router = APIRouter(prefix="/opportunities", tags=["Opportunity Matching Engine"])


def _get_student_academic_data(user_id: str):
    courses = db.get_courses(user_id)
    attendance_records = db.get_attendance(user_id)
    timetable = db.get_timetable(user_id)

    att_by_code = {}
    for rec in attendance_records:
        att_by_code[rec.course_code.upper().strip()] = rec
        if hasattr(rec, "course_id") and rec.course_id:
            att_by_code[rec.course_id] = rec
        if hasattr(rec, "id") and rec.id:
            att_by_code[rec.id] = rec

    courses_att = []
    for c in courses:
        code = c.course_code.upper().strip()
        cid = c.id
        att_entry = att_by_code.get(cid) or att_by_code.get(code)
        if att_entry:
            a = att_entry.attended_classes
            t = att_entry.total_classes
        else:
            a, t = 0, 0

        courses_att.append({
            "course_code": c.course_code,
            "course_name": c.course_name,
            "attended_classes": a,
            "total_classes": t,
        })

    timetable_list = [
        {
            "id": s.id,
            "course_code": s.course_code,
            "course_name": s.course_name,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "venue": s.venue,
            "slot_type": s.slot_type,
        }
        for s in timetable
    ]

    return courses_att, timetable_list


# ============================================================
# 1. Opportunities Feed (Public / Filtered)
# ============================================================

@public_router.get("", response_model=List[Opportunity])
@router.get("", response_model=List[Opportunity])
def list_opportunities(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by keyword in title or description"),
):
    """
    Returns verified on-campus and research opportunities at TIET.
    """
    opps = db.get_opportunities()
    if category:
        opps = [o for o in opps if o.category.lower() == category.lower()]
    if search:
        q = search.lower()
        opps = [
            o for o in opps
            if q in o.title.lower() or q in o.description.lower() or any(q in s.lower() for s in o.required_skills)
        ]
    return opps


# ============================================================
# 2. Personalized Smart Matching Engine
# ============================================================

@public_router.get("/recommended", response_model=OpportunityRecommendationResponse)
@router.get("/recommended", response_model=OpportunityRecommendationResponse)
def get_recommended_opportunities(user_id: str = Depends(get_current_user_id)):
    """
    Matches student skills, timetable schedule, and attendance risk to deliver
    personalized opportunity recommendations with explicit explanations.
    """
    profile = db.get_student_skill_profile(user_id)
    all_opps = db.get_opportunities()
    courses_att, timetable = _get_student_academic_data(user_id)

    recommendations = OpportunityEngine.match_opportunities(
        profile=profile,
        opportunities=all_opps,
        courses_attendance=courses_att,
        timetable=timetable,
        student_branch="COE",
    )

    return OpportunityRecommendationResponse(
        student_id=user_id,
        total_evaluated=len(all_opps),
        recommendations=recommendations,
        student_skills=profile.skills,
        opt_in_matching=profile.opt_in_matching,
    )


# ============================================================
# 3. Student Skill Profile Management
# ============================================================

@public_router.get("/profile", response_model=StudentSkillProfile)
@router.get("/profile", response_model=StudentSkillProfile)
def get_student_profile(user_id: str = Depends(get_current_user_id)):
    """
    Returns student's opt-in skill tags, interests, and availability settings.
    """
    return db.get_student_skill_profile(user_id)


@public_router.put("/profile", response_model=StudentSkillProfile)
@router.put("/profile", response_model=StudentSkillProfile)
@public_router.post("/profile", response_model=StudentSkillProfile)
@router.post("/profile", response_model=StudentSkillProfile)
def update_student_profile(
    update_data: StudentSkillProfileUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """
    Updates student's skill profile for opportunity matching.
    """
    profile = db.get_student_skill_profile(user_id)
    if update_data.skills is not None:
        profile.skills = [s.strip() for s in update_data.skills if s.strip()]
    if update_data.interests is not None:
        profile.interests = [i.strip() for i in update_data.interests if i.strip()]
    if update_data.opt_in_matching is not None:
        profile.opt_in_matching = update_data.opt_in_matching
    if update_data.available_hours_per_week is not None:
        profile.available_hours_per_week = max(1, min(40, update_data.available_hours_per_week))
    if update_data.preferred_categories is not None:
        profile.preferred_categories = update_data.preferred_categories

    return db.update_student_skill_profile(user_id, profile)


# ============================================================
# 4. Save / Bookmark Opportunities
# ============================================================

@public_router.post("/{opportunity_id}/save")
@router.post("/{opportunity_id}/save")
def toggle_save_opportunity(
    opportunity_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Toggles saved/bookmarked status of an opportunity for the student.
    """
    opp = db.get_opportunity(opportunity_id)
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Opportunity {opportunity_id} not found",
        )

    saved = db.toggle_save_opportunity(user_id, opportunity_id)
    return {
        "opportunity_id": opportunity_id,
        "saved": saved,
        "message": "Opportunity saved" if saved else "Opportunity removed from saved",
    }


@public_router.get("/saved", response_model=List[Opportunity])
@router.get("/saved", response_model=List[Opportunity])
def get_saved_opportunities(user_id: str = Depends(get_current_user_id)):
    """
    Returns opportunities bookmarked by the student.
    """
    return db.get_saved_opportunities(user_id)
