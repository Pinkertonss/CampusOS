import pytest
from app.services.rag_engine import rag_engine, UNSUPPORTED_ANSWER
from app.models.copilot import CopilotQueryRequest

def test_copilot_answers_with_citations_for_valid_campus_query():
    req = CopilotQueryRequest(query="What is the minimum attendance requirement to appear in exams?")
    res = rag_engine.ask(req)
    assert res.answered is True
    assert len(res.citations) > 0
    # Must cite TIET Academic Regulations
    assert any("Academic Regulations" in c.document_title for c in res.citations)
    assert "75%" in res.answer

def test_copilot_declines_unsupported_questions():
    req = CopilotQueryRequest(query="What is the recipe for chocolate chip cookies in Paris?")
    res = rag_engine.ask(req)
    assert res.answered is False
    assert len(res.citations) == 0
    assert res.answer == UNSUPPORTED_ANSWER

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
