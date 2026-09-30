"""
Workspace Radar AI - Lead Finder Streamlit Application
Primary entrypoint: python -m streamlit run app/app.py
Focused on finding and qualifying the TOP 30 potential coworking customers in Mumbai.
"""

import os
import sys
import streamlit as st
import pandas as pd
from typing import List, Dict, Any

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.pipeline import run_lead_finder_pipeline
from src.export import (
    export_to_csv,
    export_to_hubspot_csv,
    export_to_salesforce_csv,
    export_to_excel,
    export_to_pdf,
    OPENPYXL_AVAILABLE,
    REPORTLAB_AVAILABLE
)

# Configure Streamlit page
st.set_page_config(
    page_title="Workspace Radar AI - Lead Finder",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom Dark Premium CSS Styling matching Workspace Radar AI
st.markdown("""
<style>
    /* Dark Premium Theme Palette */
    :root {
        --bg-main: #0B0F17;
        --card-bg: #111827;
        --card-border: #1F2937;
        --accent-blue: #38BDF8;
        --accent-indigo: #6366F1;
        --text-primary: #F3F4F6;
        --text-secondary: #9CA3AF;
        --success-green: #34D399;
        --warning-yellow: #FBBF24;
    }

    .radar-header {
        font-family: 'Inter', -apple-system, sans-serif;
        letter-spacing: -0.025em;
        margin-bottom: 0.25rem;
    }
    
    .radar-subtitle {
        font-size: 0.95rem;
        color: #9CA3AF;
        margin-bottom: 1.5rem;
    }

    .kpi-card {
        background: #111827;
        border: 1px solid #1F2937;
        border-radius: 12px;
        padding: 1.25rem 1rem;
        text-align: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    
    .kpi-value {
        font-size: 2.2rem;
        font-weight: 700;
        color: #38BDF8;
        line-height: 1.1;
    }
    
    .kpi-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #9CA3AF;
        margin-top: 0.5rem;
    }

    .priority-badge-high {
        background-color: rgba(52, 211, 153, 0.15);
        color: #34D399;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.75rem;
        border: 1px solid rgba(52, 211, 153, 0.3);
    }

    .priority-badge-med {
        background-color: rgba(251, 191, 36, 0.15);
        color: #FBBF24;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.75rem;
        border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .priority-badge-low {
        background-color: rgba(156, 163, 175, 0.15);
        color: #9CA3AF;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.75rem;
        border: 1px solid rgba(156, 163, 175, 0.3);
    }

    .lead-box {
        background: #111827;
        border: 1px solid #1F2937;
        border-radius: 10px;
        padding: 1.2rem;
        margin-bottom: 0.8rem;
    }
</style>
""", unsafe_allow_html=True)


@st.cache_data(show_spinner=False)
def cached_run_pipeline(city: str, target: str, limit: int) -> tuple:
    """Caches pipeline runs for identical search parameters."""
    return run_lead_finder_pipeline(city=city, target=target, limit=limit)


def render_dashboard():
    # Header Section
    st.markdown("""
    <div style="margin-top: 0.5rem;">
        <span style="font-size: 0.8rem; font-weight: 700; color: #38BDF8; letter-spacing: 0.15em; text-transform: uppercase;">
            WORKSPACE RADAR AI
        </span>
        <h1 class="radar-header" style="color: #F9FAFB; font-size: 2.2rem; font-weight: 800; margin: 0.2rem 0 0.5rem 0;">
            LEAD FINDER
        </h1>
        <p class="radar-subtitle">
            Commercial Workspace Prospecting Engine & Lead Intelligence for Flexible Office Operators.
        </p>
    </div>
    """, unsafe_allow_html=True)

    # Search Configuration Bar
    col_city, col_count, col_target, col_btn = st.columns([2, 1.4, 3.2, 2], vertical_alignment="bottom")

    with col_city:
        city_preset = st.selectbox(
            "City Preset",
            ["Mumbai", "Bangalore", "Pune", "Hyderabad", "Delhi NCR", "Chennai", "Custom / Other City"],
            index=0
        )
        if city_preset == "Custom / Other City":
            city_input = st.text_input("Enter City Name", value="Mumbai")
        else:
            city_input = city_preset

    with col_count:
        count_choice = st.selectbox(
            "Leads Count",
            ["10", "20", "30", "50", "100", "Custom..."],
            index=2
        )
        if count_choice == "Custom...":
            lead_count = st.number_input("Count", min_value=5, max_value=200, value=30, step=5)
        else:
            lead_count = int(count_choice)

    with col_target:
        target_preset = st.selectbox(
            "Target Preset",
            [
                "Potential coworking customers",
                "Tech startups & SaaS companies",
                "Digital marketing & growth agencies",
                "Fintech & financial services",
                "AI & data analytics solutions",
                "Management & business consulting",
                "Custom Target..."
            ],
            index=0
        )
        if target_preset == "Custom Target...":
            target_input = st.text_input("Enter Target", value="Potential coworking customers")
        else:
            target_input = target_preset

    with col_btn:
        find_btn = st.button(
            f"🔍 FIND TOP {lead_count} LEADS",
            type="primary",
            use_container_width=True
        )

    # Initialize or fetch session state leads
    if find_btn:
        progress_bar = st.progress(0, text="Initializing lead discovery pipeline...")
        status_text = st.empty()

        def on_progress(message: str, pct: float):
            progress_bar.progress(int(pct * 100), text=message)

        top_leads, metrics = run_lead_finder_pipeline(
            city=city_input,
            target=target_input,
            limit=int(lead_count),
            progress_callback=on_progress
        )

        progress_bar.empty()
        status_text.empty()

        st.session_state["top_leads"] = top_leads
        st.session_state["metrics"] = metrics
        st.session_state["current_city"] = city_input

    # Check if results are in session state
    if "top_leads" not in st.session_state:
        # Initial run on Mumbai automatically so user sees data immediately
        with st.spinner("Discovering and analyzing Top 30 Mumbai coworking prospects..."):
            top_leads, metrics = cached_run_pipeline("Mumbai", "Potential coworking customers", 30)
            st.session_state["top_leads"] = top_leads
            st.session_state["metrics"] = metrics
            st.session_state["current_city"] = "Mumbai"

    top_leads: List[Dict[str, Any]] = st.session_state.get("top_leads", [])
    metrics: Dict[str, Any] = st.session_state.get("metrics", {})
    city_display = st.session_state.get("current_city", "Mumbai")

    st.markdown("---")

    # Metrics Row
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    with m1:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-value">{metrics.get('raw_records', 50)}</div>
            <div class="kpi-label">Discovered</div>
        </div>
        """, unsafe_allow_html=True)
    with m2:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-value">{metrics.get('clean_records', 50)}</div>
            <div class="kpi-label">Clean Records</div>
        </div>
        """, unsafe_allow_html=True)
    with m3:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-value" style="color: #F87171;">{metrics.get('duplicates_removed', 0)}</div>
            <div class="kpi-label">Duplicates Removed</div>
        </div>
        """, unsafe_allow_html=True)
    with m4:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-value" style="color: #34D399;">{metrics.get('contact_enriched', len(top_leads))}</div>
            <div class="kpi-label">Contact Enriched</div>
        </div>
        """, unsafe_allow_html=True)
    with m5:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-value" style="color: #FBBF24;">{len(top_leads)}</div>
            <div class="kpi-label">Qualified Prospects</div>
        </div>
        """, unsafe_allow_html=True)
    with m6:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-value" style="color: #A78BFA;">{min(30, len(top_leads))}</div>
            <div class="kpi-label">Top Leads</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<div style='height: 20px;'></div>", unsafe_allow_html=True)

    # Filter Controls Section
    with st.expander("Filter & Refine Leads", expanded=False):
        f_col1, f_col2, f_col3, f_col4 = st.columns(4)
        with f_col1:
            p_filter = st.selectbox("Priority", ["All", "HIGH", "MEDIUM", "LOW"])
        with f_col2:
            min_score = st.slider("Minimum Score", 0, 100, 0, step=5)
        with f_col3:
            email_filter = st.selectbox("Email Available", ["All", "Yes", "No"])
        with f_col4:
            phone_filter = st.selectbox("Phone Available", ["All", "Yes", "No"])

    # Apply filters
    filtered_leads = []
    for lead in top_leads:
        if p_filter != "All" and lead.get("priority") != p_filter:
            continue
        if lead.get("score", 0) < min_score:
            continue
        if email_filter == "Yes" and lead.get("email") == "Not Found":
            continue
        if email_filter == "No" and lead.get("email") != "Not Found":
            continue
        if phone_filter == "Yes" and lead.get("phone") == "Not Found":
            continue
        if phone_filter == "No" and lead.get("phone") != "Not Found":
            continue
        filtered_leads.append(lead)

    # Lead Table Header & Export Row
    st.markdown(f"### TOP {len(filtered_leads)} {city_display.upper()} PROSPECTS")

    export_col1, export_col2, export_col3 = st.columns([1, 1, 1])

    # 1. CSV Export
    with export_col1:
        csv_data = export_to_csv(filtered_leads)
        st.download_button(
            label="📄 Download CSV",
            data=csv_data,
            file_name=f"workspace_radar_{city_display.lower()}_leads.csv",
            mime="text/csv",
            use_container_width=True
        )

    # 2. Excel Export
    with export_col2:
        excel_bytes = export_to_excel(filtered_leads, metrics, city=city_display)
        st.download_button(
            label="📊 Download Excel (.xlsx)",
            data=excel_bytes,
            file_name=f"workspace_radar_{city_display.lower()}_intelligence.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True
        )

    # 3. PDF Export
    with export_col3:
        pdf_bytes = export_to_pdf(filtered_leads, metrics, city=city_display)
        st.download_button(
            label="📑 Download PDF Report",
            data=pdf_bytes,
            file_name=f"workspace_radar_{city_display.lower()}_report.pdf",
            mime="application/pdf",
            use_container_width=True
        )

    # CRM Direct Sync Section
    crm_col1, crm_col2 = st.columns(2)
    with crm_col1:
        hubspot_csv = export_to_hubspot_csv(filtered_leads)
        st.download_button(
            label="🟠 Sync to HubSpot CRM (Contacts & Companies CSV)",
            data=hubspot_csv,
            file_name=f"hubspot_leads_{city_display.lower()}.csv",
            mime="text/csv",
            use_container_width=True,
            help="Formatted directly for HubSpot CRM import without custom property mapping."
        )

    with crm_col2:
        salesforce_csv = export_to_salesforce_csv(filtered_leads)
        st.download_button(
            label="☁️ Sync to Salesforce CRM (Leads Standard CSV)",
            data=salesforce_csv,
            file_name=f"salesforce_leads_{city_display.lower()}.csv",
            mime="text/csv",
            use_container_width=True,
            help="Formatted directly for Salesforce Data Import Wizard and Data Loader."
        )

    st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)

    # Interactive Leads View: Compact Table + Expandable Detailed Cards
    # Create tabular view for immediate glance
    table_rows = []
    for l in filtered_leads:
        table_rows.append({
            "Rank": l.get("rank"),
            "Business": l.get("name"),
            "Contact Person": l.get("contact_person"),
            "Phone": l.get("phone"),
            "Email": l.get("email"),
            "Website": l.get("website"),
            "Score": l.get("score"),
            "Priority": l.get("priority")
        })

    df = pd.DataFrame(table_rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Website": st.column_config.LinkColumn("Website"),
            "Score": st.column_config.ProgressColumn(
                "Lead Score",
                help="Coworking prospect potential (0-100)",
                format="%d",
                min_value=0,
                max_value=100
            ),
        }
    )

    st.markdown("<div style='height: 15px;'></div>", unsafe_allow_html=True)
    st.markdown("#### Prospect Deep-Dive & Action Links")

    # Expandable lead cards with clickable tel: and mailto: links
    for lead in filtered_leads:
        rank = lead.get("rank", "-")
        name = lead.get("name", "Unknown Business")
        score = lead.get("score", 0)
        priority = lead.get("priority", "LOW")
        contact = lead.get("contact_person", "Not Found")
        phone = lead.get("phone", "Not Found")
        email = lead.get("email", "Not Found")
        website = lead.get("website", "Not Found")
        address = lead.get("address", f"{city_display}, India")
        category = lead.get("category", "Technology & Services")
        reason = lead.get("score_reason", "Score calculated from verified commercial presence.")
        source = lead.get("source", "Public Business Directory")

        p_class = "priority-badge-high" if priority == "HIGH" else ("priority-badge-med" if priority == "MEDIUM" else "priority-badge-low")

        with st.expander(f"#{rank} • {name} — Score: {score} ({priority})", expanded=False):
            c1, c2 = st.columns([3, 2])
            with c1:
                st.markdown(f"**Business Name:** {name}")
                st.markdown(f"**Category:** `{category}`")
                st.markdown(f"**Physical Address:** {address}")
                st.markdown(f"**Source Attribution:** *{source}*")
                st.markdown(f"**Score Rationale:** {reason}")

            with c2:
                st.markdown(f"**Priority:** <span class='{p_class}'>{priority}</span>", unsafe_allow_html=True)
                st.markdown(f"**Contact Person:** {contact}")

                # Phone Link
                if phone != "Not Found":
                    clean_p = phone.replace(" ", "").replace("-", "")
                    st.markdown(f"**Phone:** [📞 {phone}](tel:{clean_p})")
                else:
                    st.markdown("**Phone:** <span style='color: #64748B;'>Not Found</span>", unsafe_allow_html=True)

                # Email Link
                if email != "Not Found":
                    st.markdown(f"**Email:** [✉️ {email}](mailto:{email})")
                else:
                    st.markdown("**Email:** <span style='color: #64748B;'>Not Found</span>", unsafe_allow_html=True)

                # Website Link
                if website != "Not Found":
                    st.markdown(f"**Website:** [🌐 Visit Site]({website})")
                else:
                    st.markdown("**Website:** <span style='color: #64748B;'>Not Found</span>", unsafe_allow_html=True)

    # Footer
    st.markdown("---")
    st.markdown(
        "<div style='text-align: center; color: #64748B; font-size: 0.8rem;'>"
        "Workspace Radar AI — Dedicated Mumbai Commercial Prospect Intelligence | Powered by deterministic lead scoring"
        "</div>",
        unsafe_allow_html=True
    )


if __name__ == "__main__":
    render_dashboard()
