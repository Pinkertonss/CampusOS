import pytest
from app.models.reuse import ReuseItem
from app.services.impact_engine import impact_engine

def test_impact_engine_calculation():
    items = [
        ReuseItem(
            id="1",
            user_name="Student A",
            title="Calculator",
            description="Good",
            category="electronics",
            listing_type="donate",
            condition="good",
            estimated_retail_price=1000.0,
            estimated_weight_kg=0.5,
            contact_info="Hostel A",
            status="completed",
            created_at="2024-01-01"
        ),
        ReuseItem(
            id="2",
            user_name="Student B",
            title="Book",
            description="Good",
            category="books",
            listing_type="donate",
            condition="good",
            estimated_retail_price=500.0,
            estimated_weight_kg=1.0,
            contact_info="Hostel B",
            status="completed",
            created_at="2024-01-01"
        ),
        ReuseItem(
            id="3",
            user_name="Student C",
            title="Lab Coat",
            description="Good",
            category="lab_gear",
            listing_type="donate",
            condition="good",
            estimated_retail_price=400.0,
            estimated_weight_kg=0.3,
            contact_info="Hostel C",
            status="available", # Active, not completed
            created_at="2024-01-01"
        ),
    ]

    metrics = impact_engine.calculate_metrics(items)
    assert metrics.total_exchanges_completed == 2
    assert metrics.active_listings_count == 1
    assert metrics.total_money_saved_inr == 1500.0
    assert metrics.total_waste_diverted_kg == 1.5
    assert metrics.co2_avoided_kg == round(1.5 * 2.45, 2)
    assert metrics.categories["electronics"].money_saved_inr == 1000.0
    assert metrics.categories["books"].money_saved_inr == 500.0
