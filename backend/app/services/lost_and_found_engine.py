import json
import uuid
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from fastapi import HTTPException, status
from ..models.lost_and_found import (
    LostAndFoundItem,
    LostAndFoundCreate,
    LostAndFoundUpdate,
    LostAndFoundClaim,
    LostAndFoundClaimCreate,
)

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"
ITEMS_FILE = STORAGE_DIR / "lost_and_found_items.json"
CLAIMS_FILE = STORAGE_DIR / "lost_and_found_claims.json"
IMAGES_DIR = STORAGE_DIR / "lost_and_found_images"

def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***@thapar.edu"
    parts = email.split("@")
    user, domain = parts[0], parts[1]
    if len(user) <= 2:
        masked_user = user[0] + "***"
    else:
        masked_user = user[:2] + "***" + user[-1]
    return f"{masked_user}@{domain}"

class LostAndFoundEngine:
    """
    Durable service engine for CampusOS Lost and Found system.
    Supports:
    - Lost & Found item lifecycle (open, resolved, archived)
    - Ownership-based editing & resolution
    - Administrator moderation with audit logs
    - Private claimant workflow where identifying proof is strictly visible only to owner/claimant/admin
    """

    def __init__(self):
        self._lock = threading.RLock()
        self.items: Dict[str, LostAndFoundItem] = {}
        self.claims: Dict[str, List[LostAndFoundClaim]] = {}  # item_id -> list of claims
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self):
        with self._lock:
            if ITEMS_FILE.exists():
                try:
                    with open(ITEMS_FILE, "r", encoding="utf-8") as f:
                        raw = json.load(f)
                        self.items = {k: LostAndFoundItem(**v) for k, v in raw.items()}
                except Exception:
                    self.items = {}
            if CLAIMS_FILE.exists():
                try:
                    with open(CLAIMS_FILE, "r", encoding="utf-8") as f:
                        raw_c = json.load(f)
                        self.claims = {k: [LostAndFoundClaim(**c) for c in v] for k, v in raw_c.items()}
                except Exception:
                    self.claims = {}

    def _save(self):
        with self._lock:
            try:
                with open(ITEMS_FILE, "w", encoding="utf-8") as f:
                    json.dump({k: v.model_dump() for k, v in self.items.items()}, f, indent=2)
                with open(CLAIMS_FILE, "w", encoding="utf-8") as f:
                    json.dump({k: [c.model_dump() for c in v] for k, v in self.claims.items()}, f, indent=2)
            except Exception:
                pass

    def list_items(
        self,
        report_type: Optional[str] = None,
        category: Optional[str] = None,
        status_filter: Optional[str] = None,
        query: Optional[str] = None,
        my_user_id: Optional[str] = None,
        only_my_reports: bool = False,
        is_admin: bool = False,
    ) -> List[LostAndFoundItem]:
        with self._lock:
            results = list(self.items.values())

            # Filter by creator if requested
            if only_my_reports and my_user_id:
                results = [item for item in results if item.creator_id == my_user_id]

            # Public users shouldn't see archived items unless explicitly filtering or viewing own items
            if not is_admin and not only_my_reports:
                if not status_filter:
                    results = [item for item in results if item.status != "archived"]

            if report_type and report_type != "all":
                results = [item for item in results if item.report_type == report_type]

            if category and category != "all":
                results = [item for item in results if item.category.lower() == category.lower()]

            if status_filter and status_filter != "all":
                results = [item for item in results if item.status == status_filter]

            if query:
                q = query.strip().lower()
                results = [
                    item
                    for item in results
                    if q in item.title.lower()
                    or q in item.description.lower()
                    or q in item.location.lower()
                    or q in item.category.lower()
                ]

            # Sort: newest first
            results.sort(key=lambda x: x.created_at, reverse=True)
            return results

    def get_item(self, item_id: str) -> Optional[LostAndFoundItem]:
        with self._lock:
            return self.items.get(item_id)

    def create_item(
        self,
        creator_id: str,
        creator_name: str,
        creator_email: str,
        data: LostAndFoundCreate,
    ) -> LostAndFoundItem:
        with self._lock:
            now_iso = datetime.now(timezone.utc).isoformat()
            date_val = data.date_incident or data.event_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            img_urls = data.image_urls or ([data.image_url] if data.image_url else [])
            img_val = data.image_url or (img_urls[0] if img_urls else None)
            masked_email = _mask_email(creator_email)
            new_id = f"laf-{uuid.uuid4().hex[:8]}"
            item = LostAndFoundItem(
                id=new_id,
                title=data.title.strip(),
                description=data.description.strip(),
                category=data.category,
                report_type=data.report_type,
                status="open",
                location=data.location.strip(),
                date_incident=date_val,
                event_date=date_val,
                image_url=img_val,
                image_urls=img_urls,
                creator_id=creator_id,
                creator_name=creator_name,
                creator_email=creator_email,
                reporter_id=creator_id,
                reporter_email_masked=masked_email,
                created_at=now_iso,
                updated_at=now_iso,
                claims_count=0,
                audit_logs=[
                    {
                        "action": "CREATED",
                        "actor_id": creator_id,
                        "actor_name": creator_name,
                        "timestamp": now_iso,
                    }
                ],
            )
            self.items[new_id] = item
            self._save()
            return item

    def update_item(
        self,
        item_id: str,
        actor_id: str,
        actor_name: str,
        is_admin: bool,
        data: LostAndFoundUpdate,
    ) -> LostAndFoundItem:
        with self._lock:
            item = self.items.get(item_id)
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

            # Check ownership or admin
            if item.creator_id != actor_id and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: You are not authorized to edit this report.",
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            if data.title is not None:
                item.title = data.title.strip()
            if data.description is not None:
                item.description = data.description.strip()
            if data.category is not None:
                item.category = data.category
            if data.location is not None:
                item.location = data.location.strip()
            if data.date_incident is not None:
                item.date_incident = data.date_incident
            if data.image_url is not None:
                item.image_url = data.image_url
            if data.status is not None:
                item.status = data.status
                if data.status == "resolved" and not item.resolved_at:
                    item.resolved_at = now_iso
                    item.resolved_by = actor_id

            item.updated_at = now_iso
            item.audit_logs.append(
                {
                    "action": "UPDATED",
                    "actor_id": actor_id,
                    "actor_name": actor_name,
                    "is_admin": is_admin,
                    "timestamp": now_iso,
                }
            )
            self._save()
            return item

    def resolve_item(
        self,
        item_id: str,
        actor_id: str,
        actor_name: str,
        is_admin: bool,
    ) -> LostAndFoundItem:
        with self._lock:
            item = self.items.get(item_id)
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

            if item.creator_id != actor_id and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the reporter or an administrator can mark this item resolved.",
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            item.status = "resolved"
            item.resolved_at = now_iso
            item.resolved_by = actor_id
            item.updated_at = now_iso
            item.audit_logs.append(
                {
                    "action": "RESOLVED",
                    "actor_id": actor_id,
                    "actor_name": actor_name,
                    "is_admin": is_admin,
                    "timestamp": now_iso,
                }
            )
            self._save()
            return item

    def archive_item(
        self,
        item_id: str,
        actor_id: str,
        actor_name: str,
        is_admin: bool,
    ) -> LostAndFoundItem:
        with self._lock:
            item = self.items.get(item_id)
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

            if item.creator_id != actor_id and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the reporter or an administrator can archive this report.",
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            item.status = "archived"
            item.updated_at = now_iso
            item.audit_logs.append(
                {
                    "action": "ARCHIVED",
                    "actor_id": actor_id,
                    "actor_name": actor_name,
                    "is_admin": is_admin,
                    "timestamp": now_iso,
                }
            )
            self._save()
            return item

    def delete_item(
        self,
        item_id: str,
        actor_id: str,
        actor_name: str,
        is_admin: bool,
    ) -> None:
        with self._lock:
            item = self.items.get(item_id)
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

            # Only admin or owner can delete
            if item.creator_id != actor_id and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the reporter or an administrator can delete this report.",
                )

            del self.items[item_id]
            if item_id in self.claims:
                del self.claims[item_id]
            self._save()

    # ============================================================
    # Claims & Private Identifying Proof Management
    # ============================================================

    def submit_claim(
        self,
        item_id: str,
        claimant_id: str,
        claimant_name: str,
        claimant_email: str,
        data: LostAndFoundClaimCreate,
    ) -> LostAndFoundClaim:
        with self._lock:
            item = self.items.get(item_id)
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

            if item.creator_id == claimant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot submit a claim on your own report.",
                )

            if item.status != "open":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot claim an item that is {item.status}.",
                )

            proof_str = (data.identifying_proof or data.distinguishing_proof or "").strip()
            if not proof_str:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Identifying proof must be provided.",
                )
            now_iso = datetime.now(timezone.utc).isoformat()
            claim_id = f"clm-{uuid.uuid4().hex[:8]}"
            claim = LostAndFoundClaim(
                id=claim_id,
                item_id=item_id,
                claimant_id=claimant_id,
                claimant_name=claimant_name,
                claimant_email=claimant_email,
                identifying_proof=proof_str,
                distinguishing_proof=proof_str,
                status="pending",
                created_at=now_iso,
            )

            if item_id not in self.claims:
                self.claims[item_id] = []
            self.claims[item_id].append(claim)
            item.claims_count = len(self.claims[item_id])

            item.audit_logs.append(
                {
                    "action": "CLAIM_SUBMITTED",
                    "claim_id": claim_id,
                    "claimant_id": claimant_id,
                    "timestamp": now_iso,
                }
            )
            self._save()
            return claim

    def list_claims_for_item(
        self,
        item_id: str,
        actor_id: str,
        is_admin: bool,
    ) -> List[LostAndFoundClaim]:
        with self._lock:
            item = self.items.get(item_id)
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

            # Identifying proof is sensitive and visible ONLY to:
            # 1. Report owner
            # 2. Administrator
            if item.creator_id != actor_id and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Identifying proof is confidential and only accessible by the reporter or an administrator.",
                )

            return self.claims.get(item_id, [])

    def verify_claim(
        self,
        item_id: str,
        claim_id: str,
        actor_id: str,
        actor_name: str,
        is_admin: bool,
        verify_status: str,  # "verified" or "rejected"
        admin_notes: Optional[str] = None,
    ) -> LostAndFoundClaim:
        with self._lock:
            item = self.items.get(item_id)
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

            if item.creator_id != actor_id and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the reporter or an administrator can verify claims.",
                )

            claims_list = self.claims.get(item_id, [])
            target_claim = next((c for c in claims_list if c.id == claim_id), None)
            if not target_claim:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

            now_iso = datetime.now(timezone.utc).isoformat()
            target_claim.status = verify_status
            target_claim.admin_notes = admin_notes
            target_claim.resolved_at = now_iso

            if verify_status == "verified":
                item.status = "resolved"
                item.resolved_at = now_iso
                item.resolved_by = actor_id

            item.audit_logs.append(
                {
                    "action": f"CLAIM_{verify_status.upper()}",
                    "claim_id": claim_id,
                    "actor_id": actor_id,
                    "timestamp": now_iso,
                }
            )
            self._save()
            return target_claim


lost_and_found_engine = LostAndFoundEngine()
