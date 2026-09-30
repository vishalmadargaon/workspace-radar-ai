"""
Unified Lead Finder Pipeline Orchestrator for Workspace Radar AI
Coordinates discovery -> cleaning -> deduplication -> enrichment -> scoring -> ranking.
Accepts city: str (default 'Mumbai', seamlessly expandable to Bangalore, Pune, Hyderabad, Delhi, etc.)
"""

import logging
from typing import List, Dict, Any, Tuple, Optional, Callable

from src.discovery import get_discovery_provider
from src.cleaning import clean_records
from src.deduplication import deduplicate_records
from src.enrichment import WebsiteEnricher
from src.scoring import score_and_rank_prospects

logger = logging.getLogger(__name__)


def run_lead_finder_pipeline(
    city: str = "Mumbai",
    target: str = "Potential coworking customers",
    limit: int = 30,
    api_key: Optional[str] = None,
    progress_callback: Optional[Callable[[str, float], None]] = None
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Executes the complete Lead Finder Pipeline:
    1. Discover candidates (> 30, e.g. 50-100)
    2. Clean records (normalize names, phones, emails, URLs, addresses)
    3. Deduplicate businesses (merge contact points)
    4. Enrich websites (extract public contacts safely)
    5. Score prospects (deterministic 0-100 rules)
    6. Rank and return top candidates

    Returns:
        (top_leads, pipeline_metrics)
    """
    def notify(msg: str, pct: float):
        if progress_callback:
            progress_callback(msg, pct)

    city_clean = city.strip() if city else "Mumbai"

    # Step 1: Discover Businesses
    notify(f"Discovering potential coworking customers in {city_clean}...", 0.15)
    provider = get_discovery_provider(api_key=api_key)
    # Request larger pool of businesses to ensure ranking quality
    raw_discovered = provider.search_businesses(city=city_clean, target=target, limit=100)

    # Step 2: Clean Records
    notify("Cleaning and normalizing business records...", 0.35)
    cleaned_records = clean_records(raw_discovered, city=city_clean)

    # Step 3: Deduplicate Businesses
    notify("Deduplicating records and consolidating contact channels...", 0.55)
    unique_records, dedup_metrics = deduplicate_records(cleaned_records)

    # Step 4: Website Contact Enrichment
    notify("Enriching public contact data from business websites...", 0.75)
    enricher = WebsiteEnricher(timeout=3, max_pages=2)
    enriched_records, enriched_count = enricher.enrich_batch(unique_records)

    # Step 5 & 6: Score & Rank Top Prospects
    notify(f"Scoring coworking potential and ranking Top {limit} prospects...", 0.90)
    top_leads = score_and_rank_prospects(enriched_records, top_n=limit)

    notify("Pipeline completed successfully.", 1.0)

    # Compile comprehensive pipeline metrics
    metrics = {
        "raw_records": dedup_metrics.get("raw_records", len(raw_discovered)),
        "clean_records": dedup_metrics.get("clean_records", len(unique_records)),
        "duplicates_removed": dedup_metrics.get("duplicates_removed", 0),
        "contact_enriched": enriched_count,
        "qualified_prospects": len(top_leads),
        "city": city_clean,
        "target": target
    }

    return top_leads, metrics
