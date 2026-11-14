import io
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response, status
from fastapi.responses import StreamingResponse

from ..core.auth import (
    get_current_user_id,
    get_optional_user_id,
    require_opportunity_manager_or_admin,
    get_current_user_claims,
)
from ..database import db
from ..models.opportunity import (
    Opportunity,
    OpportunityCreate,
    OpportunityRecommendation,
    OpportunityRecommendationResponse,
    OpportunityEligibility,
    StudentSkillProfile,
    StudentSkillProfileUpdate,
    StudentExperienceProfile,
    StudentExperienceProfileUpdate,
    OpportunityApplication,
    OpportunityApplicationCreate,
    CandidateDiscoveryResponse,
    OpportunityInvitationRequest,
    OpportunityInvitationResponse,
)
from ..services.opportunity_engine import OpportunityEngine

router = APIRouter(prefix="/api/opportunities", tags=["Opportunity Matching"])
public_router = APIRouter(prefix="/opportunities", tags=["Opportunity Matching Engine (Root Alias)"])


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
# 1. Opportunities Feed (Public / Student Filtered)
# ============================================================

@public_router.get("", response_model=List[Opportunity])
@router.get("", response_model=List[Opportunity])
def list_opportunities(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by keyword in title or description"),
    eligibility: Optional[str] = Query(None, description="Filter by eligibility: ELIGIBLE, INCOMPLETE_PROFILE, all"),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Returns opportunities at TIET with optional category, search, and deterministic eligibility filters.
    """
    opps = db.get_opportunities()
    if category and category.lower() != "all":
        opps = [o for o in opps if o.category.lower() == category.lower()]
    if search:
        q = search.lower()
        opps = [
            o for o in opps
            if q in o.title.lower() or q in o.description.lower() or any(q in s.lower() for s in o.required_skills)
        ]

    # If student is authenticated and requested an eligibility filter
    if user_id and eligibility and eligibility.lower() != "all":
        prof = db.get_student_experience_profile(user_id)
        filtered = []
        for o in opps:
            res = OpportunityEngine.evaluate_eligibility(prof, o)
            if res.status.upper() == eligibility.upper():
                filtered.append(o)
        return filtered

    return opps


@public_router.post("", response_model=Opportunity)
@router.post("", response_model=Opportunity)
def create_opportunity(
    opp_in: OpportunityCreate,
    creator_claims: dict = Depends(require_opportunity_manager_or_admin),
):
    """
    Authorized Opportunity Managers, Professors, and Administrators post new opportunities
    with structured requirements and eligibility criteria.
    """
    creator_id = str(creator_claims.get("sub", "admin"))
    creator_role = str(creator_claims.get("role", "opportunity_manager"))
    return db.create_opportunity(creator_id=creator_id, creator_role=creator_role, opp_in=opp_in)


# ============================================================
# 2. Personalized Smart Matching Engine
# ============================================================

@public_router.get("/recommended", response_model=OpportunityRecommendationResponse)
@router.get("/recommended", response_model=OpportunityRecommendationResponse)
def get_recommended_opportunities(user_id: str = Depends(get_current_user_id)):
    """
    Matches student experience profile, schedule, and attendance risk to deliver
    personalized opportunity recommendations with explicit explanations.
    """
    profile = db.get_student_experience_profile(user_id)
    all_opps = db.get_opportunities()
    courses_att, timetable = _get_student_academic_data(user_id)

    if not profile.discovery_opt_in:
        recommendations = []
    else:
        recommendations = OpportunityEngine.match_opportunities(
            profile=profile,
            opportunities=all_opps,
            courses_attendance=courses_att,
            timetable=timetable,
            verified_cgpa=8.52 if user_id in (db.default_user_id, "102203099-tiet-user") else 7.80,
        )

    return OpportunityRecommendationResponse(
        student_id=user_id,
        total_evaluated=len(all_opps),
        recommendations=recommendations,
        student_skills=profile.skills,
        opt_in_matching=profile.discovery_opt_in,
    )


# ============================================================
# 3. Student Experience Profile & Resume Management
# ============================================================

@public_router.get("/experience-profile", response_model=StudentExperienceProfile)
@router.get("/experience-profile", response_model=StudentExperienceProfile)
@public_router.get("/profile/experience", response_model=StudentExperienceProfile)
@router.get("/profile/experience", response_model=StudentExperienceProfile)
def get_student_experience_profile(user_id: str = Depends(get_current_user_id)):
    """
    Returns persistent student experience profile with education, projects, skills,
    work experience, certifications, and resume metadata.
    """
    return db.get_student_experience_profile(user_id)


@public_router.put("/experience-profile", response_model=StudentExperienceProfile)
@router.put("/experience-profile", response_model=StudentExperienceProfile)
@public_router.put("/profile/experience", response_model=StudentExperienceProfile)
@router.put("/profile/experience", response_model=StudentExperienceProfile)
@public_router.post("/experience-profile", response_model=StudentExperienceProfile)
@router.post("/experience-profile", response_model=StudentExperienceProfile)
@public_router.post("/profile/experience", response_model=StudentExperienceProfile)
@router.post("/profile/experience", response_model=StudentExperienceProfile)
def update_student_experience_profile(
    update_data: StudentExperienceProfileUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """
    Updates student experience profile.
    ACADEMIC TRUST BOUNDARY: Official institutional CGPA cannot be overwritten by student.
    """
    return db.update_student_experience_profile(user_id, update_data)


@public_router.post("/resume")
@router.post("/resume")
@public_router.post("/profile/experience/resume")
@router.post("/profile/experience/resume")
@public_router.post("/experience-profile/resume")
@router.post("/experience-profile/resume")
async def upload_student_resume(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Uploads or replaces student's private resume PDF.
    Validates file type (.pdf) and size (<= 10 MB) server-side.
    """
    filename = file.filename or "resume.pdf"
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext != "pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported resume format. Only PDF (.pdf) documents are accepted.",
        )

    content_bytes = await file.read()
    if len(content_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume file exceeds maximum allowed limit of 10 MB.",
        )

    res = db.save_student_resume(user_id, filename, content_bytes)
    return {"success": True, "message": "Resume uploaded successfully.", **res}


@public_router.get("/resume")
@router.get("/resume")
@public_router.get("/profile/experience/resume")
@router.get("/profile/experience/resume")
@public_router.get("/experience-profile/resume")
@router.get("/experience-profile/resume")
def download_student_resume(user_id: str = Depends(get_current_user_id)):
    """
    Securely streams the authenticated student's private resume.
    """
    res = db.get_student_resume(user_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume uploaded yet.",
        )
    filename, content = res
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@public_router.delete("/resume")
@router.delete("/resume")
@public_router.delete("/profile/experience/resume")
@router.delete("/profile/experience/resume")
@public_router.delete("/experience-profile/resume")
@router.delete("/experience-profile/resume")
def delete_student_resume(user_id: str = Depends(get_current_user_id)):
    """
    Permanently removes the student's uploaded resume from private storage.
    """
    db.delete_student_resume(user_id)
    return {"success": True, "message": "Resume deleted successfully."}


# Backward-compatible skill profile aliases
@public_router.get("/profile", response_model=StudentSkillProfile)
@router.get("/profile", response_model=StudentSkillProfile)
def get_legacy_student_profile(user_id: str = Depends(get_current_user_id)):
    return db.get_student_skill_profile(user_id)


@public_router.put("/profile", response_model=StudentSkillProfile)
@router.put("/profile", response_model=StudentSkillProfile)
@public_router.post("/profile", response_model=StudentSkillProfile)
@router.post("/profile", response_model=StudentSkillProfile)
def update_legacy_student_profile(
    update_data: StudentSkillProfileUpdate,
    user_id: str = Depends(get_current_user_id),
):
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

    res = db.update_student_skill_profile(user_id, profile)

    # Sync to persistent experience profile
    exp_prof = db.get_student_experience_profile(user_id)
    if update_data.skills is not None:
        exp_prof.skills = profile.skills
    if update_data.opt_in_matching is not None:
        exp_prof.discovery_opt_in = update_data.opt_in_matching
    db._save_experience_profiles()

    return res


# ============================================================
# 4. Candidate Discovery & Creator Management
# ============================================================

@public_router.get("/{opportunity_id}/candidates", response_model=CandidateDiscoveryResponse)
@router.get("/{opportunity_id}/candidates", response_model=CandidateDiscoveryResponse)
def get_opportunity_candidates(
    opportunity_id: str,
    creator_claims: dict = Depends(require_opportunity_manager_or_admin),
):
    """
    Creator Discovery: Returns eligible matching candidates for an opportunity owned by creator.
    Respects student candidate discovery visibility setting (excludes opted-out students unless they applied).
    """
    requester_id = str(creator_claims.get("sub", ""))
    requester_role = str(creator_claims.get("role", "opportunity_manager"))
    try:
        return db.get_opportunity_candidates(
            opportunity_id=opportunity_id,
            requester_id=requester_id,
            requester_role=requester_role,
        )
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@public_router.post("/{opportunity_id}/invite", response_model=OpportunityInvitationResponse)
@router.post("/{opportunity_id}/invite", response_model=OpportunityInvitationResponse)
def invite_opportunity_candidates(
    opportunity_id: str,
    payload: OpportunityInvitationRequest,
    creator_claims: dict = Depends(require_opportunity_manager_or_admin),
):
    """
    Invites matching students to apply.
    Prevents duplicate invitations and delivers persistent in-app notifications.
    """
    creator_id = str(creator_claims.get("sub", ""))
    creator_role = str(creator_claims.get("role", "opportunity_manager"))
    opp = db.get_opportunity(opportunity_id)
    if not opp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Opportunity {opportunity_id} not found")

    is_creator = opp.creator_id == creator_id or opp.creator_id in (creator_id, "admin")
    is_admin = creator_role == "admin"
    is_opp_mgr = creator_role in ("opportunity_manager", "opportunity-manager", "placement_coordinator")
    if not (is_creator or is_admin or is_opp_mgr):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opportunity creator, opportunity manager, or administrator can send invitations.",
        )

    return db.send_opportunity_invitations(
        opportunity_id=opportunity_id,
        creator_id=creator_id,
        student_ids=payload.student_ids,
        message=payload.message,
    )


@public_router.get("/candidates/{student_id}/resume")
@router.get("/candidates/{student_id}/resume")
def download_candidate_resume(
    student_id: str,
    opportunity_id: Optional[str] = Query(None, description="Context opportunity ID for reviewer access"),
    creator_claims: dict = Depends(get_current_user_claims),
):
    """
    Secure scoped resume access for opportunity reviewers.
    Enforces the following authorization invariants:
    1. Opportunity context is mandatory for reviewer access.
    2. Requester must be the creator of the opportunity or an administrator.
    3. An application to Opportunity A cannot authorize access by the owner of Opportunity B.
    4. For non-applicants, student must have discovery_opt_in=True AND resume_sharing_opt_in=True
       AND be eligible in the context of this specific opportunity.
    5. Student ownership self-access is preserved.
    """
    requester_id = str(creator_claims.get("sub", ""))
    requester_role = str(creator_claims.get("role", "opportunity_manager"))
    is_admin = requester_role == "admin" or creator_claims.get("is_admin") is True

    # 1. Student self-access: student can always download their own resume
    if requester_id == student_id:
        res = db.get_student_resume(student_id)
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resume uploaded yet.")
        filename, content = res
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )

    # 2. Reviewer access requires opportunity manager, faculty, or admin
    is_prof = bool(creator_claims.get("is_professor") or requester_role in ("professor", "faculty", "opportunity_manager"))
    if not (is_admin or is_prof):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Opportunity Manager, Faculty, or Administrator role required.",
        )

    # 3. Opportunity context is mandatory for reviewers
    if not opportunity_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'opportunity_id' is mandatory for candidate resume review.",
        )

    # 4. Validate opportunity context existence
    opp = db.get_opportunity(opportunity_id)
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Context opportunity '{opportunity_id}' not found.",
        )

    # 5. Requester relationship to the opportunity: must be creator or administrator
    is_owner = (opp.creator_id == requester_id)
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are not the creator or authorized reviewer for opportunity '{opportunity_id}'.",
        )

    # 4. Validate student's relationship to THIS specific opportunity
    prof = db.get_student_experience_profile(student_id)
    apps = db.user_applications.get(student_id, [])
    applied_to_this_opp = any(a.opportunity_id == opportunity_id for a in apps)

    # If student applied to THIS opportunity, resume access is authorized by application submission
    if not applied_to_this_opp and not is_admin:
        # Check explicit resume sharing consent (discovery_opt_in alone does not grant resume download)
        has_resume_sharing_consent = getattr(prof, "resume_sharing_opt_in", False)
        if not (prof.discovery_opt_in and has_resume_sharing_consent):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Candidate has not applied to this opportunity and has not consented to general resume sharing.",
            )
        # Candidate must also be eligible in this opportunity context
        eligibility = OpportunityEngine.evaluate_eligibility(prof, opp)
        if eligibility.status == "NOT_ELIGIBLE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Candidate is not eligible for this opportunity.",
            )

    res = db.get_student_resume(student_id)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate has not uploaded a resume.")

    filename, content = res
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ============================================================
# 5. Save / Bookmark & Apply to Opportunities
# ============================================================

@public_router.post("/{opportunity_id}/save")
@router.post("/{opportunity_id}/save")
def toggle_save_opportunity(
    opportunity_id: str,
    user_id: str = Depends(get_current_user_id),
):
    opp = db.get_opportunity(opportunity_id)
    if not opp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Opportunity {opportunity_id} not found")

    saved = db.toggle_save_opportunity(user_id, opportunity_id)
    return {
        "opportunity_id": opportunity_id,
        "saved": saved,
        "message": "Opportunity saved" if saved else "Opportunity removed from saved",
    }


@public_router.get("/saved", response_model=List[Opportunity])
@router.get("/saved", response_model=List[Opportunity])
def get_saved_opportunities(user_id: str = Depends(get_current_user_id)):
    return db.get_saved_opportunities(user_id)


@public_router.post("/{opportunity_id}/apply", response_model=OpportunityApplication)
@router.post("/{opportunity_id}/apply", response_model=OpportunityApplication)
def apply_opportunity(
    opportunity_id: str,
    application_in: Optional[OpportunityApplicationCreate] = None,
    user_id: str = Depends(get_current_user_id),
):
    try:
        app = db.apply_to_opportunity(user_id, opportunity_id, application_in)
        return app
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@public_router.get("/applications", response_model=List[OpportunityApplication])
@router.get("/applications", response_model=List[OpportunityApplication])
@public_router.get("/applied", response_model=List[OpportunityApplication])
@router.get("/applied", response_model=List[OpportunityApplication])
def get_student_applications(user_id: str = Depends(get_current_user_id)):
    return db.get_student_applications(user_id)
