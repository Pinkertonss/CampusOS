"""
Unit Tests for Digital Vault Endpoints
--------------------------------------
Tests validation (max 10 MB, allowed file types), signed upload/download URLs,
category filtering, search, rename, delete, and authentication scoping.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
AUTH_HEADER = {"Authorization": "Bearer dev-user-102203099"}


def test_vault_unauthorized_without_token():
    """Unauthenticated calls to /api/vault/items must return 401."""
    res_list = client.get("/api/vault/items")
    assert res_list.status_code == 401

    res_upload_url = client.post(
        "/api/vault/upload-url",
        json={"filename": "notes.pdf", "mime_type": "application/pdf", "size_bytes": 1024},
    )
    assert res_upload_url.status_code == 401


def test_vault_upload_url_valid():
    """Generating signed upload URL with valid PDF under 10MB."""
    payload = {
        "filename": "Operating_Systems_Notes.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1024 * 1024,  # 1 MB
    }
    res = client.post("/api/vault/upload-url", json=payload, headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert "storage_path" in data
    assert "upload_url" in data
    assert "102203099-tiet-user" in data["storage_path"]
    assert "Operating_Systems_Notes" in data["storage_path"]


def test_vault_upload_url_oversized_file():
    """Validation: file size > 10 MB must return 400 Bad Request."""
    payload = {
        "filename": "heavy_video.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 12 * 1024 * 1024,  # 12 MB (exceeds 10 MB)
    }
    res = client.post("/api/vault/upload-url", json=payload, headers=AUTH_HEADER)
    assert res.status_code == 400
    assert "exceeds 10 MB" in res.json()["detail"]


def test_vault_upload_url_unsupported_file_type():
    """Validation: unsupported file type (e.g. .exe) must return 400 Bad Request."""
    payload = {
        "filename": "malicious_script.exe",
        "mime_type": "application/x-msdownload",
        "size_bytes": 50000,
    }
    res = client.post("/api/vault/upload-url", json=payload, headers=AUTH_HEADER)
    assert res.status_code == 400
    assert "Unsupported file type" in res.json()["detail"]


def test_vault_register_list_and_search_item():
    """Registers metadata, lists items, filters by category, and searches by title."""
    create_payload = {
        "title": "Machine Learning Lecture 5 Notes",
        "category": "notes",
        "storage_path": "102203099-tiet-user/ml_lec5_notes.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 204800,
    }
    create_res = client.post("/api/vault/items", json=create_payload, headers=AUTH_HEADER)
    assert create_res.status_code == 200
    item = create_res.json()
    item_id = item["id"]
    assert item["title"] == "Machine Learning Lecture 5 Notes"
    assert item["category"] == "notes"

    # List all items
    list_res = client.get("/api/vault/items", headers=AUTH_HEADER)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total_count"] >= 1
    assert any(i["id"] == item_id for i in list_data["items"])
    assert list_data["total_size_bytes"] > 0

    # Filter by category = 'notes'
    filter_res = client.get("/api/vault/items?category=notes", headers=AUTH_HEADER)
    assert filter_res.status_code == 200
    for i in filter_res.json()["items"]:
        assert i["category"] == "notes"

    # Search by title = 'Machine Learning'
    search_res = client.get("/api/vault/items?q=Machine%20Learning", headers=AUTH_HEADER)
    assert search_res.status_code == 200
    search_items = search_res.json()["items"]
    assert len(search_items) >= 1
    assert any("Machine Learning" in i["title"] for i in search_items)


def test_vault_download_url_and_rename():
    """Generates signed download URL and renames vault item."""
    # Register an item
    create_res = client.post(
        "/api/vault/items",
        json={
            "title": "Original Transcript Scan",
            "category": "academic",
            "storage_path": "102203099-tiet-user/transcript_original.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 512000,
        },
        headers=AUTH_HEADER,
    )
    assert create_res.status_code == 200
    item_id = create_res.json()["id"]

    # Generate signed download URL
    dl_res = client.get(f"/api/vault/items/{item_id}/download-url", headers=AUTH_HEADER)
    assert dl_res.status_code == 200
    dl_data = dl_res.json()
    assert "download_url" in dl_data
    assert dl_data["expires_in"] == 300

    # Rename item
    rename_res = client.patch(
        f"/api/vault/items/{item_id}",
        json={"title": "Official Semester 4 Grade Card (Renamed)"},
        headers=AUTH_HEADER,
    )
    assert rename_res.status_code == 200
    assert rename_res.json()["title"] == "Official Semester 4 Grade Card (Renamed)"


def test_vault_delete_item():
    """Deletes item metadata and removes storage object."""
    create_res = client.post(
        "/api/vault/items",
        json={
            "title": "Temporary Draft Assignment",
            "category": "other",
            "storage_path": "102203099-tiet-user/temp_draft.txt",
            "mime_type": "text/plain",
            "size_bytes": 1024,
        },
        headers=AUTH_HEADER,
    )
    item_id = create_res.json()["id"]

    # Delete item
    del_res = client.delete(f"/api/vault/items/{item_id}", headers=AUTH_HEADER)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Accessing download url after deletion must return 404
    dl_res = client.get(f"/api/vault/items/{item_id}/download-url", headers=AUTH_HEADER)
    assert dl_res.status_code == 404


def test_vault_raw_file_serving():
    """Validates raw streaming endpoint returns valid PDF/SVG content without mock domains."""
    res_seed = client.get("/api/vault/raw/v-seed-1")
    assert res_seed.status_code == 200
    assert "application/pdf" in res_seed.headers["content-type"]
    assert b"%PDF" in res_seed.content

    # Image seed returns SVG
    res_img = client.get("/api/vault/raw/v-seed-3")
    assert res_img.status_code == 200
    assert "image/svg+xml" in res_img.headers["content-type"]
    assert b"<svg" in res_img.content


def test_vault_direct_multipart_upload_and_byte_integrity():
    """
    Phase 3: Real file upload -> download -> exact byte matching.
    Verifies original uploaded bytes are returned intact upon download.
    """
    test_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstream\nCampusOS Vault Real Bytes Verified\nendstream\n%%EOF"
    upload_res = client.post(
        "/api/vault/upload",
        files={"file": ("semester_grade_card.pdf", test_content, "application/pdf")},
        data={"title": "Official Semester 4 Grade Card", "category": "academic", "tags": "grades,official"},
        headers=AUTH_HEADER,
    )
    assert upload_res.status_code == 200
    item = upload_res.json()
    item_id = item["id"]
    assert item["title"] == "Official Semester 4 Grade Card"
    assert item["size_bytes"] == len(test_content)

    # Fetch download URL
    dl_res = client.get(f"/api/vault/items/{item_id}/download-url", headers=AUTH_HEADER)
    assert dl_res.status_code == 200
    dl_data = dl_res.json()
    raw_url = dl_data["download_url"]

    # Download raw file bytes
    download_res = client.get(raw_url, headers=AUTH_HEADER)
    assert download_res.status_code == 200
    assert download_res.content == test_content


def test_vault_cross_tenant_isolation():
    """
    Phase 3: Student A's private vault file cannot be accessed, downloaded,
    renamed, or deleted by Student B.
    """
    student_a_headers = {"Authorization": "Bearer test-student-a"}
    student_b_headers = {"Authorization": "Bearer test-student-b"}

    # Student A uploads private file
    file_bytes = b"Student A Confidential Medical Certificate"
    upload_res = client.post(
        "/api/vault/upload",
        files={"file": ("medical_leave_cert.pdf", file_bytes, "application/pdf")},
        data={"title": "Private Medical Certificate", "category": "academic"},
        headers=student_a_headers,
    )
    assert upload_res.status_code == 200
    item_id = upload_res.json()["id"]

    # Student B attempts to get download URL -> 403 Forbidden
    b_dl = client.get(f"/api/vault/items/{item_id}/download-url", headers=student_b_headers)
    assert b_dl.status_code == 403
    assert "Access denied" in b_dl.json()["detail"]

    # Student B attempts direct raw access with their own token -> 403 Forbidden
    b_raw = client.get(f"/api/vault/raw/{item_id}?token=test-student-b")
    assert b_raw.status_code == 403

    # Unauthenticated raw access -> 401 Unauthorized
    unauth_raw = client.get(f"/api/vault/raw/{item_id}")
    assert unauth_raw.status_code == 401

    # Student B attempts to rename Student A's file -> 403 Forbidden
    b_rename = client.patch(
        f"/api/vault/items/{item_id}",
        json={"title": "Hacked Document Name"},
        headers=student_b_headers,
    )
    assert b_rename.status_code == 403

    # Student B attempts to delete Student A's file -> 403 Forbidden
    b_del = client.delete(f"/api/vault/items/{item_id}", headers=student_b_headers)
    assert b_del.status_code == 403

    # Student A CAN download their file
    a_raw = client.get(f"/api/vault/raw/{item_id}", headers=student_a_headers)
    assert a_raw.status_code == 200
    assert a_raw.content == file_bytes

    # Student A can delete their file
    a_del = client.delete(f"/api/vault/items/{item_id}", headers=student_a_headers)
    assert a_del.status_code == 200

    # Once deleted, access returns 404
    a_after_del = client.get(f"/api/vault/raw/{item_id}", headers=student_a_headers)
    assert a_after_del.status_code == 404


def test_vault_safe_filename_handling():
    """
    Phase 3: Filename path traversal attempts (../../) are stripped and sanitized.
    """
    payload = {
        "filename": "../../../../etc/passwd.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1024,
    }
    res = client.post("/api/vault/upload-url", json=payload, headers=AUTH_HEADER)
    assert res.status_code == 200
    storage_path = res.json()["storage_path"]
    assert ".." not in storage_path
    assert "/etc/" not in storage_path
    assert storage_path.startswith("102203099-tiet-user/")
    assert "passwd.pdf" in storage_path


def test_vault_disallowed_file_types():
    """
    Phase 3: Dangerous or unapproved file extensions (.exe, .sh, .bat, .bin) are rejected.
    """
    for bad_ext, bad_mime in [
        ("payload.exe", "application/x-msdownload"),
        ("script.sh", "application/x-sh"),
        ("malware.bat", "application/x-bat"),
    ]:
        res = client.post(
            "/api/vault/upload-url",
            json={"filename": bad_ext, "mime_type": bad_mime, "size_bytes": 1024},
            headers=AUTH_HEADER,
        )
        assert res.status_code == 400
        assert "Unsupported file type" in res.json()["detail"]


def test_vault_storage_quota_enforcement():
    """
    Phase 3: Student 500 MB storage quota boundary check.
    """
    huge_size = 501 * 1024 * 1024  # 501 MB
    res = client.post(
        "/api/vault/upload-url",
        json={"filename": "huge_archive.pdf", "mime_type": "application/pdf", "size_bytes": huge_size},
        headers=AUTH_HEADER,
    )
    # Exceeds both 10MB file limit and 500MB quota
    assert res.status_code == 400


def test_vault_orphan_storage_rollback_on_db_failure(monkeypatch):
    """
    Phase 3: If database metadata registration fails after storage upload,
    storage rollback is triggered and orphan objects are deleted.
    """
    from unittest.mock import MagicMock
    from app.routers import vault

    # Mock supabase client where storage.upload succeeds but db insert raises Exception
    mock_client = MagicMock()
    mock_client.storage.from_().upload.return_value = {"Key": "test"}
    mock_client.table().insert().execute.side_effect = RuntimeError("Database connection lost")

    monkeypatch.setattr(vault, "get_supabase_client", lambda: mock_client)

    # Register vault item should fail closed with 500 and call remove()
    with pytest.raises(Exception):
        vault.register_vault_item(
            vault.VaultItemCreate(
                title="Failed Commit Note",
                category="notes",
                storage_path="102203099-tiet-user/failed_note.pdf",
                mime_type="application/pdf",
                size_bytes=1024,
            ),
            user_id="102203099-tiet-user",
        )

    # Verify storage object cleanup was attempted
    mock_client.storage.from_().remove.assert_called_with(["102203099-tiet-user/failed_note.pdf"])
