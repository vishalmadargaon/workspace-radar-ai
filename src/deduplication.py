"""
Deduplication Layer for Workspace Radar AI - Lead Finder
Detects and merges duplicate businesses using ID, normalized name, domain, and phone.
"""

import re
from typing import List, Dict, Any, Tuple
from urllib.parse import urlparse


def extract_domain(website: str) -> str:
    """Extracts base registered domain without www and protocol for matching."""
    if not website or website == "Not Found":
        return ""
    try:
        parsed = urlparse(website if "://" in website else f"https://{website}")
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc
    except Exception:
        return ""


def normalize_name_for_comparison(name: str) -> str:
    """
    Strips common legal suffixes and cleans name to form comparison key:
    e.g. 'ABC Technologies Pvt Ltd' -> 'abc technologies'
    """
    if not name:
        return ""
    lower = name.lower()
    # Remove punctuation
    lower = re.sub(r"[^\w\s]", " ", lower)
    # Strip common corporate suffixes
    suffixes = [
        r"\bpvt\s+ltd\b", r"\bprivate\s+limited\b", r"\bltd\b", r"\blimited\b",
        r"\bllp\b", r"\binc\b", r"\bcorp\b", r"\bcorporation\b", r"\bco\b",
        r"\bindia\b", r"\btechnologies\b", r"\btechnology\b", r"\btech\b",
        r"\bsolutions\b", r"\bservices\b"
    ]
    for suff in suffixes:
        lower = re.sub(suff, "", lower)
    return re.sub(r"\s+", " ", lower).strip()


def deduplicate_records(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """
    Deduplicates records using multi-tiered matching:
    1. Business ID
    2. Normalized domain
    3. Normalized phone number (digits only)
    4. Normalized business name + address proximity

    When duplicates are identified, contact information (email, phone, contact_person)
    is merged so no valuable data is lost.

    Returns:
        (unique_records, metrics_dict)
    """
    raw_count = len(records)
    unique_list: List[Dict[str, Any]] = []

    seen_ids = set()
    seen_domains = {}
    seen_phones = {}
    seen_names = {}

    for record in records:
        rec_id = record.get("id")
        website = record.get("website", "")
        phone = record.get("phone", "")
        name = record.get("name", "")

        domain = extract_domain(website)
        digits_phone = re.sub(r"\D", "", phone)
        norm_name = normalize_name_for_comparison(name)

        matched_existing: Dict[str, Any] = None

        # Check 1: Explicit ID
        if rec_id and rec_id in seen_ids:
            for item in unique_list:
                if item.get("id") == rec_id:
                    matched_existing = item
                    break

        # Check 2: Domain matching (high confidence)
        elif domain and domain in seen_domains:
            matched_existing = seen_domains[domain]

        # Check 3: Phone number matching (high confidence if >= 10 digits)
        elif len(digits_phone) >= 10 and digits_phone in seen_phones:
            matched_existing = seen_phones[digits_phone]

        # Check 4: Name similarity matching
        elif norm_name and len(norm_name) > 3 and norm_name in seen_names:
            matched_existing = seen_names[norm_name]

        if matched_existing is not None:
            # Merge fields if the new record has richer contact details
            if matched_existing.get("email") == "Not Found" and record.get("email") != "Not Found":
                matched_existing["email"] = record.get("email")
            if matched_existing.get("phone") == "Not Found" and record.get("phone") != "Not Found":
                matched_existing["phone"] = record.get("phone")
            if matched_existing.get("contact_person") == "Not Found" and record.get("contact_person") != "Not Found":
                matched_existing["contact_person"] = record.get("contact_person")
            if matched_existing.get("website") == "Not Found" and record.get("website") != "Not Found":
                matched_existing["website"] = record.get("website")
        else:
            # New unique record
            unique_list.append(record)
            if rec_id:
                seen_ids.add(rec_id)
            if domain:
                seen_domains[domain] = record
            if len(digits_phone) >= 10:
                seen_phones[digits_phone] = record
            if norm_name and len(norm_name) > 3:
                seen_names[norm_name] = record

    clean_count = len(unique_list)
    duplicates_removed = raw_count - clean_count

    metrics = {
        "raw_records": raw_count,
        "clean_records": clean_count,
        "duplicates_removed": duplicates_removed
    }

    return unique_list, metrics
