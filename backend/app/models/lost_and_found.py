from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, Field

ReportType = Literal["lost", "found"]
ItemStatus = Literal["open", "resolved", "archived"]
ClaimStatus = Literal["pending", "verified", "rejected"]

class LostAndFoundClaim(BaseModel):
    id: str
    item_id: str
    claimant_id: str
    claimant_name: str
    claimant_email: str
    identifying_proof: str = ""  # Private distinguishing information
    distinguishing_proof: Optional[str] = None
    status: ClaimStatus = "pending"
    admin_notes: Optional[str] = None
    created_at: str
    resolved_at: Optional[str] = None

class LostAndFoundClaimCreate(BaseModel):
    identifying_proof: Optional[str] = None
    distinguishing_proof: Optional[str] = None

class LostAndFoundItem(BaseModel):
    id: str
    title: str
    description: str
    category: str  # Electronics, IDs & Cards, Keys, Books & Stationery, Clothing, Bags, Other
    report_type: ReportType  # "lost" or "found"
    status: ItemStatus = "open"
    location: str  # e.g., "Library 2nd Floor", "C-Block Lab 102", "Hostel J"
    date_incident: str = ""  # ISO date or YYYY-MM-DD
    event_date: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    creator_id: str
    creator_name: str
    creator_email: str
    reporter_id: Optional[str] = None
    reporter_email_masked: Optional[str] = None
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    claims_count: int = 0
    audit_logs: List[dict] = Field(default_factory=list)

class LostAndFoundCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=5, max_length=2000)
    category: str = "Other"
    report_type: ReportType = "lost"
    location: str = Field(..., min_length=2, max_length=150)
    date_incident: Optional[str] = None
    event_date: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    image_url: Optional[str] = None

class LostAndFoundUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    date_incident: Optional[str] = None
    status: Optional[ItemStatus] = None
    image_url: Optional[str] = None
