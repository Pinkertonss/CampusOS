from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ============================================================
# Core Campus Reuse Enums & Constants
# ============================================================

ALLOWED_LISTING_CATEGORIES = ["book", "calculator", "labcoat", "other"]
ALLOWED_LISTING_MODES = ["exchange", "donate", "borrow"]
ALLOWED_CONDITIONS = ["like_new", "good", "fair"]
ALLOWED_REQUEST_STATUSES = ["pending", "accepted", "declined", "completed"]

def normalize_category(cat: Optional[str]) -> str:
    if not cat:
        return "other"
    c = cat.strip().lower()
    if c in ("book", "books", "textbook", "textbooks"):
        return "book"
    elif c in ("calculator", "calculators", "electronics", "gadgets"):
        return "calculator"
    elif c in ("labcoat", "lab_gear", "lab_coat", "coat", "drafter"):
        return "labcoat"
    elif c in ("other", "hostel_essentials", "misc"):
        return "other"
    return "other"

def normalize_mode(mode: Optional[str]) -> str:
    if not mode:
        return "exchange"
    m = mode.strip().lower()
    if m in ("exchange", "swap"):
        return "exchange"
    elif m in ("donate", "donation", "free"):
        return "donate"
    elif m in ("borrow", "loan", "lend"):
        return "borrow"
    return "exchange"

def normalize_condition(cond: Optional[str]) -> str:
    if not cond:
        return "good"
    c = cond.strip().lower()
    if c in ("like_new", "new", "like new", "mint"):
        return "like_new"
    elif c in ("good", "very_good"):
        return "good"
    elif c in ("fair", "used", "acceptable"):
        return "fair"
    return "good"

def mode_to_impact_event(mode: str) -> str:
    m = normalize_mode(mode)
    if m == "exchange":
        return "exchange"
    elif m == "donate":
        return "donation"
    elif m == "borrow":
        return "loan"
    return "exchange"

# ============================================================
# Listings Models
# ============================================================

class ListingCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field("", max_length=1000)
    category: str = Field("book", description="book, calculator, labcoat, other")
    mode: str = Field("exchange", description="exchange, donate, borrow")
    condition: str = Field("good", description="like_new, good, fair")
    image_url: Optional[str] = None
    contact_info: Optional[str] = None
    estimated_retail_price: Optional[float] = 0.0
    estimated_weight_kg: Optional[float] = 0.5

class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    mode: Optional[str] = None
    condition: Optional[str] = None
    image_url: Optional[str] = None
    contact_info: Optional[str] = None
    status: Optional[str] = None

class Listing(BaseModel):
    id: str
    owner_id: str
    owner_name: str
    title: str
    description: str
    category: str
    mode: str
    condition: str
    status: str = "available"  # available, reserved, completed
    image_url: Optional[str] = None
    contact_info: Optional[str] = None
    estimated_retail_price: float = 0.0
    estimated_weight_kg: float = 0.5
    created_at: str
    requests_count: int = 0
    user_has_requested: bool = False
    active_request_id: Optional[str] = None

# ============================================================
# Exchange Request Flow Models
# ============================================================

class ExchangeRequestCreate(BaseModel):
    message: Optional[str] = Field("Hey, I would like to request this item!", max_length=500)
    contact_info: Optional[str] = None

class ExchangeRequest(BaseModel):
    id: str
    listing_id: str
    listing_title: str
    listing_mode: str
    listing_category: str
    requester_id: str
    requester_name: str
    requester_contact: Optional[str] = None
    message: Optional[str] = None
    owner_id: str
    owner_name: str
    status: str = "pending"  # pending, accepted, declined, completed
    owner_confirmed: bool = False
    requester_confirmed: bool = False
    created_at: str
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None

# ============================================================
# Impact Events & SDG 12 Response Models
# ============================================================

class ImpactEvent(BaseModel):
    id: str
    listing_id: str
    event_type: str  # exchange, donation, loan
    completed_at: str
    created_at: str

class MonthlyImpactSeries(BaseModel):
    month: str
    exchanges: int
    donations: int
    loans: int
    total: int
    co2_kg: float
    waste_kg: float
    money_saved_inr: float

class ReuseImpactResponse(BaseModel):
    exchanges_completed: int
    donations_completed: int
    loans_completed: int
    total_completed: int
    total_exchanges_completed: int = 0
    items_kept_in_use: int
    total_money_saved_inr: float
    total_waste_diverted_kg: float
    co2_avoided_kg: float
    sdg_framework: str = "SDG 12: Responsible Consumption and Production"
    per_month_series: List[MonthlyImpactSeries]

# ============================================================
# In-App Notifications Models
# ============================================================

class ReuseNotification(BaseModel):
    id: str
    type: str  # new_request, request_accepted, request_declined, completion_confirmed
    title: str
    message: str
    listing_id: str
    request_id: Optional[str] = None
    created_at: str
    read: bool = False

class NotificationsResponse(BaseModel):
    unread_count: int
    notifications: List[ReuseNotification]

# ============================================================
# Backward-Compatibility Models (for test_api & test_impact)
# ============================================================

class ReuseItemBase(BaseModel):
    title: str = Field(...)
    description: str = Field(...)
    category: str = Field(...)
    listing_type: str = Field("donate")
    condition: str = Field("good")
    estimated_retail_price: float = Field(0.0, ge=0.0)
    estimated_weight_kg: float = Field(0.0, ge=0.0)
    contact_info: str = Field("")
    image_url: Optional[str] = None

class ReuseItemCreate(ReuseItemBase):
    pass

class ReuseItem(ReuseItemBase):
    id: str
    user_id: Optional[str] = None
    user_name: str
    status: str = "available"
    completed_at: Optional[str] = None
    created_at: str

class ClaimItemRequest(BaseModel):
    requester_name: str
    requester_contact: str
    message: Optional[str] = None

class CategoryImpact(BaseModel):
    count: int
    money_saved_inr: float
    weight_kg: float

class ImpactMetricsResponse(BaseModel):
    total_exchanges_completed: int
    total_money_saved_inr: float
    total_waste_diverted_kg: float
    co2_avoided_kg: float
    active_listings_count: int
    categories: Dict[str, CategoryImpact]
