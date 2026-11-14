import uuid
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
from fastapi.responses import StreamingResponse

from ..core.auth import get_current_user_id, get_optional_user_id
from ..core.supabase import get_supabase_client
from ..database import db
from ..models.academic import DeadlineTask
from ..models.copilot import (
    CopilotQueryRequest,
    CopilotQueryResponse,
    CampusDocument,
    DocumentUploadResponse,
    ConfirmTaskRequest,
)
from ..services.rag_engine import rag_engine

router = APIRouter(prefix="/api/copilot", tags=["Campus Copilot RAG"])
copilot_public_router = APIRouter(prefix="/copilot", tags=["Campus Copilot RAG (Root Alias)"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB max


@router.post("/documents", response_model=DocumentUploadResponse)
async def upload_campus_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    source_label: str = Form("circular"),
):
    """
    INGESTION (Admin-only):
    Uploads an approved campus document (PDF/DOCX/TXT such as circulars, academic calendar, handbook, hostel/exam rules).
    Stores it in the campus-docs bucket, extracts text per page, chunks it (~500 tokens, ~80 overlap) preserving page numbers,
    embeds each chunk via swappable embedding provider, and stores in document_chunks.
    """
    filename = file.filename or "campus_doc.txt"
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type .{ext}. Approved document formats are PDF, DOCX, and TXT."
        )

    content_bytes = await file.read()
    if len(content_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit of 25 MB."
        )

    res = await rag_engine.ingest_document(
        file_bytes=content_bytes,
        filename=filename,
        title=title.strip(),
        source_label=source_label.strip(),
        uploaded_by="admin@thapar.edu",
    )
    return res


@router.get("/documents", response_model=List[CampusDocument])
def list_campus_documents():
    """
    List all indexed approved campus documents with chunk count and metadata.
    """
    return rag_engine.list_documents()


@router.delete("/documents/{document_id}")
def delete_campus_document(document_id: str):
    """
    Admin: Delete an approved campus document and purge its chunks from the vector index.
    """
    deleted = rag_engine.delete_document(document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {document_id} not found."
        )
    return {"success": True, "message": f"Document {document_id} and associated chunks deleted."}


@router.post("/ask", response_model=CopilotQueryResponse)
async def ask_copilot(
    request: CopilotQueryRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    QUERY:
    Embeds the question, calls match_chunks for top-k, applies similarity threshold.
    If no chunk passes the threshold, returns strict refusal:
    "I couldn't find this in the approved campus documents" with no guessing.
    Otherwise prompts the LLM with ONLY the retrieved chunks, citing sources as [1], [2].
    For personalized questions, retrieves authorized academic records on the server.
    """
    return await rag_engine.aask(request, user_id=user_id)


@router.post("/ask/stream")
async def ask_copilot_stream(
    request: CopilotQueryRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Streaming query endpoint delivering tokens in real-time via Server-Sent Events (SSE).
    """
    return StreamingResponse(
        rag_engine.ask_stream(request, user_id=user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/confirm-task", response_model=DeadlineTask)
def confirm_actionable_task(
    req: ConfirmTaskRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Actionable AI confirmation: turns a relevant campus circular into a task
    ONLY after the student explicitly clicks 'Confirm'. Persists user-owned task.
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
    db.add_deadline(user_id, task)

    client = get_supabase_client()
    if client:
        try:
            from .vault import _to_db_user_id
            db_uid = _to_db_user_id(user_id)
            client.table("tasks").insert({
                "id": str(uuid.uuid4()),
                "user_id": db_uid,
                "title": req.title,
                "course_code": req.course_code or "CAMPUS-NOTICE",
                "due_date": req.due_date,
                "status": "pending",
                "priority": req.priority,
                "source": "copilot_action",
            }).execute()
        except Exception:
            pass

    return task


# ============================================================
# Root Alias Mirror (/copilot/* mirroring /api/copilot/*)
# ============================================================
@copilot_public_router.post("/documents", response_model=DocumentUploadResponse)
async def upload_campus_document_root(
    file: UploadFile = File(...),
    title: str = Form(...),
    source_label: str = Form("circular"),
):
    return await upload_campus_document(file=file, title=title, source_label=source_label)


@copilot_public_router.get("/documents", response_model=List[CampusDocument])
def list_campus_documents_root():
    return list_campus_documents()


@copilot_public_router.delete("/documents/{document_id}")
def delete_campus_document_root(document_id: str):
    return delete_campus_document(document_id=document_id)


@copilot_public_router.post("/ask", response_model=CopilotQueryResponse)
async def ask_copilot_root(
    request: CopilotQueryRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    return await ask_copilot(request=request, user_id=user_id)


@copilot_public_router.post("/ask/stream")
async def ask_copilot_stream_root(
    request: CopilotQueryRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    return await ask_copilot_stream(request=request, user_id=user_id)


@copilot_public_router.post("/confirm-task", response_model=DeadlineTask)
def confirm_actionable_task_root(
    req: ConfirmTaskRequest,
    user_id: str = Depends(get_current_user_id),
):
    return confirm_actionable_task(req=req, user_id=user_id)
