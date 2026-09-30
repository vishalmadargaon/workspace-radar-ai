"""
Multi-Format Export Engine for Workspace Radar AI - Lead Finder
Generates production-grade CSV, Excel (4-sheet OpenPyXL workbook), and PDF (ReportLab landscape).
"""

import io
import csv
from typing import List, Dict, Any
from datetime import datetime

# OpenPyXL for styled Excel exports
try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

# ReportLab for landscape PDF generation
try:
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


FINAL_COLUMNS = [
    ("rank", "Rank"),
    ("name", "Business Name"),
    ("contact_person", "Contact Person"),
    ("phone", "Phone"),
    ("email", "Email"),
    ("website", "Website"),
    ("address", "Address"),
    ("city", "City"),
    ("category", "Category"),
    ("score", "Lead Score"),
    ("priority", "Priority"),
    ("score_reason", "Score Reason"),
    ("source", "Source")
]


def export_to_csv(records: List[Dict[str, Any]]) -> str:
    """Exports leads to RFC 4180 standard CSV string."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Header
    writer.writerow([col[1] for col in FINAL_COLUMNS])

    # Rows
    for r in records:
        row = [r.get(col[0], "Not Found") for col in FINAL_COLUMNS]
        writer.writerow(row)

    return output.getvalue()


def _parse_contact_name_and_title(contact_str: str) -> tuple:
    """Parses 'First Last (Title)' into (first_name, last_name, title)."""
    if not contact_str or contact_str == "Not Found":
        return ("Commercial", "Decision Maker", "Executive")

    import re
    # Check for parentheses like "Asif Hasan (Co-Founder)"
    title_match = re.search(r"\((.*?)\)", contact_str)
    title = title_match.group(1).strip() if title_match else "Executive"

    clean_name = re.sub(r"\(.*?\)", "", contact_str).strip()
    parts = clean_name.split()
    if len(parts) >= 2:
        return (parts[0], " ".join(parts[1:]), title)
    elif len(parts) == 1:
        return (parts[0], "Team", title)
    return ("Commercial", "Decision Maker", title)


def export_to_hubspot_csv(records: List[Dict[str, Any]]) -> str:
    """
    Exports leads in HubSpot CRM Contacts & Companies import format.
    Compatible with HubSpot CSV Import tool without custom field mapping.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "First Name",
        "Last Name",
        "Job Title",
        "Company Name",
        "Company Domain Name",
        "Work Email",
        "Phone Number",
        "Street Address",
        "City",
        "Country/Region",
        "Lead Status",
        "Coworking Lead Score",
        "Coworking Priority",
        "Original Source",
        "Notes"
    ]
    writer.writerow(headers)

    for r in records:
        first, last, title = _parse_contact_name_and_title(r.get("contact_person", ""))
        website = r.get("website", "")
        domain = website.replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "") if website != "Not Found" else ""

        email = r.get("email", "")
        email_val = email if email != "Not Found" else ""
        phone = r.get("phone", "")
        phone_val = phone if phone != "Not Found" else ""

        priority = r.get("priority", "MEDIUM")
        lead_status = "NEW" if priority == "HIGH" else "OPEN"

        writer.writerow([
            first,
            last,
            title,
            r.get("name", "Unknown Business"),
            domain,
            email_val,
            phone_val,
            r.get("address", ""),
            r.get("city", "Mumbai"),
            "India",
            lead_status,
            r.get("score", 0),
            priority,
            "Workspace Radar AI",
            f"Category: {r.get('category', '')} | Rationale: {r.get('score_reason', '')}"
        ])

    return output.getvalue()


def export_to_salesforce_csv(records: List[Dict[str, Any]]) -> str:
    """
    Exports leads in Salesforce Leads standard import format.
    Compatible with Salesforce Data Import Wizard and Data Loader.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "First Name",
        "Last Name",
        "Title",
        "Company",
        "Website",
        "Email",
        "Phone",
        "Street",
        "City",
        "Country",
        "Rating",
        "Status",
        "Lead Source",
        "Industry",
        "Description"
    ]
    writer.writerow(headers)

    for r in records:
        first, last, title = _parse_contact_name_and_title(r.get("contact_person", ""))
        priority = r.get("priority", "MEDIUM")
        rating = "Hot" if priority == "HIGH" else ("Warm" if priority == "MEDIUM" else "Cold")

        email = r.get("email", "")
        email_val = email if email != "Not Found" else ""
        phone = r.get("phone", "")
        phone_val = phone if phone != "Not Found" else ""
        website = r.get("website", "")
        web_val = website if website != "Not Found" else ""

        writer.writerow([
            first,
            last,
            title,
            r.get("name", "Unknown Business"),
            web_val,
            email_val,
            phone_val,
            r.get("address", ""),
            r.get("city", "Mumbai"),
            "India",
            rating,
            "Open - Not Contacted",
            "Workspace Radar AI - Lead Finder",
            r.get("category", "Technology"),
            f"Score: {r.get('score', 0)}/100 ({priority}). Reason: {r.get('score_reason', '')}"
        ])

    return output.getvalue()



def export_to_excel(records: List[Dict[str, Any]], metrics: Dict[str, Any], city: str = "Mumbai") -> bytes:
    """
    Creates a styled, 4-sheet Excel workbook using openpyxl:
    Sheet 1: 'Lead Summary'
    Sheet 2: 'Top 30 Leads'
    Sheet 3: 'Data Quality'
    Sheet 4: 'Scoring'
    """
    if not OPENPYXL_AVAILABLE:
        # Fallback to plain CSV wrapped in bytes if openpyxl is unavailable
        return export_to_csv(records).encode("utf-8")

    wb = openpyxl.Workbook()

    # Style definitions
    font_family = "Segoe UI"
    navy_dark = "1E293B"
    slate_sub = "334155"
    border_gray = "CBD5E1"
    thin_border = Border(
        left=Side(style='thin', color=border_gray),
        right=Side(style='thin', color=border_gray),
        top=Side(style='thin', color=border_gray),
        bottom=Side(style='thin', color=border_gray)
    )

    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color=navy_dark, end_color=navy_dark, fill_type="solid")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    green_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid") # High
    green_font = Font(name=font_family, size=10, bold=True, color="166534")

    yellow_fill = PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid") # Medium
    yellow_font = Font(name=font_family, size=10, bold=True, color="854D0E")

    gray_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid") # Low
    gray_font = Font(name=font_family, size=10, bold=True, color="475569")

    missing_font = Font(name=font_family, size=10, italic=True, color="94A3B8")
    standard_font = Font(name=font_family, size=10, color="0F172A")

    # -------------------------------------------------------------
    # SHEET 1: Lead Summary
    # -------------------------------------------------------------
    ws_summary = wb.active
    ws_summary.title = "Lead Summary"
    ws_summary.views.sheetView[0].showGridLines = True

    # Title block
    ws_summary["B2"] = "WORKSPACE RADAR AI"
    ws_summary["B2"].font = Font(name=font_family, size=18, bold=True, color="0F172A")
    ws_summary["B3"] = f"{city} — Commercial Lead Intelligence Report"
    ws_summary["B3"].font = Font(name=font_family, size=13, color="475569")
    ws_summary["B4"] = f"Generated on: {datetime.now().strftime('%B %d, %Y - %H:%M')}"
    ws_summary["B4"].font = Font(name=font_family, size=10, color="64748B")

    # KPI Summary Table
    ws_summary["B6"] = "Pipeline KPI"
    ws_summary["C6"] = "Value"
    for col_cell in ["B6", "C6"]:
        ws_summary[col_cell].font = header_font
        ws_summary[col_cell].fill = header_fill
        ws_summary[col_cell].alignment = Alignment(horizontal="center", vertical="center")
        ws_summary[col_cell].border = thin_border

    kpis = [
        ("Total Businesses Discovered", metrics.get("raw_records", len(records))),
        ("Clean Verified Records", metrics.get("clean_records", len(records))),
        ("Duplicate Records Removed", metrics.get("duplicates_removed", 0)),
        ("Qualified Top Prospects", len(records)),
        ("Public Emails Located", sum(1 for r in records if r.get("email") != "Not Found")),
        ("Public Phone Numbers Located", sum(1 for r in records if r.get("phone") != "Not Found")),
        ("Public Websites Verified", sum(1 for r in records if r.get("website") != "Not Found")),
        ("Identifiable Leadership Contacts", sum(1 for r in records if r.get("contact_person") != "Not Found"))
    ]

    for idx, (label, val) in enumerate(kpis, start=7):
        ws_summary[f"B{idx}"] = label
        ws_summary[f"B{idx}"].font = standard_font
        ws_summary[f"B{idx}"].border = thin_border
        ws_summary[f"B{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

        ws_summary[f"C{idx}"] = val
        ws_summary[f"C{idx}"].font = Font(name=font_family, size=11, bold=True, color="0F172A")
        ws_summary[f"C{idx}"].alignment = Alignment(horizontal="center")
        ws_summary[f"C{idx}"].border = thin_border
        ws_summary[f"C{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

    ws_summary.column_dimensions["B"].width = 38
    ws_summary.column_dimensions["C"].width = 18

    # -------------------------------------------------------------
    # SHEET 2: Top 30 Leads
    # -------------------------------------------------------------
    ws_leads = wb.create_sheet(title=f"Top {len(records)} Leads")
    ws_leads.views.sheetView[0].showGridLines = True
    ws_leads.freeze_panes = "A2"

    headers = [col[1] for col in FINAL_COLUMNS]
    ws_leads.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws_leads.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws_leads.row_dimensions[1].height = 28

    for row_idx, r in enumerate(records, start=2):
        row_vals = [r.get(col[0], "Not Found") for col in FINAL_COLUMNS]
        ws_leads.append(row_vals)
        ws_leads.row_dimensions[row_idx].height = 22
        is_even = (row_idx % 2 == 0)

        for col_idx, val in enumerate(row_vals, start=1):
            cell = ws_leads.cell(row=row_idx, column=col_idx)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

            # Default row background
            cell.fill = alt_fill if is_even else white_fill

            # Check if "Not Found"
            if str(val) == "Not Found":
                cell.font = missing_font
            else:
                cell.font = standard_font

            # Priority column formatting
            if col_idx == 11:  # Priority
                cell.alignment = Alignment(horizontal="center", vertical="center")
                if val == "HIGH":
                    cell.fill = green_fill
                    cell.font = green_font
                elif val == "MEDIUM":
                    cell.fill = yellow_fill
                    cell.font = yellow_font
                else:
                    cell.fill = gray_fill
                    cell.font = gray_font

            # Rank and Score formatting
            if col_idx in [1, 10]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
                if col_idx == 10:  # Lead Score
                    cell.font = Font(name=font_family, size=11, bold=True, color="0F172A")

    # Autofilter on leads table
    ws_leads.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(records)+1}"

    # Set column widths
    col_widths = {
        "A": 8,   # Rank
        "B": 32,  # Name
        "C": 26,  # Contact
        "D": 18,  # Phone
        "E": 26,  # Email
        "F": 28,  # Website
        "G": 38,  # Address
        "H": 14,  # City
        "I": 30,  # Category
        "J": 14,  # Score
        "K": 14,  # Priority
        "L": 45,  # Score Reason
        "M": 22   # Source
    }
    for col_letter, width in col_widths.items():
        ws_leads.column_dimensions[col_letter].width = width

    # -------------------------------------------------------------
    # SHEET 3: Data Quality
    # -------------------------------------------------------------
    ws_quality = wb.create_sheet(title="Data Quality")
    ws_quality.views.sheetView[0].showGridLines = True

    ws_quality["B2"] = "DATA INTEGRITY & QUALITY METRICS"
    ws_quality["B2"].font = Font(name=font_family, size=14, bold=True, color="0F172A")

    ws_quality["B4"] = "Metric"
    ws_quality["C4"] = "Count"
    ws_quality["D4"] = "Percentage"
    for cell_id in ["B4", "C4", "D4"]:
        ws_quality[cell_id].font = header_font
        ws_quality[cell_id].fill = header_fill
        ws_quality[cell_id].alignment = Alignment(horizontal="center", vertical="center")
        ws_quality[cell_id].border = thin_border

    tot_clean = max(1, metrics.get("clean_records", len(records)))
    rec_len = max(1, len(records))
    phone_cnt = sum(1 for r in records if r.get("phone") != "Not Found")
    email_cnt = sum(1 for r in records if r.get("email") != "Not Found")
    web_cnt = sum(1 for r in records if r.get("website") != "Not Found")
    person_cnt = sum(1 for r in records if r.get("contact_person") != "Not Found")
    dups_rem = metrics.get("duplicates_removed", 0)
    raw_recs = max(1, metrics.get("raw_records", 1))

    quality_rows = [
        ("Discovered Raw Businesses", metrics.get("raw_records", len(records)), "-"),
        ("Clean Non-Redundant Records", metrics.get("clean_records", len(records)), "100.0%"),
        ("Duplicates Detected & Removed", dups_rem, f"{(dups_rem / raw_recs) * 100:.1f}%"),
        ("Qualified Top Tier Leads", len(records), f"{(len(records) / tot_clean) * 100:.1f}%"),
        ("Businesses with Public Phone", phone_cnt, f"{(phone_cnt / rec_len) * 100:.1f}%"),
        ("Businesses with Public Email", email_cnt, f"{(email_cnt / rec_len) * 100:.1f}%"),
        ("Businesses with Active Website", web_cnt, f"{(web_cnt / rec_len) * 100:.1f}%"),
        ("Businesses with Identified Leadership", person_cnt, f"{(person_cnt / rec_len) * 100:.1f}%")
    ]

    for idx, (m_lbl, cnt, pct) in enumerate(quality_rows, start=5):
        ws_quality[f"B{idx}"] = m_lbl
        ws_quality[f"B{idx}"].font = standard_font
        ws_quality[f"B{idx}"].border = thin_border
        ws_quality[f"B{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

        ws_quality[f"C{idx}"] = cnt
        ws_quality[f"C{idx}"].alignment = Alignment(horizontal="center")
        ws_quality[f"C{idx}"].font = standard_font
        ws_quality[f"C{idx}"].border = thin_border
        ws_quality[f"C{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

        ws_quality[f"D{idx}"] = pct
        ws_quality[f"D{idx}"].alignment = Alignment(horizontal="center")
        ws_quality[f"D{idx}"].font = Font(name=font_family, size=10, bold=True, color="0F172A")
        ws_quality[f"D{idx}"].border = thin_border
        ws_quality[f"D{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

    ws_quality.column_dimensions["B"].width = 38
    ws_quality.column_dimensions["C"].width = 16
    ws_quality.column_dimensions["D"].width = 18

    # -------------------------------------------------------------
    # SHEET 4: Scoring Model
    # -------------------------------------------------------------
    ws_scoring = wb.create_sheet(title="Scoring")
    ws_scoring.views.sheetView[0].showGridLines = True

    ws_scoring["B2"] = "COWORKING PROSPECT POTENTIAL SCORING MODEL"
    ws_scoring["B2"].font = Font(name=font_family, size=14, bold=True, color="0F172A")

    ws_scoring["B4"] = "Signal / Attribute"
    ws_scoring["C4"] = "Max Points"
    ws_scoring["D4"] = "Rationale"
    for cell_id in ["B4", "C4", "D4"]:
        ws_scoring[cell_id].font = header_font
        ws_scoring[cell_id].fill = header_fill
        ws_scoring[cell_id].alignment = Alignment(horizontal="center", vertical="center")
        ws_scoring[cell_id].border = thin_border

    scoring_rules = [
        ("Public Email Available", 20, "Direct actionable outreach channel for sales prospecting"),
        ("Phone Number Available", 15, "Direct calling / WhatsApp business contact verification"),
        ("Website Available", 10, "Digital presence confirming operational commercial status"),
        ("Relevant Business Category", 10, "Consulting, creative, agency, or corporate services"),
        ("Technology / Software / IT", 15, "Highest statistical propensity for coworking and flexible desk leasing"),
        ("Startup / Growing Business", 10, "Rapid team scaling requires flexible month-to-month office terms"),
        ("Hiring / Expansion Signal", 10, "Talent onboarding indicators signaling urgent workspace demand"),
        ("Team / Leadership Presence", 15, "Named founders or managers available for targeted outreach")
    ]

    for idx, (sig, pts, rat) in enumerate(scoring_rules, start=5):
        ws_scoring[f"B{idx}"] = sig
        ws_scoring[f"B{idx}"].font = standard_font
        ws_scoring[f"B{idx}"].border = thin_border
        ws_scoring[f"B{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

        ws_scoring[f"C{idx}"] = f"+{pts}"
        ws_scoring[f"C{idx}"].alignment = Alignment(horizontal="center")
        ws_scoring[f"C{idx}"].font = Font(name=font_family, size=10, bold=True, color="0F172A")
        ws_scoring[f"C{idx}"].border = thin_border
        ws_scoring[f"C{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

        ws_scoring[f"D{idx}"] = rat
        ws_scoring[f"D{idx}"].font = standard_font
        ws_scoring[f"D{idx}"].border = thin_border
        ws_scoring[f"D{idx}"].fill = alt_fill if idx % 2 == 0 else white_fill

    # Priority Bands
    p_start = len(scoring_rules) + 7
    ws_scoring[f"B{p_start}"] = "Priority Band"
    ws_scoring[f"C{p_start}"] = "Score Range"
    ws_scoring[f"D{p_start}"] = "Action Protocol"
    for cell_id in [f"B{p_start}", f"C{p_start}", f"D{p_start}"]:
        ws_scoring[cell_id].font = header_font
        ws_scoring[cell_id].fill = PatternFill(start_color=slate_sub, end_color=slate_sub, fill_type="solid")
        ws_scoring[cell_id].alignment = Alignment(horizontal="center", vertical="center")
        ws_scoring[cell_id].border = thin_border

    bands = [
        ("HIGH", "70 – 100", "Immediate priority for coworking sales rep outreach", green_fill, green_font),
        ("MEDIUM", "40 – 69", "Nurture campaign, verify secondary decision maker contacts", yellow_fill, yellow_font),
        ("LOW", "0 – 39", "Monitor quarterly for expansion or office requirement signals", gray_fill, gray_font)
    ]
    for b_idx, (b_name, rng, proto, b_fill, b_font) in enumerate(bands, start=p_start + 1):
        ws_scoring[f"B{b_idx}"] = b_name
        ws_scoring[f"B{b_idx}"].alignment = Alignment(horizontal="center")
        ws_scoring[f"B{b_idx}"].fill = b_fill
        ws_scoring[f"B{b_idx}"].font = b_font
        ws_scoring[f"B{b_idx}"].border = thin_border

        ws_scoring[f"C{b_idx}"] = rng
        ws_scoring[f"C{b_idx}"].alignment = Alignment(horizontal="center")
        ws_scoring[f"C{b_idx}"].font = Font(name=font_family, size=10, bold=True)
        ws_scoring[f"C{b_idx}"].border = thin_border

        ws_scoring[f"D{b_idx}"] = proto
        ws_scoring[f"D{b_idx}"].font = standard_font
        ws_scoring[f"D{b_idx}"].border = thin_border

    ws_scoring.column_dimensions["B"].width = 28
    ws_scoring.column_dimensions["C"].width = 16
    ws_scoring.column_dimensions["D"].width = 46

    # Save to buffer
    stream = io.BytesIO()
    wb.save(stream)
    return stream.getvalue()


class NumberedCanvas(canvas.Canvas):
    """Adds running headers and 'Generated by Workspace Radar AI' footers with page numbers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Footer
        self.drawString(36, 20, "Generated by Workspace Radar AI — Confidential Commercial Lead Intelligence")
        self.drawRightString(792 - 36, 20, f"Page {self._pageNumber} of {page_count}")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 32, 792 - 36, 32)

        self.restoreState()


def export_to_pdf(records: List[Dict[str, Any]], metrics: Dict[str, Any], city: str = "Mumbai") -> bytes:
    """
    Creates a landscape PDF report using ReportLab with custom styling,
    KPI summary, and lead intelligence table.
    """
    if not REPORTLAB_AVAILABLE:
        # Fallback if reportlab missing
        return b"%PDF-1.4\n%Fallback empty PDF\n"

    buffer = io.BytesIO()
    # Landscape Letter: 792 x 612 pt
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=42
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0F172A")
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#475569")
    )
    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A")
    )
    cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A")
    )
    cell_muted = ParagraphStyle(
        "TableCellMuted",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#94A3B8")
    )
    th_style = ParagraphStyle(
        "TableHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("WORKSPACE RADAR AI", title_style))
    story.append(Paragraph(
        f"{city} — Top {len(records)} Potential Coworking Customers Lead Intelligence Report | {datetime.now().strftime('%B %d, %Y')}",
        subtitle_style
    ))
    story.append(Spacer(1, 10))

    # KPI Summary Row
    kpi_data = [
        [
            Paragraph("<b>Businesses Discovered</b><br/>" + str(metrics.get("raw_records", len(records))), cell_style),
            Paragraph("<b>Clean Records</b><br/>" + str(metrics.get("clean_records", len(records))), cell_style),
            Paragraph("<b>Duplicates Removed</b><br/>" + str(metrics.get("duplicates_removed", 0)), cell_style),
            Paragraph("<b>Contact Enriched</b><br/>" + str(sum(1 for r in records if r.get("email") != "Not Found" or r.get("phone") != "Not Found")), cell_style),
            Paragraph("<b>Qualified Top Leads</b><br/>" + str(len(records)), cell_style)
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[140, 140, 140, 140, 140])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    # Lead Table
    # Available width: 792 - 72 = 720 pt
    # Col widths: Rank (30), Business (125), Contact (100), Phone (85), Email (120), Website (100), Score (45), Priority (55) -> 30+125+100+85+120+100+45+55 = 660 pt
    table_headers = [
        Paragraph("Rank", th_style),
        Paragraph("Business Name", th_style),
        Paragraph("Contact Person", th_style),
        Paragraph("Phone", th_style),
        Paragraph("Email", th_style),
        Paragraph("Website", th_style),
        Paragraph("Score", th_style),
        Paragraph("Priority", th_style)
    ]
    table_data = [table_headers]

    for r in records:
        contact_txt = r.get("contact_person", "Not Found")
        phone_txt = r.get("phone", "Not Found")
        email_txt = r.get("email", "Not Found")
        web_txt = r.get("website", "Not Found")
        priority_txt = r.get("priority", "LOW")

        p_style = cell_bold if priority_txt == "HIGH" else cell_style

        row = [
            Paragraph(str(r.get("rank", "-")), cell_bold),
            Paragraph(r.get("name", "Unknown"), cell_bold),
            Paragraph(contact_txt, cell_style if contact_txt != "Not Found" else cell_muted),
            Paragraph(phone_txt, cell_style if phone_txt != "Not Found" else cell_muted),
            Paragraph(email_txt, cell_style if email_txt != "Not Found" else cell_muted),
            Paragraph(web_txt.replace("https://", "").replace("http://", ""), cell_style if web_txt != "Not Found" else cell_muted),
            Paragraph(f"<b>{r.get('score', 0)}</b>", cell_bold),
            Paragraph(f"<b>{priority_txt}</b>", p_style)
        ]
        table_data.append(row)

    lead_table = Table(
        table_data,
        colWidths=[35, 150, 115, 95, 130, 105, 40, 50],
        repeatRows=1
    )

    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (6, 0), (7, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
    ]

    # Alternating row background colors
    for r_idx in range(1, len(table_data)):
        if r_idx % 2 == 0:
            t_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor("#F8FAFC")))

    lead_table.setStyle(TableStyle(t_style))
    story.append(lead_table)

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
