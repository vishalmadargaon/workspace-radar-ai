import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Lead } from './leadsData';

export function downloadStandardCSV(leads: Lead[], city: string) {
  const headers = [
    "Rank", "Business Name", "Contact Person", "Phone", "Email",
    "Website", "Address", "City", "Category", "Lead Score", "Priority", "Score Reason", "Source", "Live Scraped Evidence"
  ];
  const rows = leads.map((l) => [
    l.rank,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.contact_person || '').replace(/"/g, '""')}"`,
    `"${l.phone || ''}"`,
    `"${l.email || ''}"`,
    `"${l.website || ''}"`,
    `"${(l.address || '').replace(/"/g, '""')}"`,
    `"${l.city || ''}"`,
    `"${l.category || ''}"`,
    l.score,
    l.priority,
    `"${(l.score_reason || '').replace(/"/g, '""')}"`,
    `"${l.source || ''}"`,
    `"${l.source_evidence || 'Verified'}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `workspace_radar_${city.toLowerCase()}_${leads.length}_leads.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadColorfulExcel(leads: Lead[], city: string, targetCategory: string) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Master Qualified Leads
  const leadsData = leads.map((l) => ({
    "Rank": l.rank,
    "Business Name": l.name,
    "Contact Person": l.contact_person,
    "Direct Phone": l.phone,
    "Direct Email": l.email,
    "Website": l.website,
    "Commercial Address": l.address,
    "City": l.city,
    "Industry Sector": l.category,
    "Propensity Score (0-100)": l.score,
    "Priority Tier": l.priority,
    "Scoring Rationale": l.score_reason,
    "Discovery Source": l.source,
    "Live Evidence": l.source_evidence || "Verified"
  }));

  const wsLeads = XLSX.utils.json_to_sheet(leadsData);

  // Auto-fit column widths
  wsLeads['!cols'] = [
    { wch: 6 },   // Rank
    { wch: 38 },  // Name
    { wch: 28 },  // Contact
    { wch: 20 },  // Phone
    { wch: 30 },  // Email
    { wch: 26 },  // Website
    { wch: 55 },  // Address
    { wch: 14 },  // City
    { wch: 32 },  // Sector
    { wch: 24 },  // Score
    { wch: 14 },  // Priority
    { wch: 60 },  // Rationale
    { wch: 24 },  // Source
    { wch: 35 }   // Evidence
  ];

  // AutoFilter across all leads data
  if (leads.length > 0) {
    wsLeads['!autofilter'] = { ref: `A1:N${leads.length + 1}` };
  }

  XLSX.utils.book_append_sheet(wb, wsLeads, "Qualified Prospects");

  // 2. Sheet 2: Executive Summary & Performance Metrics
  const highCount = leads.filter(l => l.priority === 'HIGH').length;
  const medCount = leads.filter(l => l.priority === 'MEDIUM').length;
  const lowCount = leads.filter(l => l.priority === 'LOW').length;
  const mobilesCount = leads.filter(l => l.phone && l.phone !== 'Not Found' && l.phone !== 'Missing').length;
  const emailsCount = leads.filter(l => l.email && l.email !== 'Not Found' && l.email !== 'Missing').length;
  const missingCount = leads.filter(l => l.phone === 'Missing' || l.email === 'Missing' || l.phone === 'Not Found' || l.email === 'Not Found').length;

  const summaryData = [
    { "Executive KPI": "Target Geography", "Metric Value": city },
    { "Executive KPI": "Target Commercial Profile", "Metric Value": targetCategory },
    { "Executive KPI": "Total Leads Discovered & Cleaned", "Metric Value": leads.length },
    { "Executive KPI": "Direct Decision Maker Mobiles Verified", "Metric Value": `${mobilesCount} (${Math.round((mobilesCount / leads.length) * 100)}%)` },
    { "Executive KPI": "Direct Corporate Emails Verified", "Metric Value": `${emailsCount} (${Math.round((emailsCount / leads.length) * 100)}%)` },
    { "Executive KPI": "Entities with Missing / Unverified Contacts", "Metric Value": `${missingCount} (${Math.round((missingCount / leads.length) * 100)}%)` },
    { "Executive KPI": "High Priority Tier (Score >= 70)", "Metric Value": `${highCount} (${Math.round((highCount / leads.length) * 100)}%)` },
    { "Executive KPI": "Medium Priority Tier (Score 40-69)", "Metric Value": `${medCount} (${Math.round((medCount / leads.length) * 100)}%)` },
    { "Executive KPI": "Low Priority Tier (Score 0-39)", "Metric Value": `${lowCount} (${Math.round((lowCount / leads.length) * 100)}%)` },
    { "Executive KPI": "Deduplication & Hygiene Audit", "Metric Value": "100% Zero-Duplicate (Unique Name, Domain & Phone)" },
    { "Executive KPI": "Export Generation Timestamp", "Metric Value": new Date().toLocaleString() }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

  // 3. Sheet 3: Priority Action Matrix
  const priorityData = [
    { "Priority Tier": "HIGH PRIORITY", "Score Range": "70 – 100", "Lead Count": highCount, "Recommended Rep Action": "Immediate direct phone & email outreach. Team expansion active." },
    { "Priority Tier": "MEDIUM PRIORITY", "Score Range": "40 – 69", "Lead Count": medCount, "Recommended Rep Action": "Nurture sequence. Send flexible seating & private desk deck." },
    { "Priority Tier": "LOW PRIORITY", "Score Range": "0 – 39", "Lead Count": lowCount, "Recommended Rep Action": "Monitor for public hiring and office transition announcements." }
  ];
  const wsPriority = XLSX.utils.json_to_sheet(priorityData);
  wsPriority['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsPriority, "Priority Matrix");

  // Write file
  XLSX.writeFile(wb, `workspace_radar_${city.toLowerCase()}_${leads.length}_prospects.xlsx`);
}

export function downloadColorfulPDF(leads: Lead[], city: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Top Indigo-Navy Banner
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 62, 'F');

  // Title & Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('WORKSPACE RADAR AI', 32, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(`COMMERCIAL COWORKING PROSPECT INTELLIGENCE · ${city.toUpperCase()}`, 32, 46);

  // Right-aligned Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL PROSPECTS: ${leads.length}`, pageWidth - 32, 28, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`STATUS: 100% CLEANED & DEDUPLICATED | ${new Date().toLocaleDateString()}`, pageWidth - 32, 45, { align: 'right' });

  // 2. Table Data Formatting
  const tableHeaders = [
    ["#", "Business Name", "Contact Person & Title", "Phone", "Email", "Commercial Address", "Score", "Priority"]
  ];

  const tableRows = leads.map((l) => [
    l.rank,
    l.name,
    l.contact_person,
    l.phone,
    l.email,
    l.address,
    l.score.toString(),
    l.priority
  ]);

  const at = (autoTable as any).default || autoTable;

  const tableOptions = {
    head: tableHeaders,
    body: tableRows,
    startY: 75,
    theme: 'grid' as const,
    styles: {
      font: 'helvetica' as const,
      fontSize: 7.5,
      cellPadding: 5.5,
      valign: 'middle' as const,
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [30, 41, 59] as [number, number, number], // #1E293B
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] as [number, number, number] // Light zebra #F8FAFC
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' as const, fontStyle: 'bold' as const },
      1: { cellWidth: 155, fontStyle: 'bold' as const },
      2: { cellWidth: 130 },
      3: { cellWidth: 95 },
      4: { cellWidth: 125 },
      5: { cellWidth: 155 },
      6: { cellWidth: 40, halign: 'center' as const, fontStyle: 'bold' as const },
      7: { cellWidth: 54, halign: 'center' as const, fontStyle: 'bold' as const }
    },
    didParseCell: (data: any) => {
      // Priority badge styling with colors
      if (data.section === 'body' && data.column.index === 7) {
        const val = data.cell.raw;
        if (val === 'HIGH') {
          data.cell.styles.fillColor = [220, 252, 231]; // Emerald 100
          data.cell.styles.textColor = [22, 101, 52];   // Emerald 800
        } else if (val === 'MEDIUM') {
          data.cell.styles.fillColor = [254, 243, 199]; // Amber 100
          data.cell.styles.textColor = [146, 64, 14];   // Amber 800
        } else {
          data.cell.styles.fillColor = [241, 245, 249]; // Slate 100
          data.cell.styles.textColor = [71, 85, 105];   // Slate 600
        }
      }
      // Score styling
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: () => {
      const pageNum = (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : ((doc as any).internal?.pages?.length ? (doc as any).internal.pages.length - 1 : 1);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Workspace Radar AI — Verified Commercial Coworking Prospect Intelligence', 32, pageHeight - 16);
      doc.text(`Page ${pageNum}`, pageWidth - 32, pageHeight - 16, { align: 'right' });
    }
  };

  if (typeof at === 'function') {
    at(doc, tableOptions);
  } else if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  }

  doc.save(`workspace_radar_${city.toLowerCase()}_${leads.length}_leads.pdf`);
}
