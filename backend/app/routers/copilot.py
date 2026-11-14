import uuid
from fastapi import APIRouter
from ..database import db
from ..models.academic import DeadlineTask
from ..models.copilot import (
    CopilotQueryRequest,
    CopilotQueryResponse,
    ConfirmTaskRequest,
)
from ..services.rag_engine import rag_engine

router = APIRouter(prefix="/api/copilot", tags=["Campus Copilot RAG"])

@router.post("/ask", response_model=CopilotQueryResponse)
def ask_copilot(request: CopilotQueryRequest):
    """
    RAG Chatbot over approved Thapar Institute campus documents.
    Always answers with source citations and strictly declines unsupported questions.
    Generates actionable suggestions if a verified circular deadline is identified.
    """
    return rag_engine.ask(request)

@router.post("/confirm-task", response_model=DeadlineTask)
def confirm_actionable_task(req: ConfirmTaskRequest):
    """
    Actionable AI confirmation: turns a relevant campus circular into a task
    ONLY after the student explicitly clicks 'Confirm'.
    """
    task = DeadlineTask(
        id=f"task-{uuid.uuid4().hex[:6]}",
        title=req.title,
        course_code=req.course_code or "CAMPUS-NOTICE",
        due_date=req.due_date,
        status="pending",
        priority=req.priority,
        source="copilot_action",
    )
    db.deadlines.append(task)
    return task
