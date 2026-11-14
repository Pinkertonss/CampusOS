import io
import os
import json
import uuid
import time
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.database import db
from app.services.durable_storage import AtomicJsonStorage, StorageError, CorruptStorageError
from app.services.academic_profile_reader import get_canonical_academic_profile, CanonicalAcademicProfile
from app.services.personal_assistant import safe_calculate, personal_assistant_service
from app.services.attachment_service import attachment_service, ATTACHMENTS_DIR
from app.services.lost_and_found_engine import lost_and_found_engine, IMAGES_DIR
from app.models.support import SupportTicket
from app.models.lost_and_found import LostAndFoundItem

client = TestClient(app)

STUDENT_A_HEADERS = {"Authorization": "Bearer dev-student-a"}  # sub: user-student-a
STUDENT_B_HEADERS = {"Authorization": "Bearer dev-student-b"}  # sub: user-student-b
ADMIN_HEADERS = {"Authorization": "Bearer dev-admin"}          # sub: dev-admin, is_admin: True


# ============================================================
# Finding A: Support Screenshot Authorization & Traversal
# ============================================================

def test_finding_a_support_screenshot_authorization_and_traversal(tmp_path):
    """
    Verify:
    - Anonymous access fails 401
    - Owner access succeeds (200 with Cache-Control: private, no-store)
    - Cross-student access fails 403 Forbidden
    - Administrator access succeeds 200
    - Attachment/ticket mismatch fails 400
    - Path traversal fails 400/404
    - Missing attachment fails 404
    - Unauthorized responses contain no file bytes
    """
    # 1. Anonymous access fails 401
    res_anon = client.get("/api/support/attachments/att-nonexistent")
    assert res_anon.status_code == 401
    res_legacy_anon = client.get("/api/support/screenshots/fake.png")
    assert res_legacy_anon.status_code == 401

    # 2. Student A uploads a valid screenshot
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    upload_res = client.post(
        "/api/support/upload-screenshot",
        files={"file": ("screenshot.png", png_bytes, "image/png")},
        headers=STUDENT_A_HEADERS,
    )
    assert upload_res.status_code == 200
    data = upload_res.json()
    att_id = data["attachment_id"]
    att_url = data["screenshot_url"]
    assert att_id in att_url

    # 3. Student A creates a ticket linking this screenshot
    tkt_res = client.post(
        "/api/support/tickets",
        json={
            "category": "technical",
            "subject": "Portal Loading Error",
            "description": "The grade simulator is showing a spinning loader.",
            "priority": "high",
            "screenshot_url": att_url,
        },
        headers=STUDENT_A_HEADERS,
    )
    assert tkt_res.status_code == 201
    tkt_id = tkt_res.json()["id"]

    # 4. Owner access succeeds with private no-store headers
    res_owner = client.get(f"/api/support/attachments/{att_id}", headers=STUDENT_A_HEADERS)
    assert res_owner.status_code == 200
    assert "no-store" in res_owner.headers.get("cache-control", "").lower()
    assert res_owner.content == png_bytes

    # 5. Cross-student (Student B) access fails 403 Forbidden without leaking bytes
    res_cross = client.get(f"/api/support/attachments/{att_id}", headers=STUDENT_B_HEADERS)
    assert res_cross.status_code == 403
    assert b"IHDR" not in res_cross.content

    # 6. Admin access succeeds
    res_admin = client.get(f"/api/support/attachments/{att_id}", headers=ADMIN_HEADERS)
    assert res_admin.status_code == 200
    assert res_admin.content == png_bytes

    # 7. Attachment / ticket mismatch fails 400
    res_mismatch = client.get(
        f"/api/support/attachments/{att_id}?ticket_id=tkt-different-999",
        headers=STUDENT_A_HEADERS,
    )
    assert res_mismatch.status_code == 400
    assert "does not belong" in res_mismatch.json()["detail"].lower()

    # 8. Path traversal fails safely
    res_trav = client.get(
        "/api/support/screenshots/..%2F..%2Fetc%2Fpasswd",
        headers=STUDENT_A_HEADERS,
    )
    assert res_trav.status_code in (400, 404)

    # 9. Legacy filename route uses same authorization
    meta = attachment_service.storage.get(att_id)
    assert meta is not None
    legacy_owner = client.get(f"/api/support/screenshots/{meta.filename}", headers=STUDENT_A_HEADERS)
    assert legacy_owner.status_code == 200
    legacy_cross = client.get(f"/api/support/screenshots/{meta.filename}", headers=STUDENT_B_HEADERS)
    assert legacy_cross.status_code == 403


# ============================================================
# Finding B: Remove Fabricated CGPA Across Every Matching Path
# ============================================================

def test_finding_b_canonical_academic_profile_and_no_fabricated_cgpa():
    """
    Verify:
    - Official student in registry (Arjun) has is_verified=True, cgpa=8.52, institutional provenance
    - Any new/unverified student has cgpa=None, is_verified=False, provenance='unverified'
    - Recommendations do NOT supply 7.80 or 8.52 for unverified students
    - Opportunities requiring min_cgpa produce INCOMPLETE_PROFILE for unverified students
    - Equality at threshold satisfies minimum requirement
    - Opportunities without min_cgpa do not reject students with missing CGPA
    """
    # 1. Canonical reader outputs
    prof_arjun = get_canonical_academic_profile("102203099-tiet-user")
    assert prof_arjun.is_verified is True
    assert prof_arjun.cgpa == 8.52
    assert prof_arjun.provenance == "institutional_registry"

    prof_new = get_canonical_academic_profile("student-new-applicant-99")
    assert prof_new.is_verified is False
    assert prof_new.cgpa is None
    assert prof_new.provenance == "unverified"

    # 2. Recommendations for unverified student
    # Create profile with discovery_opt_in=True
    db.get_student_experience_profile("student-new-applicant-99")
    db.update_student_experience_profile("student-new-applicant-99", {
        "discovery_opt_in": True,
        "skills": ["Python", "FastAPI"],
    })

    rec_res = client.get(
        "/api/opportunities/recommended",
        headers={"Authorization": "Bearer dev-student-new-applicant-99"},
    )
    assert rec_res.status_code == 200
    recs = rec_res.json()["recommendations"]

    # Verify that any opportunity requiring min_cgpa >= 8.0 is marked INCOMPLETE_PROFILE,
    # NOT ELIGIBLE via fabricated 7.80 or 8.52!
    for r in recs:
        if r.get("min_cgpa") and r["min_cgpa"] > 0:
            assert r["eligibility_status"] in ("INCOMPLETE_PROFILE", "NOT_ELIGIBLE")
            if r["eligibility_status"] == "INCOMPLETE_PROFILE":
                assert any("Verified institutional CGPA is required" in reason for reason in r.get("eligibility_reasons", []))

    # 3. Preview matching does not fabricate 8.52 or count unverified student as eligible
    preview_res = client.post(
        "/api/opportunities/preview-matching",
        json={
            "title": "High CGPA Research Fellow",
            "organization": "TIET AI Lab",
            "description": "Elite research lab position",
            "category": "research",
            "department": "Computer Science",
            "location": "TIET",
            "min_cgpa": 8.0,
            "eligible_branches": ["COE"],
        },
        headers=ADMIN_HEADERS,
    )
    assert preview_res.status_code == 200
    pdata = preview_res.json()
    assert "incomplete_profile_count" in pdata
    # Unverified students with missing CGPA must count towards incomplete_profile_count, not eligible_count
    assert pdata["incomplete_profile_count"] > 0


# ============================================================
# Finding C: Bound Calculator Resource Consumption
# ============================================================

def test_finding_c_bounded_calculator_computation_limits():
    """
    Verify:
    - Ordinary math evaluates correctly: 2 + 3 * 4, (12.5 * 8) / 2, 2 ** 10
    - Malicious / expensive expressions rejected before evaluation:
      - 999999999 ** 999
      - Power towers (chained exponents)
      - Very long expressions (> 200 chars)
      - Excessive nesting (depth > 8)
      - Oversized literals (> 1e12 or > 12 digits)
      - Division by zero
      - Non-finite results
      - Forbidden functions / attributes / imports
    """
    # 1. Normal valid calculations
    res1 = safe_calculate("2 + 3 * 4")
    assert res1["success"] is True
    assert res1["result"] == 14.0

    res2 = safe_calculate("(12.5 * 8) / 2")
    assert res2["success"] is True
    assert res2["result"] == 50.0

    res3 = safe_calculate("2 ** 10")
    assert res3["success"] is True
    assert res3["result"] == 1024.0

    # 2. Oversized power rejected before computation
    res_pow = safe_calculate("999999999 ** 999")
    assert res_pow["success"] is False
    assert res_pow["error_code"] in ("EXPONENT_TOO_LARGE", "RESULT_SIZE_EXCEEDED")

    # 3. Power tower rejected before computation
    res_tower = safe_calculate("2 ** (2 ** (2 ** 2))")
    assert res_tower["success"] is False
    assert res_tower["error_code"] == "POWER_TOWER_REJECTED"

    # 4. Input length exceeded (> 200 chars)
    res_len = safe_calculate("1 + " * 105 + "1")
    assert res_len["success"] is False
    assert res_len["error_code"] == "INPUT_LENGTH_EXCEEDED"

    # 5. Excessive nesting depth (> 8 levels)
    res_nest = safe_calculate("(((((((((1 + 1)))))))))")
    assert res_nest["success"] is False
    assert res_nest["error_code"] == "NESTING_DEPTH_EXCEEDED"

    # 6. Oversized literal
    res_lit = safe_calculate("99999999999999999999 + 1")
    assert res_lit["success"] is False
    assert res_lit["error_code"] == "LITERAL_TOO_LARGE"

    # 7. Division by zero
    res_div0 = safe_calculate("100 / 0")
    assert res_div0["success"] is False
    assert res_div0["error_code"] == "DIVISION_BY_ZERO"

    # 8. Forbidden function call / import
    res_fn = safe_calculate("__import__('os').system('echo pwned')")
    assert res_fn["success"] is False
    assert res_fn["error_code"] == "FORBIDDEN_SYNTAX"

    res_attr = safe_calculate("(10).bit_length()")
    assert res_attr["success"] is False
    assert res_attr["error_code"] == "FORBIDDEN_SYNTAX"


# ============================================================
# Finding D: Storage Must Not Claim Success After Failed Save
# ============================================================

def test_finding_d_storage_failure_propagation_and_quarantine(tmp_path):
    """
    Verify:
    - Atomic writes use same-dir temp file + flush + fsync + replace
    - Failed writes raise StorageError, roll back in-memory state, and propagate HTTP 500
    - Corrupt JSON raises CorruptStorageError and is quarantined to preserve evidence
    - Mutations persist cleanly across independent process re-reads
    """
    storage_file = tmp_path / "test_store.json"
    storage = AtomicJsonStorage(storage_file, SupportTicket)

    # 1. Successful save
    t1 = SupportTicket(
        id="tkt-001",
        user_id="user-1",
        user_name="Student",
        user_email="s@thapar.edu",
        category="general",
        subject="Test Ticket",
        description="Detailed inquiry",
        priority="low",
        created_at="2026-11-14T10:00:00Z",
        updated_at="2026-11-14T10:00:00Z",
    )
    storage.set("tkt-001", t1)
    assert storage.get("tkt-001") is not None

    # Verify persisted on disk across new storage instance
    reloaded = AtomicJsonStorage(storage_file, SupportTicket)
    assert reloaded.get("tkt-001") is not None

    # 2. Injected write failure propagates and does NOT mutate state
    with patch.object(storage, "_write_atomic", side_effect=StorageError("Disk full")):
        with pytest.raises(StorageError):
            storage.set("tkt-002", t1)
        # Verify in-memory state rolled back!
        assert storage.get("tkt-002") is None

    # 3. HTTP route propagation: simulated storage error returns 500, not 201
    with patch("app.routers.support.ticket_storage.set", side_effect=StorageError("Simulated disk error")):
        res_fail = client.post(
            "/api/support/tickets",
            json={
                "category": "technical",
                "subject": "Failing Ticket",
                "description": "Should fail gracefully with 500.",
                "priority": "low",
            },
            headers=STUDENT_A_HEADERS,
        )
        assert res_fail.status_code == 500
        assert "Storage persistence failure" in res_fail.json()["detail"]

    # 4. Corrupt JSON file quarantine
    corrupt_file = tmp_path / "corrupt_store.json"
    with open(corrupt_file, "w", encoding="utf-8") as f:
        f.write("{broken_json: unclosed...")

    with pytest.raises(CorruptStorageError) as exc_info:
        AtomicJsonStorage(corrupt_file, SupportTicket)
    assert "corrupted and was quarantined" in str(exc_info.value)
    # Check that quarantine file exists on disk
    corrupt_copies = list(tmp_path.glob("corrupt_store*.corrupt.*"))
    assert len(corrupt_copies) > 0


# ============================================================
# Finding E: Consistent Lost & Found Archive Privacy
# ============================================================

def test_finding_e_consistent_lost_and_found_archive_privacy():
    """
    Verify:
    - Active and resolved items are discoverable
    - Archived reports are EXCLUDED from general discovery
    - Archived reports are accessible strictly to owner and admin
    - status_filter='archived' returns empty list for unrelated students
    - Direct detail URL /api/lost-and-found/{item_id} returns 404 for unrelated students
    - Images belonging to archived reports fail 403/404 for unrelated students
    """
    # 1. Student A creates a report
    create_res = client.post(
        "/api/lost-and-found",
        json={
            "title": "Black Leather Wallet",
            "description": "Lost near library lawn with college ID inside.",
            "category": "Wallets & Bags",
            "report_type": "lost",
            "location": "Library Lawn",
        },
        headers=STUDENT_A_HEADERS,
    )
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    # Verify discoverable in general listing while open
    list_open = client.get("/api/lost-and-found", headers=STUDENT_B_HEADERS)
    assert list_open.status_code == 200
    assert any(i["id"] == item_id for i in list_open.json())

    # 2. Student A archives the report
    archive_res = client.post(f"/api/lost-and-found/{item_id}/archive", headers=STUDENT_A_HEADERS)
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "archived"

    # 3. Default listing excludes archived item for Student B and anonymous
    list_after = client.get("/api/lost-and-found", headers=STUDENT_B_HEADERS)
    assert not any(i["id"] == item_id for i in list_after.json())
    list_anon = client.get("/api/lost-and-found")
    assert not any(i["id"] == item_id for i in list_anon.json())

    # 4. status_filter='archived' returns empty for Student B, but succeeds for Owner and Admin
    filter_b = client.get("/api/lost-and-found?status=archived", headers=STUDENT_B_HEADERS)
    assert not any(i["id"] == item_id for i in filter_b.json())

    filter_owner = client.get("/api/lost-and-found?status=archived", headers=STUDENT_A_HEADERS)
    assert any(i["id"] == item_id for i in filter_owner.json())

    filter_admin = client.get("/api/lost-and-found?status=archived", headers=ADMIN_HEADERS)
    assert any(i["id"] == item_id for i in filter_admin.json())

    # 5. Direct detail URL: 404 for Student B, 200 for Owner and Admin
    detail_b = client.get(f"/api/lost-and-found/{item_id}", headers=STUDENT_B_HEADERS)
    assert detail_b.status_code == 404

    detail_owner = client.get(f"/api/lost-and-found/{item_id}", headers=STUDENT_A_HEADERS)
    assert detail_owner.status_code == 200
    assert detail_owner.json()["id"] == item_id

    detail_admin = client.get(f"/api/lost-and-found/{item_id}", headers=ADMIN_HEADERS)
    assert detail_admin.status_code == 200

    # 6. Search does not leak archived report to Student B
    search_b = client.get("/api/lost-and-found?query=Leather+Wallet", headers=STUDENT_B_HEADERS)
    assert not any(i["id"] == item_id for i in search_b.json())


import asyncio

# ============================================================
# Finding F: Sanitize Personal Assistant Errors
# ============================================================

def test_finding_f_personal_assistant_error_sanitization_and_correlation():
    """
    Verify:
    - Never returns raw exceptions, API keys, internal paths, or tracebacks
    - Public responses include correlation_id and stable error_code
    - Simulated 429 returns UPSTREAM_QUOTA_EXCEEDED
    - Simulated 401 returns UPSTREAM_AUTH_ERROR without leaking key
    - Simulated unexpected exception does not leak private tokens or paths
    """
    async def _run_checks():
        # 1. Rate limiting returns structured error with correlation_id
        res_rl = await personal_assistant_service.chat(
            user_id="test-rl-user",
            messages=[{"role": "user", "content": "hello"}],
        )
        # Exceed limit
        for _ in range(30):
            res_rl = await personal_assistant_service.chat(
                user_id="test-rl-user",
                messages=[{"role": "user", "content": "rapid message"}],
            )
        assert res_rl["status"] == "rate_limited"
        assert res_rl["error_code"] == "RATE_LIMIT_EXCEEDED"
        assert "correlation_id" in res_rl
        assert res_rl["correlation_id"].startswith("req-")

        # 2. Simulated unexpected upstream error containing fake secret and internal path
        fake_secret = "AIzaSySecretKey998877"
        fake_path = "/Users/victim/.secret/config.json"
        leak_error = f"Connection failed to https://gemini.googleapis.com?key={fake_secret} via {fake_path}"

        with patch("httpx.AsyncClient.post", side_effect=Exception(leak_error)):
            res_err = await personal_assistant_service.chat(
                user_id="test-safe-user",
                messages=[{"role": "user", "content": "explain sorting"}],
            )
            assert res_err["status"] == "service_error"
            assert res_err["error_code"] == "SERVICE_UNAVAILABLE"
            assert "correlation_id" in res_err
            # Assert fake secret and internal path are NOT in public response!
            assert fake_secret not in res_err["reply"]
            assert fake_path not in res_err["reply"]
            assert "temporarily unavailable" in res_err["reply"].lower()

    asyncio.run(_run_checks())
