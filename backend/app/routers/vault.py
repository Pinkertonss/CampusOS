import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from ..database import db
from ..models.vault import VaultDocument, VaultConsentRequest

router = APIRouter(prefix="/api/vault", tags=["Digital Vault"])

@router.get("/consent")
def get_vault_consent():
    return {
        "consent_given": db.vault_consent_granted,
        "policy": "CampusOS Private Vault isolates all student records in user-level encrypted buckets. Data is never shared or used for model training without explicit student authorization.",
    }

@router.post("/consent")
def set_vault_consent(req: VaultConsentRequest):
    db.vault_consent_granted = req.consent_given
    return {
        "success": True,
        "consent_given": db.vault_consent_granted,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@router.get("/documents", response_model=List[VaultDocument])
def list_documents(category: Optional[str] = None):
    docs = list(db.vault_docs.values())
    if category and category.lower() != "all":
        docs = [d for d in docs if d.category.lower() == category.lower()]
    return sorted(docs, key=lambda x: x.created_at, reverse=True)

@router.post("/upload", response_model=VaultDocument)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form(...),
    tags: str = Form(""),
):
    if not db.vault_consent_granted:
        raise HTTPException(
            status_code=403,
            detail="Student privacy consent must be acknowledged before uploading private documents into the Digital Vault."
        )

    content = await file.read()
    file_size = len(content)
    doc_id = f"v-{uuid.uuid4().hex[:6]}"
    
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    storage_path = f"vault-private/user_102203099/{doc_id}_{file.filename}"

    new_doc = VaultDocument(
        id=doc_id,
        title=title.strip(),
        category=category.strip().lower(),
        tags=tag_list,
        file_size_bytes=file_size,
        mime_type=file.content_type or "application/octet-stream",
        storage_path=storage_path,
        download_url=f"/api/vault/download/{doc_id}",
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.vault_docs[doc_id] = new_doc
    return new_doc

@router.get("/download/{doc_id}")
def download_document(doc_id: str):
    if doc_id not in db.vault_docs:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc = db.vault_docs[doc_id]
    return {
        "id": doc.id,
        "title": doc.title,
        "mime_type": doc.mime_type,
        "file_size_bytes": doc.file_size_bytes,
        "signed_secure_url": f"https://mock-storage.supabase.co/storage/v1/object/authenticated/{doc.storage_path}?token=expiring_signed_jwt",
        "notice": "Private document accessed via signed URL adhering to Row Level Security."
    }

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    if doc_id in db.vault_docs:
        del db.vault_docs[doc_id]
        return {"success": True, "message": "Document deleted securely from vault"}
    raise HTTPException(status_code=404, detail="Document not found")
