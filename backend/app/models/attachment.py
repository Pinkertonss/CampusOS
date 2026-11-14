from typing import Optional
from pydantic import BaseModel, Field

class AttachmentMetadata(BaseModel):
    id: str = Field(..., description="Opaque attachment identifier")
    resource_type: str = Field("support_ticket", description="Owning resource category (support_ticket, lost_and_found)")
    resource_id: Optional[str] = Field(None, description="ID of the parent resource once linked")
    uploader_id: str = Field(..., description="User ID of the student/staff who uploaded the file")
    filename: str = Field(..., description="Server-controlled safe filename on storage disk")
    original_filename: str = Field(..., description="Sanitized original upload name")
    content_type: str = Field(..., description="Verified MIME type")
    size_bytes: int = Field(..., description="File size in bytes")
    created_at: str = Field(..., description="ISO 8601 UTC creation timestamp")
    lifecycle_state: str = Field("staged", description="staged, attached, archived, deleted")
