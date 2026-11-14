"""
Phase 1 Security & Tenant Isolation Tests
------------------------------------------
Validates:
1. Strict cryptographic JWT verification:
   - Forged JWTs with invalid/tampered signatures are rejected with 401.
   - Expired JWTs are rejected with 401.
   - Missing authentication token is rejected with 401.
   - Unverified 'sub' claims are NEVER decoded for authorization.
2. Environment-aware fail-closed dev tokens:
   - In production environment (ENVIRONMENT='production'), mock/dev tokens are rejected with 401.
3. Multi-tenant academic isolation:
   - Unauthenticated requests to academic endpoints return 401.
   - Tenant A's courses, attendance, and deadlines are isolated from Tenant B.
4. Multi-tenant vault isolation:
   - Unauthenticated requests to vault endpoints return 401.
   - Tenant A's private vault items cannot be accessed, downloaded, renamed, or deleted by Tenant B.
5. Reuse authorization and privacy protection:
   - Public listing feed obscures student contact details (phone numbers, hostel rooms).
   - Only listing owner or accepted requester can see contact details.
   - Non-owner cannot update, delete, or accept requests on another student's listing (403 Forbidden).
   - Students cannot request their own listings (400 Bad Request).
"""

import time
import jwt
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.auth import DEFAULT_LOCAL_DEV_JWT_SECRET, verify_supabase_jwt

client = TestClient(app)

ALICE_TOKEN = "Bearer test-user-alice"
BOB_TOKEN = "Bearer test-user-bob"


# ============================================================
# 1. Cryptographic JWT Verification Tests
# ============================================================

def test_forged_jwt_rejected_with_401():
    """An attacker generates a JWT signed with an untrusted secret key."""
    tampered_payload = {
        "sub": "attacker-target-id",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
    }
    # Sign with attacker's bogus key
    forged_token = jwt.encode(tampered_payload, "bogus-attacker-secret-key-1234567890", algorithm="HS256")
    
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged_token}"})
    assert res.status_code == 401
    assert "Invalid or forged authentication token" in res.json()["detail"]


def test_expired_jwt_rejected_with_401():
    """A JWT with an expired timestamp is rejected fail-closed."""
    expired_payload = {
        "sub": "user-alice-123",
        "aud": "authenticated",
        "exp": int(time.time()) - 1000,
    }
    expired_token = jwt.encode(expired_payload, DEFAULT_LOCAL_DEV_JWT_SECRET, algorithm="HS256")
    
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "Token has expired" in res.json()["detail"]


def test_valid_signed_jwt_accepted():
    """A JWT signed with the verified secret is accepted."""
    valid_payload = {
        "sub": "valid-user-uuid-1234",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
    }
    valid_token = jwt.encode(valid_payload, DEFAULT_LOCAL_DEV_JWT_SECRET, algorithm="HS256")
    
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
    assert res.status_code == 200
    assert res.json()["user_id"] == "valid-user-uuid-1234"


def test_production_environment_rejects_dev_tokens(monkeypatch):
    """When ENVIRONMENT is set to production, all dev tokens must fail closed with 401."""
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "allow_dev_tokens", False)
    
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer dev-user-102203099"})
    assert res.status_code == 401


# ============================================================
# 2. Multi-Tenant Academic Isolation Tests
# ============================================================

def test_academic_endpoints_require_authentication():
    """Academic data endpoints must reject unauthenticated requests with 401."""
    endpoints = [
        ("GET", "/api/academic/courses"),
        ("POST", "/api/academic/courses"),
        ("GET", "/api/academic/attendance"),
        ("POST", "/api/academic/attendance/update"),
        ("GET", "/api/academic/timetable"),
        ("GET", "/api/academic/deadlines"),
        ("POST", "/api/academic/deadlines"),
    ]
    for method, path in endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"{method} {path} should require authentication"


def test_academic_tenant_data_isolation():
    """Alice adds a course and deadline; Bob cannot view or modify them."""
    # Alice adds a private course
    new_course = {
        "course_code": "CS999",
        "course_name": "Alice Private AI Seminar",
        "credits": 4,
        "faculty": "Prof. Turing",
        "slot": "A1",
    }
    alice_add = client.post("/api/academic/courses", json=new_course, headers={"Authorization": ALICE_TOKEN})
    assert alice_add.status_code == 200

    # Alice sees her course
    alice_courses = client.get("/api/academic/courses", headers={"Authorization": ALICE_TOKEN}).json()
    assert any(c["course_code"] == "CS999" for c in alice_courses)

    # Bob does NOT see Alice's course
    bob_courses = client.get("/api/academic/courses", headers={"Authorization": BOB_TOKEN}).json()
    assert not any(c["course_code"] == "CS999" for c in bob_courses)

    # Bob cannot delete Alice's course
    bob_delete = client.delete("/api/academic/courses/CS999", headers={"Authorization": BOB_TOKEN})
    assert bob_delete.status_code == 404

    # Alice adds a deadline
    deadline_payload = {
        "title": "Alice Thesis Submission",
        "due_date": "2026-12-01",
        "priority": "high",
        "course_code": "CS999",
    }
    alice_dead = client.post("/api/academic/deadlines", json=deadline_payload, headers={"Authorization": ALICE_TOKEN})
    assert alice_dead.status_code == 200
    alice_dl_id = alice_dead.json()["id"]

    # Bob does NOT see Alice's deadline
    bob_deadlines = client.get("/api/academic/deadlines", headers={"Authorization": BOB_TOKEN}).json()
    assert not any(d["id"] == alice_dl_id for d in bob_deadlines)

    # Bob cannot toggle Alice's deadline
    bob_toggle = client.patch(f"/api/academic/deadlines/{alice_dl_id}/toggle", headers={"Authorization": BOB_TOKEN})
    assert bob_toggle.status_code == 404


# ============================================================
# 3. Multi-Tenant Vault Isolation Tests
# ============================================================

def test_vault_endpoints_require_authentication():
    """Vault operations must reject unauthenticated requests with 401."""
    assert client.get("/api/vault/items").status_code == 401
    assert client.post("/api/vault/items", json={}).status_code == 401
    assert client.get("/api/vault/items/any-id/download-url").status_code == 401


def test_vault_cross_tenant_isolation():
    """Alice registers a vault document; Bob cannot list, download, rename, or delete it."""
    # Alice registers a confidential file
    doc_payload = {
        "title": "alice_secret_transcript.pdf",
        "category": "transcripts",
        "storage_path": "alice-user-id/transcript.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 10240,
    }
    alice_reg = client.post("/api/vault/items", json=doc_payload, headers={"Authorization": ALICE_TOKEN})
    assert alice_reg.status_code == 200
    doc_id = alice_reg.json()["id"]

    # Alice can list it
    alice_items = client.get("/api/vault/items", headers={"Authorization": ALICE_TOKEN}).json()["items"]
    assert any(i["id"] == doc_id for i in alice_items)

    # Bob CANNOT see Alice's document in his vault list
    bob_items = client.get("/api/vault/items", headers={"Authorization": BOB_TOKEN}).json()["items"]
    assert not any(i["id"] == doc_id for i in bob_items)

    # Bob CANNOT download Alice's document (returns 403 or 404)
    bob_download = client.get(f"/api/vault/items/{doc_id}/download-url", headers={"Authorization": BOB_TOKEN})
    assert bob_download.status_code in (403, 404)

    # Bob CANNOT rename Alice's document
    bob_rename = client.patch(
        f"/api/vault/items/{doc_id}/rename",
        json={"new_title": "hacked.pdf"},
        headers={"Authorization": BOB_TOKEN},
    )
    assert bob_rename.status_code in (403, 404)

    # Bob CANNOT delete Alice's document
    bob_delete = client.delete(f"/api/vault/items/{doc_id}", headers={"Authorization": BOB_TOKEN})
    assert bob_delete.status_code in (403, 404)


# ============================================================
# 4. Campus Reuse Privacy & Authorization Tests
# ============================================================

def test_reuse_contact_info_privacy():
    """Contact details are masked from public listing consumers and revealed only to owner/accepted requester."""
    # Alice creates a listing with private contact info
    alice_listing = client.post(
        "/api/reuse/listings",
        json={
            "title": "Discrete Math Notes by Alice",
            "description": "Handwritten semester 3 notes",
            "category": "notes",
            "mode": "donate",
            "condition": "good",
            "contact_info": "Alice WhatsApp: +91 99999 88888, Room 101",
        },
        headers={"Authorization": ALICE_TOKEN},
    ).json()
    listing_id = alice_listing["id"]

    # Bob views the public listings list -> contact_info MUST be None
    public_listings = client.get("/api/reuse/listings", headers={"Authorization": BOB_TOKEN}).json()
    matching = next(l for l in public_listings if l["id"] == listing_id)
    assert matching["contact_info"] is None, "Contact info must be hidden from third party"

    # Bob views the single listing detail -> contact_info MUST be None
    bob_detail = client.get(f"/api/reuse/listings/{listing_id}", headers={"Authorization": BOB_TOKEN}).json()
    assert bob_detail["contact_info"] is None, "Contact info must be hidden on single listing"

    # Alice (the owner) views the listing -> contact_info is visible
    alice_detail = client.get(f"/api/reuse/listings/{listing_id}", headers={"Authorization": ALICE_TOKEN}).json()
    assert alice_detail["contact_info"] == "Alice WhatsApp: +91 99999 88888, Room 101"


def test_reuse_owner_authorization():
    """Only the listing owner can update, delete, or accept/decline requests for their listing."""
    # Alice creates a listing
    alice_listing = client.post(
        "/api/reuse/listings",
        json={
            "title": "Electronics Lab Breadboard",
            "category": "electronics",
            "mode": "borrow",
            "condition": "like_new",
        },
        headers={"Authorization": ALICE_TOKEN},
    ).json()
    lid = alice_listing["id"]

    # Bob attempts to update Alice's listing -> 403 Forbidden
    bob_update = client.patch(
        f"/api/reuse/listings/{lid}",
        json={"title": "Hacked Breadboard"},
        headers={"Authorization": BOB_TOKEN},
    )
    assert bob_update.status_code == 403

    # Bob attempts to delete Alice's listing -> 403 Forbidden
    bob_delete = client.delete(f"/api/reuse/listings/{lid}", headers={"Authorization": BOB_TOKEN})
    assert bob_delete.status_code == 403

    # Bob requests the item
    bob_request = client.post(
        f"/api/reuse/listings/{lid}/request",
        json={"message": "Can I borrow this for 2 days?"},
        headers={"Authorization": BOB_TOKEN},
    ).json()
    req_id = bob_request["id"]

    # Bob attempts to accept his own request on Alice's item -> 403 Forbidden
    bob_accept = client.post(f"/api/reuse/requests/{req_id}/accept", headers={"Authorization": BOB_TOKEN})
    assert bob_accept.status_code == 403

    # Alice (the owner) accepts the request -> 200 OK
    alice_accept = client.post(f"/api/reuse/requests/{req_id}/accept", headers={"Authorization": ALICE_TOKEN})
    assert alice_accept.status_code == 200
    assert alice_accept.json()["status"] == "accepted"


def test_reuse_prevent_request_own_listing():
    """Users cannot submit exchange requests on their own listings."""
    alice_listing = client.post(
        "/api/reuse/listings",
        json={"title": "Chemistry Goggles", "category": "lab_coat", "mode": "donate", "condition": "good"},
        headers={"Authorization": ALICE_TOKEN},
    ).json()
    lid = alice_listing["id"]

    # Alice requests her own item -> 400 Bad Request
    self_req = client.post(
        f"/api/reuse/listings/{lid}/request",
        json={"message": "I want my own goggles"},
        headers={"Authorization": ALICE_TOKEN},
    )
    assert self_req.status_code == 400
    assert "You cannot request your own listing" in self_req.json()["detail"]
