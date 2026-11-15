import os
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse

from ..models.support import (
    SupportTicket,
    SupportTicketCreate,
    SupportTicketUpdate,
)
from ..core.auth import get_current_user_claims, require_admin_user
from ..services.durable_storage import AtomicJsonStorage, StorageError
from ..services.attachment_service import attachment_service, ATTACHMENTS_DIR

router = APIRouter(prefix="/api/support", tags=["Support & Help"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"
TICKETS_FILE = STORAGE_DIR / "support_tickets.json"

# Atomic, transactional storage for Support Tickets
ticket_storage = AtomicJsonStorage(TICKETS_FILE, SupportTicket)


@router.get("/tickets", response_model=List[SupportTicket])
def list_tickets(
    status_filter: Optional[str] = Query(None, description="'open', 'in_progress', 'resolved', or 'all'"),
    category: Optional[str] = Query(None),
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    List support tickets. Students see strictly their own tickets; Administrators see all tickets.
    """
    user_id = str(claims["sub"])
    is_admin = bool(claims.get("is_admin"))

    tickets = list(ticket_storage.get_all().values())
    if not is_admin:
        tickets = [t for t in tickets if t.user_id == user_id]

    if status_filter and status_filter != "all":
        tickets = [t for t in tickets if t.status == status_filter]

    if category and category != "all":
        tickets = [t for t in tickets if t.category == category]

    tickets.sort(key=lambda x: x.created_at, reverse=True)
    return tickets


@router.get("/tickets/{ticket_id}", response_model=SupportTicket)
def get_ticket(
    ticket_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Get ticket detail. Restricted to owner or administrator.
    """
    user_id = str(claims["sub"])
    is_admin = bool(claims.get("is_admin"))

    ticket = ticket_storage.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.user_id != user_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have access to this support ticket.",
        )
    return ticket


@router.post("/tickets", response_model=SupportTicket, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: SupportTicketCreate,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Authenticated user files a support ticket or bug report.
    Enforces atomic persistence: failed saves roll back and raise HTTP 500 without returning 201.
    """
    user_id = str(claims["sub"])
    user_name = claims.get("user_metadata", {}).get("full_name") or claims.get("email", "").split("@")[0].capitalize() or "Student"
    user_email = claims.get("email") or f"{user_id}@thapar.edu"

    now_iso = datetime.now(timezone.utc).isoformat()
    ticket_id = f"tkt-{uuid.uuid4().hex[:8]}"

    ticket = SupportTicket(
        id=ticket_id,
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        category=payload.category,
        subject=payload.subject.strip(),
        description=payload.description.strip(),
        priority=payload.priority,
        screenshot_url=payload.screenshot_url,
        status="open",
        created_at=now_iso,
        updated_at=now_iso,
    )

    # If a screenshot attachment was supplied, extract its ID and link lifecycle
    if payload.screenshot_url:
        att_token = payload.screenshot_url.split("/")[-1]
        if att_token.startswith("att-"):
            att_id = att_token.split(".")[0]
            try:
                attachment_service.link_attachment(att_id, ticket_id, user_id)
            except HTTPException:
                pass

    try:
        ticket_storage.set(ticket_id, ticket)
    except StorageError as se:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage persistence failure: could not save ticket.",
        ) from se

    return ticket


@router.put("/tickets/{ticket_id}", response_model=SupportTicket)
def update_ticket(
    ticket_id: str,
    payload: SupportTicketUpdate,
    claims: Dict[str, Any] = Depends(require_admin_user),
):
    """
    Administrator updates ticket status and adds response.
    Enforces atomic persistence.
    """
    admin_id = str(claims["sub"])
    ticket = ticket_storage.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    updated = ticket.model_copy()

    if payload.status is not None:
        updated.status = payload.status
        if payload.status == "resolved":
            updated.resolved_at = now_iso
            updated.resolved_by = admin_id
    if payload.admin_response is not None:
        updated.admin_response = payload.admin_response.strip()
    if payload.priority is not None:
        updated.priority = payload.priority

    updated.updated_at = now_iso

    try:
        ticket_storage.set(ticket_id, updated)
    except StorageError as se:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage persistence failure: could not update ticket.",
        ) from se

    return updated


@router.post("/upload-screenshot")
async def upload_screenshot(
    file: UploadFile = File(...),
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Upload a private screenshot for a support ticket (JPEG, PNG, WEBP, max 5MB).
    Registers attachment metadata and returns an authorized attachment access URL.
    """
    user_id = str(claims["sub"])
    content = await file.read()
    metadata = attachment_service.validate_and_stage_upload(
        uploader_id=user_id,
        content=content,
        declared_content_type=file.content_type or "image/png",
        original_filename=file.filename or "screenshot.png",
        resource_type="support_ticket",
    )

    return {
        "attachment_id": metadata.id,
        "screenshot_url": f"/api/support/attachments/{metadata.id}",
    }


@router.get("/attachments/{attachment_id}")
def get_attachment(
    attachment_id: str,
    ticket_id: Optional[str] = Query(None, description="Optional ticket context for cross-validation"),
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Secure attachment retrieval endpoint.
    Guarantees:
    1. Authenticated callers only (anonymous fails 401).
    2. Restricted to uploader, ticket owner, or authorized admin (cross-student fails 403).
    3. Validates ticket ID match when supplied.
    4. Safe path resolution preventing directory traversal.
    5. No-store private caching headers for sensitive downloads.
    """
    user_id = str(claims["sub"])
    is_admin = bool(claims.get("is_admin"))

    # Resolve parent ticket owner if linked
    ticket_owner_id = None
    meta = attachment_service.storage.get(attachment_id)
    if meta and meta.resource_id:
        parent_ticket = ticket_storage.get(meta.resource_id)
        if parent_ticket:
            ticket_owner_id = parent_ticket.user_id

    file_path, content_type = attachment_service.get_authorized_file(
        attachment_id=attachment_id,
        user_id=user_id,
        is_admin=is_admin,
        ticket_owner_id=ticket_owner_id,
        requested_ticket_id=ticket_id,
    )

    return FileResponse(
        file_path,
        media_type=content_type,
        headers={
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/screenshots/{filename}")
def serve_screenshot_legacy(
    filename: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Legacy compatibility route for screenshots.
    Routes strictly through the same resource authorization check as /attachments/{id}.
    Anonymous access is rejected with 401; unmanaged/unauthorized files fail 403/404.
    """
    user_id = str(claims["sub"])
    is_admin = bool(claims.get("is_admin"))

    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename format.")

    meta = attachment_service.get_by_filename(filename)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found or access denied.",
        )

    ticket_owner_id = None
    if meta.resource_id:
        parent_ticket = ticket_storage.get(meta.resource_id)
        if parent_ticket:
            ticket_owner_id = parent_ticket.user_id

    file_path, content_type = attachment_service.get_authorized_file(
        attachment_id=meta.id,
        user_id=user_id,
        is_admin=is_admin,
        ticket_owner_id=ticket_owner_id,
    )

    return FileResponse(
        file_path,
        media_type=content_type,
        headers={
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )
