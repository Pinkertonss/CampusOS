import uuid
from datetime import datetime
from typing import List, Dict, Optional
from .models.academic import Course, AttendanceRecord, TimetableSlot, DeadlineTask
from .models.vault import VaultDocument
from .models.reuse import ReuseItem
from .services.what_if_engine import WhatIfEngine

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
        self._seed_sample_data()

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

        # 4. Seed Deadlines & Academic Tasks
        self.deadlines = [
            DeadlineTask(
                id="dl-1",
                title="UCS301 Assignment 3: Red-Black Trees Implementation",
                course_code="UCS301",
                due_date="2024-11-20T23:59:00",
                status="pending",
                priority="high",
                source="syllabus"
            ),
            DeadlineTask(
                id="dl-2",
                title="DBMS Mid-Term Project Phase 1 Report",
                course_code="UCS310",
                due_date="2024-11-24T17:00:00",
                status="pending",
                priority="medium",
                source="manual"
            ),
            DeadlineTask(
                id="dl-3",
                title="Mathematics Tutorial Sheet 4 Submission",
                course_code="UMA010",
                due_date="2024-11-18T10:00:00",
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

db = CampusOSDatabase()
