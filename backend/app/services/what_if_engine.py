import math
from typing import List, Dict, Tuple
from ..models.academic import (
    GRADE_POINTS,
    WhatIfAttendanceRequest,
    WhatIfAttendanceResponse,
    WhatIfGradeRequest,
    WhatIfGradeResponse,
    AttendanceRecord,
)

class WhatIfEngine:
    @staticmethod
    def calculate_attendance_status(attended: int, total: int) -> Tuple[float, str, int, int]:
        """
        Calculates attendance %, status category, safe bunks, and classes needed for 75%
        based on Thapar Institute Section 6.2 Attendance Regulations.
        """
        if total <= 0:
            return 100.0, "safe", 0, 0
        
        pct = round((attended / total) * 100, 1)
        
        if pct >= 75.0:
            # How many consecutive classes can be missed without dropping below 75%?
            # attended / (total + x) >= 0.75  =>  x <= (attended - 0.75 * total) / 0.75
            safe_bunks = max(0, math.floor((attended - 0.75 * total) / 0.75))
            classes_needed = 0
            status = "safe"
        elif pct >= 65.0:
            # In warning zone (65% - 74.9%): needs medical or DOAA condonation
            safe_bunks = 0
            # How many consecutive classes must be attended to reach 75%?
            # (attended + y) / (total + y) >= 0.75  =>  y >= (0.75 * total - attended) / 0.25
            classes_needed = max(0, math.ceil((0.75 * total - attended) / 0.25))
            status = "warning"
        else:
            # Below 65%: strictly debarred (attendance back)
            safe_bunks = 0
            classes_needed = max(0, math.ceil((0.75 * total - attended) / 0.25))
            status = "critical"
            
        return pct, status, safe_bunks, classes_needed

    @classmethod
    def simulate_attendance(cls, req: WhatIfAttendanceRequest) -> WhatIfAttendanceResponse:
        current_pct, status, safe_bunks, needed = cls.calculate_attendance_status(
            req.attended_classes, req.total_classes
        )
        
        # If simulation parameters provided
        if req.total_upcoming_classes > 0:
            sim_attended = req.attended_classes + req.upcoming_classes_to_attend
            sim_total = req.total_classes + req.total_upcoming_classes
            sim_pct, sim_status, sim_safe, sim_needed = cls.calculate_attendance_status(
                sim_attended, sim_total
            )
        else:
            sim_pct = current_pct
            sim_status = status
            sim_safe = safe_bunks
            sim_needed = needed

        # Advice generation adhering to Thapar Regulations
        if sim_pct >= 75.0:
            advice = (
                f"You are meeting Thapar's 75% requirement. You can safely miss {sim_safe} "
                f"upcoming lecture{'s' if sim_safe != 1 else ''} and remain above 75%."
            )
        elif sim_pct >= 65.0:
            advice = (
                f"Warning: At {sim_pct}%, you risk being debarred unless you obtain medical condonation. "
                f"You must attend the next {sim_needed} consecutive class{'es' if sim_needed != 1 else ''} to cross 75%."
            )
        else:
            advice = (
                f"Critical Alert: At {sim_pct}%, you are below the 65% condonable cutoff. "
                f"Per TIET Section 6.2, you will be debarred from EST exams. "
                f"You need {sim_needed} consecutive classes to recover to 75%."
            )

        return WhatIfAttendanceResponse(
            course_code=req.course_code,
            current_percentage=current_pct,
            simulated_percentage=sim_pct,
            safe_bunks_allowed=sim_safe,
            classes_needed_for_75=sim_needed,
            status_assessment=sim_status,
            advice=advice,
        )

    @staticmethod
    def calculate_sgpa(courses: List[Dict[str, any]]) -> float:
        total_points = 0.0
        total_credits = 0.0
        for c in courses:
            credits = float(c.get("credits", 4.0))
            grade = c.get("grade") or c.get("target_grade") or "F"
            points = GRADE_POINTS.get(grade.upper(), 0.0)
            total_points += credits * points
            total_credits += credits
            
        if total_credits == 0:
            return 0.0
        return round(total_points / total_credits, 2)

    @classmethod
    def simulate_grades(cls, req: WhatIfGradeRequest) -> WhatIfGradeResponse:
        current_credits = sum(c.credits for c in req.current_semester_courses)
        if current_credits <= 0:
            return WhatIfGradeResponse(
                target_cgpa=req.target_cgpa,
                predicted_sgpa=0.0,
                predicted_cgpa=req.current_cgpa,
                required_sgpa_for_target=0.0,
                is_feasible=False,
                summary="No current semester courses provided for projection.",
            )

        # 1. Calculate predicted SGPA from selected target grades
        predicted_points = sum(
            c.credits * GRADE_POINTS.get(c.target_grade.upper(), 0.0)
            for c in req.current_semester_courses
        )
        predicted_sgpa = round(predicted_points / current_credits, 2)

        # 2. Predicted CGPA after this semester
        total_projected_credits = req.completed_credits + current_credits
        total_projected_points = (req.completed_credits * req.current_cgpa) + (current_credits * predicted_sgpa)
        predicted_cgpa = round(total_projected_points / total_projected_credits, 2)

        # 3. Calculate minimum SGPA required to reach target CGPA
        # target_cgpa = (req.completed_credits * req.current_cgpa + current_credits * req_sgpa) / total_projected_credits
        required_sgpa = (
            (req.target_cgpa * total_projected_credits) - (req.completed_credits * req.current_cgpa)
        ) / current_credits
        required_sgpa = round(required_sgpa, 2)

        is_feasible = required_sgpa <= 10.0
        
        if required_sgpa <= 0.0:
            summary = (
                f"Target {req.target_cgpa} CGPA is already assured. Even an SGPA of 0.0 "
                f"would maintain your target!"
            )
        elif not is_feasible:
            summary = (
                f"Target {req.target_cgpa} CGPA is mathematically unattainable this semester alone "
                f"(would require an SGPA of {required_sgpa}, exceeding the 10.0 maximum). "
                f"With your planned grades, your projected CGPA will be {predicted_cgpa}."
            )
        else:
            summary = (
                f"To reach your target CGPA of {req.target_cgpa}, you need an SGPA of at least {required_sgpa} "
                f"this semester. Your current planned grades yield an SGPA of {predicted_sgpa} "
                f"(projected CGPA: {predicted_cgpa})."
            )

        return WhatIfGradeResponse(
            target_cgpa=req.target_cgpa,
            predicted_sgpa=predicted_sgpa,
            predicted_cgpa=predicted_cgpa,
            required_sgpa_for_target=required_sgpa,
            is_feasible=is_feasible,
            summary=summary,
        )
