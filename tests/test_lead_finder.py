"""
Test Suite for Workspace Radar AI - Lead Finder
Validates discovery, cleaning, deduplication, enrichment, scoring, exports, and pipeline.
Runnable with: python -m pytest -q
"""

import pytest
from bs4 import BeautifulSoup

from src.discovery import (
    FreePublicDiscoveryProvider,
    GooglePlacesProvider,
    get_discovery_provider,
    COWORKING_PROVIDERS
)
from src.cleaning import (
    clean_business_name,
    clean_email,
    clean_phone,
    clean_website,
    clean_address,
    clean_records
)
from src.deduplication import (
    normalize_name_for_comparison,
    extract_domain,
    deduplicate_records
)
from src.enrichment import WebsiteEnricher
from src.scoring import calculate_lead_score, score_and_rank_prospects
from src.export import (
    export_to_csv,
    export_to_hubspot_csv,
    export_to_salesforce_csv,
    export_to_excel,
    export_to_pdf,
    FINAL_COLUMNS
)
from src.pipeline import run_lead_finder_pipeline


# =====================================================================
# 1. DISCOVERY TESTS
# =====================================================================

def test_free_discovery_provider_mumbai():
    provider = FreePublicDiscoveryProvider()
    results = provider.search_businesses(city="Mumbai", target="Potential coworking customers", limit=50)
    assert len(results) >= 30
    for r in results:
        assert r["city"] == "Mumbai"
        assert "name" in r
        assert "category" in r
        assert "address" in r
        # Ensure no coworking operators are in prospects
        for c in COWORKING_PROVIDERS:
            assert c not in r["name"].lower(), f"Coworking operator {c} found in prospects"


def test_city_flexibility():
    provider = FreePublicDiscoveryProvider()
    for city in ["Bangalore", "Pune", "Hyderabad", "Delhi", "Chennai"]:
        results = provider.search_businesses(city=city, target="Potential coworking customers", limit=30)
        assert len(results) >= 20
        assert results[0]["city"] == city


def test_google_places_fallback_without_key():
    provider = GooglePlacesProvider(api_key="")
    results = provider.search_businesses(city="Mumbai", target="test", limit=10)
    assert results == []


def test_get_discovery_provider_factory():
    provider = get_discovery_provider(api_key=None)
    assert isinstance(provider, FreePublicDiscoveryProvider)


# =====================================================================
# 2. CLEANING TESTS
# =====================================================================

def test_clean_business_name():
    assert clean_business_name("  ABC Technologies Pvt Ltd  ") == "ABC Technologies Pvt Ltd"
    assert clean_business_name("Acme   Corp...  ") == "Acme Corp"
    assert clean_business_name(",-Specialized Softwares;-") == "Specialized Softwares"
    assert clean_business_name("") == "Unknown Business"


def test_clean_email():
    assert clean_email("  INFO@Company.com ") == "info@company.com"
    assert clean_email("hello@sub.domain.co.in") == "hello@sub.domain.co.in"
    assert clean_email("not an email") == "Not Found"
    assert clean_email("") == "Not Found"
    assert clean_email("Not Found") == "Not Found"


def test_clean_phone():
    assert clean_phone("9820012345") == "+91 98200 12345"
    assert clean_phone("+91 98200 12345") == "+91 98200 12345"
    assert clean_phone("022 2659 1800") == "+91 22 2659 1800"
    assert clean_phone("invalid") == "Not Found"
    assert clean_phone("") == "Not Found"


def test_clean_website():
    assert clean_website("company.com") == "https://company.com"
    assert clean_website("https://company.com/") == "https://company.com"
    assert clean_website("http://test.in/about#team") == "http://test.in/about"
    assert clean_website("Not Found") == "Not Found"


def test_clean_records():
    raw = [
        {
            "name": "  Fintech Edge Pvt Ltd.  ",
            "email": " CONTACT@FINTECH.IO ",
            "phone": "9820199999",
            "website": "fintech.io/",
            "address": "BKC, Mumbai, ",
            "city": "Mumbai"
        }
    ]
    cleaned = clean_records(raw, city="Mumbai")
    assert cleaned[0]["name"] == "Fintech Edge Pvt Ltd"
    assert cleaned[0]["email"] == "contact@fintech.io"
    assert cleaned[0]["phone"] == "+91 98201 99999"
    assert cleaned[0]["website"] == "https://fintech.io"
    assert cleaned[0]["contact_person"] == "Not Found"


# =====================================================================
# 3. DEDUPLICATION TESTS
# =====================================================================

def test_normalize_name_for_comparison():
    norm1 = normalize_name_for_comparison("ABC Technologies Pvt Ltd")
    norm2 = normalize_name_for_comparison("ABC Technologies Private Limited")
    assert norm1 == norm2 == "abc"


def test_extract_domain():
    assert extract_domain("https://www.company.com/about") == "company.com"
    assert extract_domain("http://sub.domain.in") == "sub.domain.in"
    assert extract_domain("Not Found") == ""


def test_deduplicate_records():
    records = [
        {
            "id": "rec_1",
            "name": "Acme Technologies Pvt Ltd",
            "website": "https://acme.com",
            "phone": "+91 22 6123 4567",
            "email": "Not Found",
            "contact_person": "Not Found"
        },
        {
            "id": "rec_2",
            "name": "Acme Technologies",
            "website": "https://www.acme.com",
            "phone": "+91 22 6123 4567",
            "email": "info@acme.com",  # richer field
            "contact_person": "Aarav Shah (CEO)"
        },
        {
            "id": "rec_3",
            "name": "Distinct Software Labs",
            "website": "https://distinct.io",
            "phone": "+91 98200 55555",
            "email": "hello@distinct.io",
            "contact_person": "Neha Sen (Director)"
        }
    ]

    unique, metrics = deduplicate_records(records)
    assert metrics["raw_records"] == 3
    assert metrics["clean_records"] == 2
    assert metrics["duplicates_removed"] == 1

    # Verify merged record preserved the email and contact person from rec_2
    acme_rec = [r for r in unique if "acme" in r["name"].lower()][0]
    assert acme_rec["email"] == "info@acme.com"
    assert "Aarav Shah" in acme_rec["contact_person"]


# =====================================================================
# 4. ENRICHMENT TESTS
# =====================================================================

def test_enrichment_html_parsing():
    enricher = WebsiteEnricher()
    html = """
    <html>
        <body>
            <h1>Contact Us</h1>
            <p>Reach our sales team at <a href="mailto:sales@innovate.in?subject=Inquiry">Email us</a></p>
            <p>Or call our office: <a href="tel:+912249712000">+91 22 4971 2000</a></p>
            <div class="team">
                <h3>Kavita Nair, Founder & CEO</h3>
                <p>Leading the next generation of cloud engineering.</p>
            </div>
        </body>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")
    emails = enricher.extract_emails_from_html(soup, "https://innovate.in")
    phones = enricher.extract_phones_from_html(soup)
    person = enricher.extract_contact_person_from_html(soup)

    assert "sales@innovate.in" in emails
    assert any("22" in p for p in phones)
    assert person is not None
    assert "Kavita Nair" in person


def test_pick_best_email_priority():
    enricher = WebsiteEnricher()
    emails = ["other@domain.com", "info@domain.com", "sales@domain.com"]
    best = enricher.pick_best_email(emails)
    assert best == "sales@domain.com"


def test_enricher_resilience_to_failures():
    enricher = WebsiteEnricher()
    # Bad URL should not raise exceptions
    rec = {
        "name": "Nonexistent Web Co",
        "website": "https://invalid-non-existent-subdomain-12345.com",
        "email": "Not Found",
        "phone": "Not Found",
        "contact_person": "Not Found"
    }
    res = enricher.enrich_business(rec)
    assert res["name"] == "Nonexistent Web Co"
    assert res["email"] == "Not Found"


# =====================================================================
# 5. SCORING & RANKING TESTS
# =====================================================================

def test_calculate_lead_score():
    rec_high = {
        "name": "Zenith AI Technologies Pvt Ltd",
        "category": "AI & Data Analytics Solutions",
        "email": "connect@zenith.ai",
        "phone": "+91 22 4972 5000",
        "website": "https://zenith.ai",
        "contact_person": "Rajesh Sharma (CEO)",
        "team_signal": True,
        "hiring_signal": True
    }
    score, priority, reason = calculate_lead_score(rec_high)
    assert 70 <= score <= 100
    assert priority == "HIGH"
    assert "public email available" in reason.lower()
    assert "phone available" in reason.lower()


def test_score_priority_bands():
    rec_low = {
        "name": "Independent Contractor",
        "category": "General",
        "email": "Not Found",
        "phone": "Not Found",
        "website": "Not Found",
        "contact_person": "Not Found",
        "team_signal": False,
        "hiring_signal": False
    }
    score, priority, reason = calculate_lead_score(rec_low)
    assert score < 40
    assert priority == "LOW"


def test_score_and_rank_prospects():
    records = [
        {"name": f"Company {i}", "email": "a@co.in" if i % 2 == 0 else "Not Found", "phone": "+91 99999 11111", "category": "Software"}
        for i in range(40)
    ]
    top_30 = score_and_rank_prospects(records, top_n=30)
    assert len(top_30) == 30
    assert top_30[0]["rank"] == 1
    assert top_30[29]["rank"] == 30
    # Check descending order
    for idx in range(len(top_30) - 1):
        assert top_30[idx]["score"] >= top_30[idx+1]["score"]


# =====================================================================
# 6. EXPORT TESTS
# =====================================================================

def test_export_to_csv():
    records = [
        {
            "rank": 1,
            "name": "Alpha Software",
            "contact_person": "Amit Kumar",
            "phone": "+91 98200 12345",
            "email": "sales@alpha.com",
            "website": "https://alpha.com",
            "address": "Andheri East, Mumbai",
            "city": "Mumbai",
            "category": "Software",
            "score": 85,
            "priority": "HIGH",
            "score_reason": "High tech score",
            "source": "Public Business Directory"
        }
    ]
    csv_str = export_to_csv(records)
    assert "Business Name" in csv_str
    assert "Alpha Software" in csv_str
    assert "sales@alpha.com" in csv_str


def test_export_to_hubspot_crm():
    records = [
        {
            "rank": 1,
            "name": "Alpha Software",
            "contact_person": "Amit Kumar (CEO)",
            "phone": "+91 98200 12345",
            "email": "sales@alpha.com",
            "website": "https://alpha.com",
            "address": "Andheri East, Mumbai",
            "city": "Mumbai",
            "category": "Software Development & SaaS",
            "score": 85,
            "priority": "HIGH",
            "score_reason": "High tech score",
            "source": "Public Business Directory"
        }
    ]
    hs_csv = export_to_hubspot_csv(records)
    assert "Company Name" in hs_csv
    assert "Company Domain Name" in hs_csv
    assert "Work Email" in hs_csv
    assert "Alpha Software" in hs_csv
    assert "sales@alpha.com" in hs_csv
    assert "Amit" in hs_csv
    assert "Kumar" in hs_csv
    assert "CEO" in hs_csv


def test_export_to_salesforce_crm():
    records = [
        {
            "rank": 1,
            "name": "Alpha Software",
            "contact_person": "Amit Kumar (CEO)",
            "phone": "+91 98200 12345",
            "email": "sales@alpha.com",
            "website": "https://alpha.com",
            "address": "Andheri East, Mumbai",
            "city": "Mumbai",
            "category": "Software Development & SaaS",
            "score": 85,
            "priority": "HIGH",
            "score_reason": "High tech score",
            "source": "Public Business Directory"
        }
    ]
    sf_csv = export_to_salesforce_csv(records)
    assert "Company" in sf_csv
    assert "Lead Source" in sf_csv
    assert "Rating" in sf_csv
    assert "Hot" in sf_csv
    assert "Open - Not Contacted" in sf_csv
    assert "Alpha Software" in sf_csv



def test_export_to_excel():
    records = [
        {
            "rank": 1,
            "name": "Alpha Software",
            "contact_person": "Amit Kumar",
            "phone": "+91 98200 12345",
            "email": "sales@alpha.com",
            "website": "https://alpha.com",
            "address": "Andheri East, Mumbai",
            "city": "Mumbai",
            "category": "Software",
            "score": 85,
            "priority": "HIGH",
            "score_reason": "High tech score",
            "source": "Public Business Directory"
        }
    ]
    metrics = {"raw_records": 50, "clean_records": 48, "duplicates_removed": 2}
    excel_bytes = export_to_excel(records, metrics, city="Mumbai")
    assert isinstance(excel_bytes, bytes)
    assert len(excel_bytes) > 100


def test_export_to_pdf():
    records = [
        {
            "rank": 1,
            "name": "Alpha Software",
            "contact_person": "Amit Kumar",
            "phone": "+91 98200 12345",
            "email": "sales@alpha.com",
            "website": "https://alpha.com",
            "address": "Andheri East, Mumbai",
            "city": "Mumbai",
            "category": "Software",
            "score": 85,
            "priority": "HIGH",
            "score_reason": "High tech score",
            "source": "Public Business Directory"
        }
    ]
    metrics = {"raw_records": 50, "clean_records": 48, "duplicates_removed": 2}
    pdf_bytes = export_to_pdf(records, metrics, city="Mumbai")
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")


# =====================================================================
# 7. PIPELINE INTEGRATION TEST
# =====================================================================

def test_full_lead_finder_pipeline_mumbai():
    top_leads, metrics = run_lead_finder_pipeline(
        city="Mumbai",
        target="Potential coworking customers",
        limit=30
    )
    assert len(top_leads) == 30
    assert metrics["raw_records"] >= 30
    assert metrics["clean_records"] >= 30
    assert metrics["qualified_prospects"] == 30

    lead = top_leads[0]
    assert lead["rank"] == 1
    assert "name" in lead
    assert "email" in lead
    assert "phone" in lead
    assert "score" in lead
    assert "priority" in lead
    assert lead["priority"] in ["HIGH", "MEDIUM", "LOW"]
    assert "score_reason" in lead
    assert lead["city"] == "Mumbai"


def test_scoring_bounds_and_capping():
    # Test that score never exceeds 100
    hyper_prospect = {
        "name": "Super Scaling AI Technologies Labs Solutions Pvt Ltd",
        "category": "Software Development & SaaS, AI, Fintech, DevOps",
        "email": "founders@scalingai.com",
        "phone": "+91 98200 99999",
        "website": "https://scalingai.com",
        "contact_person": "CEO & Founder",
        "hiring_signal": True,
        "team_signal": True
    }
    score, priority, reason = calculate_lead_score(hyper_prospect)
    assert score <= 100
    assert priority == "HIGH"
    assert score >= 70


def test_address_cleaning_edge_cases():
    assert clean_address("   101,  B Wing,,  MIDC, , Andheri East,   ", city="Mumbai") == "101, B Wing, MIDC, Andheri East"
    assert clean_address("", city="Bangalore") == "Bangalore, India"


def test_excel_four_sheets_structure():
    import io
    import openpyxl
    records = [
        {
            "rank": 1,
            "name": "Test Tech",
            "contact_person": "Aditi Roy",
            "phone": "+91 98200 11111",
            "email": "info@testtech.in",
            "website": "https://testtech.in",
            "address": "BKC, Mumbai",
            "city": "Mumbai",
            "category": "Software",
            "score": 85,
            "priority": "HIGH",
            "score_reason": "Tech score",
            "source": "Public Business Directory"
        }
    ]
    excel_bytes = export_to_excel(records, {"raw_records": 10, "clean_records": 10, "duplicates_removed": 0}, city="Mumbai")
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    sheet_names = wb.sheetnames
    assert "Lead Summary" in sheet_names
    assert any("Top" in s for s in sheet_names)
    assert "Data Quality" in sheet_names
    assert "Scoring" in sheet_names


def test_deduplication_by_domain_and_phone():
    rec1 = {
        "id": "1",
        "name": "CloudOps Solutions",
        "website": "https://www.cloudops.in/",
        "phone": "+91 22 4100 2000",
        "email": "contact@cloudops.in"
    }
    rec2 = {
        "id": "2",
        "name": "CloudOps Systems",
        "website": "http://cloudops.in",
        "phone": "022 4100 2000",
        "email": "Not Found"
    }
    uniques, metrics = deduplicate_records([rec1, rec2])
    assert len(uniques) == 1
    assert metrics["duplicates_removed"] == 1
    assert uniques[0]["email"] == "contact@cloudops.in"

