from typing import Optional, List
from pydantic import BaseModel, Field

class Citation(BaseModel):
    document_title: str
    section_title: str
    page_number: Optional[int] = 1
    source_ref: str
    excerpt: str

class ActionableSuggestion(BaseModel):
    has_action: bool = False
    title: str
    due_date: str
    priority: str = "medium"
    course_code: Optional[str] = None
    reason: str

class CopilotQueryRequest(BaseModel):
    query: str = Field(..., min_length=2)
    student_context: Optional[dict] = None

class CopilotQueryResponse(BaseModel):
    query: str
    answered: bool
    answer: str
    citations: List[Citation] = []
    actionable_suggestion: Optional[ActionableSuggestion] = None

class ConfirmTaskRequest(BaseModel):
    title: str
    due_date: str
    priority: str = "medium"
    course_code: Optional[str] = None
