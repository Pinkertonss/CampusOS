"""
Academic Planning Engine for CampusOS
-------------------------------------
Implements explicit, mathematically documented formulas for:
1. Attendance Tracking & What-If Simulations (TIET 75% Regulation)
2. Grade Calculations, Target Feasibility & Projected Letter Grades
3. Daily Action Plan Prioritization with Plain-English Reasoning

Mathematical Foundations:
-------------------------
ATTENDANCE:
- a = attended classes (count of 'present')
- t = total classes held (count of 'present' + 'absent'; 'cancelled' excluded)
- T = target attendance percentage (default 75.0%)

Formulas:
- current_percent = (100 * a / t) if t > 0 else 100.0
- classes_needed_to_reach_target = ceil((T * t - 100 * a) / (100 - T))
    Derivation:
        (a + x) / (t + x) >= T / 100
        100(a + x) >= T(t + x)
        (100 - T)x >= Tt - 100a
        x = ceil((Tt - 100a) / (100 - T))
    Edge Case T=100: If a == t, x = 0; if a < t, reaching 100% is impossible (returns None).
- safe_bunks_remaining = floor(100 * a / T - t)
    Derivation:
        a / (t + y) >= T / 100
        100a >= T(t + y)
        Ty <= 100a - Tt
        y = floor(100a / T - t)
    If current_percent < T, safe_bunks = 0.
- what_if(attend_next_n, skip_next_m):
    a' = a + n
    t' = t + n + m
    projected_percent = (100 * a' / t') if t' > 0 else 100.0

GRADES:
- Assessments have weight_percent, max_marks, obtained_marks.
- current_weighted_score = sum((obtained_marks / max_marks) * weight_percent) for completed assessments.
- remaining_weight = 100.0 - completed_weight
- needed_weighted = target_total_percent - current_weighted_score
- required_on_remaining = (needed_weighted / remaining_weight) * 100.0
- is_achievable = required_on_remaining <= 100.0
"""

import math
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple


# Configurable default grading scale (Letter Grade -> Minimum Percentage)
DEFAULT_GRADING_SCALE: Dict[str, float] = {
    "A+": 90.0,
    "A": 80.0,
    "B": 70.0,
    "C": 60.0,
    "D": 50.0,
    "E": 40.0,
    "F": 0.0,
}


class AttendanceEngine:
    """
    Pure mathematical calculations for attendance tracking and what-if simulation.
    """

    @staticmethod
    def calculate_current_percent(attended: int, total_held: int) -> float:
        """
        Computes the current attendance percentage:
            current_percent = 100 * a / t

        Edge cases:
        - t <= 0: Returns 100.0% (no classes held yet; student is in good standing).
        - a < 0 or t < 0: Clamped to 0.
        - a > t: Clamped such that a <= t.
        """
        if total_held <= 0:
            return 100.0
        safe_a = max(0, min(attended, total_held))
        return round((100.0 * safe_a) / total_held, 2)

    @staticmethod
    def calculate_classes_needed_to_reach_target(
        attended: int, total_held: int, target_percent: float = 75.0
    ) -> Optional[int]:
        """
        Calculates the minimum consecutive future classes the student must attend
        to reach or restore target attendance T%:
            classes_needed = ceil((T * t - 100 * a) / (100 - T))

        Assumes all future classes are attended without skipping.

        Edge cases:
        - If current_percent >= target_percent: Returns 0 (target is already met).
        - If total_held <= 0: Returns 0.
        - If target_percent <= 0.0: Returns 0.
        - If target_percent >= 100.0:
            - If attended == total_held: Returns 0 (already 100%).
            - If attended < total_held: Returns None (impossible to reach 100% after missing any class).
        """
        if total_held <= 0 or target_percent <= 0.0:
            return 0

        current_pct = (100.0 * attended) / total_held
        if current_pct >= target_percent:
            return 0

        # When target is 100% and student has missed any class (attended < total_held):
        # (a + x) / (t + x) = 1 - (t - a) / (t + x) < 1.0 for all finite x.
        if target_percent >= 100.0:
            return None

        numerator = (target_percent * total_held) - (100.0 * attended)
        denominator = 100.0 - target_percent

        if denominator <= 0:
            return None

        needed = math.ceil(numerator / denominator)
        return max(0, needed)

    @staticmethod
    def calculate_safe_bunks_remaining(
        attended: int, total_held: int, target_percent: float = 75.0
    ) -> int:
        """
        Calculates the maximum consecutive future classes the student can skip
        without dropping below target attendance T%:
            safe_bunks = floor(100 * a / T - t)

        Edge cases:
        - If current_percent < target_percent: Returns 0 (no safe bunks available).
        - If total_held <= 0 or target_percent <= 0.0: Returns 0.
        - If target_percent >= 100.0:
            - If attended == total_held: Returns 0 (cannot skip any class to stay at 100%).
            - If attended < total_held: Returns 0.
        - If exactly at target: Returns 0 (floor(100*a/T - t) = floor(0) = 0).
        """
        if total_held <= 0 or target_percent <= 0.0 or target_percent > 100.0:
            return 0

        current_pct = (100.0 * attended) / total_held
        if current_pct < target_percent:
            return 0

        if target_percent == 100.0:
            return 0

        # floor(100 * a / T - t)
        val = (100.0 * attended) / target_percent - total_held
        safe_bunks = math.floor(val)
        return max(0, safe_bunks)

    @staticmethod
    def evaluate_status(percent: float, target_percent: float = 75.0) -> str:
        """
        Returns status classification based on TIET attendance regulations:
        - 'safe': percent >= target_percent (>= 75.0%)
        - 'warning': 65.0% <= percent < target_percent (eligible for medical/dean condonation)
        - 'critical': percent < 65.0% (detention threshold)
        """
        if percent >= target_percent:
            return "safe"
        elif percent >= 65.0:
            return "warning"
        else:
            return "critical"

    @classmethod
    def what_if(
        cls,
        attended: int,
        total_held: int,
        attend_next_n: int = 0,
        skip_next_m: int = 0,
        target_percent: float = 75.0,
    ) -> Dict[str, Any]:
        """
        Projects attendance percent and status after attending n and skipping m upcoming classes.
        """
        curr_pct = cls.calculate_current_percent(attended, total_held)
        curr_status = cls.evaluate_status(curr_pct, target_percent)
        curr_bunks = cls.calculate_safe_bunks_remaining(attended, total_held, target_percent)
        curr_needed = cls.calculate_classes_needed_to_reach_target(
            attended, total_held, target_percent
        )

        projected_attended = max(0, attended + max(0, attend_next_n))
        projected_total = max(0, total_held + max(0, attend_next_n) + max(0, skip_next_m))

        proj_pct = cls.calculate_current_percent(projected_attended, projected_total)
        proj_status = cls.evaluate_status(proj_pct, target_percent)
        proj_bunks = cls.calculate_safe_bunks_remaining(
            projected_attended, projected_total, target_percent
        )
        proj_needed = cls.calculate_classes_needed_to_reach_target(
            projected_attended, projected_total, target_percent
        )

        return {
            "current_attended": attended,
            "current_total_held": total_held,
            "current_percent": curr_pct,
            "current_status": curr_status,
            "current_safe_bunks": curr_bunks,
            "current_classes_needed": curr_needed,
            "attend_next_n": attend_next_n,
            "skip_next_m": skip_next_m,
            "projected_attended": projected_attended,
            "projected_total_held": projected_total,
            "projected_percent": proj_pct,
            "projected_status": proj_status,
            "projected_safe_bunks": proj_bunks,
            "projected_classes_needed": proj_needed,
            "target_percent": target_percent,
        }

    @classmethod
    def process_records(
        cls,
        records: List[Dict[str, Any]],
        target_percent: float = 75.0,
        enrollment_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Filters out 'cancelled' and 'excused' classes and computes attendance statistics.
        Cancelled and excused classes do not count toward total held t.
        'present' and 'late' count as attended a.
        'present', 'late', and 'absent' count toward total held t.
        Respects enrollment_date if provided (ignores sessions prior to enrollment).
        """
        attended = 0
        total_held = 0
        cancelled = 0
        excused = 0

        for rec in records:
            rec_date = rec.get("date") or rec.get("session_date")
            if rec_date and enrollment_date:
                r_date_str = str(rec_date)[:10]
                e_date_str = str(enrollment_date)[:10]
                if r_date_str < e_date_str:
                    continue

            status = str(rec.get("status", "")).strip().lower()
            if status in ("present", "late"):
                attended += 1
                total_held += 1
            elif status == "absent":
                total_held += 1
            elif status == "cancelled":
                cancelled += 1
            elif status == "excused":
                excused += 1

        percent = cls.calculate_current_percent(attended, total_held)
        status = cls.evaluate_status(percent, target_percent)
        safe_bunks = cls.calculate_safe_bunks_remaining(attended, total_held, target_percent)
        classes_needed = cls.calculate_classes_needed_to_reach_target(
            attended, total_held, target_percent
        )

        return {
            "attended": attended,
            "total_held": total_held,
            "cancelled": cancelled,
            "excused": excused,
            "percent": percent,
            "status": status,
            "safe_bunks_remaining": safe_bunks,
            "classes_needed_to_reach_target": classes_needed,
            "target_percent": target_percent,
        }


class GradeEngine:
    """
    Weighted assessment scoring, required remaining score, and grade projections.
    """

    @staticmethod
    def calculate_current_weighted_score(
        assessments: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Computes current weighted score from completed assessments:
            score_i = (obtained_marks / max_marks) * weight_percent
            current_weighted_score = sum(score_i)

        Only assessments where obtained_marks is not None are counted.
        Distinguishes earned weighted contribution from performance on graded work alone.
        """
        current_weighted_score = 0.0
        completed_weight = 0.0
        total_planned_weight = 0.0

        for a in assessments:
            weight = max(0.0, float(a.get("weight_percent", 0.0)))
            max_m = float(a.get("max_marks", 100.0))
            obtained = a.get("obtained_marks")

            total_planned_weight += weight

            if obtained is not None and max_m > 0:
                obt = float(obtained)
                ratio = max(0.0, min(obt / max_m, 1.0))
                current_weighted_score += ratio * weight
                completed_weight += weight

        remaining_weight = max(0.0, 100.0 - completed_weight)
        graded_performance = (
            round((current_weighted_score / completed_weight) * 100.0, 2)
            if completed_weight > 0
            else None
        )

        return {
            "current_weighted_score": round(current_weighted_score, 2),
            "completed_weight": round(completed_weight, 2),
            "remaining_weight": round(remaining_weight, 2),
            "total_planned_weight": round(total_planned_weight, 2),
            "graded_performance_percent": graded_performance,
        }

    @staticmethod
    def calculate_required_on_remaining(
        current_weighted_score: float,
        remaining_weight: float,
        target_total_percent: float,
    ) -> Dict[str, Any]:
        """
        Calculates the percentage score required on the remaining weight to hit the target:
            needed_weighted = target_total_percent - current_weighted_score
            required_percent = (needed_weighted / remaining_weight) * 100.0

        Edge Cases:
        - If needed_weighted <= 0: Target already reached! required = 0.0, is_achievable = True.
        - If remaining_weight <= 0:
            - If needed_weighted <= 0: is_achievable = True, required = 0.0.
            - If needed_weighted > 0: is_achievable = False, required = None (impossible, no weight left).
        - If required_percent > 100.0:
            Target exceeds maximum possible score (current + remaining_weight).
            is_achievable = False, required_percent > 100.0.
        """
        needed_weighted = target_total_percent - current_weighted_score
        max_possible_score = round(current_weighted_score + remaining_weight, 2)

        if needed_weighted <= 0.0:
            return {
                "target_total_percent": target_total_percent,
                "current_weighted_score": current_weighted_score,
                "remaining_weight": remaining_weight,
                "max_possible_score": max_possible_score,
                "required_percent_on_remaining": 0.0,
                "is_achievable": True,
                "message": f"Target of {target_total_percent}% is already secured.",
            }

        if remaining_weight <= 0.0:
            return {
                "target_total_percent": target_total_percent,
                "current_weighted_score": current_weighted_score,
                "remaining_weight": 0.0,
                "max_possible_score": max_possible_score,
                "required_percent_on_remaining": None,
                "is_achievable": False,
                "message": f"Target impossible: all assessments completed. Max score is {current_weighted_score}%.",
            }

        required_percent = (needed_weighted / remaining_weight) * 100.0
        is_achievable = required_percent <= 100.0

        return {
            "target_total_percent": target_total_percent,
            "current_weighted_score": current_weighted_score,
            "remaining_weight": remaining_weight,
            "max_possible_score": max_possible_score,
            "required_percent_on_remaining": round(required_percent, 2),
            "is_achievable": is_achievable,
            "message": (
                f"Must average {round(required_percent, 1)}% across remaining assessments."
                if is_achievable
                else f"Target unattainable: requires {round(required_percent, 1)}% on remaining assessments (>100%). Maximum possible score is {max_possible_score}%."
            ),
        }

    @staticmethod
    def get_letter_grade(
        score: float, grading_scale: Optional[Dict[str, float]] = None
    ) -> str:
        """
        Maps a total percentage score to a letter grade based on a descending grading scale.
        """
        scale = grading_scale or DEFAULT_GRADING_SCALE
        # Sort by threshold descending
        sorted_scale = sorted(scale.items(), key=lambda x: x[1], reverse=True)
        for letter, threshold in sorted_scale:
            if score >= threshold:
                return letter
        return "F"

    @classmethod
    def what_if(
        cls,
        assessments: List[Dict[str, Any]],
        hypothetical_scores: Dict[str, float],
        target_total_percent: Optional[float] = None,
        grading_scale: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Simulates final score with hypothetical marks or percentages for pending assessments:
        hypothetical_scores: dict mapping assessment id or name to score.
        If score <= 1.0, treated as ratio (0.85 = 85%).
        If score > 1.0 and <= 100.0, treated as percentage (85.0 = 85%).
        """
        weighted_info = cls.calculate_current_weighted_score(assessments)
        current_score = weighted_info["current_weighted_score"]
        remaining_weight = weighted_info["remaining_weight"]

        projected_score = current_score
        pending_assessments = [a for a in assessments if a.get("obtained_marks") is None]

        def _clean_str(s: str) -> str:
            return "".join(c.lower() for c in str(s) if c.isalnum())

        hypo_norm_map = {_clean_str(k): v for k, v in hypothetical_scores.items()}

        for a in assessments:
            if a.get("obtained_marks") is None:
                a_id = str(a.get("id", ""))
                a_name = str(a.get("name", ""))
                weight = float(a.get("weight_percent", 0.0))
                max_m = float(a.get("max_marks", 100.0))

                # 1. Exact match by id or name
                hypo = hypothetical_scores.get(a_id)
                if hypo is None:
                    hypo = hypothetical_scores.get(a_name)

                # 2. Case-insensitive / normalized match
                if hypo is None:
                    hypo = hypo_norm_map.get(_clean_str(a_id)) or hypo_norm_map.get(_clean_str(a_name))

                # 3. Synonym matching for terminal exam / end semester / finals
                if hypo is None:
                    a_norm = _clean_str(a_name)
                    if any(term in a_norm for term in ["end", "sem", "est", "final", "exam"]):
                        for hk, hv in hypo_norm_map.items():
                            if any(term in hk for term in ["end", "sem", "est", "final", "exam"]):
                                hypo = hv
                                break

                # 4. Fallback: single pending assessment with single hypothetical score
                if hypo is None and len(pending_assessments) == 1 and len(hypothetical_scores) == 1:
                    hypo = next(iter(hypothetical_scores.values()))

                if hypo is not None and max_m > 0:
                    val = float(hypo)
                    # If value > max_m and max_m != 100, treat as percentage
                    if val <= 1.0:
                        ratio = max(0.0, val)
                    elif val <= max_m and max_m != 100.0:
                        ratio = max(0.0, val / max_m)
                    else:
                        ratio = max(0.0, min(val / 100.0, 1.0))

                    projected_score += ratio * weight

        projected_score = round(min(100.0, projected_score), 2)
        projected_grade = cls.get_letter_grade(projected_score, grading_scale)

        req_info = None
        if target_total_percent is not None:
            req_info = cls.calculate_required_on_remaining(
                current_score, remaining_weight, target_total_percent
            )

        return {
            "current_weighted_score": current_score,
            "completed_weight": weighted_info["completed_weight"],
            "remaining_weight": remaining_weight,
            "projected_total_score": projected_score,
            "projected_letter_grade": projected_grade,
            "required_on_remaining": req_info,
        }


class ActionPlanEngine:
    """
    Cross-Module Decision Intelligence Engine:
    Synthesizes:
    1. Timetable / Calendar schedule and next upcoming lecture slots
    2. Attendance risk analysis (< 75% or critical < 65% detention threshold)
    3. Upcoming high-weight assessment deadlines and pending tasks
    4. Cross-module collision & trade-off detection (e.g. deadline vs at-risk lecture)
    """

    @classmethod
    def generate_daily_plan(
        cls,
        courses_attendance: List[Dict[str, Any]],
        assessments: List[Dict[str, Any]],
        tasks: List[Dict[str, Any]],
        target_percent: float = 75.0,
        reference_date: Optional[date] = None,
        timetable: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        ref_date = reference_date or date.today()
        day_name = ref_date.strftime("%A")
        actions: List[Dict[str, Any]] = []

        # Map today's timetable slots
        day_slots = [
            s for s in (timetable or [])
            if str(s.get("day_of_week", "")).strip().lower() == day_name.lower()
        ]
        slots_by_code: Dict[str, List[Dict[str, Any]]] = {}
        for s in (timetable or []):
            c_code = str(s.get("course_code", "")).strip().upper()
            slots_by_code.setdefault(c_code, []).append(s)

        # 1. COURSES AT RISK ON ATTENDANCE (Mapped to Timetable Slots)
        at_risk_today: List[Dict[str, Any]] = []

        for c in courses_attendance:
            code = c.get("course_code") or c.get("code") or "Course"
            name = c.get("course_name") or c.get("name") or code
            attended = int(c.get("attended_classes", c.get("attended", 0)))
            total = int(c.get("total_classes", c.get("total_held", 0)))

            pct = AttendanceEngine.calculate_current_percent(attended, total)
            needed = AttendanceEngine.calculate_classes_needed_to_reach_target(
                attended, total, target_percent
            )
            safe_bunks = AttendanceEngine.calculate_safe_bunks_remaining(
                attended, total, target_percent
            )

            # Check if scheduled today
            today_slot = next(
                (s for s in day_slots if str(s.get("course_code", "")).strip().upper() == code.upper()),
                None
            )
            sched_info = (
                f"{today_slot.get('day_of_week', day_name)} {today_slot.get('start_time')}-{today_slot.get('end_time')} @ {today_slot.get('venue')}"
                if today_slot else None
            )

            if pct < 65.0:
                reason = (
                    f"Attendance in {code} ({name}) is {pct:.1f}% (below 65% detention threshold). "
                    + (f"Next lecture is scheduled today at {today_slot.get('start_time')} in {today_slot.get('venue')}. " if today_slot else "")
                    + (f"Attend the next {needed} classes consecutively to reach {target_percent:.0f}%." if needed is not None else "Below critical threshold.")
                )
                action_item = {
                    "id": f"att-crit-{code}",
                    "category": "attendance",
                    "priority": "urgent",
                    "priority_order": 1,
                    "title": f"Critical Attendance Alert in {code}",
                    "course_code": code,
                    "current_percent": pct,
                    "schedule_info": sched_info,
                    "reason": reason,
                    "action_required": f"Attend today's class at {today_slot.get('start_time')} ({today_slot.get('venue')})" if today_slot else (f"Attend next {needed} classes" if needed else "Consult Academic Section"),
                    "risk_score": 95.0,
                }
                actions.append(action_item)
                if today_slot:
                    at_risk_today.append(action_item)

            elif pct < target_percent:
                reason = (
                    f"Attendance in {code} is {pct:.1f}%. "
                    + (f"Today's class is at {today_slot.get('start_time')} ({today_slot.get('venue')}). " if today_slot else "")
                    + (f"Attend the next {needed} classes to reach {target_percent:.0f}%." if needed is not None else "Attend upcoming classes.")
                )
                action_item = {
                    "id": f"att-warn-{code}",
                    "category": "attendance",
                    "priority": "high",
                    "priority_order": 2,
                    "title": f"Attendance Shortage in {code}",
                    "course_code": code,
                    "current_percent": pct,
                    "schedule_info": sched_info,
                    "reason": reason,
                    "action_required": f"Attend class at {today_slot.get('start_time')} ({today_slot.get('venue')})" if today_slot else (f"Attend next {needed} classes" if needed else "Attend upcoming classes"),
                    "risk_score": 75.0,
                }
                actions.append(action_item)
                if today_slot:
                    at_risk_today.append(action_item)

            else:
                if 0 < safe_bunks <= 2:
                    actions.append({
                        "id": f"att-buffer-{code}",
                        "category": "attendance",
                        "priority": "low",
                        "priority_order": 5,
                        "title": f"Tight Attendance Buffer in {code}",
                        "course_code": code,
                        "current_percent": pct,
                        "schedule_info": sched_info,
                        "reason": f"Attendance in {code} is {pct:.1f}%. You have {safe_bunks} safe bunk(s) remaining.",
                        "action_required": "Avoid missing classes",
                        "risk_score": 45.0,
                    })

        # 2. UPCOMING DEADLINES (NEXT 7 DAYS) FROM ASSESSMENTS
        urgent_deadlines: List[Dict[str, Any]] = []

        for a in assessments:
            due_str = a.get("due_date")
            obt = a.get("obtained_marks")
            if due_str and obt is None:
                try:
                    due = (
                        datetime.strptime(due_str, "%Y-%m-%d").date()
                        if isinstance(due_str, str)
                        else due_str
                    )
                    delta_days = (due - ref_date).days
                    if 0 <= delta_days <= 7:
                        priority = "urgent" if delta_days <= 2 else "high"
                        priority_order = 1 if delta_days <= 2 else 2
                        day_word = "today" if delta_days == 0 else f"in {delta_days} day(s)"
                        a_name = a.get("name", "Assessment")
                        c_code = a.get("course_code", "")

                        item = {
                            "id": f"assess-{a.get('id', a_name)}",
                            "category": "deadline",
                            "priority": priority,
                            "priority_order": priority_order,
                            "title": f"Upcoming Assessment: {a_name}",
                            "course_code": c_code,
                            "due_date": due_str,
                            "days_remaining": delta_days,
                            "reason": f"{a_name} ({a.get('weight_percent', 0)}% weight) is due {day_word} ({due_str}).",
                            "action_required": "Prepare and submit",
                            "risk_score": 88.0 if delta_days <= 1 else (75.0 if delta_days <= 3 else 55.0),
                        }
                        actions.append(item)
                        if delta_days <= 1:
                            urgent_deadlines.append(item)
                except Exception:
                    pass

        # 3. PENDING TASKS
        for t in tasks:
            status = str(t.get("status", "")).lower()
            if status == "pending":
                t_title = t.get("title", "Task")
                due_str = t.get("due_date")
                priority = "medium"
                priority_order = 3
                risk_score = 50.0

                reason = f"Pending task: {t_title}"
                if due_str:
                    try:
                        due = (
                            datetime.strptime(due_str, "%Y-%m-%d").date()
                            if isinstance(due_str, str)
                            else due_str
                        )
                        delta_days = (due - ref_date).days
                        if delta_days <= 2:
                            priority = "urgent"
                            priority_order = 1
                            risk_score = 80.0
                            reason = f"Urgent task due {due_str}: {t_title}"
                        elif delta_days <= 7:
                            priority = "high"
                            priority_order = 2
                            risk_score = 65.0
                            reason = f"Task due {due_str}: {t_title}"
                    except Exception:
                        pass

                actions.append({
                    "id": f"task-{t.get('id', t_title)}",
                    "category": "task",
                    "priority": priority,
                    "priority_order": priority_order,
                    "title": t_title,
                    "due_date": due_str,
                    "reason": reason,
                    "action_required": "Mark complete once done",
                    "risk_score": risk_score,
                })

        # 4. CROSS-MODULE TRADE-OFF & SCHEDULE CONFLICT DETECTION
        # When an urgent deadline collides on the same day with an at-risk attendance lecture
        for r_item in at_risk_today:
            for d_item in urgent_deadlines:
                c_code = r_item.get("course_code", "")
                c_pct = r_item.get("current_percent", 0.0)
                d_title = d_item.get("title", "")
                sched_info = r_item.get("schedule_info") or "today"

                conflict_id = f"conflict-{c_code}-{d_item.get('id', 'item')}"
                actions.insert(0, {
                    "id": conflict_id,
                    "category": "conflict",
                    "priority": "urgent",
                    "priority_order": 0,
                    "title": f"Schedule Trade-off Alert: {c_code} vs {d_title}",
                    "course_code": c_code,
                    "current_percent": c_pct,
                    "schedule_info": sched_info,
                    "conflict_warning": f"Risk of skipping {c_code} ({c_pct:.1f}% attendance) to finish {d_title}.",
                    "reason": f"Urgent assessment '{d_title}' is due, but {c_code} attendance is dangerously low at {c_pct:.1f}% with class scheduled today ({sched_info}). Under TIET Section 6.2, do NOT bunk this lecture.",
                    "action_required": f"Attend {c_code} lecture at scheduled slot; complete {d_title} in designated evening study block.",
                    "risk_score": 99.0,
                })

        # Sort actions by priority_order (0=conflict, 1=urgent, 2=high, 3=medium, etc.)
        # then by risk_score descending
        actions.sort(key=lambda x: (x.get("priority_order", 99), -float(x.get("risk_score", 0.0))))
        return actions

    @classmethod
    def generate_decision_matrix(
        cls,
        courses_attendance: List[Dict[str, Any]],
        assessments: List[Dict[str, Any]],
        tasks: List[Dict[str, Any]],
        timetable: List[Dict[str, Any]],
        target_percent: float = 75.0,
        reference_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Synthesizes cross-module decision intelligence into a unified action matrix.
        """
        ref_d = reference_date or date.today()
        day_name = ref_d.strftime("%A")

        actions = cls.generate_daily_plan(
            courses_attendance=courses_attendance,
            assessments=assessments,
            tasks=tasks,
            target_percent=target_percent,
            reference_date=ref_d,
            timetable=timetable,
        )

        conflicts = [a for a in actions if a.get("category") == "conflict"]

        # Today's schedule annotated with live attendance standing
        today_slots = [
            s for s in (timetable or [])
            if str(s.get("day_of_week", "")).strip().lower() == day_name.lower()
        ]
        annotated_schedule = []
        for s in today_slots:
            code = s.get("course_code", "").upper()
            c_att = next(
                (c for c in courses_attendance if str(c.get("course_code", "")).upper() == code),
                None
            )
            pct = 100.0
            status_val = "safe"
            if c_att:
                a = int(c_att.get("attended_classes", c_att.get("attended", 0)))
                t = int(c_att.get("total_classes", c_att.get("total_held", 0)))
                pct = AttendanceEngine.calculate_current_percent(a, t)
                status_val = AttendanceEngine.evaluate_status(pct, target_percent)

            annotated_schedule.append({
                "course_code": code,
                "course_name": s.get("course_name", code),
                "day_of_week": s.get("day_of_week", day_name),
                "start_time": s.get("start_time", ""),
                "end_time": s.get("end_time", ""),
                "venue": s.get("venue", ""),
                "slot_type": s.get("slot_type", "Lecture"),
                "current_attendance_percent": pct,
                "attendance_status": status_val,
                "is_attendance_mandatory": pct < target_percent,
            })

        # Calculate academic standing summary
        safe_count = 0
        warning_count = 0
        critical_count = 0
        for c in courses_attendance:
            a = int(c.get("attended_classes", c.get("attended", 0)))
            t = int(c.get("total_classes", c.get("total_held", 0)))
            p = AttendanceEngine.calculate_current_percent(a, t)
            if p < 65.0:
                critical_count += 1
            elif p < target_percent:
                warning_count += 1
            else:
                safe_count += 1

        # Determine recommended focus
        if conflicts:
            c = conflicts[0]
            recommended_focus = f"Schedule Collision: Protect {c['course_code']} class at {c.get('schedule_info', 'scheduled slot')} to prevent detention risk, then complete pending deadlines."
        elif any(a["priority"] == "urgent" and a["category"] == "attendance" for a in actions):
            top_att = next(a for a in actions if a["priority"] == "urgent" and a["category"] == "attendance")
            recommended_focus = f"Critical Attendance: Attend next {top_att['course_code']} lecture consecutively. You are in the detention risk zone."
        elif any(a["priority"] == "urgent" and a["category"] == "deadline" for a in actions):
            top_d = next(a for a in actions if a["priority"] == "urgent" and a["category"] == "deadline")
            recommended_focus = f"High-Stakes Deadline: Prioritize preparation for {top_d['title']}."
        else:
            recommended_focus = "Academic standing is secure across all registered courses. Maintain attendance momentum."

        return {
            "date": ref_d.isoformat(),
            "recommended_focus": recommended_focus,
            "conflicts": conflicts,
            "today_schedule": annotated_schedule,
            "priorities": actions,
            "academic_standing_summary": {
                "safe": safe_count,
                "warning": warning_count,
                "critical": critical_count,
            },
        }
