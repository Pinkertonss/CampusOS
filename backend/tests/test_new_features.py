import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

STUDENT_TOKEN = "dev-user-102203099"
STUDENT_AUTH = {"Authorization": f"Bearer {STUDENT_TOKEN}"}

OTHER_STUDENT_TOKEN = "dev-user-102203100"
OTHER_STUDENT_AUTH = {"Authorization": f"Bearer {OTHER_STUDENT_TOKEN}"}

ADMIN_TOKEN = "dev-admin"
ADMIN_AUTH = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

OPP_MGR_TOKEN = "dev-opportunity-manager"
OPP_MGR_AUTH = {"Authorization": f"Bearer {OPP_MGR_TOKEN}"}


# ============================================================
# 1. Lost & Found Tests
# ============================================================

def test_lost_and_found_create_and_privacy_redaction():
    # 1. Student creates a lost item report
    payload = {
        "report_type": "lost",
        "title": "TIET Blue Scientific Calculator Casio fx-991EX",
        "description": "Lost near Computer Science Block 2nd floor lab.",
        "category": "electronics",
        "location": "CS Block Lab 204",
        "event_date": "2026-11-14",
        "image_urls": ["/images/resell/calculator.svg"],
    }
    create_res = client.post("/api/lost-and-found", json=payload, headers=STUDENT_AUTH)
    assert create_res.status_code == 201
    item = create_res.json()
    item_id = item["id"]
    assert item["title"] == payload["title"]
    assert item["status"] == "open"
    assert item["reporter_id"] == "102203099-tiet-user"

    # 2. Public / unauthenticated reports list masks reporter details
    list_res = client.get("/api/lost-and-found")
    assert list_res.status_code == 200
    reports = list_res.json()
    matching = [r for r in reports if r["id"] == item_id]
    assert len(matching) == 1
    found = matching[0]
    # No sensitive contact info or direct phone exposed
    assert "phone" not in found
    if found.get("reporter_email_masked"):
        assert "*" in found["reporter_email_masked"]

    # 3. Another student submits an ownership claim with private distinguishing proof
    claim_payload = {
        "distinguishing_proof": "It has a yellow Pikachu sticker on the sliding back cover and serial number ends in 8421."
    }
    claim_res = client.post(
        f"/api/lost-and-found/{item_id}/claim",
        json=claim_payload,
        headers=OTHER_STUDENT_AUTH,
    )
    assert claim_res.status_code == 201
    claim_data = claim_res.json()
    claim_id = claim_data["id"]
    assert claim_data["status"] == "pending"

    # 4. Third-party student CANNOT see the private distinguishing proof
    third_party_auth = {"Authorization": "Bearer dev-user-102203105"}
    unauth_claims_res = client.get(f"/api/lost-and-found/{item_id}/claims", headers=third_party_auth)
    assert unauth_claims_res.status_code == 403

    # 5. Item Reporter (owner) CAN see the private proof
    owner_claims_res = client.get(f"/api/lost-and-found/{item_id}/claims", headers=STUDENT_AUTH)
    assert owner_claims_res.status_code == 200
    owner_claims = owner_claims_res.json()
    assert len(owner_claims) >= 1
    assert any("Pikachu sticker" in c["distinguishing_proof"] for c in owner_claims)

    # 6. Item Reporter verifies the claim
    verify_res = client.post(
        f"/api/lost-and-found/{item_id}/claims/{claim_id}/verify",
        json={"action": "verify", "notes": "Confirmed sticker matches"},
        headers=STUDENT_AUTH,
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "verified"

    # 7. Item Reporter marks item as resolved
    resolve_res = client.post(
        f"/api/lost-and-found/{item_id}/resolve",
        json={"resolution_notes": "Handed back to claimant at library desk."},
        headers=STUDENT_AUTH,
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "resolved"


def test_lost_and_found_admin_moderation():
    # Admin creates and archives a report
    payload = {
        "report_type": "found",
        "title": "Campus ID Card Found in TAN Audi",
        "description": "Found on row 4 seat 12.",
        "category": "documents",
        "location": "TAN Auditorium",
    }
    res = client.post("/api/lost-and-found", json=payload, headers=ADMIN_AUTH)
    assert res.status_code == 201
    item_id = res.json()["id"]

    # Admin archives it
    archive_res = client.post(f"/api/lost-and-found/{item_id}/archive", headers=ADMIN_AUTH)
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "archived"


# ============================================================
# 2. Support Ticket Tests
# ============================================================

def test_support_tickets_lifecycle_and_isolation():
    # 1. Student creates a support ticket
    ticket_payload = {
        "category": "technical",
        "subject": "Unable to preview timetable slot",
        "description": "When clicking Friday 3PM lecture, the modal displays loading spinner.",
        "priority": "medium",
    }
    create_res = client.post("/api/support/tickets", json=ticket_payload, headers=STUDENT_AUTH)
    assert create_res.status_code == 201
    ticket = create_res.json()
    ticket_id = ticket["id"]
    assert ticket["status"] == "open"
    assert ticket["user_id"] == "102203099-tiet-user"

    # 2. Student lists their tickets (contains their ticket)
    my_tickets_res = client.get("/api/support/tickets", headers=STUDENT_AUTH)
    assert my_tickets_res.status_code == 200
    my_tickets = my_tickets_res.json()
    assert any(t["id"] == ticket_id for t in my_tickets)

    # 3. Another student lists tickets (must NOT see student 1's ticket)
    other_res = client.get("/api/support/tickets", headers=OTHER_STUDENT_AUTH)
    assert other_res.status_code == 200
    other_tickets = other_res.json()
    assert not any(t["id"] == ticket_id for t in other_tickets)

    # 4. Another student CANNOT update ticket (403 Forbidden)
    forbidden_update = client.put(
        f"/api/support/tickets/{ticket_id}",
        json={"admin_response": "Fake resolution", "status": "resolved"},
        headers=OTHER_STUDENT_AUTH,
    )
    assert forbidden_update.status_code == 403

    # 5. Administrator responds to and resolves ticket
    admin_res = client.put(
        f"/api/support/tickets/{ticket_id}",
        json={"admin_response": "Cache invalidated on timetable service. Resolved.", "status": "resolved"},
        headers=ADMIN_AUTH,
    )
    assert admin_res.status_code == 200
    resolved = admin_res.json()
    assert resolved["status"] == "resolved"
    assert "Cache invalidated" in resolved["admin_response"]


# ============================================================
# 3. Personal Assistant Tests
# ============================================================

def test_personal_assistant_status():
    res = client.get("/api/assistant/status")
    assert res.status_code == 200
    data = res.json()
    assert "model" in data
    assert "rate_limit_rpm" in data


def test_personal_assistant_safe_calculation():
    # Valid AST calculation
    res = client.post(
        "/api/assistant/calculate",
        json={"expression": "(8.4 * 20 + 9.0 * 22) / 42"},
        headers=STUDENT_AUTH,
    )
    assert res.status_code == 200
    data = res.json()
    assert abs(data["result"] - 8.714) < 0.01

    # Security check: Unsafe code injection / eval attempt must be safely rejected
    malicious = client.post(
        "/api/assistant/calculate",
        json={"expression": "__import__('os').system('ls')"},
        headers=STUDENT_AUTH,
    )
    assert malicious.status_code == 400


def test_personal_assistant_chat_without_api_key_fails_cleanly():
    # When GEMINI_API_KEY is dummy or missing, returns 503 Service Unavailable with friendly message
    res = client.post(
        "/api/assistant/chat",
        json={"message": "Explain binary search trees simply."},
        headers=STUDENT_AUTH,
    )
    # Either succeeds if key configured, or returns 503 service unavailable with clear detail
    assert res.status_code in (200, 503)


# ============================================================
# 4. Admin Opportunities & Live Matching Preview Tests
# ============================================================

def test_admin_opportunities_preview_matching():
    # Admin evaluates draft matching preview before creating opportunity
    draft_opp = {
        "title": "Quantum Computing Research Fellowship",
        "organization": "TIET Physics & Quantum Lab",
        "description": "Quantum systems and tensor networks research.",
        "category": "research",
        "role_type": "research_assistant",
        "location": "Patiala, Punjab",
        "stipend": "₹20,000 / month",
        "time_commitment_hrs_week": 15,
        "application_deadline": "2026-12-31",
        "required_skills": ["Python", "Quantum Mechanics", "Linear Algebra"],
        "criteria": {
          "min_cgpa": 8.0,
          "allowed_branches": ["COE", "CSE", "ENC"],
          "max_active_backlogs": 0,
          "min_attendance_percentage": 75,
        },
    }

    # Student cannot run preview (403 Forbidden)
    student_preview = client.post(
        "/api/opportunities/preview-matching",
        json=draft_opp,
        headers=STUDENT_AUTH,
    )
    assert student_preview.status_code == 403

    # Admin/Opportunity Manager can preview matching
    admin_preview = client.post(
        "/api/opportunities/preview-matching",
        json=draft_opp,
        headers=ADMIN_AUTH,
    )
    assert admin_preview.status_code == 200
    preview_data = admin_preview.json()
    assert "eligible_count" in preview_data
    assert "not_eligible_count" in preview_data
    assert "incomplete_profile_count" in preview_data
    assert "total_candidates_evaluated" in preview_data


def test_admin_opportunities_crud_and_status_transitions():
    # Create opportunity as draft
    new_opp = {
        "title": "Autonomous Robotics Lab Intern",
        "organization": "TIET Mechatronics Society",
        "description": "Research on autonomous navigation and path planning for robotic rovers.",
        "category": "project",
        "role_type": "internship",
        "location": "Patiala, Punjab",
        "stipend": "₹12,000 / month",
        "time_commitment_hrs_week": 12,
        "application_deadline": "2026-12-01",
        "required_skills": ["C++", "ROS", "Python"],
        "criteria": {
          "min_cgpa": 7.0,
          "allowed_branches": ["COE", "MECH"],
          "max_active_backlogs": 1,
          "min_attendance_percentage": 70,
        },
    }
    create_res = client.post("/api/opportunities", json=new_opp, headers=ADMIN_AUTH)
    assert create_res.status_code in (200, 201)
    opp = create_res.json()
    opp_id = opp["id"]

    # Publish opportunity
    pub_res = client.post(f"/api/opportunities/{opp_id}/publish", headers=ADMIN_AUTH)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "open"

    # Close opportunity
    close_res = client.post(f"/api/opportunities/{opp_id}/close", headers=ADMIN_AUTH)
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "closed"

    # Archive opportunity
    arch_res = client.post(f"/api/opportunities/{opp_id}/archive", headers=ADMIN_AUTH)
    assert arch_res.status_code == 200
    assert arch_res.json()["status"] == "archived"


def test_campus_guide_route_alias():
    # Campus Guide route /api/guide/documents works identical to /api/copilot/documents
    res = client.get("/api/guide/documents", headers=ADMIN_AUTH)
    assert res.status_code == 200
    docs = res.json()
    assert isinstance(docs, list)
