from typing import List, Dict, Any, Optional
from datetime import date
from ..models.opportunity import (
    Opportunity,
    OpportunityRecommendation,
    StudentSkillProfile,
)


class OpportunityEngine:
    """
    Deterministic matching engine for student opportunities:
    Synthesizes:
    1. Skill overlap (student skills vs opportunity requirements)
    2. Academic attendance feasibility (detention risks & study pressure)
    3. Timetable schedule compatibility & lecture collision detection
    4. Student branch and category interests
    """

    @classmethod
    def match_opportunities(
        cls,
        profile: StudentSkillProfile,
        opportunities: List[Opportunity],
        courses_attendance: List[Dict[str, Any]],
        timetable: List[Dict[str, Any]],
        assessments: Optional[List[Dict[str, Any]]] = None,
        student_branch: str = "COE",
    ) -> List[OpportunityRecommendation]:
        if not profile.opt_in_matching:
            return []

        student_skills_clean = {s.strip().lower() for s in profile.skills if s.strip()}
        student_interests_clean = {i.strip().lower() for i in profile.interests if i.strip()}

        # Evaluate student attendance standing
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
            if opp.status != "open":
                continue

            # 1. SKILL MATCH SCORE (45%)
            required_skills = [s.strip() for s in opp.required_skills if s.strip()]
            matched_skills: List[str] = []
            missing_skills: List[str] = []

            for req_skill in required_skills:
                req_lower = req_skill.lower()
                # Check direct or substring match
                if any(req_lower == s or req_lower in s or s in req_lower for s in student_skills_clean):
                    matched_skills.append(req_skill)
                else:
                    missing_skills.append(req_skill)

            if len(required_skills) == 0:
                skill_score = 100.0
                skill_match_pct = 100.0
            else:
                skill_match_pct = round((len(matched_skills) / len(required_skills)) * 100.0, 1)
                skill_score = skill_match_pct

            # 2. SCHEDULE COMPATIBILITY (20%)
            schedule_compatible = True
            collision_warning: Optional[str] = None
            schedule_score = 100.0

            sched_req = (opp.schedule_requirement or "").strip().lower()
            if sched_req and sched_req not in ("flexible", "weekends", "remote"):
                # Detect day of week collision
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
                        schedule_score = 40.0
                        break

            # 3. ACADEMIC FEASIBILITY SCORE (25%)
            academic_score = 100.0
            academic_advisory: Optional[str] = None

            hrs = opp.time_commitment_hrs_week
            if critical_courses:
                crit_code, crit_pct = critical_courses[0]
                if hrs >= 8:
                    academic_score = 45.0
                    academic_advisory = (
                        f"High commitment ({hrs} hrs/wk) is high-risk while {crit_code} attendance "
                        f"is below detention threshold ({crit_pct}%). Prioritize lecture attendance."
                    )
                else:
                    academic_score = 75.0
                    academic_advisory = (
                        f"Low commitment ({hrs} hrs/wk) is feasible, but monitor {crit_code} ({crit_pct}%)."
                    )
            elif warning_courses:
                warn_code, warn_pct = warning_courses[0]
                if hrs >= 12:
                    academic_score = 65.0
                    academic_advisory = (
                        f"Heavy commitment ({hrs} hrs/wk) may impact attendance recovery for {warn_code} ({warn_pct}%)."
                    )
                else:
                    academic_score = 90.0
            else:
                academic_score = 100.0

            # 4. BRANCH & INTEREST ALIGNMENT (10%)
            branch_score = 100.0
            pref_branches = [b.strip().upper() for b in opp.preferred_branches]
            if "ANY" not in pref_branches and student_branch.upper() not in pref_branches:
                branch_score = 50.0

            if opp.category.lower() in student_interests_clean:
                branch_score = min(100.0, branch_score + 20.0)

            # WEIGHTED OVERALL MATCH SCORE
            total_score = round(
                (0.45 * skill_score)
                + (0.25 * academic_score)
                + (0.20 * schedule_score)
                + (0.10 * branch_score),
                1,
            )

            # Formulate clear recommendation reason
            reason_parts = []
            if len(required_skills) > 0:
                reason_parts.append(f"{len(matched_skills)}/{len(required_skills)} skills matched")
            else:
                reason_parts.append("Open to all skill levels")

            if schedule_compatible:
                reason_parts.append("compatible with your timetable")
            else:
                reason_parts.append("requires timetable accommodation")

            if academic_advisory:
                reason_parts.append(f"Advisory: {academic_advisory}")

            reason = ". ".join(reason_parts) + "."

            recommendations.append(
                OpportunityRecommendation(
                    opportunity=opp,
                    match_score=total_score,
                    skill_match_percent=skill_match_pct,
                    matched_skills=matched_skills,
                    missing_skills=missing_skills,
                    schedule_compatible=schedule_compatible,
                    schedule_collision_warning=collision_warning,
                    academic_advisory=academic_advisory,
                    recommendation_reason=reason,
                )
            )

        # Sort descending by match_score
        recommendations.sort(key=lambda x: -x.match_score)
        return recommendations
