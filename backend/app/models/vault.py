from typing import Optional, List
from pydantic import BaseModel, Field

class VaultDocumentBase(BaseModel):
    title: str = Field(...)
    category: str = Field(...) # marksheets, certificates, receipts, identity, notes
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
