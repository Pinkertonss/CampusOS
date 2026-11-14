import json
import uuid
import threading
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

router = APIRouter(prefix="/api/support", tags=["Support & Help"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"
TICKETS_FILE = STORAGE_DIR / "support_tickets.json"
SCREENSHOTS_DIR = STORAGE_DIR / "support_screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

_lock = threading.RLock()
_tickets: Dict[str, SupportTicket] = {}

def _load_tickets():
    global _tickets
    if TICKETS_FILE.exists():
        try:
            with open(TICKETS_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
                _tickets = {k: SupportTicket(**v) for k, v in raw.items()}
        except Exception:
            _tickets = {}

def _save_tickets():
    with _lock:
        try:
            with open(TICKETS_FILE, "w", encoding="utf-8") as f:
                json.dump({k: v.model_dump() for k, v in _tickets.items()}, f, indent=2)
        except Exception:
            pass

_load_tickets()


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

    with _lock:
        results = list(_tickets.values())
        if not is_admin:
            results = [t for t in results if t.user_id == user_id]

        if status_filter and status_filter != "all":
            results = [t for t in results if t.status == status_filter]

        if category and category != "all":
            results = [t for t in results if t.category == category]

        results.sort(key=lambda x: x.created_at, reverse=True)
        return results


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

    with _lock:
        ticket = _tickets.get(ticket_id)
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

    with _lock:
        _tickets[ticket_id] = ticket
        _save_tickets()

    return ticket


@router.put("/tickets/{ticket_id}", response_model=SupportTicket)
def update_ticket(
    ticket_id: str,
    payload: SupportTicketUpdate,
    claims: Dict[str, Any] = Depends(require_admin_user),
):
    """
    Administrator updates ticket status and adds response.
    """
    admin_id = str(claims["sub"])
    admin_name = claims.get("user_metadata", {}).get("full_name") or "Administrator"

    with _lock:
        ticket = _tickets.get(ticket_id)
        if not ticket:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

        now_iso = datetime.now(timezone.utc).isoformat()
        if payload.status is not None:
            ticket.status = payload.status
            if payload.status == "resolved":
                ticket.resolved_at = now_iso
                ticket.resolved_by = admin_id
        if payload.admin_response is not None:
            ticket.admin_response = payload.admin_response.strip()
        if payload.priority is not None:
            ticket.priority = payload.priority

        ticket.updated_at = now_iso
        _save_tickets()
        return ticket


@router.post("/upload-screenshot")
async def upload_screenshot(
    file: UploadFile = File(...),
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Upload an optional screenshot for a support ticket (JPEG, PNG, WEBP, max 5MB).
    """
    ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Allowed formats: JPEG, PNG, WEBP.",
        )

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Screenshot file exceeds maximum limit of 5 MB.",
        )

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    safe_filename = f"tkt_{uuid.uuid4().hex[:12]}.{ext.lower()}"
    target_path = SCREENSHOTS_DIR / safe_filename
    with open(target_path, "wb") as f:
        f.write(content)

    return {"screenshot_url": f"/api/support/screenshots/{safe_filename}"}


@router.get("/screenshots/{filename}")
def serve_screenshot(filename: str):
    """
    Serve uploaded support screenshots.
    """
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")

    target = SCREENSHOTS_DIR / filename
    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")

    return FileResponse(target)
