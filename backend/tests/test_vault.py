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
