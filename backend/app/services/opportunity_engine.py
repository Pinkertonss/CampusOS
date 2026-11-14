from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import date
from ..models.opportunity import (
    Opportunity,
    OpportunityRecommendation,
    OpportunityEligibility,
    StudentExperienceProfile,
    StudentSkillProfile,
)


CANONICAL_SKILL_MAP: Dict[str, str] = {
    "react.js": "react",
    "reactjs": "react",
    "node.js": "node",
    "nodejs": "node",
    "vue.js": "vue",
    "vuejs": "vue",
    "c++": "c++",
    "cpp": "c++",
    "golang": "go",
    "postgres": "postgresql",
    "postgres sql": "postgresql",
    "fast api": "fastapi",
    "py": "python",
    "python 3": "python",
    "python3": "python",
    "machine learning": "machine learning",
    "ml": "machine learning",
    "deep learning": "deep learning",
    "dl": "deep learning",
    "artificial intelligence": "ai",
    "ui/ux": "ui/ux",
    "ui ux": "ui/ux",
}


def normalize_skill(skill: str) -> str:
    """Normalizes skill tokens to canonical lowercase representations."""
    cleaned = skill.strip().lower()
    return CANONICAL_SKILL_MAP.get(cleaned, cleaned)


class OpportunityEngine:
    """
    Deterministic shared matching and eligibility engine for CampusOS opportunities.
    Evaluates:
    1. Mandatory Criteria -> ELIGIBLE | NOT_ELIGIBLE | INCOMPLETE_PROFILE
    2. Preference Criteria (Preferred Skills & Categories) -> Recommendation ranking
    3. Academic & Schedule Feasibility -> Collision warnings and workload advisory
    """

    @classmethod
    def evaluate_eligibility(
        cls,
        profile: StudentExperienceProfile,
        opportunity: Opportunity,
        verified_cgpa: Optional[float] = None,
    ) -> OpportunityEligibility:
        """
        Evaluates student profile strictly against mandatory opportunity requirements.
        Returns three distinct deterministic outcomes:
        - ELIGIBLE: all mandatory criteria demonstrably met
        - NOT_ELIGIBLE: at least one mandatory criterion demonstrably unmet
        - INCOMPLETE_PROFILE: required information missing to establish eligibility
        """
        reasons: List[str] = []
        missing_fields: List[str] = []
        is_not_eligible = False
        is_incomplete = False

        # If opportunity is closed, immediately mark as NOT_ELIGIBLE with clear reason
        if opportunity.status == "closed":
            return OpportunityEligibility(
                status="NOT_ELIGIBLE",
                reasons=["Opportunity is closed for applications."],
                missing_profile_fields=[],
                explanation="This opportunity has passed its deadline and is closed.",
            )

        # 1. Branch and Education Criteria
        edu = profile.education[0] if profile.education else None
        if not edu or not edu.branch:
            is_incomplete = True
            missing_fields.append("Branch")
            reasons.append("Branch is required to determine eligibility.")
        else:
            student_branch = edu.branch.strip().upper()
            allowed_branches = [b.strip().upper() for b in opportunity.eligible_branches if b.strip()]
            if allowed_branches and "ANY" not in allowed_branches and student_branch not in allowed_branches:
                is_not_eligible = True
                reasons.append(
                    f"Recorded branch '{student_branch}' does not meet eligible branches: {', '.join(opportunity.eligible_branches)}."
                )

        # 2. Semester Range Criteria
        if opportunity.min_semester is not None or opportunity.max_semester is not None:
            if not edu or edu.semester is None:
                is_incomplete = True
                missing_fields.append("Semester")
                reasons.append("Semester is required to determine eligibility.")
            else:
                sem = edu.semester
                if opportunity.min_semester is not None and sem < opportunity.min_semester:
                    is_not_eligible = True
                    reasons.append(
                        f"Current semester ({sem}) is below required minimum semester ({opportunity.min_semester})."
                    )
                if opportunity.max_semester is not None and sem > opportunity.max_semester:
                    is_not_eligible = True
                    reasons.append(
                        f"Current semester ({sem}) exceeds maximum allowed semester ({opportunity.max_semester})."
                    )

        # 3. Graduation Year Criteria
        if opportunity.graduation_years:
            if not edu or not edu.graduation_year:
                is_incomplete = True
                missing_fields.append("Graduation Year")
                reasons.append("Graduation year is required to determine eligibility.")
            elif edu.graduation_year not in opportunity.graduation_years:
                is_not_eligible = True
                reasons.append(
                    f"Graduation year ({edu.graduation_year}) is not among eligible graduation years: {opportunity.graduation_years}."
                )

        # 4. Minimum CGPA Criteria (Requires verified institutional records)
        if opportunity.min_cgpa is not None:
            effective_cgpa = verified_cgpa or (edu.cgpa_verified if edu else None)
            if effective_cgpa is None:
                is_incomplete = True
                missing_fields.append("Verified Institutional CGPA")
                reasons.append(
                    f"Verified institutional CGPA is required to evaluate eligibility (minimum threshold is {opportunity.min_cgpa})."
                )
            elif round(effective_cgpa, 2) < round(opportunity.min_cgpa, 2):
                is_not_eligible = True
                reasons.append(
                    f"Minimum CGPA is {opportunity.min_cgpa}; verified CGPA is {round(effective_cgpa, 2)}."
                )

        # 5. Mandatory Required Skills
        student_skills_normalized = {normalize_skill(s) for s in profile.skills if s.strip()}
        matched_mandatory: List[str] = []
        missing_mandatory: List[str] = []

        for req in opportunity.required_skills:
            req_norm = normalize_skill(req)
            if req_norm in student_skills_normalized:
                matched_mandatory.append(req)
            else:
                missing_mandatory.append(req)

        if opportunity.required_skills:
            mode = (opportunity.required_skills_mode or "any").lower()
            if mode == "all":
                if missing_mandatory:
                    is_not_eligible = True
                    reasons.append(
                        f"Missing mandatory required skills (requires all): {', '.join(missing_mandatory)}."
                    )
            else:  # "any" mode
                if len(matched_mandatory) == 0:
                    is_not_eligible = True
                    reasons.append(
                        f"Requires at least one of the mandatory skills: {', '.join(opportunity.required_skills)}."
                    )

        # 6. Preferred Skills & Preferences (Affects ranking, never eligibility!)
        matched_preferred: List[str] = []
        missing_preferred: List[str] = []
        for pref in opportunity.preferred_skills:
            pref_norm = normalize_skill(pref)
            if pref_norm in student_skills_normalized:
                matched_preferred.append(pref)
            else:
                missing_preferred.append(pref)

        if opportunity.preferred_skills:
            pref_score = round((len(matched_preferred) / len(opportunity.preferred_skills)) * 100.0, 1)
        else:
            pref_score = 100.0

        # Outcome synthesis: NOT_ELIGIBLE takes precedence over INCOMPLETE_PROFILE
        if is_not_eligible:
            status_val = "NOT_ELIGIBLE"
            explanation = reasons[0] if reasons else "One or more mandatory criteria are unmet."
        elif is_incomplete:
            status_val = "INCOMPLETE_PROFILE"
            explanation = (
                f"Profile incomplete: {', '.join(missing_fields)} is required to establish eligibility."
            )
        else:
            status_val = "ELIGIBLE"
            explanation = "Eligible: your academic profile and recorded qualifications satisfy all mandatory criteria."

        return OpportunityEligibility(
            status=status_val,
            mandatory_passed=(status_val == "ELIGIBLE"),
            reasons=reasons,
            missing_requirements=reasons,
            missing_profile_fields=missing_fields,
            matched_mandatory_skills=matched_mandatory,
            missing_mandatory_skills=missing_mandatory,
            matched_preferred_skills=matched_preferred,
            missing_preferred_skills=missing_preferred,
            preference_score=pref_score,
            explanation=explanation,
            manual_review_required=False,
        )

    @classmethod
    def match_opportunities(
        cls,
        profile: Any,  # StudentExperienceProfile or StudentSkillProfile
        opportunities: List[Opportunity],
        courses_attendance: List[Dict[str, Any]],
        timetable: List[Dict[str, Any]],
        verified_cgpa: Optional[float] = None,
        student_branch: str = "COE",
    ) -> List[OpportunityRecommendation]:
        """
        Delivers personalized opportunity matching and ranked recommendations.
        """
        # Convert legacy StudentSkillProfile if needed
        if isinstance(profile, StudentSkillProfile):
            exp_profile = StudentExperienceProfile(
                user_id=profile.user_id,
                skills=profile.skills,
                career_interests=profile.interests,
                discovery_opt_in=profile.opt_in_matching,
            )
        else:
            exp_profile = profile

        # Attendance and academic safety checks
        critical_courses = []
        warning_courses = []
        for c in courses_attendance:
            a = int(c.get("attended_classes", c.get("attended", 0)))
            t = int(c.get("total_classes", c.get("total_held", 0)))
            pct = round((a / t * 100.0), 1) if t > 0 else 100.0
            code = c.get("course_code") or c.get("code") or "Course"
            if pct < 65.0:
                critical_courses.append((code, pct))
            elif pct < 75.0:
                warning_courses.append((code, pct))

        recommendations: List[OpportunityRecommendation] = []

        for opp in opportunities:
            # Deterministic eligibility evaluation
            eligibility = cls.evaluate_eligibility(
                profile=exp_profile,
                opportunity=opp,
                verified_cgpa=verified_cgpa,
            )

            # Schedule collision detection
            schedule_compatible = True
            collision_warning: Optional[str] = None
            sched_req = (opp.schedule_requirement or "").strip().lower()
            if sched_req and sched_req not in ("flexible", "weekends", "remote"):
                for slot in timetable:
                    slot_day = str(slot.get("day_of_week", "")).strip().lower()
                    if slot_day and slot_day in sched_req:
                        c_code = slot.get("course_code", "Lecture")
                        start_t = slot.get("start_time", "")
                        end_t = slot.get("end_time", "")
                        venue = slot.get("venue", "Campus")
                        schedule_compatible = False
                        collision_warning = (
                            f"Potential collision with scheduled class {c_code} on {slot.get('day_of_week')} "
                            f"({start_t}-{end_t} @ {venue})."
                        )
                        break

            # Academic safety advisory
            academic_advisory: Optional[str] = None
            if critical_courses:
                course_strs = [f"{c[0]} ({c[1]}%)" for c in critical_courses]
                academic_advisory = (
                    f"Warning: Attendance is critical (<65%) in {', '.join(course_strs)}. "
                    f"Prioritize academic recovery before committing {opp.time_commitment_hrs_week}h/week."
                )
            elif warning_courses:
                course_strs = [f"{c[0]} ({c[1]}%)" for c in warning_courses]
                academic_advisory = (
                    f"Notice: Attendance is in warning zone (<75%) in {', '.join(course_strs)}."
                )

            # Combined Match Score for recommendation ordering:
            # 50% eligibility weight + 30% preferred skills + 20% schedule compatibility
            if eligibility.status == "ELIGIBLE":
                base_score = 60.0 + (eligibility.preference_score * 0.3)
            elif eligibility.status == "INCOMPLETE_PROFILE":
                base_score = 35.0 + (eligibility.preference_score * 0.2)
            else:
                base_score = 15.0 + (eligibility.preference_score * 0.1)

            if not schedule_compatible:
                base_score -= 15.0

            match_score = round(max(0.0, min(100.0, base_score)), 1)
            all_required = opp.required_skills
            skill_match_pct = (
                round((len(eligibility.matched_mandatory_skills) / len(all_required)) * 100.0, 1)
                if all_required
                else 100.0
            )

            recommendations.append(
                OpportunityRecommendation(
                    opportunity=opp,
                    eligibility=eligibility,
                    match_score=match_score,
                    skill_match_percent=skill_match_pct,
                    matched_skills=eligibility.matched_mandatory_skills,
                    missing_skills=eligibility.missing_mandatory_skills,
                    schedule_compatible=schedule_compatible,
                    schedule_collision_warning=collision_warning,
                    academic_advisory=academic_advisory,
                    recommendation_reason=eligibility.explanation,
                )
            )

        # Sort recommendations by match_score descending
        recommendations.sort(key=lambda r: r.match_score, reverse=True)

        return recommendations
