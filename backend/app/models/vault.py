from typing import Optional, List
from pydantic import BaseModel, Field

# ============================================================
# Legacy Vault Models (Kept for backward compatibility)
# ============================================================

class VaultDocumentBase(BaseModel):
    title: str = Field(...)
    category: str = Field(...)  # notes, certificate, academic, other, marksheets, receipts, identity
    tags: List[str] = Field(default_factory=list)

class VaultDocumentCreate(VaultDocumentBase):
    file_size_bytes: int
    mime_type: str
    storage_path: str
    consent_verified: bool = True

class VaultDocument(VaultDocumentBase):
    id: str
    user_id: Optional[str] = None
    file_size_bytes: int
    mime_type: str
    storage_path: str
    download_url: Optional[str] = None
    created_at: str

class VaultConsentRequest(BaseModel):
    consent_given: bool = True
    terms_version: str = "2024.1"


# ============================================================
# Digital Vault Official Specification Models
# ============================================================

ALLOWED_VAULT_MIME_TYPES = {
    # PDF
    "application/pdf",
    # Images
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    # DOCX / DOC
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    # PPTX / PPT
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    # TXT / MD / CSV
    "text/plain",
    "text/markdown",
    "text/csv",
}

ALLOWED_EXTENSIONS = {
    "pdf", "png", "jpg", "jpeg", "webp", "gif", "svg",
    "docx", "doc", "pptx", "ppt", "txt", "md", "csv"
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

class UploadUrlRequest(BaseModel):
    filename: str = Field(..., min_length=1)
    mime_type: str = Field(...)
    size_bytes: int = Field(..., gt=0)

class UploadUrlResponse(BaseModel):
    storage_path: str
    upload_url: str
    token: Optional[str] = None
    expires_in: int = 300

class VaultItemCreate(BaseModel):
    title: str = Field(..., min_length=1)
    category: str = Field(..., description="notes, certificate, academic, other")
    storage_path: str = Field(..., min_length=1)
    mime_type: str = Field(...)
    size_bytes: int = Field(..., ge=0)

class VaultItemUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None

class VaultItem(BaseModel):
    id: str
    user_id: str
    title: str
    category: str
    storage_path: str
    mime_type: str
    size_bytes: int
    created_at: str
    download_url: Optional[str] = None

class DownloadUrlResponse(BaseModel):
    item_id: str
    title: str
    download_url: str
    mime_type: str
    expires_in: int = 300

class VaultListResponse(BaseModel):
    items: List[VaultItem]
    total_count: int
    total_size_bytes: int
    total_storage_bytes: Optional[int] = None
    max_storage_bytes: int = 500 * 1024 * 1024  # 500 MB student quota
    storage_limit_bytes: Optional[int] = None
