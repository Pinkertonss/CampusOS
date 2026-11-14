import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.rag_engine import rag_engine, UNSUPPORTED_ANSWER, REFUSAL_MESSAGE
from app.models.copilot import CopilotQueryRequest
from app.services.ai_provider import (
    get_embedding_provider,
    get_llm_provider,
    LocalEmbeddingProvider,
    LocalLLMProvider,
)
from app.services.ingestion import DocumentIngestionService

client = TestClient(app)

def test_copilot_answers_with_citations_for_valid_campus_query():
    req = CopilotQueryRequest(query="What is the minimum attendance requirement to appear in exams?")
    res = rag_engine.ask(req)
    assert res.answered is True
    assert res.grounded is True
    assert res.confidence > 0.0
    assert len(res.citations) > 0
    # Must cite TIET Academic Regulations
    assert any("Academic Regulations" in c.document_title for c in res.citations)
    assert "75%" in res.answer


def test_copilot_declines_unsupported_questions():
    req = CopilotQueryRequest(query="What is the recipe for chocolate chip cookies in Paris?")
    res = rag_engine.ask(req)
    assert res.answered is False
    assert res.grounded is False
    assert res.confidence == 0.0
    assert len(res.citations) == 0
    # Strict refusal phrasing: "I couldn't find this in the approved campus documents"
    assert REFUSAL_MESSAGE in res.answer


def test_copilot_hostel_curfew_query():
    req = CopilotQueryRequest(query="What time is the hostel curfew and turnstile entry?")
    res = rag_engine.ask(req)
    assert res.answered is True
    assert any("Hostel" in c.document_title for c in res.citations)
    assert "10:30 PM" in res.answer


def test_actionable_ai_detects_fee_deadline():
    req = CopilotQueryRequest(query="When do I have to pay fees for even semester?")
    res = rag_engine.ask(req)
    assert res.answered is True
    assert res.actionable_suggestion is not None
    assert res.actionable_suggestion.has_action is True
    assert "Fee" in res.actionable_suggestion.title
    assert "2024-12-20" in res.actionable_suggestion.due_date


def test_refusal_path_and_citation_format():
    """
    Specifically verifies:
    1. Refusal path when no chunks pass threshold:
       - Refusal answer: "I couldn't find this in the approved campus documents"
       - No hallucinated text
       - grounded: false
       - empty citations array
    2. Citation format when answering:
       - citations have document_title, page_ref, snippet
       - LLM answer contains brackets [1] referencing source chunks
    """
    # 1. Refusal check
    unsupported_query = "Who was the Roman emperor in 45 BC and what was his favorite fruit?"
    resp = client.post("/api/copilot/ask", json={"question": unsupported_query})
    assert resp.status_code == 200
    data = resp.json()
    assert data["grounded"] is False
    assert data["answered"] is False
    assert data["citations"] == []
    assert REFUSAL_MESSAGE in data["answer"]
    assert "emperor" not in data["answer"].lower()  # Strict: no guessing!

    # Also test on /copilot/ask root alias
    resp_alias = client.post("/copilot/ask", json={"question": unsupported_query})
    assert resp_alias.status_code == 200
    assert resp_alias.json()["grounded"] is False

    # 2. Citation format check
    valid_query = "What is the penalty if my attendance is below 65%?"
    resp_valid = client.post("/api/copilot/ask", json={"question": valid_query})
    assert resp_valid.status_code == 200
    data_valid = resp_valid.json()
    assert data_valid["grounded"] is True
    assert data_valid["answered"] is True
    assert len(data_valid["citations"]) > 0

    first_cit = data_valid["citations"][0]
    assert "document_title" in first_cit and first_cit["document_title"]
    assert "page_ref" in first_cit and ("Page" in first_cit["page_ref"] or first_cit["page_ref"])
    assert "snippet" in first_cit and len(first_cit["snippet"]) > 0

    # Answer text must cite sources as [1]
    assert "[1]" in data_valid["answer"]


def test_document_ingestion_end_to_end():
    """
    Tests admin document ingestion:
    - POST /copilot/documents with approved file
    - Extracts per page
    - Chunks (~500 tokens, ~80 overlap) preserving page numbers
    - Embeds and indexes chunks
    - Query matches newly ingested chunk
    - DELETE /copilot/documents/{id} cleans up
    """
    # Upload sample notice
    sample_text = (
        "--- Page 1 ---\n"
        "TIET Sports Council Circular 2024-25.\n"
        "Inter-hostel sports tournament Urja 2024 commences on November 25, 2024.\n"
        "Badminton and table tennis matches will take place at the Multipurpose Gymnasium Hall.\n"
        "Participants must register their team before November 20 with the Sports Secretary.\n"
        "\f"
        "--- Page 2 ---\n"
        "All players are required to wear non-marking shoes on wooden indoor badminton courts.\n"
        "Equipment issue requires submission of student identity card.\n"
    )

    upload_file = io.BytesIO(sample_text.encode("utf-8"))
    resp = client.post(
        "/api/copilot/documents",
        files={"file": ("urja_sports_circular.txt", upload_file, "text/plain")},
        data={"title": "TIET Urja Sports 2024 Circular", "source_label": "sports_rules"},
    )
    assert resp.status_code == 200
    upload_data = resp.json()
    assert upload_data["chunks_created"] >= 2
    doc_id = upload_data["document"]["id"]
    assert upload_data["document"]["title"] == "TIET Urja Sports 2024 Circular"

    # Query newly ingested document
    sports_query = "What shoes are required for indoor badminton courts at Urja sports tournament?"
    ask_resp = client.post("/api/copilot/ask", json={"question": sports_query})
    assert ask_resp.status_code == 200
    ask_data = ask_resp.json()
    assert ask_data["grounded"] is True
    assert any("Urja Sports" in c["document_title"] for c in ask_data["citations"])
    assert "non-marking" in ask_data["answer"].lower()

    # List documents
    list_resp = client.get("/api/copilot/documents")
    assert list_resp.status_code == 200
    doc_ids = [d["id"] for d in list_resp.json()]
    assert doc_id in doc_ids

    # Delete document
    del_resp = client.delete(f"/api/copilot/documents/{doc_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # Confirm purged from list
    list_after = client.get("/api/copilot/documents").json()
    assert doc_id not in [d["id"] for d in list_after]


def test_ai_provider_abstraction(monkeypatch):
    """
    Verifies that the embedding and LLM providers are cleanly abstracted
    and can be configured via environment variables.
    """
    monkeypatch.setenv("EMBEDDING_PROVIDER", "local")
    monkeypatch.setenv("LLM_PROVIDER", "local")

    embedder = get_embedding_provider()
    llm = get_llm_provider()

    assert isinstance(embedder, LocalEmbeddingProvider)
    assert isinstance(llm, LocalLLMProvider)
