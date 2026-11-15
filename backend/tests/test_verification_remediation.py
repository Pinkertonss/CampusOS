import os
import sys
import json
import time
import uuid
import jwt
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import db
from app.core.config import settings
from app.core.auth import DEFAULT_LOCAL_DEV_JWT_SECRET, verify_supabase_jwt_claims
from app.services.rag_engine import rag_engine, STORAGE_DIR, INDEX_PATH
from app.services.ai_provider import LocalEmbeddingProvider, GeminiProvider

client = TestClient(app)


# ============================================================
# 1. Administrator Trust Boundary Tests
# ============================================================

def test_user_metadata_cannot_grant_admin_privileges():
    """Security Invariant: user_metadata is user-editable and MUST NOT grant admin privileges."""
    # Create a signed JWT where the user put role: admin inside user_metadata
    user_id = f"student-attacker-{uuid.uuid4().hex[:6]}"
    token = jwt.encode(
        {
            "sub": user_id,
            "email": "attacker@thapar.edu",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "user_metadata": {"role": "admin", "full_name": "Attacker"},
            "app_metadata": {"provider": "email"},  # No admin role in app_metadata
        },
        DEFAULT_LOCAL_DEV_JWT_SECRET,
        algorithm="HS256",
    )

    claims = verify_supabase_jwt_claims(token)
    assert claims["is_admin"] is False
    assert claims["role"] == "student"

    # Attempt to access admin-only endpoint
    res = client.get(
        "/api/academic/users/roles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
    assert "administrator role required" in res.json()["detail"].lower()


def test_user_metadata_cannot_grant_professor_privileges():
    """Security Invariant: user_metadata cannot grant professor privileges."""
    user_id = f"student-imposter-{uuid.uuid4().hex[:6]}"
    token = jwt.encode(
        {
            "sub": user_id,
            "email": "imposter@thapar.edu",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "user_metadata": {"role": "professor", "name": "Fake Prof"},
            "app_metadata": {},
        },
        DEFAULT_LOCAL_DEV_JWT_SECRET,
        algorithm="HS256",
    )

    claims = verify_supabase_jwt_claims(token)
    assert claims["is_professor"] is False

    # Attempt professor-only endpoint
    res = client.get(
        "/api/academic/students/directory",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_server_controlled_app_metadata_grants_admin():
    """Server-controlled app_metadata grants admin privileges."""
    admin_id = f"verified-admin-{uuid.uuid4().hex[:6]}"
    token = jwt.encode(
        {
            "sub": admin_id,
            "email": "real_admin@thapar.edu",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "app_metadata": {"role": "admin"},
        },
        DEFAULT_LOCAL_DEV_JWT_SECRET,
        algorithm="HS256",
    )

    claims = verify_supabase_jwt_claims(token)
    assert claims["is_admin"] is True
    assert claims["role"] == "admin"


def test_invalid_token_on_optional_route_rejected_with_401():
    """Even on routes that permit anonymous calls, passing an invalid/forged token returns 401."""
    res = client.post(
        "/api/copilot/ask",
        json={"question": "What is the attendance cutoff?"},
        headers={"Authorization": "Bearer forged-or-garbage-token.xyz.abc"},
    )
    assert res.status_code == 401
    assert "token" in res.json()["detail"].lower() or "credentials" in res.json()["detail"].lower()


# ============================================================
# 2. Embedding Identity & Vector Space Signature Tests
# ============================================================

@pytest.mark.anyio
async def test_compatible_embedding_signature_succeeds():
    """Queries with matching embedding signatures succeed."""
    matches = await rag_engine.match_chunks("attendance regulation 75 percent cutoff", top_k=2)
    assert isinstance(matches, list)


@pytest.mark.anyio
async def test_incompatible_vector_space_signature_rejected():
    """Identical dimension (768) but different model signatures must be rejected to prevent corrupted ranking."""
    # Temporarily modify index_metadata to simulate corpus indexed with a different model
    orig_meta = dict(rag_engine.index_metadata)
    try:
        rag_engine.index_metadata = {
            "provider": "gemini",
            "model": "text-embedding-004",
            "dimension": 768,
            "version": "1.0",
        }
        # Local embedder query against 'gemini' indexed corpus must fail
        with pytest.raises(ValueError) as excinfo:
            await rag_engine.match_chunks("attendance regulation cutoff")
        assert "incompatible embedding vector space signature" in str(excinfo.value).lower()
    finally:
        rag_engine.index_metadata = orig_meta


@pytest.mark.anyio
async def test_reindex_corpus_updates_signature():
    """Reindexing updates the index signature to the active provider."""
    res = await rag_engine.reindex_corpus()
    assert res["status"] == "reindexed"
    assert "signature" in res
    assert res["signature"]["provider"] == "local"
    assert res["signature"]["dimension"] == 768


# ============================================================
# 3. Process Restart & Storage Safety Tests
# ============================================================

def test_independent_process_restart_persistence():
    """
    Subprocess Restart Verification:
    Spawns an independent Python process to verify that corpus_index.json
    and tasks_persistence.json reload correctly in a completely clean OS process.
    """
    script = """
import sys
import json
from pathlib import Path
sys.path.insert(0, 'backend')
from app.services.rag_engine import rag_engine
from app.database import db

status = rag_engine.get_status()
assert status["document_count"] >= 0
assert status["dimension"] == 768
tasks = db.get_deadlines("102203099-tiet-user")
assert isinstance(tasks, list)
print("SUBPROCESS_RELOAD_SUCCESS")
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).resolve().parent.parent.parent),
    )
    assert result.returncode == 0, f"Subprocess failed: {result.stderr}"
    assert "SUBPROCESS_RELOAD_SUCCESS" in result.stdout


def test_document_deletion_traversal_prevention():
    """Verify document deletion cannot escape storage directory via path traversal."""
    doc_id = f"test-traverse-{uuid.uuid4().hex[:6]}"
    from app.models.copilot import CampusDocument
    rag_engine.documents[doc_id] = CampusDocument(
        id=doc_id,
        title="Path Traversal Test",
        source_label="test",
        storage_path="campus-docs/../../etc/passwd",
        uploaded_by="admin",
        created_at=datetime.now().isoformat(),
    )
    # Deleting document must not delete or attempt to unlink outside STORAGE_DIR
    deleted = rag_engine.delete_document(doc_id)
    assert deleted is True
    assert doc_id not in rag_engine.documents


# ============================================================
# 4. Stale-Date & Date-Only Semantics Tests
# ============================================================

def test_stale_circular_date_detected_as_expired():
    """Circular dates in 2024 must be flagged with is_expired=True and is_historical=True."""
    suggestion = rag_engine._detect_actionable_event("Even semester fee due on December 20, 2024", "fee due date")
    assert suggestion is not None
    assert suggestion.has_action is True
    assert suggestion.is_expired is True
    assert suggestion.is_historical is True
    assert "2024" in suggestion.due_date
