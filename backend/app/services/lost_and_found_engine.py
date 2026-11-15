import os
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from fastapi import HTTPException, status
from pydantic import BaseModel
from .durable_storage import AtomicJsonStorage, StorageError
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
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

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


class LostAndFoundClaimsWrapper(BaseModel):
    claims: List[LostAndFoundClaim] = []


class LostAndFoundEngine:
    """
    Durable service engine for CampusOS Lost and Found system.
    Enforces Shared Invariant 4 (atomic persistence failure propagation)
    and Shared Invariant 5 (consistent archive visibility policy everywhere).
    """

    def __init__(self):
        self.item_storage = AtomicJsonStorage(ITEMS_FILE, LostAndFoundItem)
        self.claim_storage = AtomicJsonStorage(CLAIMS_FILE, LostAndFoundClaim)

    def is_item_visible_to_user(
        self,
        item: LostAndFoundItem,
        user_id: Optional[str],
        is_admin: bool,
    ) -> bool:
        """
        Centralized Visibility Policy:
        - Active and resolved reports remain discoverable according to standard rules.
        - Archived reports are EXCLUDED from general discovery.
        - Archived reports are accessible strictly to their owner and authorized administrators.
        """
        if item.status == "archived":
            return bool(is_admin or (user_id and item.creator_id == user_id))
        return True

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
        """
        List items applying centralized archive visibility policy across all filters and search.
        """
        all_items = list(self.item_storage.get_all().values())

        # Base authorization filter: discard any item not visible to this caller
        results = [
            item for item in all_items
            if self.is_item_visible_to_user(item, my_user_id, is_admin)
        ]

        # Filter by creator if requested
        if only_my_reports and my_user_id:
            results = [item for item in results if item.creator_id == my_user_id]

        # Status filter: must narrow authorized records, never expand access
        if status_filter and status_filter != "all":
            results = [item for item in results if item.status == status_filter]
        elif not status_filter:
            # Default listing: exclude archived items for everyone except in my_reports view
            if not only_my_reports:
                results = [item for item in results if item.status != "archived"]

        if report_type and report_type != "all":
            results = [item for item in results if item.report_type == report_type]

        if category and category != "all":
            results = [item for item in results if item.category.lower() == category.lower()]

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

    def get_item(
        self,
        item_id: str,
        user_id: Optional[str] = None,
        is_admin: bool = False,
    ) -> Optional[LostAndFoundItem]:
        """
        Get single item detail enforcing centralized archive visibility.
        Returns None if item does not exist or caller is unauthorized to view archived item.
        """
        item = self.item_storage.get(item_id)
        if not item:
            return None
        if not self.is_item_visible_to_user(item, user_id, is_admin):
            return None
        return item

    def get_item_by_image_filename(
        self,
        filename: str,
        user_id: Optional[str] = None,
        is_admin: bool = False,
    ) -> Optional[LostAndFoundItem]:
        """
        Reverse lookup from image filename to owning item to verify image download authorization.
        """
        clean_name = Path(filename).name
        for item in self.item_storage.get_all().values():
            urls = item.image_urls or ([item.image_url] if item.image_url else [])
            for u in urls:
                if u and clean_name in u:
                    if self.is_item_visible_to_user(item, user_id, is_admin):
                        return item
                    return None  # Item exists but archived and unauthorized
        return None

    def create_item(
        self,
        creator_id: str,
        creator_name: str,
        creator_email: str,
        data: LostAndFoundCreate,
    ) -> LostAndFoundItem:
        """
        Atomically creates a new report. Fails safely on storage error.
        """
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
                    "action": "created",
                    "actor_id": creator_id,
                    "actor_name": creator_name,
                    "timestamp": now_iso,
                }
            ],
        )

        try:
            self.item_storage.set(new_id, item)
        except StorageError as se:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage persistence failure: could not save Lost & Found report.",
            ) from se

        return item

    def update_item(
        self,
        item_id: str,
        actor_id: str,
        actor_name: str,
        is_admin: bool,
        data: LostAndFoundUpdate,
    ) -> LostAndFoundItem:
        """
        Atomically updates a report. Fails safely on storage error.
        """
        item = self.item_storage.get(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

        # Authorization: creator or admin
        if not is_admin and item.creator_id != actor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to edit this report.",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        updated = item.model_copy()

        if data.title is not None:
            updated.title = data.title.strip()
        if data.description is not None:
            updated.description = data.description.strip()
        if data.category is not None:
            updated.category = data.category
        if data.location is not None:
            updated.location = data.location.strip()
        if data.date_incident is not None:
            updated.date_incident = data.date_incident
            updated.event_date = data.date_incident
        if data.image_url is not None:
            updated.image_url = data.image_url
            if data.image_url not in updated.image_urls:
                updated.image_urls.append(data.image_url)

        if data.status is not None and data.status != item.status:
            updated.status = data.status
            if data.status in ("resolved", "archived"):
                updated.resolved_at = now_iso
                updated.resolved_by = actor_id
            updated.audit_logs.append(
                {
                    "action": f"status_changed_to_{data.status}",
                    "actor_id": actor_id,
                    "actor_name": actor_name,
                    "timestamp": now_iso,
                }
            )

        updated.updated_at = now_iso

        try:
            self.item_storage.set(item_id, updated)
        except StorageError as se:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage persistence failure: could not update Lost & Found report.",
            ) from se

        return updated

    def resolve_item(self, item_id: str, actor_id: str, actor_name: str, is_admin: bool) -> LostAndFoundItem:
        return self.update_item(
            item_id=item_id,
            actor_id=actor_id,
            actor_name=actor_name,
            is_admin=is_admin,
            data=LostAndFoundUpdate(status="resolved"),
        )

    def archive_item(self, item_id: str, actor_id: str, actor_name: str, is_admin: bool) -> LostAndFoundItem:
        return self.update_item(
            item_id=item_id,
            actor_id=actor_id,
            actor_name=actor_name,
            is_admin=is_admin,
            data=LostAndFoundUpdate(status="archived"),
        )

    def delete_item(self, item_id: str, actor_id: str, actor_name: str = "", is_admin: bool = False) -> bool:
        item = self.item_storage.get(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        if not is_admin and item.creator_id != actor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

        try:
            self.item_storage.delete(item_id)
            return True
        except StorageError as se:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage persistence failure: could not delete Lost & Found report.",
            ) from se

    def create_claim(
        self,
        item_id: str,
        claimant_id: str,
        claimant_name: str,
        claimant_email: str,
        data: LostAndFoundClaimCreate,
    ) -> LostAndFoundClaim:
        """
        Submits private distinguishing proof for an item. Fails safely on storage error.
        """
        item = self.item_storage.get(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        if item.status == "archived":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot claim an archived item.")
        if item.creator_id == claimant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot claim your own report.")

        proof_text = (data.distinguishing_proof or data.identifying_proof or "").strip()
        if not proof_text or len(proof_text) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Distinguishing proof is required to verify ownership.",
            )

        claim_id = f"clm-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        claim = LostAndFoundClaim(
            id=claim_id,
            item_id=item_id,
            claimant_id=claimant_id,
            claimant_name=claimant_name,
            claimant_email=claimant_email,
            identifying_proof=proof_text,
            distinguishing_proof=proof_text,
            status="pending",
            created_at=now_iso,
        )

        try:
            self.claim_storage.set(claim_id, claim)
            # Update item claims_count
            updated_item = item.model_copy()
            updated_item.claims_count += 1
            self.item_storage.set(item_id, updated_item)
        except StorageError as se:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage persistence failure: could not submit claim.",
            ) from se

        return claim

    def get_claims_for_item(
        self,
        item_id: str,
        actor_id: str,
        is_admin: bool,
    ) -> List[LostAndFoundClaim]:
        """
        Strict Privacy:
        Distinguishing proof is visible ONLY to:
        1. Original item creator / reporter
        2. Authorized administrator
        3. The claimant themselves (their own claim only)
        """
        item = self.item_storage.get(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

        is_owner = item.creator_id == actor_id
        all_claims = [c for c in self.claim_storage.get_all().values() if c.item_id == item_id]

        if is_admin or is_owner:
            return all_claims

        # Other claimants only see their own claim
        user_claims = [c for c in all_claims if c.claimant_id == actor_id]
        if not user_claims:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Only the report creator or claimant may view claims.",
            )
        return user_claims

    def verify_claim(
        self,
        item_id: str,
        claim_id: str,
        actor_id: str,
        actor_name: str,
        is_admin: bool,
        verify_status: str,
        admin_notes: Optional[str] = None,
    ) -> LostAndFoundClaim:
        item = self.item_storage.get(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

        if not is_admin and item.creator_id != actor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the report owner or an administrator can verify claims.",
            )

        claim = self.claim_storage.get(claim_id)
        if not claim or claim.item_id != item_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found for this item.")

        now_iso = datetime.now(timezone.utc).isoformat()
        updated_claim = claim.model_copy()
        updated_claim.status = verify_status  # "verified" or "rejected"
        updated_claim.admin_notes = admin_notes
        updated_claim.resolved_at = now_iso

        try:
            self.claim_storage.set(claim_id, updated_claim)

            # If verified, mark item as resolved automatically
            if verify_status == "verified":
                updated_item = item.model_copy()
                updated_item.status = "resolved"
                updated_item.resolved_at = now_iso
                updated_item.resolved_by = actor_id
                updated_item.audit_logs.append(
                    {
                        "action": "claim_verified_item_resolved",
                        "claim_id": claim_id,
                        "claimant_id": claim.claimant_id,
                        "actor_id": actor_id,
                        "timestamp": now_iso,
                    }
                )
                self.item_storage.set(item_id, updated_item)
        except StorageError as se:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage persistence failure: could not verify claim.",
            ) from se

        return updated_claim


    # Aliases for router compatibility
    submit_claim = create_claim
    list_claims_for_item = get_claims_for_item

lost_and_found_engine = LostAndFoundEngine()
