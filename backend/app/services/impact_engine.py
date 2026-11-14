from typing import List, Dict
from ..models.reuse import CategoryImpact, ImpactMetricsResponse, ReuseItem

class ImpactEngine:
    CO2_SAVINGS_RATIO = 2.45 # kg CO2 avoided per kg of manufactured goods reused

    @classmethod
    def calculate_metrics(cls, items: List[ReuseItem]) -> ImpactMetricsResponse:
        completed_items = [it for it in items if it.status == "completed"]
        active_items = [it for it in items if it.status in ["available", "requested"]]

        total_saved_inr = sum(it.estimated_retail_price for it in completed_items)
        total_weight_kg = sum(it.estimated_weight_kg for it in completed_items)
        co2_avoided_kg = round(total_weight_kg * cls.CO2_SAVINGS_RATIO, 2)

        # Category breakdowns
        categories = ["books", "electronics", "lab_gear", "hostel_essentials"]
        cat_metrics: Dict[str, CategoryImpact] = {}

        for cat in categories:
            cat_completed = [it for it in completed_items if it.category == cat]
            cat_metrics[cat] = CategoryImpact(
                count=len(cat_completed),
                money_saved_inr=sum(it.estimated_retail_price for it in cat_completed),
                weight_kg=round(sum(it.estimated_weight_kg for it in cat_completed), 2)
            )

        return ImpactMetricsResponse(
            total_exchanges_completed=len(completed_items),
            total_money_saved_inr=round(total_saved_inr, 2),
            total_waste_diverted_kg=round(total_weight_kg, 2),
            co2_avoided_kg=co2_avoided_kg,
            active_listings_count=len(active_items),
            categories=cat_metrics,
        )

impact_engine = ImpactEngine()
