"""
Data Cleaning Layer for Workspace Radar AI - Lead Finder
Normalizes business names, phones, emails, websites, and addresses.
"""

import re
from typing import Dict, Any, List


def clean_business_name(name: str) -> str:
    """
    Cleans business names by removing repeated spaces, excessive punctuation,
    and trimming whitespace.
    """
    if not name or not isinstance(name, str):
        return "Unknown Business"

    # Replace multiple whitespace with single space
    cleaned = re.sub(r"\s+", " ", name).strip()

    # Remove trailing/leading punctuation artifacts like commas, dashes, dots
    cleaned = re.sub(r"^[,\-.:;]+|[,\-.:;]+$", "", cleaned).strip()

    # Normalize double quotes or backticks
    cleaned = cleaned.replace('""', '"').replace("''", "'")

    return cleaned if cleaned else "Unknown Business"


def clean_email(email: str) -> str:
    """
    Validates and cleans email addresses.
    Returns 'Not Found' if missing or invalid.
    """
    if not email or not isinstance(email, str):
        return "Not Found"

    raw = email.strip().lower()

    if raw in ["not found", "n/a", "none", "null", "-", ""]:
        return "Not Found"

    # RFC 5322 simplified email regex validation
    email_pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if re.match(email_pattern, raw):
        return raw

    return "Not Found"


def clean_phone(phone: str) -> str:
    """
    Normalizes Indian and international phone numbers.
    Preserves country codes when available, strips invalid chars.
    """
    if not phone or not isinstance(phone, str):
        return "Not Found"

    raw = phone.strip()
    if raw.lower() in ["not found", "n/a", "none", "null", "-", ""]:
        return "Not Found"

    # Remove alphabetic characters and weird symbols, keep +, digits, spaces, hyphens
    cleaned = re.sub(r"[^\d+\-\s]", "", raw)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Strip pure numbers for checking
    digits_only = re.sub(r"\D", "", cleaned)
    if len(digits_only) < 7:
        return "Not Found"

    # If starts with 91 and has 12 digits, format nicely as +91 XXXXX XXXXX
    if digits_only.startswith("91") and len(digits_only) == 12:
        return f"+91 {digits_only[2:7]} {digits_only[7:]}"
    elif len(digits_only) == 10 and digits_only[0] in "6789":
        return f"+91 {digits_only[:5]} {digits_only[5:]}"
    elif len(digits_only) == 11 and digits_only.startswith("022"):
        return f"+91 22 {digits_only[3:7]} {digits_only[7:]}"
    elif len(digits_only) == 10 and digits_only.startswith("22"):
        return f"+91 22 {digits_only[2:6]} {digits_only[6:]}"

    return cleaned if cleaned else "Not Found"


def clean_website(url: str) -> str:
    """
    Normalizes website URLs: ensures http/https scheme,
    removes trailing slash, removes fragments.
    """
    if not url or not isinstance(url, str):
        return "Not Found"

    raw = url.strip()
    if raw.lower() in ["not found", "n/a", "none", "null", "-", ""]:
        return "Not Found"

    # If scheme missing, prepend https://
    if not (raw.startswith("http://") or raw.startswith("https://")):
        raw = "https://" + raw

    # Remove query string / fragments for display normalization if trailing
    raw = re.sub(r"[#?].*$", "", raw)

    # Remove trailing slash
    raw = raw.rstrip("/")

    return raw if len(raw) > 8 else "Not Found"


def clean_address(address: str, city: str = "Mumbai") -> str:
    """Cleans up address strings, trimming whitespace and duplicate commas."""
    if not address or not isinstance(address, str):
        return f"{city}, India"

    cleaned = re.sub(r"\s+", " ", address).strip()
    cleaned = re.sub(r",\s*,+", ",", cleaned)
    cleaned = cleaned.strip(", ")

    return cleaned if cleaned else f"{city}, India"


def clean_record(record: Dict[str, Any], city: str = "Mumbai") -> Dict[str, Any]:
    """Applies all cleaning functions to a single business lead record."""
    cleaned = dict(record)
    cleaned["name"] = clean_business_name(record.get("name", ""))
    cleaned["email"] = clean_email(record.get("email", "Not Found"))
    cleaned["phone"] = clean_phone(record.get("phone", "Not Found"))
    cleaned["website"] = clean_website(record.get("website", "Not Found"))
    cleaned["address"] = clean_address(record.get("address", ""), city=city)
    cleaned["city"] = record.get("city", city)

    contact_person = record.get("contact_person", "Not Found")
    if not contact_person or str(contact_person).lower() in ["none", "null", "n/a", ""]:
        cleaned["contact_person"] = "Not Found"
    else:
        cleaned["contact_person"] = re.sub(r"\s+", " ", str(contact_person)).strip()

    return cleaned


def clean_records(records: List[Dict[str, Any]], city: str = "Mumbai") -> List[Dict[str, Any]]:
    """Cleans a list of raw records."""
    return [clean_record(r, city=city) for r in records]
