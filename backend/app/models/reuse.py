from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class ReuseItemBase(BaseModel):
    title: str = Field(...)
    description: str = Field(...)
    category: str = Field(...) # books, electronics, lab_gear, hostel_essentials
    listing_type: str = Field("donate") # donate, exchange, borrow
    condition: str = Field("good") # like_new, good, fair
    estimated_retail_price: float = Field(..., ge=0.0)
    estimated_weight_kg: float = Field(..., ge=0.0)
    contact_info: str = Field(...)
    image_url: Optional[str] = None

class ReuseItemCreate(ReuseItemBase):
    pass

class ReuseItem(ReuseItemBase):
    id: str
    user_id: Optional[str] = None
    user_name: str
    status: str = "available" # available, requested, completed
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
