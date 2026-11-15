import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse

from ..models.lost_and_found import (
    LostAndFoundItem,
    LostAndFoundCreate,
    LostAndFoundUpdate,
    LostAndFoundClaim,
    LostAndFoundClaimCreate,
)
from ..services.lost_and_found_engine import lost_and_found_engine, IMAGES_DIR
from ..core.auth import get_current_user_claims, get_optional_user_claims

router = APIRouter(prefix="/api/lost-and-found", tags=["Lost and Found"])


@router.get("", response_model=List[LostAndFoundItem])
def list_reports(
    report_type: Optional[str] = Query(None, description="'lost', 'found', or 'all'"),
    category: Optional[str] = Query(None, description="Category filter"),
    status: Optional[str] = Query(None, description="'open', 'resolved', 'archived', or 'all'"),
    query: Optional[str] = Query(None, description="Search keyword"),
    my_reports: bool = Query(False, description="Filter to current user's reports"),
    claims: Optional[Dict[str, Any]] = Depends(get_optional_user_claims),
):
    """
    List Lost & Found reports with search, filtering, and privacy redaction.
    """
    user_id = str(claims["sub"]) if claims and "sub" in claims else None
    is_admin = bool(claims.get("is_admin")) if claims else False

    items = lost_and_found_engine.list_items(
        report_type=report_type,
        category=category,
        status_filter=status,
        query=query,
        my_user_id=user_id,
        only_my_reports=my_reports,
        is_admin=is_admin,
    )

    # Privacy Protection:
    # Do not expose creator email to unrelated students.
    sanitized: List[LostAndFoundItem] = []
    for item in items:
        copied = item.model_copy()
        if not is_admin and (not user_id or user_id != item.creator_id):
            copied.creator_email = "[Protected for Privacy]"
        sanitized.append(copied)

    return sanitized


@router.get("/{item_id}", response_model=LostAndFoundItem)
def get_report_detail(
    item_id: str,
    claims: Optional[Dict[str, Any]] = Depends(get_optional_user_claims),
):
    """
    Get detailed Lost & Found report with privacy redaction and archive visibility enforcement.
    """
    user_id = str(claims["sub"]) if claims and "sub" in claims else None
    is_admin = bool(claims.get("is_admin")) if claims else False

    item = lost_and_found_engine.get_item(item_id, user_id=user_id, is_admin=is_admin)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    copied = item.model_copy()
    if not is_admin and (not user_id or user_id != item.creator_id):
        copied.creator_email = "[Protected for Privacy]"
    return copied


@router.post("", response_model=LostAndFoundItem, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: LostAndFoundCreate,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Authenticated student/faculty/admin files a lost or found report.
    """
    creator_id = str(claims["sub"])
    creator_name = (
        claims.get("user_metadata", {}).get("full_name")
        or claims.get("email", "").split("@")[0].capitalize()
        or "Campus User"
    )
    creator_email = claims.get("email") or f"{creator_id}@thapar.edu"

    return lost_and_found_engine.create_item(
        creator_id=creator_id,
        creator_name=creator_name,
        creator_email=creator_email,
        data=payload,
    )


@router.put("/{item_id}", response_model=LostAndFoundItem)
def update_report(
    item_id: str,
    payload: LostAndFoundUpdate,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Owner or administrator updates report details.
    """
    actor_id = str(claims["sub"])
    actor_name = claims.get("user_metadata", {}).get("full_name") or "Campus User"
    is_admin = bool(claims.get("is_admin"))

    return lost_and_found_engine.update_item(
        item_id=item_id,
        actor_id=actor_id,
        actor_name=actor_name,
        is_admin=is_admin,
        data=payload,
    )


@router.post("/{item_id}/resolve", response_model=LostAndFoundItem)
def mark_report_resolved(
    item_id: str,
    payload: Optional[Dict[str, Any]] = None,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Owner or administrator marks report as resolved.
    """
    actor_id = str(claims["sub"])
    actor_name = claims.get("user_metadata", {}).get("full_name") or "Campus User"
    is_admin = bool(claims.get("is_admin"))

    return lost_and_found_engine.resolve_item(
        item_id=item_id,
        actor_id=actor_id,
        actor_name=actor_name,
        is_admin=is_admin,
    )


@router.post("/{item_id}/archive", response_model=LostAndFoundItem)
def archive_report(
    item_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Owner or administrator archives report.
    """
    actor_id = str(claims["sub"])
    actor_name = claims.get("user_metadata", {}).get("full_name") or "Campus User"
    is_admin = bool(claims.get("is_admin"))

    return lost_and_found_engine.archive_item(
        item_id=item_id,
        actor_id=actor_id,
        actor_name=actor_name,
        is_admin=is_admin,
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    item_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Owner or administrator permanently deletes report.
    """
    actor_id = str(claims["sub"])
    actor_name = claims.get("user_metadata", {}).get("full_name") or "Campus User"
    is_admin = bool(claims.get("is_admin"))

    lost_and_found_engine.delete_item(
        item_id=item_id,
        actor_id=actor_id,
        actor_name=actor_name,
        is_admin=is_admin,
    )
    return None


# ============================================================
# Private Claims & Verification
# ============================================================

@router.post("/{item_id}/claims", response_model=LostAndFoundClaim, status_code=status.HTTP_201_CREATED)
@router.post("/{item_id}/claim", response_model=LostAndFoundClaim, status_code=status.HTTP_201_CREATED)
def submit_claim(
    item_id: str,
    payload: LostAndFoundClaimCreate,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Claimant submits private distinguishing proof to the reporter.
    Proof is strictly private and hidden from other students.
    """
    claimant_id = str(claims["sub"])
    claimant_name = claims.get("user_metadata", {}).get("full_name") or "Claimant"
    claimant_email = claims.get("email") or f"{claimant_id}@thapar.edu"

    return lost_and_found_engine.submit_claim(
        item_id=item_id,
        claimant_id=claimant_id,
        claimant_name=claimant_name,
        claimant_email=claimant_email,
        data=payload,
    )


@router.get("/{item_id}/claims", response_model=List[LostAndFoundClaim])
def list_claims(
    item_id: str,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    List private claims for an item. Restricted strictly to report owner or administrator.
    """
    actor_id = str(claims["sub"])
    is_admin = bool(claims.get("is_admin"))

    return lost_and_found_engine.list_claims_for_item(
        item_id=item_id,
        actor_id=actor_id,
        is_admin=is_admin,
    )


from pydantic import BaseModel, Field

class VerifyClaimRequest(BaseModel):
    action: Optional[str] = None
    status_update: Optional[str] = None
    notes: Optional[str] = None
    admin_notes: Optional[str] = None

@router.post("/{item_id}/claims/{claim_id}/verify", response_model=LostAndFoundClaim)
def verify_claim(
    item_id: str,
    claim_id: str,
    payload: Optional[VerifyClaimRequest] = None,
    status_update: Optional[str] = Query(None, description="'verified' or 'rejected'"),
    admin_notes: Optional[str] = Query(None),
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Report owner or administrator verifies or rejects claimant proof.
    """
    actor_id = str(claims["sub"])
    actor_name = claims.get("user_metadata", {}).get("full_name") or "Campus User"
    is_admin = bool(claims.get("is_admin"))

    resolved_status = (payload.status_update or payload.action if payload else None) or status_update
    resolved_notes = (payload.admin_notes or payload.notes if payload else None) or admin_notes

    if resolved_status == "verify":
        resolved_status = "verified"
    elif resolved_status == "reject":
        resolved_status = "rejected"

    if resolved_status not in ("verified", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'verified' or 'rejected'.",
        )

    return lost_and_found_engine.verify_claim(
        item_id=item_id,
        claim_id=claim_id,
        actor_id=actor_id,
        actor_name=actor_name,
        is_admin=is_admin,
        verify_status=resolved_status,
        admin_notes=resolved_notes,
    )


# ============================================================
# Authorized Image Upload
# ============================================================

@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Upload an item photo (JPEG, PNG, WEBP, max 5MB).
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
            detail="Image size exceeds maximum limit of 5 MB.",
        )

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    safe_filename = f"laf_{uuid.uuid4().hex[:12]}.{ext.lower()}"
    target_path = IMAGES_DIR / safe_filename
    with open(target_path, "wb") as f:
        f.write(content)

    return {"image_url": f"/api/lost-and-found/images/{safe_filename}"}


@router.get("/images/{filename}")
def serve_image(
    filename: str,
    claims: Optional[Dict[str, Any]] = Depends(get_optional_user_claims),
):
    """
    Serve uploaded lost and found images enforcing archive visibility.
    If the owning report is archived, images are accessible only to the owner and administrators.
    """
    # Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename format.")

    user_id = str(claims["sub"]) if claims and "sub" in claims else None
    is_admin = bool(claims.get("is_admin")) if claims else False

    # Check owning item authorization
    owning_item = lost_and_found_engine.get_item_by_image_filename(filename, user_id=user_id, is_admin=is_admin)
    target = (IMAGES_DIR / filename).resolve()
    if not target.is_relative_to(IMAGES_DIR.resolve()) or not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    if not owning_item:
        # Check if the file belongs to an archived report that the caller cannot access
        for item in lost_and_found_engine.item_storage.get_all().values():
            urls = item.image_urls or ([item.image_url] if item.image_url else [])
            if any(filename in u for u in urls if u):
                if item.status == "archived" and not (is_admin or (user_id and item.creator_id == user_id)):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: Image belongs to an archived report.",
                    )

    return FileResponse(
        target,
        headers={
            "Cache-Control": "private, max-age=3600" if (owning_item and owning_item.status != "archived") else "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
        },
    )
