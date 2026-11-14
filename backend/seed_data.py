#!/usr/bin/env python3
"""
Seed script for CampusOS single-campus pilot (Thapar Institute).
Can be run standalone to verify or reset data.
"""
from app.database import db
from app.services.rag_engine import rag_engine
from app.services.impact_engine import impact_engine

def verify_seeded_data():
    print("=" * 60)
    print("Verifying CampusOS Seed Data for Thapar Institute Pilot")
    print("=" * 60)
    
    print(f"Courses loaded: {len(db.courses)}")
    for c in db.courses.values():
        print(f"  - {c.course_code}: {c.course_name} ({c.credits} cr, Grade: {c.grade or 'Ongoing'})")
        
    print(f"\nAttendance Records: {len(db.attendance)}")
    for a in db.attendance.values():
        print(f"  - {a.course_code}: {a.attended_classes}/{a.total_classes} ({a.percentage}%) -> Status: {a.status.upper()}")
        
    print(f"\nCampus Corpus Chunks: {len(rag_engine.corpus)}")
    for chunk in rag_engine.corpus:
        print(f"  - [{chunk['document_type']}] {chunk['document_title']}: {chunk['section_title']}")
        
    impact = impact_engine.calculate_metrics(list(db.reuse_items.values()))
    print(f"\nCampus Reuse Impact:")
    print(f"  - Completed Exchanges: {impact.total_exchanges_completed}")
    print(f"  - Money Saved: ₹{impact.total_money_saved_inr:,.2f}")
    print(f"  - Waste Diverted: {impact.total_waste_diverted_kg} kg")
    print(f"  - CO2 Avoided: {impact.co2_avoided_kg} kg")
    print("=" * 60)
    print("Seed verification complete!")

if __name__ == "__main__":
    verify_seeded_data()
