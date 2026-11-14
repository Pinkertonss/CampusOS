import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import verify_supabase_jwt

client = TestClient(app)

def test_root_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "CampusOS" in data["app"]

def test_auth_me_without_token_fails():
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert "Authorization header must be provided" in res.json()["detail"]

def test_auth_me_with_invalid_header_fails():
    res = client.get("/api/auth/me", headers={"Authorization": "Basic 12345"})
    assert res.status_code == 401

def test_auth_me_with_dev_token():
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer dev-user-102203099"})
    assert res.status_code == 200
    data = res.json()
    assert data["authenticated"] is True
    assert data["user_id"] == "102203099-tiet-user"

def test_verify_jwt_format():
    import jwt
    mock_payload = {"sub": "user-uuid-9999", "aud": "authenticated", "exp": 9999999999}
    token = jwt.encode(mock_payload, "super-secret-key-that-is-at-least-32-bytes-long", algorithm="HS256")
    user_id = verify_supabase_jwt(token)
    assert user_id == "user-uuid-9999"
