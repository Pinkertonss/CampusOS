import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from ..database import db
from ..models.reuse import (
    ReuseItem,
    ReuseItemCreate,
    ClaimItemRequest,
    ImpactMetricsResponse,
)
from ..services.impact_engine import impact_engine

router = APIRouter(prefix="/api/reuse", tags=["Campus Reuse"])

@router.get("/items", response_model=List[ReuseItem])
def list_items(
    category: Optional[str] = None,
    listing_type: Optional[str] = None,
    status: Optional[str] = None,
):
    items = list(db.reuse_items.values())
    if category and category.lower() != "all":
        items = [i for i in items if i.category.lower() == category.lower()]
    if listing_type and listing_type.lower() != "all":
        items = [i for i in items if i.listing_type.lower() == listing_type.lower()]
    if status and status.lower() != "all":
        items = [i for i in items if i.status.lower() == status.lower()]
    
    return sorted(items, key=lambda x: x.created_at, reverse=True)

@router.post("/items", response_model=ReuseItem)
def create_item(item_in: ReuseItemCreate):
    item_id = f"r-{uuid.uuid4().hex[:6]}"
    item = ReuseItem(
        id=item_id,
        user_name="Gurasees Singh (You)",
        title=item_in.title.strip(),
        description=item_in.description.strip(),
        category=item_in.category.strip().lower(),
        listing_type=item_in.listing_type.strip().lower(),
        condition=item_in.condition.strip().lower(),
        estimated_retail_price=item_in.estimated_retail_price,
        estimated_weight_kg=item_in.estimated_weight_kg,
        contact_info=item_in.contact_info.strip(),
        image_url=item_in.image_url,
        status="available",
        created_at=datetime.utcnow().isoformat(),
    )
    db.reuse_items[item_id] = item
    return item

@router.post("/items/{item_id}/claim", response_model=ReuseItem)
def claim_item(item_id: str, claim: ClaimItemRequest):
    if item_id not in db.reuse_items:
        raise HTTPException(status_code=404, detail="Reuse item not found")
    
    item = db.reuse_items[item_id]
    if item.status == "completed":
        raise HTTPException(status_code=400, detail="Item has already been exchanged")
        
    item.status = "requested"
    return item

@router.post("/items/{item_id}/complete", response_model=ReuseItem)
def complete_exchange(item_id: str):
    if item_id not in db.reuse_items:
        raise HTTPException(status_code=404, detail="Reuse item not found")
        
    item = db.reuse_items[item_id]
    item.status = "completed"
    item.completed_at = datetime.utcnow().isoformat()
    return item

@router.get("/impact", response_model=ImpactMetricsResponse)
def get_impact_metrics():
    """
    Computes environmental & economic impact from completed reuse cycles:
    Money saved in INR, landfill waste diverted in kg, and CO2 emissions avoided.
    """
    all_items = list(db.reuse_items.values())
    return impact_engine.calculate_metrics(all_items)
