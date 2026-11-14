import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import db

client = TestClient(app)

AUTH_HEADER = {"Authorization": "Bearer dev-user-102203099"}


def test_list_opportunities_public_and_filter():
    res = client.get("/api/opportunities")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 5
    assert any(o["id"] == "opp-1" for o in data)

    # Filter by category
    res_research = client.get("/api/opportunities?category=research")
    assert res_research.status_code == 200
    research_items = res_research.json()
    assert len(research_items) >= 2
    assert all(o["category"] == "research" for o in research_items)

    # Search keyword
    res_search = client.get("/opportunities?search=robotics")
    assert res_search.status_code == 200
    search_items = res_search.json()
    assert len(search_items) >= 1
    assert any("Robotics" in o["title"] or "robotics" in o["description"].lower() for o in search_items)


def test_recommended_opportunities_unauthorized_fails():
    res = client.get("/api/opportunities/recommended")
    assert res.status_code == 401


def test_recommended_opportunities_authenticated():
    res = client.get("/api/opportunities/recommended", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert "student_id" in data
    assert "recommendations" in data
    assert "student_skills" in data
    assert data["opt_in_matching"] is True

    recs = data["recommendations"]
    assert len(recs) >= 5
    # Verify descending sort by match_score
    scores = [r["match_score"] for r in recs]
    assert scores == sorted(scores, reverse=True)

    # First recommendation should have high match score
    top_rec = recs[0]
    assert top_rec["match_score"] >= 70.0
    assert len(top_rec["matched_skills"]) > 0
    assert "recommendation_reason" in top_rec
    assert len(top_rec["recommendation_reason"]) > 10


def test_schedule_collision_and_academic_advisory():
    # User has UMA010 at 60.7% (critical detention threshold)
    res = client.get("/opportunities/recommended", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    recs = data["recommendations"]

    # Check that high commitment opportunities contain academic advisory warning
    high_hrs_opp = next((r for r in recs if r["opportunity"]["time_commitment_hrs_week"] >= 10), None)
    if high_hrs_opp:
        assert high_hrs_opp["academic_advisory"] is not None
        assert "detention" in high_hrs_opp["academic_advisory"].lower() or "attendance" in high_hrs_opp["academic_advisory"].lower()


def test_student_skill_profile_get_and_update():
    # GET profile
    res = client.get("/api/opportunities/profile", headers=AUTH_HEADER)
    assert res.status_code == 200
    p = res.json()
    assert "skills" in p
    assert "Python" in p["skills"]

    # UPDATE profile
    update_payload = {
        "skills": ["Rust", "Solana", "Next.js"],
        "available_hours_per_week": 15,
        "opt_in_matching": True,
    }
    res_up = client.put("/api/opportunities/profile", json=update_payload, headers=AUTH_HEADER)
    assert res_up.status_code == 200
    updated = res_up.json()
    assert "Rust" in updated["skills"]
    assert updated["available_hours_per_week"] == 15

    # Check updated recommendations reflect new skill
    res_rec = client.get("/api/opportunities/recommended", headers=AUTH_HEADER)
    assert res_rec.status_code == 200
    rec_data = res_rec.json()
    assert "Rust" in rec_data["student_skills"]

    # Restore default skills
    restore_payload = {
        "skills": ["Python", "FastAPI", "Next.js", "TypeScript", "Machine Learning"],
        "available_hours_per_week": 10,
        "opt_in_matching": True,
    }
    client.put("/api/opportunities/profile", json=restore_payload, headers=AUTH_HEADER)


def test_opt_in_matching_toggle():
    # Set opt-in to False
    client.put("/api/opportunities/profile", json={"opt_in_matching": False}, headers=AUTH_HEADER)

    res = client.get("/api/opportunities/recommended", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data["opt_in_matching"] is False
    assert len(data["recommendations"]) == 0

    # Re-enable opt-in
    client.put("/api/opportunities/profile", json={"opt_in_matching": True}, headers=AUTH_HEADER)


def test_save_and_get_saved_opportunities():
    # Save opp-1
    res_save = client.post("/api/opportunities/opp-1/save", headers=AUTH_HEADER)
    assert res_save.status_code == 200
    assert res_save.json()["saved"] is True

    # List saved
    res_list = client.get("/api/opportunities/saved", headers=AUTH_HEADER)
    assert res_list.status_code == 200
    saved = res_list.json()
    assert any(o["id"] == "opp-1" for o in saved)

    # Toggle unsave
    res_unsave = client.post("/opportunities/opp-1/save", headers=AUTH_HEADER)
    assert res_unsave.status_code == 200
    assert res_unsave.json()["saved"] is False

    # Verify not in saved list
    res_list2 = client.get("/opportunities/saved", headers=AUTH_HEADER)
    assert res_list2.status_code == 200
    assert not any(o["id"] == "opp-1" for o in res_list2.json())


def test_save_nonexistent_opportunity_fails():
    res = client.post("/api/opportunities/non-existent-999/save", headers=AUTH_HEADER)
    assert res.status_code == 404
