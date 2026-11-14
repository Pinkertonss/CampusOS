from fastapi.testclient import TestClient
from app.main import app
from app.database import db

client = TestClient(app)
AUTH_HEADER = {"Authorization": "Bearer dev-user-102203099"}

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_get_courses():
    res = client.get("/api/academic/courses", headers=AUTH_HEADER)
    assert res.status_code == 200
    courses = res.json()
    assert len(courses) >= 5
    assert any(c["course_code"] == "UCS301" for c in courses)

def test_get_attendance():
    res = client.get("/api/academic/attendance", headers=AUTH_HEADER)
    assert res.status_code == 200
    records = res.json()
    assert len(records) >= 5
    # Check that warning and safe statuses exist
    statuses = {r["status"] for r in records}
    assert "safe" in statuses
    assert "warning" in statuses

def test_what_if_attendance_endpoint():
    payload = {
        "course_code": "UCS405",
        "attended_classes": 18,
        "total_classes": 25,
        "upcoming_classes_to_attend": 4,
        "total_upcoming_classes": 4,
    }
    res = client.post("/api/academic/what-if/attendance", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["current_percentage"] == 72.0
    # 22 / 29 = 75.9% -> safe
    assert data["simulated_percentage"] == 75.9
    assert data["status_assessment"] == "safe"

def test_copilot_ask_and_confirm_task():
    # Ask question
    res = client.post("/api/copilot/ask", json={"query": "When is the fee payment deadline?"})
    assert res.status_code == 200
    data = res.json()
    assert data["answered"] is True
    assert data["actionable_suggestion"] is not None
    
    # Explicitly confirm actionable task
    confirm_payload = {
        "title": data["actionable_suggestion"]["title"],
        "due_date": data["actionable_suggestion"]["due_date"],
        "priority": data["actionable_suggestion"]["priority"],
        "course_code": data["actionable_suggestion"]["course_code"],
    }
    confirm_res = client.post("/api/copilot/confirm-task", json=confirm_payload)
    assert confirm_res.status_code == 200
    task_data = confirm_res.json()
    assert task_data["source"] == "copilot_action"
    assert task_data["title"] == confirm_payload["title"]

def test_vault_consent_and_upload():
    # Initially consent might be false
    consent_res = client.get("/api/vault/consent")
    assert consent_res.status_code == 200

    # Give consent
    post_consent = client.post("/api/vault/consent", json={"consent_given": True})
    assert post_consent.status_code == 200
    assert post_consent.json()["consent_given"] is True

    # Upload a document
    file_content = b"%PDF-1.4 Mock PDF content for test"
    upload_res = client.post(
        "/api/vault/upload",
        files={"file": ("test_cert.pdf", file_content, "application/pdf")},
        data={"title": "Test Certificate", "category": "certificates", "tags": "test,cert"},
        headers=AUTH_HEADER,
    )
    assert upload_res.status_code == 200
    uploaded_doc = upload_res.json()
    assert uploaded_doc["title"] == "Test Certificate"
    assert uploaded_doc["category"] == "certificates"

def test_reuse_items_and_impact():
    res = client.get("/api/reuse/items")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0

    impact_res = client.get("/api/reuse/impact")
    assert impact_res.status_code == 200
    impact = impact_res.json()
    assert impact["total_exchanges_completed"] > 0
    assert impact["total_money_saved_inr"] > 0
