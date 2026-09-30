"""
Lead Scoring & Ranking Engine for Workspace Radar AI - Lead Finder
Deterministic 0–100 scoring model evaluating coworking prospect potential with clear rationale.
"""

from typing import List, Dict, Any, Tuple


def calculate_lead_score(record: Dict[str, Any]) -> Tuple[int, str, str]:
    """
    Calculates deterministic lead score (0-100), priority tier, and human-readable score reason.

    Scoring Breakdown:
    - Public email available: +20
    - Phone available: +15
    - Website available: +10
    - Relevant category: +10
    - Technology / IT / Software: +15
    - Startup / growing company: +10
    - Hiring / expansion signal: +10
    - Team / workspace signal: +15
    Max capped at 100.
    """
    points = 0
    reasons = []

    # 1. Email available
    email = record.get("email", "")
    if email and email != "Not Found":
        points += 20
        reasons.append("public email available")

    # 2. Phone available
    phone = record.get("phone", "")
    if phone and phone != "Not Found":
        points += 15
        reasons.append("phone available")

    # 3. Website available
    website = record.get("website", "")
    if website and website != "Not Found":
        points += 10
        reasons.append("website available")

    # 4. Relevant category
    category = record.get("category", "")
    cat_lower = category.lower()
    is_tech = any(k in cat_lower for k in ["software", "technology", "saas", "ai", "analytics", "it", "devops", "cloud"])
    is_consulting_or_agency = any(k in cat_lower for k in ["consulting", "agency", "marketing", "design", "fintech"])

    if is_tech or is_consulting_or_agency:
        points += 10
        reasons.append("workspace-relevant business category")

    # 5. Technology / IT specific bonus
    if is_tech:
        points += 15
        reasons.append("high-propensity technology sector")

    # 6. Startup / growing company signal
    name_lower = record.get("name", "").lower()
    # Emerging tech indicators or pvt ltd
    if any(k in name_lower for k in ["technologies", "labs", "solutions", "digital", "pvt ltd"]):
        points += 10
        reasons.append("growing commercial entity")

    # 7. Hiring / expansion signal
    if record.get("hiring_signal", False):
        points += 10
        reasons.append("active hiring/expansion signals")

    # 8. Team / workspace signal
    if record.get("team_signal", False) or (record.get("contact_person") and record.get("contact_person") != "Not Found"):
        points += 15
        reasons.append("identifiable leadership/team presence")

    # Cap score between 0 and 100
    final_score = min(100, max(0, points))

    # Priority determination
    if final_score >= 70:
        priority = "HIGH"
    elif final_score >= 40:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    # Construct score explanation
    if reasons:
        explanation = ", ".join(reasons).capitalize() + "."
    else:
        explanation = "Limited publicly verified signals found."

    return final_score, priority, explanation


def score_and_rank_prospects(records: List[Dict[str, Any]], top_n: int = 30) -> List[Dict[str, Any]]:
    """
    Scores each prospect, sorts by score descending, assigns Rank (1..N),
    and returns top_n qualified leads.
    """
    scored_records = []

    for rec in records:
        scored = dict(rec)
        score, priority, reason = calculate_lead_score(scored)
        scored["score"] = score
        scored["lead_score"] = score
        scored["priority"] = priority
        scored["score_reason"] = reason

        # Ensure standard keys are present
        if "contact_person" not in scored or not scored["contact_person"]:
            scored["contact_person"] = "Not Found"
        if "phone" not in scored or not scored["phone"]:
            scored["phone"] = "Not Found"
        if "email" not in scored or not scored["email"]:
            scored["email"] = "Not Found"
        if "website" not in scored or not scored["website"]:
            scored["website"] = "Not Found"

        scored_records.append(scored)

    # Sort descending by score, tie-breaker by presence of email and phone
    scored_records.sort(
        key=lambda x: (
            x["score"],
            1 if x["email"] != "Not Found" else 0,
            1 if x["phone"] != "Not Found" else 0,
            1 if x["contact_person"] != "Not Found" else 0
        ),
        reverse=True
    )

    # Slice top N (or all if fewer)
    top_records = scored_records[:top_n]

    # Assign rank 1-indexed
    for idx, item in enumerate(top_records, start=1):
        item["rank"] = idx

    return top_records
