"""
Website Contact Enrichment for Workspace Radar AI - Lead Finder
Visits public websites, extracts emails, phones, and contact persons.
Resilient, timeout-guarded, lightweight, and strictly respects site availability.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

from src.cleaning import clean_email, clean_phone

logger = logging.getLogger(__name__)

# Preferred email prefixes in priority order
PREFERRED_EMAIL_PREFIXES = ["sales@", "business@", "contact@", "info@", "hello@", "connect@", "support@"]

# Leadership & Key Decision Maker roles
KEY_ROLES = [
    "Founder", "Co-Founder", "CEO", "Chief Executive Officer", "Director",
    "Managing Director", "Partner", "Chief Technology Officer", "CTO",
    "Head of Operations", "Operations Manager", "HR", "Business Development Manager"
]


class WebsiteEnricher:
    """
    Safely enriches business records by scanning up to 3 public pages
    (Homepage, /contact or /contact-us, /about or /team) for publicly posted contacts.
    """

    def __init__(self, timeout: float = 1.5, max_pages: int = 2):
        self.timeout = timeout
        self.max_pages = max_pages
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36 (compatible; WorkspaceRadarAI/1.0; +https://workspaceradar.ai)"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        })

    def extract_emails_from_html(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extracts emails from mailto: links and visible body text."""
        emails = set()

        # 1. Check mailto: links
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith("mailto:"):
                raw_email = href[7:].split("?")[0].strip()
                cleaned = clean_email(raw_email)
                if cleaned != "Not Found":
                    emails.add(cleaned)

        # 2. Check visible text with standard email regex
        # Avoid file extensions like .png, .jpg, .svg in domain
        text = soup.get_text(separator=" ")
        found_in_text = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        for cand in found_in_text:
            cleaned = clean_email(cand)
            if cleaned != "Not Found":
                # Filter out obvious false positives like image filenames (e.g. user@2x.png)
                if not any(cleaned.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]):
                    emails.add(cleaned)

        return list(emails)

    def extract_phones_from_html(self, soup: BeautifulSoup) -> List[str]:
        """Extracts phone numbers from tel: links and visible text."""
        phones = set()

        # 1. Check tel: links
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith("tel:"):
                raw_phone = href[4:].split("?")[0].strip()
                cleaned = clean_phone(raw_phone)
                if cleaned != "Not Found":
                    phones.add(cleaned)

        # 2. Check visible text for Indian phone patterns
        text = soup.get_text(separator=" ")
        # Patterns like +91 22 XXXXXXXX or +91 9XXXX XXXXX or 022-XXXXXXXX
        patterns = [
            r"\+91[\s\-]?[6-9]\d{4}[\s\-]?\d{5}",
            r"\+91[\s\-]?22[\s\-]?\d{4}[\s\-]?\d{4}",
            r"022[\s\-]?\d{4}[\s\-]?\d{4}",
            r"\b[6-9]\d{4}[\s\-]?\d{5}\b"
        ]
        for pat in patterns:
            for match in re.findall(pat, text):
                cleaned = clean_phone(match)
                if cleaned != "Not Found":
                    phones.add(cleaned)

        return list(phones)

    def extract_contact_person_from_html(self, soup: BeautifulSoup) -> Optional[str]:
        """
        Extracts named individuals associated with leadership or management roles
        from about, team, or contact sections.
        """
        text = soup.get_text(separator="\n")
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        for i, line in enumerate(lines):
            for role in KEY_ROLES:
                # Match patterns like: "Rahul Sharma, Founder" or "Founder: Rahul Sharma"
                if re.search(rf"\b{role}\b", line, re.IGNORECASE):
                    # Check if line contains a person's name
                    match = re.search(rf"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*(?:[-–,|:]|\bis\b)\s*.*?\b{role}\b", line, re.IGNORECASE)
                    if match:
                        name = match.group(1).strip()
                        return f"{name} ({role})"

                    # Check next line or previous line
                    if i > 0 and re.match(r"^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$", lines[i-1]):
                        return f"{lines[i-1]} ({role})"
                    if i < len(lines) - 1 and re.match(r"^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$", lines[i+1]):
                        return f"{lines[i+1]} ({role})"

        return None

    def pick_best_email(self, emails: List[str]) -> str:
        """Selects the best contact email prioritizing sales, business, contact, info, hello."""
        if not emails:
            return "Not Found"

        for prefix in PREFERRED_EMAIL_PREFIXES:
            for email in emails:
                if email.lower().startswith(prefix):
                    return email

        return emails[0]

    def enrich_business(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Visits the business website up to 3 pages to enrich contacts.
        Never crashes on timeouts, 403, 404, or network issues.
        """
        enriched = dict(record)
        website = record.get("website", "")

        # If no website or already fully populated, return
        if not website or website == "Not Found":
            return enriched

        # If website is provided and already has phone & email & contact person, skip network
        has_email = record.get("email") not in [None, "Not Found", ""]
        has_phone = record.get("phone") not in [None, "Not Found", ""]
        has_contact = record.get("contact_person") not in [None, "Not Found", ""]

        if has_email and has_phone and has_contact:
            return enriched

        # Synthesize fallback public website contacts if already present or simulate verified lookup
        discovered_emails = []
        discovered_phones = []
        discovered_person = None
        visited_pages = 0

        # Construct target URLs to inspect
        parsed = urlparse(website)
        base = f"{parsed.scheme}://{parsed.netloc}"
        candidate_subpaths = ["", "/contact", "/contact-us", "/about", "/about-us", "/team"]

        for subpath in candidate_subpaths:
            if visited_pages >= self.max_pages:
                break

            target_url = urljoin(base, subpath)
            try:
                resp = self.session.get(target_url, timeout=self.timeout, allow_redirects=True)
                visited_pages += 1
                if resp.status_code == 200 and "text/html" in resp.headers.get("Content-Type", ""):
                    soup = BeautifulSoup(resp.text, "html.parser")

                    if not has_email:
                        emails = self.extract_emails_from_html(soup, target_url)
                        discovered_emails.extend(emails)

                    if not has_phone:
                        phones = self.extract_phones_from_html(soup)
                        discovered_phones.extend(phones)

                    if not has_contact and not discovered_person:
                        discovered_person = self.extract_contact_person_from_html(soup)

            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.debug(f"Host unreachable for {target_url}: {e}")
                # Don't try additional subpaths if the host is down
                break
            except Exception as e:
                logger.debug(f"Could not reach {target_url}: {e}")
                continue

        # Consolidate results without fabricating
        if not has_email and discovered_emails:
            best_email = self.pick_best_email(discovered_emails)
            enriched["email"] = best_email
            enriched["source"] = "Business Website"

        if not has_phone and discovered_phones:
            enriched["phone"] = discovered_phones[0]
            enriched["source"] = "Business Website"

        if not has_contact and discovered_person:
            enriched["contact_person"] = discovered_person
            enriched["source"] = "Business Website"

        return enriched

    def enrich_batch(self, records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
        """
        Enriches a batch of records.
        Returns (enriched_records, contact_enriched_count).
        """
        enriched_list = []
        enriched_count = 0

        for rec in records:
            before_email = rec.get("email", "Not Found")
            before_phone = rec.get("phone", "Not Found")

            # For records from verified catalog that already contain rich info, check if enrichment happened
            enriched_rec = self.enrich_business(rec)
            enriched_list.append(enriched_rec)

            has_email = enriched_rec.get("email") not in [None, "Not Found", ""]
            has_phone = enriched_rec.get("phone") not in [None, "Not Found", ""]

            if has_email or has_phone:
                enriched_count += 1

        return enriched_list, enriched_count
