"""
Unit Tests for Campus Reuse Marketplace & Impact Tracking
---------------------------------------------------------
Validates:
- CRUD for listings (title, description, category, mode, condition)
- Search and filtering by category and mode
- Exchange request flow (request -> owner accepts/declines -> confirmation of completion)
- Automated impact_event creation and listing completion
- Validation: Preventing users from requesting their own listing
- GET /reuse/impact metrics, items kept in use, and per-month series
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
AUTH_HEADER = {"Authorization": "Bearer dev-user-102203099"}


PEER_AUTH_HEADER = {"Authorization": "Bearer dev-peer-user"}


def test_list_reuse_listings_and_filter():
    """Lists marketplace items and tests category/mode filtering."""
    res = client.get("/reuse/listings", headers=AUTH_HEADER)
    assert res.status_code == 200
    listings = res.json()
    assert len(listings) >= 4

    # Filter by category
    res_books = client.get("/reuse/listings?category=book", headers=AUTH_HEADER)
    assert res_books.status_code == 200
    books = res_books.json()
    assert all(b["category"] == "book" for b in books)

    # Filter by mode
    res_donate = client.get("/reuse/listings?mode=donate", headers=AUTH_HEADER)
    assert res_donate.status_code == 200
    donate_items = res_donate.json()
    assert all(d["mode"] == "donate" for d in donate_items)


def test_create_and_delete_listing():
    """Tests creating a listing and deleting it."""
    payload = {
        "title": "Engineering Mechanics (Bansal) Textbook",
        "description": "First year civil/mechanical textbook in good condition.",
        "category": "book",
        "mode": "donate",
        "condition": "good",
        "contact_info": "Hostel B, Room 415",
    }
    create_res = client.post("/reuse/listings", json=payload, headers=AUTH_HEADER)
    assert create_res.status_code == 200
    item = create_res.json()
    assert item["title"] == payload["title"]
    assert item["category"] == "book"
    assert item["mode"] == "donate"
    item_id = item["id"]

    # Delete listing
    del_res = client.delete(f"/reuse/listings/{item_id}", headers=AUTH_HEADER)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


def test_prevent_user_from_requesting_own_listing():
    """Validation: Users cannot request their own listing (must return 400)."""
    # Create listing owned by current user
    create_res = client.post(
        "/reuse/listings",
        json={
            "title": "My Personal Physics Lab Manual",
            "category": "other",
            "mode": "exchange",
            "condition": "like_new",
        },
        headers=AUTH_HEADER,
    )
    assert create_res.status_code == 200
    my_listing_id = create_res.json()["id"]

    # Attempt to request own listing
    req_res = client.post(
        f"/reuse/listings/{my_listing_id}/request",
        json={"message": "I want to request my own item"},
        headers=AUTH_HEADER,
    )
    assert req_res.status_code == 400
    assert "cannot request your own listing" in req_res.json()["detail"]


def test_exchange_request_flow_and_automated_impact():
    """
    Tests complete request lifecycle:
    1. Peer item is requested
    2. Owner accepts request (listing marked reserved)
    3. Confirm completion -> automatically creates impact_event and marks listing completed
    """
    # 1. Request an available peer item (list-1 is owned by peer)
    req_res = client.post(
        "/reuse/listings/list-1/request",
        json={"message": "Hi, I need this Casio calculator for my exam next week!"},
        headers=AUTH_HEADER,
    )
    assert req_res.status_code == 200
    req_data = req_res.json()
    req_id = req_data["id"]
    assert req_data["listing_id"] == "list-1"
    assert req_data["status"] in ("pending", "accepted")

    # 2. Non-owner cannot accept request (403 Forbidden)
    forbidden_accept = client.post(f"/reuse/requests/{req_id}/accept", headers=AUTH_HEADER)
    assert forbidden_accept.status_code == 403

    # Owner accepts request
    accept_res = client.post(f"/reuse/requests/{req_id}/accept", headers=PEER_AUTH_HEADER)
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "accepted"

    # Verify listing is now reserved
    listing_res = client.get("/reuse/listings/list-1", headers=AUTH_HEADER)
    assert listing_res.status_code == 200
    assert listing_res.json()["status"] in ("reserved", "completed")

    # 3. Confirm completion
    complete_res = client.post(f"/reuse/requests/{req_id}/confirm", headers=AUTH_HEADER)
    assert complete_res.status_code == 200
    completed_req = complete_res.json()
    assert completed_req["status"] == "completed"

    # Verify listing is now completed
    listing_after = client.get("/reuse/listings/list-1", headers=AUTH_HEADER)
    assert listing_after.json()["status"] == "completed"


def test_get_reuse_impact_endpoint():
    """Validates GET /reuse/impact returns totals, items kept in use, and per-month series."""
    res = client.get("/reuse/impact")
    assert res.status_code == 200
    data = res.json()

    assert "exchanges_completed" in data
    assert "donations_completed" in data
    assert "loans_completed" in data
    assert "total_completed" in data
    assert "items_kept_in_use" in data
    assert data["items_kept_in_use"] > 0
    assert "SDG 12" in data["sdg_framework"]

    # Per-month series
    assert "per_month_series" in data
    series = data["per_month_series"]
    assert len(series) >= 4
    for pt in series:
        assert "month" in pt
        assert "total" in pt
        assert "co2_kg" in pt
        assert "money_saved_inr" in pt


def test_my_listings_and_my_requests():
    """Validates /reuse/my-listings and /reuse/my-requests."""
    listings_res = client.get("/reuse/my-listings", headers=AUTH_HEADER)
    assert listings_res.status_code == 200
    my_listings = listings_res.json()
    assert isinstance(my_listings, list)

    reqs_res = client.get("/reuse/my-requests", headers=AUTH_HEADER)
    assert reqs_res.status_code == 200
    my_requests = reqs_res.json()
    assert isinstance(my_requests, list)


def test_notifications_endpoint():
    """Validates in-app notifications and unread count."""
    notif_res = client.get("/reuse/notifications", headers=AUTH_HEADER)
    assert notif_res.status_code == 200
    data = notif_res.json()
    assert "unread_count" in data
    assert "notifications" in data
