import os
import uuid
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
from .durable_storage import AtomicJsonStorage, StorageError
from ..models.attachment import AttachmentMetadata

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"
ATTACHMENTS_DIR = STORAGE_DIR / "support_screenshots"
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)
METADATA_FILE = STORAGE_DIR / "support_attachments.json"

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # WebP starts with RIFF....WEBP
}

MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024  # 5 MB

class AttachmentService:
    """
    Centralized resource-authorized attachment service for CampusOS.
    Enforces Shared Invariant 1: Private files require authorization against their owning resource.
    """

    def __init__(self):
        self.storage = AtomicJsonStorage(METADATA_FILE, AttachmentMetadata)

    def validate_and_stage_upload(
        self,
        uploader_id: str,
        content: bytes,
        declared_content_type: str,
        original_filename: str,
        resource_type: str = "support_ticket",
    ) -> AttachmentMetadata:
        """
        Validates content size, MIME type, and magic bytes, generates a server-controlled
        safe filename, atomically writes the file to private storage, and records metadata.
        """
        if len(content) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Attachment exceeds maximum allowed limit of {MAX_ATTACHMENT_SIZE // (1024*1024)} MB.",
            )

        if declared_content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported attachment format. Allowed formats: JPEG, PNG, WEBP.",
            )

        # Validate magic bytes against claimed MIME type
        magic_signatures = ALLOWED_IMAGE_TYPES[declared_content_type]
        valid_magic = any(content.startswith(sig) for sig in magic_signatures)
        if declared_content_type == "image/webp" and len(content) >= 12:
            valid_magic = content[:4] == b"RIFF" and content[8:12] == b"WEBP"

        if not valid_magic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match the declared image format signature.",
            )

        ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        ext = ext_map.get(declared_content_type, "png")
        attachment_id = f"att-{uuid.uuid4().hex[:12]}"
        safe_filename = f"{attachment_id}.{ext}"
        target_path = ATTACHMENTS_DIR / safe_filename

        # Write file bytes atomically
        temp_path = target_path.with_suffix(f".tmp.{uuid.uuid4().hex}")
        try:
            with open(temp_path, "wb") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, target_path)
        except Exception as e:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist attachment file bytes.",
            ) from e

        # Write metadata atomically
        now_iso = datetime.now(timezone.utc).isoformat()
        metadata = AttachmentMetadata(
            id=attachment_id,
            resource_type=resource_type,
            resource_id=None,
            uploader_id=uploader_id,
            filename=safe_filename,
            original_filename=Path(original_filename).name if original_filename else safe_filename,
            content_type=declared_content_type,
            size_bytes=len(content),
            created_at=now_iso,
            lifecycle_state="staged",
        )

        try:
            self.storage.set(attachment_id, metadata)
        except StorageError as se:
            # Clean up target file on metadata write failure
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist attachment metadata.",
            ) from se

        return metadata

    def link_attachment(self, attachment_id: str, resource_id: str, expected_uploader_id: str) -> None:
        """
        Transitions attachment lifecycle from 'staged' to 'attached' linked to a resource.
        """
        metadata = self.storage.get(attachment_id)
        if not metadata:
            return

        if metadata.uploader_id != expected_uploader_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot link attachment owned by another user.",
            )

        def _update(d: Dict[str, AttachmentMetadata]):
            if attachment_id in d:
                meta = d[attachment_id].model_copy()
                meta.resource_id = resource_id
                meta.lifecycle_state = "attached"
                d[attachment_id] = meta

        self.storage.mutate(_update)

    def get_authorized_file(
        self,
        attachment_id: str,
        user_id: str,
        is_admin: bool,
        ticket_owner_id: Optional[str] = None,
        requested_ticket_id: Optional[str] = None,
    ) -> Tuple[Path, str]:
        """
        Enforces resource-based authorization before returning attachment path and MIME type.
        Rejects anonymous, cross-student, and ticket-mismatched requests.
        """
        metadata = self.storage.get(attachment_id)
        if not metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found.",
            )

        # Ticket mismatch validation if specific ticket requested
        if requested_ticket_id and metadata.resource_id and metadata.resource_id != requested_ticket_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attachment does not belong to the specified support ticket.",
            )

        # Authorization: Must be admin, uploader, or ticket owner
        authorized = (
            is_admin
            or (metadata.uploader_id == user_id)
            or (ticket_owner_id is not None and ticket_owner_id == user_id)
        )

        if not authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to view this attachment.",
            )

        # Safe storage path resolution (anti-directory traversal)
        safe_path = (ATTACHMENTS_DIR / metadata.filename).resolve()
        if not safe_path.is_relative_to(ATTACHMENTS_DIR.resolve()) or not safe_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment file content not found in private storage.",
            )

        return safe_path, metadata.content_type

    def get_by_filename(self, filename: str) -> Optional[AttachmentMetadata]:
        """
        Reverse lookup for legacy compatibility routes.
        """
        clean_name = Path(filename).name
        for meta in self.storage.get_all().values():
            if meta.filename == clean_name or meta.id == clean_name:
                return meta
        return None


attachment_service = AttachmentService()
