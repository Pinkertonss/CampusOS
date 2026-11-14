from typing import Optional, List
from pydantic import BaseModel, Field, model_validator

class Citation(BaseModel):
    document_title: str
    page_ref: str = "Page 1"
    snippet: str = ""
    section_title: Optional[str] = ""
    page_number: Optional[int] = 1
    source_ref: Optional[str] = ""
    excerpt: Optional[str] = ""

    @model_validator(mode="before")
    @classmethod
    def sync_compat_fields(cls, data: any):
        if isinstance(data, dict):
            # Sync snippet <-> excerpt
            if "snippet" in data and not data.get("excerpt"):
                data["excerpt"] = data["snippet"]
            elif "excerpt" in data and not data.get("snippet"):
                data["snippet"] = data["excerpt"]

            # Sync page_ref <-> page_number
            if "page_ref" in data and not data.get("page_number"):
                # try parsing number
                num_match = [int(s) for s in data["page_ref"].split() if s.isdigit()]
                data["page_number"] = num_match[0] if num_match else 1
            elif "page_number" in data and not data.get("page_ref"):
                data["page_ref"] = f"Page {data['page_number']}"
        return data


class ActionableSuggestion(BaseModel):
    has_action: bool = False
    title: str = ""
    due_date: str = ""
    priority: str = "medium"
    course_code: Optional[str] = None
    reason: str = ""


class CopilotQueryRequest(BaseModel):
    query: Optional[str] = None
    question: Optional[str] = None
    student_context: Optional[dict] = None

    @model_validator(mode="before")
    @classmethod
    def sync_query_question(cls, data: any):
        if isinstance(data, dict):
            q = data.get("question") or data.get("query")
            if q:
                data["query"] = q
                data["question"] = q
        return data

    def get_query_text(self) -> str:
        return (self.question or self.query or "").strip()


class CopilotQueryResponse(BaseModel):
    query: str
    answered: bool
    answer: str
    citations: List[Citation] = []
    confidence: float = 0.0
    grounded: bool = False
    actionable_suggestion: Optional[ActionableSuggestion] = None


class CampusDocument(BaseModel):
    id: str
    title: str
    source_label: str
    storage_path: str
    uploaded_by: str = "admin"
    is_approved: bool = True
    chunk_count: int = 0
    file_size_bytes: int = 0
    created_at: str


class DocumentUploadResponse(BaseModel):
    document: CampusDocument
    chunks_created: int
    message: str


class ConfirmTaskRequest(BaseModel):
    title: str
    due_date: str
    priority: str = "medium"
    course_code: Optional[str] = None
