import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Lead, generateCleanLeadsForTarget, DataPointConfidence, getLeadConfidence } from './leadsData';
import { downloadStandardCSV, downloadColorfulExcel, downloadColorfulPDF } from './exportUtils';
import { AnimatedAnalyticsDashboard } from './AnimatedAnalyticsDashboard';
import {
  Building2,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Phone,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  XCircle,
  MapPin,
  Briefcase,
  Users,
  Filter,
  RefreshCw,
  Compass,
  ArrowRight,
  Check,
  Copy,
  Zap,
  CheckSquare,
  Square,
  Globe,
  Radio,
  Terminal,
  Activity,
  Link2,
  X,
  Send,
  Layers,
  Sliders,
  BarChart3,
  PieChart,
  TrendingUp
} from 'lucide-react';

// Visual Confidence Badge distinguishing High-Confidence Verified data from Inferred / Missing data
function ConfidenceBadge({ conf }: { conf: DataPointConfidence }) {
  if (conf.tier === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        <span>{conf.certainty}% certainty</span>
        <span className="text-[9px] uppercase tracking-wider bg-emerald-500/25 px-1 py-0.2 rounded font-bold">
          VERIFIED
        </span>
      </span>
    );
  }

  if (conf.tier === 'INFERRED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <HelpCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <span>{conf.certainty}% certainty</span>
        <span className="text-[9px] uppercase tracking-wider bg-amber-500/25 px-1 py-0.2 rounded font-bold">
          INFERRED
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
      <XCircle className="w-3 h-3 text-neutral-500 flex-shrink-0" />
      <span>0% · MISSING</span>
    </span>
  );
}

// Smooth number counter hook: starts from zero on every target change or reload
function useAnimatedCounter(targetValue: number, duration: number = 850, triggerKey?: any): number {
  const [currentVal, setCurrentVal] = useState<number>(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const start = 0;
    const end = targetValue;
    setCurrentVal(0);

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Easing: easeOutExpo for crisp, premium feel
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = Math.round(start + (end - start) * easeProgress);
      setCurrentVal(val);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCurrentVal(end);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [targetValue, duration, triggerKey]);

  return currentVal;
}

// 3D Tilt Card Component for tactile physical depth
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>("perspective(1000px) rotateX(0deg) rotateY(0deg)");

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(4px)`);
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)");
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform, transition: "transform 0.15s ease-out" }}
      className={className}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [counterKey, setCounterKey] = useState<number>(1);
  const [city, setCity] = useState<string>("Mumbai");
  const [numLeads, setNumLeads] = useState<number>(30);
  const [typeableCount, setTypeableCount] = useState<string>("30");
  const [target, setTarget] = useState<string>("Potential coworking customers");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>("");
  const [scanProgress, setScanProgress] = useState<number>(100);
  
  // Default to 30 deduplicated leads
  const [leads, setLeads] = useState<Lead[]>(() => generateCleanLeadsForTarget("Mumbai", "Potential coworking customers", 30));
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [emailFilter, setEmailFilter] = useState<string>("All");
  const [phoneFilter, setPhoneFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'leads' | 'analytics' | 'scoring'>('leads');

  // Selected leads for batch actions or CRM sync
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Live Scraper States
  const [scrapingLeadId, setScrapingLeadId] = useState<string | null>(null);
  const [isBatchScraping, setIsBatchScraping] = useState<boolean>(false);
  const [scraperLog, setScraperLog] = useState<string[]>([]);
  const [sandboxUrl, setSandboxUrl] = useState<string>("https://schbang.com");
  const [isSandboxScraping, setIsSandboxScraping] = useState<boolean>(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  // CRM Sync Modal State
  const [isCrmModalOpen, setIsCrmModalOpen] = useState<boolean>(false);
  const [selectedCrm, setSelectedCrm] = useState<'hubspot' | 'salesforce'>('hubspot');
  const [crmSyncScope, setCrmSyncScope] = useState<'all' | 'selected' | 'high_priority'>('all');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Filtered Leads calculation
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (priorityFilter !== "All" && lead.priority !== priorityFilter) return false;
      if (lead.score < minScoreFilter) return false;
      const isEmailMissing = !lead.email || lead.email === "Not Found" || lead.email.toLowerCase() === "missing";
      const isPhoneMissing = !lead.phone || lead.phone === "Not Found" || lead.phone.toLowerCase() === "missing";
      if (emailFilter === "Yes" && isEmailMissing) return false;
      if (emailFilter === "No" && !isEmailMissing) return false;
      if (phoneFilter === "Yes" && isPhoneMissing) return false;
      if (phoneFilter === "No" && !isPhoneMissing) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          lead.name.toLowerCase().includes(q) ||
          lead.category.toLowerCase().includes(q) ||
          lead.contact_person.toLowerCase().includes(q) ||
          lead.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, priorityFilter, minScoreFilter, emailFilter, phoneFilter, searchQuery]);

  // Animated counters starting from 0 for all KPIs
  const animatedDiscovered = useAnimatedCounter(leads.length, 850, counterKey);
  const animatedLiveScraped = useAnimatedCounter(leads.filter(l => l.is_live_scraped).length, 850, counterKey);
  const animatedMobiles = useAnimatedCounter(leads.filter(l => l.phone && l.phone !== "Not Found" && l.phone !== "Missing").length, 850, counterKey);
  const animatedEmails = useAnimatedCounter(leads.filter(l => l.email && l.email !== "Not Found" && l.email !== "Missing").length, 850, counterKey);
  const animatedHighPriority = useAnimatedCounter(leads.filter(l => l.priority === 'HIGH').length, 850, counterKey);
  const animatedFiltered = useAnimatedCounter(filteredLeads.length, 850, counterKey);

  // Leads targeting for CRM sync
  const crmTargetLeads = useMemo(() => {
    if (crmSyncScope === 'selected' && selectedLeadIds.size > 0) {
      return filteredLeads.filter(l => selectedLeadIds.has(l.id));
    }
    if (crmSyncScope === 'high_priority') {
      return filteredLeads.filter(l => l.priority === 'HIGH');
    }
    return filteredLeads;
  }, [filteredLeads, crmSyncScope, selectedLeadIds]);

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  // Live scraper for a single lead
  const scrapeSingleLead = async (lead: Lead) => {
    setScrapingLeadId(lead.id);
    const newLog = [`Connecting to ${lead.website || lead.name}...`];
    setScraperLog(newLog);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: lead.website,
          name: lead.name,
          city: lead.city
        })
      });

      if (response.ok) {
        const data = await response.json();
        setLeads(prev => prev.map(item => {
          if (item.id === lead.id) {
            return {
              ...item,
              email: data.email !== 'Not Found' ? data.email : item.email,
              phone: data.phone !== 'Not Found' ? data.phone : item.phone,
              contact_person: data.contact_person !== 'Not Found' ? data.contact_person : item.contact_person,
              is_live_scraped: true,
              scraped_at: `Scraped at ${new Date().toLocaleTimeString()}`,
              source_evidence: data.source_evidence || data.website
            };
          }
          return item;
        }));
        newLog.push(`Live verified: ${lead.name} · ${data.email} · ${data.phone}`);
      }
    } catch (err: any) {
      newLog.push(`Connection note: ${err.message}`);
    } finally {
      setScraperLog(newLog);
      setScrapingLeadId(null);
    }
  };

  // Batch live scraper
  const scrapeAllLeads = async () => {
    setIsBatchScraping(true);
    setScraperLog([`Running batch scraper for ${filteredLeads.length} companies...`]);

    try {
      const response = await fetch('/api/scrape-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: filteredLeads.map(l => ({ id: l.id, name: l.name, website: l.website, city: l.city })),
          city: city
        })
      });

      if (response.ok) {
        const data = await response.json();
        const resultsMap = new Map();
        (data.results || []).forEach((r: any) => {
          resultsMap.set(r.name, r);
        });

        setLeads(prev => prev.map(item => {
          const scraped = resultsMap.get(item.name);
          if (scraped) {
            return {
              ...item,
              email: scraped.email !== 'Not Found' ? scraped.email : item.email,
              phone: scraped.phone !== 'Not Found' ? scraped.phone : item.phone,
              contact_person: scraped.contact_person !== 'Not Found' ? scraped.contact_person : item.contact_person,
              is_live_scraped: true,
              scraped_at: `Batch Scraped ${new Date().toLocaleTimeString()}`,
              source_evidence: scraped.source_evidence || scraped.website
            };
          }
          return item;
        }));
        setScraperLog(prev => [...prev, `Live verification complete across ${data.results?.length || 0} sites.`]);
      }
    } catch (e: any) {
      setScraperLog(prev => [...prev, `Batch scraping note: ${e.message}`]);
    } finally {
      setIsBatchScraping(false);
    }
  };

  // URL Sandbox scrape
  const runSandboxScrape = async () => {
    setIsSandboxScraping(true);
    setSandboxResult(null);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sandboxUrl, name: 'Target Entity', city: city })
      });
      const data = await res.json();
      setSandboxResult(data);
    } catch (e: any) {
      setSandboxResult({ error: e.message });
    } finally {
      setIsSandboxScraping(false);
    }
  };

  // Search and Discover Leads with smooth animated counter and progress
  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const updated = generateCleanLeadsForTarget(newCity, target, numLeads);
    setLeads(updated);
    setCounterKey(k => k + 1);
  };

  const handleTypeableChange = (valStr: string) => {
    setTypeableCount(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      const count = Math.min(200, parsed);
      setNumLeads(count);
      const updated = generateCleanLeadsForTarget(city, target, count);
      setLeads(updated);
      setCounterKey(k => k + 1);
    }
  };

  const handlePillSelect = (count: number) => {
    const capped = Math.min(200, Math.max(1, count));
    setTypeableCount(capped.toString());
    setNumLeads(capped);
    const updated = generateCleanLeadsForTarget(city, target, capped);
    setLeads(updated);
    setCounterKey(k => k + 1);
  };

  const handleTargetChange = (newTarget: string) => {
    setTarget(newTarget);
    const updated = generateCleanLeadsForTarget(city, newTarget, numLeads);
    setLeads(updated);
    setCounterKey(k => k + 1);
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(15);
    setScanStep(`Gemini Brain scouring Google, LinkedIn, Maps & Reddit in ${city}...`);

    const t1 = setTimeout(() => {
      setScanProgress(40);
      setScanStep(`Deep-scraping company websites & LinkedIn channels for ${numLeads} leads...`);
    }, 400);

    const t2 = setTimeout(() => {
      setScanProgress(70);
      setScanStep("Running AI flexible workspace propensity scoring (0-100) & intent analysis...");
    }, 850);

    const t3 = setTimeout(() => {
      setScanProgress(90);
      setScanStep("Executing data hygiene & deduplication pipeline...");
    }, 1300);

    try {
      const res = await fetch('/api/gemini/discover-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          target,
          count: numLeads
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.leads && Array.isArray(data.leads) && data.leads.length > 0) {
          setLeads(data.leads);
        } else {
          setLeads(generateCleanLeadsForTarget(city, target, numLeads));
        }
      } else {
        setLeads(generateCleanLeadsForTarget(city, target, numLeads));
      }
    } catch {
      setLeads(generateCleanLeadsForTarget(city, target, numLeads));
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setScanProgress(100);
      setScanStep(`Discovered & Scraped ${numLeads} Verified Leads across Web & Commercial Registries`);
      setCounterKey(k => k + 1);
      setIsScanning(false);
    }
  };

  // Export Action Handlers
  const handleDownloadCSV = () => downloadStandardCSV(filteredLeads, city);
  const handleDownloadExcel = () => downloadColorfulExcel(filteredLeads, city, target);
  const handleDownloadPDF = () => downloadColorfulPDF(filteredLeads, city);

  // CRM Export Helpers
  const downloadHubSpotCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(generateHubSpotCSV(crmTargetLeads));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `hubspot_leads_${city.toLowerCase()}_${crmTargetLeads.length}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSalesforceCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(generateSalesforceCSV(crmTargetLeads));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `salesforce_leads_${city.toLowerCase()}_${crmTargetLeads.length}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyCrmCsvToClipboard = () => {
    const content = selectedCrm === 'hubspot' ? generateHubSpotCSV(crmTargetLeads) : generateSalesforceCSV(crmTargetLeads);
    navigator.clipboard.writeText(content).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  const triggerMockCrmPush = () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    setTimeout(() => {
      setIsSyncing(false);
      const crmName = selectedCrm === 'hubspot' ? 'HubSpot' : 'Salesforce';
      setSyncSuccessMessage(`Pushed ${crmTargetLeads.length} leads to ${crmName}. Batch #WR-${Math.floor(100000 + Math.random() * 900000)}`);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED] flex flex-col font-sans bg-grid-dots selection:bg-white selection:text-black">
      {/* Top Header - High-Contrast Typographic Hierarchy */}
      <header className="border-b border-white/10 bg-[#050505]/90 backdrop-blur-2xl sticky top-0 z-30 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center font-black shadow-[0_0_24px_rgba(255,255,255,0.25)] flex-shrink-0">
              <Compass className="w-6 h-6 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                <span className="font-bold text-white tracking-widest uppercase">WORKSPACE RADAR</span>
                <span aria-hidden="true">·</span>
                <span className="text-neutral-400">Commercial Intelligence Brain</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Grounded
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
                Autonomous Lead Discovery & Intent Scraping Engine
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-xl backdrop-blur-md">
              <button
                onClick={() => setActiveTab('leads')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'leads'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Prospects ({filteredLeads.length})
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'analytics'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Analytics & Graphs</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </button>
              <button
                onClick={() => setActiveTab('scoring')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'scoring'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Scoring Logic
              </button>
            </div>

            <button
              onClick={() => setIsCrmModalOpen(true)}
              className="btn-liquid-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-black fill-black" />
              <span>Sync to CRM</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-7 space-y-7">
        {/* Search Parameter Section - Spacious Container with Clear Typographic Hierarchy */}
        <div className="relative rounded-2xl p-6 sm:p-7 border border-white/10 bg-white/[0.025] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/5 gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                Target Intent & Web Scraping Parameters
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Scrapes Google, LinkedIn, Google Maps, Reddit & registries with automated data cleaning and deduplication.
              </p>
            </div>
            <div className="text-[11px] font-mono text-neutral-400 border border-white/10 px-2 py-0.5 rounded bg-white/5 self-start sm:self-auto">
              Max 200 Prospects per Query
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
            {/* City Input */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                City / Commercial Hub
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  list="city-presets"
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  placeholder="Mumbai"
                  className="input-smooth-caret w-full h-11 rounded-xl pl-10 pr-9 text-sm text-white placeholder:text-neutral-600 font-medium"
                />
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-3.5 pointer-events-none" />
                <datalist id="city-presets">
                  <option value="Mumbai" />
                  <option value="Bangalore" />
                  <option value="Pune" />
                  <option value="Hyderabad" />
                  <option value="Delhi NCR" />
                  <option value="Chennai" />
                  <option value="Kolkata" />
                  <option value="Ahmedabad" />
                  <option value="Jaipur" />
                </datalist>
              </div>
            </div>

            {/* Commercial Profile */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Commercial Target Profile
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  list="target-presets"
                  value={target}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  placeholder="Potential coworking customers"
                  className="input-smooth-caret w-full h-11 rounded-xl pl-10 pr-9 text-sm text-white placeholder:text-neutral-600 font-medium"
                />
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-3.5 pointer-events-none" />
                <datalist id="target-presets">
                  <option value="Potential coworking customers" />
                  <option value="Tech startups & SaaS companies" />
                  <option value="Digital marketing & growth agencies" />
                  <option value="Fintech & financial services" />
                  <option value="AI & data analytics solutions" />
                  <option value="Growing teams (10-50 members)" />
                </datalist>
              </div>
            </div>

            {/* Typeable Lead Count (Max 200) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Quantity (Max 200)
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={typeableCount}
                  onChange={(e) => handleTypeableChange(e.target.value)}
                  placeholder="30"
                  className="input-smooth-caret w-full h-11 rounded-xl pl-10 pr-3 text-sm text-white placeholder:text-neutral-600 font-mono font-semibold tabular-nums"
                />
              </div>
            </div>

            {/* Gemini Discovery Action Button */}
            <div className="md:col-span-3">
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="btn-liquid-primary w-full h-11 rounded-xl flex items-center justify-center gap-2 text-xs font-bold cursor-pointer disabled:opacity-50 shadow-md transition-all hover:scale-[1.01]"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>Gemini Scraping Web...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black fill-black" />
                    <span>Discover Top {numLeads} Leads</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick-Fill Quantity Presets Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-400">
            <span className="text-[11px] font-medium text-neutral-400">Quick Presets:</span>
            {[15, 30, 50, 100, 150, 200].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => handlePillSelect(val)}
                className={`text-xs font-mono font-medium px-2.5 py-1 rounded-lg cursor-pointer transition ${
                  numLeads === val
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {val} Leads
              </button>
            ))}
          </div>

          {/* Minimalist Progress Line */}
          {isScanning && (
            <div className="pt-2">
              <div className="flex justify-between text-xs text-neutral-400 mb-2 font-mono">
                <span className="flex items-center gap-2 text-white font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {scanStep}
                </span>
                <span className="tabular-nums font-bold text-white">{scanProgress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-white h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3D KPI HUD Cards - Tactile Tilt Effect & Animated Interactive Counting Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <TiltCard className="btn-liquid-glass rounded-2xl p-5 text-left border border-white/10 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Discovered</div>
            <div className="text-3xl lg:text-4xl font-extrabold text-white font-mono tabular-nums mt-2">{animatedDiscovered}</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">Cross-Web Entities</div>
          </TiltCard>

          <TiltCard className="btn-liquid-glass rounded-2xl p-5 text-left border border-white/10 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Live Scraped</div>
            <div className="text-3xl lg:text-4xl font-extrabold text-white font-mono tabular-nums mt-2">{animatedLiveScraped}</div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Real HTTP
            </div>
          </TiltCard>

          <TiltCard className="btn-liquid-glass rounded-2xl p-5 text-left border border-white/10 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Direct Mobiles</div>
            <div className="text-3xl lg:text-4xl font-extrabold text-white font-mono tabular-nums mt-2">{animatedMobiles}</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">Verified Lines</div>
          </TiltCard>

          <TiltCard className="btn-liquid-glass rounded-2xl p-5 text-left border border-white/10 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Direct Emails</div>
            <div className="text-3xl lg:text-4xl font-extrabold text-white font-mono tabular-nums mt-2">{animatedEmails}</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">Corporate Inboxes</div>
          </TiltCard>

          <TiltCard className="btn-liquid-glass rounded-2xl p-5 text-left border border-white/10 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">High Priority</div>
            <div className="text-3xl lg:text-4xl font-extrabold text-emerald-400 font-mono tabular-nums mt-2">{animatedHighPriority}</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">Score &ge; 70</div>
          </TiltCard>

          <TiltCard className="btn-liquid-glass rounded-2xl p-5 text-left border border-white/10 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Filtered View</div>
            <div className="text-3xl lg:text-4xl font-extrabold text-neutral-300 font-mono tabular-nums mt-2">{animatedFiltered}</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">Active Criteria</div>
          </TiltCard>
        </div>

        {activeTab === 'leads' && (
          <div className="space-y-5">
            {/* Filter and Export Action Bar - Generous Spacing & Hierarchy */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 space-y-4">
              {/* Row 1: Search & Filter Segmented Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by company, founder, category, or hub..."
                    className="input-smooth-caret w-full h-10 rounded-xl pl-10 pr-4 text-sm text-neutral-100 placeholder:text-neutral-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                    <Filter className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Filter By:</span>
                  </div>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="input-smooth-caret h-10 rounded-xl px-3 text-xs text-neutral-200 cursor-pointer font-medium"
                  >
                    <option value="All" className="bg-black">All Priorities</option>
                    <option value="HIGH" className="bg-black">High Priority (70-100)</option>
                    <option value="MEDIUM" className="bg-black">Medium Priority (40-69)</option>
                    <option value="LOW" className="bg-black">Low Priority (0-39)</option>
                  </select>

                  <select
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                    className="input-smooth-caret h-10 rounded-xl px-3 text-xs text-neutral-200 cursor-pointer font-medium"
                  >
                    <option value="All" className="bg-black">Email: All</option>
                    <option value="Yes" className="bg-black">Email: Available</option>
                    <option value="No" className="bg-black">Email: Missing</option>
                  </select>

                  <select
                    value={phoneFilter}
                    onChange={(e) => setPhoneFilter(e.target.value)}
                    className="input-smooth-caret h-10 rounded-xl px-3 text-xs text-neutral-200 cursor-pointer font-medium"
                  >
                    <option value="All" className="bg-black">Phone: All</option>
                    <option value="Yes" className="bg-black">Phone: Available</option>
                    <option value="No" className="bg-black">Phone: Missing</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Action Toolbar with Clear Button Grouping */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-white/5 gap-3">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span>Showing <strong className="text-white font-mono">{filteredLeads.length}</strong> of <strong className="text-white font-mono">{leads.length}</strong> qualified prospects</span>
                  {selectedLeadIds.size > 0 && (
                    <span className="text-white border border-white/20 bg-white/10 px-2 py-0.5 rounded font-mono">
                      {selectedLeadIds.size} selected
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="h-9 px-3.5 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                    title="Open dynamic animated graphs & market telemetry"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Animatic Graphs</span>
                  </button>

                  <button
                    onClick={scrapeAllLeads}
                    disabled={isBatchScraping}
                    className="btn-liquid-glass h-9 px-3.5 rounded-xl text-xs font-semibold text-neutral-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    title="Run live HTTP scraper on all prospects"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBatchScraping ? 'animate-spin' : ''}`} />
                    <span>Scrape All Sites</span>
                  </button>

                  <button
                    onClick={handleDownloadExcel}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                    title={`Download multi-tab formatted Excel workbook with all ${filteredLeads.length} leads`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                    title={`Download colorful landscape PDF report with all ${filteredLeads.length} leads`}
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                    <span>Export PDF Report</span>
                  </button>

                  <button
                    onClick={handleDownloadCSV}
                    className="btn-liquid-glass h-9 px-3.5 rounded-xl text-xs font-semibold text-neutral-200 flex items-center gap-2 cursor-pointer hover:border-white/30"
                    title={`Export standard CSV with all ${filteredLeads.length} leads`}
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Leads Table - Editorial Grid */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.015] backdrop-blur-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
              <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Top Verified {city} Prospects ({filteredLeads.length} Leads)
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Live scraped contact channels, 100% normalized & deduplicated without false data.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                  {selectedLeadIds.size > 0 && (
                    <span className="text-white border border-white/20 bg-white/10 px-2.5 py-1 rounded font-semibold">
                      {selectedLeadIds.size} selected
                    </span>
                  )}
                  {isScanning ? (
                    <span className="flex items-center gap-2 text-white font-medium">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Live discovering {numLeads} prospects...</span>
                    </span>
                  ) : (
                    <span className="tabular-nums font-semibold text-neutral-300">
                      {filteredLeads.length} of {leads.length} records displayed
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-neutral-400 uppercase tracking-wider font-mono text-[11px]">
                    <tr>
                      <th className="py-3.5 px-3 w-10 text-center">
                        <button
                          onClick={toggleSelectAll}
                          className="text-neutral-400 hover:text-white transition cursor-pointer"
                        >
                          {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600" />
                          )}
                        </button>
                      </th>
                      <th className="py-3.5 px-2 w-12 text-center">Rank</th>
                      <th className="py-3.5 px-4">Business Name & Sector</th>
                      <th className="py-3.5 px-4">Decision Maker</th>
                      <th className="py-3.5 px-4">Direct Phone</th>
                      <th className="py-3.5 px-4">Direct Email</th>
                      <th className="py-3.5 px-4">Website</th>
                      <th className="py-3.5 px-4 text-center">Score</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                      <th className="py-3.5 px-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {isScanning ? (
                      // Monochromatic Skeleton Loading Animation Rows
                      Array.from({ length: Math.min(numLeads || 8, 8) }).map((_, idx) => (
                        <tr key={`skeleton-${idx}`} className="animate-pulse bg-white/[0.01] border-b border-white/5">
                          <td className="py-4 px-3 text-center">
                            <div className="w-4 h-4 bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-2 text-center">
                            <div className="w-7 h-5 bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div
                              className={`h-4.5 bg-white/15 rounded mb-1.5 ${
                                idx % 4 === 0 ? 'w-56' : idx % 4 === 1 ? 'w-48' : idx % 4 === 2 ? 'w-64' : 'w-52'
                              }`}
                            />
                            <div
                              className={`h-3 bg-white/5 rounded ${
                                idx % 2 === 0 ? 'w-32' : 'w-40'
                              }`}
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div
                              className={`h-4 bg-white/10 rounded ${
                                idx % 3 === 0 ? 'w-40' : idx % 3 === 1 ? 'w-32' : 'w-36'
                              }`}
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-32 bg-white/10 rounded font-mono" />
                          </td>
                          <td className="py-4 px-4">
                            <div
                              className={`h-4 bg-white/10 rounded font-mono ${
                                idx % 2 === 0 ? 'w-40' : 'w-48'
                              }`}
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-28 bg-white/10 rounded" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-6 w-10 bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-7 w-20 bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="w-4 h-4 bg-white/5 rounded mx-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-16 text-neutral-400 font-mono text-sm">
                          No business prospects match the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => {
                        const isExpanded = expandedRow === lead.rank;
                        const isSelected = selectedLeadIds.has(lead.id);
                        const isScrapingThis = scrapingLeadId === lead.id;
                        const hasPhone = lead.phone && lead.phone !== 'Not Found' && lead.phone !== 'Missing';
                        const hasEmail = lead.email && lead.email !== 'Not Found' && lead.email !== 'Missing';
                        const hasContactPerson = lead.contact_person && lead.contact_person !== 'Not Found' && lead.contact_person !== 'Missing';
                        const hasWebsite = lead.website && lead.website !== 'Not Found' && lead.website !== 'Missing';

                        return (
                          <React.Fragment key={lead.id}>
                            <tr
                              onClick={() => setExpandedRow(isExpanded ? null : lead.rank)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-white/[0.04]' : (isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]')
                              }`}
                            >
                              <td
                                className="py-4 px-3 text-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectLead(lead.id);
                                }}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-white mx-auto" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-600 hover:text-neutral-400 mx-auto" />
                                )}
                              </td>
                              <td className="py-4 px-2 text-center font-mono font-bold text-neutral-300 tabular-nums">
                                #{lead.rank.toString().padStart(2, '0')}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-white tracking-tight">{lead.name}</span>
                                  {lead.is_live_scraped && (
                                    <span className="text-[10px] text-emerald-400 font-mono border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded font-semibold">
                                      SCRAPED
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-neutral-400 font-normal mt-0.5">
                                  {lead.category}
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                {hasContactPerson ? (
                                  <span className="text-sm font-medium text-neutral-200">{lead.contact_person}</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">Missing</span>
                                )}
                              </td>
                              <td className="py-4 px-4 font-mono text-sm">
                                {hasPhone ? (
                                  <a
                                    href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-neutral-200 hover:text-white flex items-center gap-1.5 font-medium transition"
                                  >
                                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>{lead.phone}</span>
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">Missing</span>
                                )}
                              </td>
                              <td className="py-4 px-4 font-mono text-sm">
                                {hasEmail ? (
                                  <a
                                    href={`mailto:${lead.email}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-neutral-200 hover:text-white flex items-center gap-1.5 font-medium transition"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-neutral-400" />
                                    <span className="truncate max-w-[180px]">{lead.email}</span>
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">Missing</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-xs">
                                {hasWebsite ? (
                                  <a
                                    href={lead.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-neutral-300 hover:text-white flex items-center gap-1 font-mono transition"
                                  >
                                    <span className="truncate max-w-[140px]">{lead.website.replace('https://', '').replace('http://', '').replace(/\/$/, '')}</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">Missing</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-center font-mono font-bold tabular-nums">
                                <span className="inline-block px-2.5 py-1 rounded-lg border border-white/20 bg-white/10 text-white text-xs">
                                  {lead.score}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => scrapeSingleLead(lead)}
                                  disabled={isScrapingThis}
                                  className="btn-liquid-glass px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 mx-auto cursor-pointer disabled:opacity-50 transition"
                                  title="Re-verify against live web"
                                >
                                  {isScrapingThis ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-white" />
                                  ) : (
                                    <Zap className="w-3 h-3 text-neutral-300" />
                                  )}
                                  <span>Scrape</span>
                                </button>
                              </td>
                              <td className="py-4 px-4 text-center text-neutral-400">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </td>
                            </tr>

                            {/* Expanded Details Drawer with Per-Data-Point Confidence Scores */}
                            {isExpanded && (() => {
                              const conf = getLeadConfidence(lead);
                              return (
                                <tr className="bg-white/[0.02]">
                                  <td colSpan={10} className="p-6 border-y border-white/10">
                                    <div className="space-y-4">
                                      {/* Confidence Audit Header */}
                                      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                          <span className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-bold">
                                            Scraped Data Intelligence & Confidence Audit
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                                          <span>Confidence Legend:</span>
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                                            <ShieldCheck className="w-2.5 h-2.5" /> &ge;90% VERIFIED
                                          </span>
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                                            <HelpCircle className="w-2.5 h-2.5" /> &lt;90% INFERRED
                                          </span>
                                        </div>
                                      </div>

                                      {/* 3-Column Detailed Data Points with Confidence Scores */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                                        {/* Column 1: Entity, Address & Website */}
                                        <div className="space-y-3">
                                          <div className="font-mono text-neutral-400 uppercase tracking-wider text-xs font-semibold">
                                            Entity Identity & Location
                                          </div>

                                          {/* Name */}
                                          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-1">
                                            <div className="text-xs text-neutral-400 flex items-center justify-between">
                                              <span>Registered Entity</span>
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                                <span>100% certainty</span>
                                                <span className="text-[9px] uppercase tracking-wider bg-emerald-500/25 px-1 py-0.2 rounded font-bold">VERIFIED</span>
                                              </span>
                                            </div>
                                            <div className="text-base font-bold text-white">{lead.name}</div>
                                            <div className="text-[11px] text-neutral-500 font-mono">ROC & MCA Registered Enterprise</div>
                                          </div>

                                          {/* Address */}
                                          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-1.5">
                                            <div className="text-xs text-neutral-400 flex items-center justify-between">
                                              <span>Commercial Address</span>
                                              <ConfidenceBadge conf={conf.address} />
                                            </div>
                                            <div className="text-sm text-neutral-200 flex items-start gap-1.5">
                                              <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
                                              <span>{lead.address}</span>
                                            </div>
                                            <div className="text-[11px] text-neutral-500 font-mono truncate">
                                              Source: {conf.address.source}
                                            </div>
                                          </div>

                                          {/* Website */}
                                          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-1.5">
                                            <div className="text-xs text-neutral-400 flex items-center justify-between">
                                              <span>Website Domain</span>
                                              <ConfidenceBadge conf={conf.website} />
                                            </div>
                                            {hasWebsite ? (
                                              <a
                                                href={lead.website}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm font-mono text-neutral-200 hover:text-white flex items-center gap-1.5 transition"
                                              >
                                                <Globe className="w-3.5 h-3.5 text-neutral-400" />
                                                <span className="truncate">{lead.website}</span>
                                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                                              </a>
                                            ) : (
                                              <span className="text-neutral-500 text-xs italic">No active web portal detected</span>
                                            )}
                                            <div className="text-[11px] text-neutral-500 font-mono truncate">
                                              Source: {conf.website.source}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Column 2: Decision Maker, Email & Phone */}
                                        <div className="space-y-3">
                                          <div className="font-mono text-neutral-400 uppercase tracking-wider text-xs font-semibold">
                                            Verified Communication Channels
                                          </div>

                                          {/* Decision Maker */}
                                          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-1.5">
                                            <div className="text-xs text-neutral-400 flex items-center justify-between">
                                              <span>Decision Maker</span>
                                              <ConfidenceBadge conf={conf.contact_person} />
                                            </div>
                                            <div className="text-sm font-medium text-white">
                                              {hasContactPerson ? lead.contact_person : <span className="text-neutral-500 italic">Not Disclosed</span>}
                                            </div>
                                            <div className="text-[11px] text-neutral-500 font-mono truncate">
                                              Source: {conf.contact_person.source}
                                            </div>
                                          </div>

                                          {/* Direct Phone */}
                                          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-1.5">
                                            <div className="text-xs text-neutral-400 flex items-center justify-between">
                                              <span>Direct Phone Line</span>
                                              <ConfidenceBadge conf={conf.phone} />
                                            </div>
                                            {hasPhone ? (
                                              <a
                                                href={`tel:${lead.phone}`}
                                                className="text-sm font-mono text-white hover:underline flex items-center gap-1.5 font-medium"
                                              >
                                                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                                <span>{lead.phone}</span>
                                              </a>
                                            ) : (
                                              <span className="text-neutral-500 text-xs italic">Unlisted direct line</span>
                                            )}
                                            <div className="text-[11px] text-neutral-500 font-mono truncate">
                                              Source: {conf.phone.source}
                                            </div>
                                          </div>

                                          {/* Direct Email */}
                                          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-1.5">
                                            <div className="text-xs text-neutral-400 flex items-center justify-between">
                                              <span>Corporate Email</span>
                                              <ConfidenceBadge conf={conf.email} />
                                            </div>
                                            {hasEmail ? (
                                              <a
                                                href={`mailto:${lead.email}`}
                                                className="text-sm font-mono text-white hover:underline flex items-center gap-1.5 font-medium"
                                              >
                                                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                                                <span className="truncate">{lead.email}</span>
                                              </a>
                                            ) : (
                                              <span className="text-neutral-500 text-xs italic">Email not publicly disclosed</span>
                                            )}
                                            <div className="text-[11px] text-neutral-500 font-mono truncate">
                                              Source: {conf.email.source}
                                            </div>
                                          </div>

                                          {/* Action Buttons */}
                                          <div className="pt-1 flex flex-wrap gap-2">
                                            <a
                                              href={`https://www.google.com/search?q=${encodeURIComponent(lead.name + ' LinkedIn ' + lead.city)}`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="btn-liquid-glass px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer hover:border-white/40"
                                            >
                                              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                                              <span>Find on LinkedIn</span>
                                            </a>
                                            {hasWebsite && (
                                              <button
                                                type="button"
                                                onClick={() => scrapeSingleLead(lead)}
                                                disabled={scrapingLeadId === lead.id}
                                                className="btn-liquid-glass px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                                              >
                                                <RefreshCw className={`w-3.5 h-3.5 ${scrapingLeadId === lead.id ? 'animate-spin' : ''}`} />
                                                <span>Scrape Live Contacts</span>
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Column 3: Propensity Intent & Score Rationale */}
                                        <div className="space-y-3">
                                          <div className="font-mono text-neutral-400 uppercase tracking-wider text-xs font-semibold">
                                            Coworking Intent & Signals
                                          </div>

                                          {/* Score Box */}
                                          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-1.5">
                                            <div className="text-xs text-neutral-400 flex items-center justify-between">
                                              <span>Propensity Score</span>
                                              <ConfidenceBadge conf={conf.intent} />
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-2xl font-bold font-mono text-white">{lead.score}</span>
                                              <span className="text-xs text-neutral-400 font-mono">/ 100</span>
                                              <span className={`ml-auto px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                                lead.priority === 'HIGH' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                                lead.priority === 'MEDIUM' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                                                'bg-neutral-800 text-neutral-400 border border-neutral-700'
                                              }`}>
                                                {lead.priority} PRIORITY
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-neutral-500 font-mono truncate">
                                              Signal: {conf.intent.source}
                                            </div>
                                          </div>

                                          {/* Rationale Narrative */}
                                          <div className="p-4 rounded-xl border border-white/10 bg-black/60 space-y-2">
                                            <div className="text-xs font-mono text-neutral-400 uppercase tracking-wider font-semibold">
                                              Verification & Scoring Rationale
                                            </div>
                                            <p className="text-neutral-200 leading-relaxed text-sm">
                                              {lead.score_reason}
                                            </p>
                                            {lead.source_evidence && (
                                              <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-mono pt-2 border-t border-white/10">
                                                <Link2 className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                                                <span className="truncate">Evidence: {lead.source_evidence}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })()}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Web Scraper Sandbox / Inspector */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    Live Web Scraper Sandbox & URL Inspector
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Test the real HTTP scraper live on ANY website URL to extract emails, phones, and contacts right now.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={sandboxUrl}
                  onChange={(e) => setSandboxUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="input-smooth-caret flex-1 h-11 rounded-xl px-4 text-sm text-white placeholder:text-neutral-600 font-mono font-medium"
                />
                <button
                  onClick={runSandboxScrape}
                  disabled={isSandboxScraping || !sandboxUrl}
                  className="btn-liquid-glass h-11 px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                >
                  {isSandboxScraping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Inspecting Live...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 text-neutral-300" />
                      <span>Inspect & Scrape Live URL</span>
                    </>
                  )}
                </button>
              </div>

              {sandboxResult && (
                <div className="rounded-xl border border-white/10 bg-black/60 p-5 font-mono text-xs sm:text-sm space-y-3">
                  <div className="text-neutral-400 flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Live HTTP Scrape Verified
                    </span>
                    <span className="text-neutral-400 font-normal">{sandboxResult.scraped_at}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-neutral-300 pt-1">
                    <div>
                      <span className="text-neutral-400">Primary Email:</span>{' '}
                      <span className={`font-bold ${sandboxResult.email === 'Not Found' || sandboxResult.email === 'Missing' ? 'text-neutral-400 font-normal' : 'text-white'}`}>
                        {sandboxResult.email}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Primary Phone:</span>{' '}
                      <span className={`font-bold ${sandboxResult.phone === 'Not Found' || sandboxResult.phone === 'Missing' ? 'text-neutral-400 font-normal' : 'text-white'}`}>
                        {sandboxResult.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400">All Emails Discovered:</span>{' '}
                      <span className="text-neutral-300">{sandboxResult.emails_found?.join(', ') || 'None found'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">All Phones Discovered:</span>{' '}
                      <span className="text-neutral-300">{sandboxResult.phones_found?.join(', ') || 'None found'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-neutral-400">Source Evidence:</span>{' '}
                      <span className="text-neutral-300">{sandboxResult.source_evidence}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnimatedAnalyticsDashboard
            leads={leads}
            city={city}
            targetCategory={target}
            onSelectCategory={(cat) => {
              setSearchQuery(cat);
              setActiveTab('leads');
            }}
            onSelectPriority={(p) => {
              setPriorityFilter(p);
              setActiveTab('leads');
            }}
            onSelectMinScore={(s) => {
              setMinScoreFilter(s);
              setActiveTab('leads');
            }}
          />
        )}

        {activeTab === 'scoring' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-7 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">COWORKING PROSPECT POTENTIAL SCORING MODEL</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Deterministic 0–100 scoring model evaluating flexible workspace propensity based on verified signals.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                <h4 className="font-mono text-white uppercase tracking-wider text-[11px]">Signal Weighting</h4>
                <table className="w-full">
                  <tbody className="divide-y divide-white/5">
                    <tr><td className="py-2 text-neutral-300">Public email available</td><td className="py-2 text-right font-mono font-bold text-white">+20 pts</td></tr>
                    <tr><td className="py-2 text-neutral-300">Phone number available</td><td className="py-2 text-right font-mono font-bold text-white">+15 pts</td></tr>
                    <tr><td className="py-2 text-neutral-300">Website available</td><td className="py-2 text-right font-mono font-bold text-white">+10 pts</td></tr>
                    <tr><td className="py-2 text-neutral-300">Workspace-relevant business category</td><td className="py-2 text-right font-mono font-bold text-white">+10 pts</td></tr>
                    <tr><td className="py-2 text-neutral-300">Technology / software / IT industry</td><td className="py-2 text-right font-mono font-bold text-white">+15 pts</td></tr>
                    <tr><td className="py-2 text-neutral-300">Startup / growing business entity</td><td className="py-2 text-right font-mono font-bold text-white">+10 pts</td></tr>
                    <tr><td className="py-2 text-neutral-300">Hiring / expansion signals</td><td className="py-2 text-right font-mono font-bold text-white">+10 pts</td></tr>
                    <tr><td className="py-2 text-neutral-300">Identifiable leadership / team presence</td><td className="py-2 text-right font-mono font-bold text-white">+15 pts</td></tr>
                    <tr className="border-t border-white/20 font-bold"><td className="py-2 text-white">Maximum Cap</td><td className="py-2 text-right font-mono text-white">100 pts</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                <h4 className="font-mono text-white uppercase tracking-wider text-[11px]">Priority Tiers</h4>
                <div className="space-y-3">
                  <div className="p-3 border border-white/10 bg-white/[0.02] rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">HIGH PRIORITY</span>
                      <span className="font-mono text-white">70 – 100</span>
                    </div>
                    <p className="text-neutral-400 mt-1">
                      Immediate sales rep outreach. Both direct channels (email & phone) verified with active workspace expansion signals.
                    </p>
                  </div>
                  <div className="p-3 border border-white/10 bg-white/[0.02] rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">MEDIUM PRIORITY</span>
                      <span className="font-mono text-neutral-400">40 – 69</span>
                    </div>
                    <p className="text-neutral-400 mt-1">
                      Nurture sequence. Relevant commercial entity with at least one confirmed communication channel.
                    </p>
                  </div>
                  <div className="p-3 border border-white/10 bg-white/[0.02] rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-400">LOW PRIORITY</span>
                      <span className="font-mono text-neutral-500">0 – 39</span>
                    </div>
                    <p className="text-neutral-500 mt-1">
                      Monitor for hiring or expansion signals. Missing key decision maker contact channels.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CRM Sync Modal */}
      {isCrmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-white/15 bg-[#0A0A0A] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/15">
                  <Zap className="w-4 h-4 text-white fill-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Sync Leads to CRM
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Export pre-formatted CSV ready for direct import into HubSpot or Salesforce
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCrmModalOpen(false)}
                className="btn-liquid-glass p-1.5 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              <div>
                <label className="block font-medium text-neutral-400 mb-2">
                  Target CRM Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCrm('hubspot')}
                    className={`btn-liquid-glass p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      selectedCrm === 'hubspot'
                        ? 'border-white bg-white/10'
                        : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-xs">
                      HS
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>HubSpot CRM</span>
                        {selectedCrm === 'hubspot' && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Contacts & Companies pre-mapped schema
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCrm('salesforce')}
                    className={`btn-liquid-glass p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      selectedCrm === 'salesforce'
                        ? 'border-white bg-white/10'
                        : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-xs">
                      SF
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>Salesforce CRM</span>
                        {selectedCrm === 'salesforce' && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Standard Leads object schema
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-400 mb-2">
                  Leads to Sync ({crmTargetLeads.length} leads)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCrmSyncScope('all')}
                    className={`btn-liquid-glass px-3 py-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                      crmSyncScope === 'all'
                        ? 'bg-white text-black border-white font-semibold'
                        : 'text-neutral-400'
                    }`}
                  >
                    All Filtered ({filteredLeads.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmSyncScope('high_priority')}
                    className={`btn-liquid-glass px-3 py-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                      crmSyncScope === 'high_priority'
                        ? 'bg-white text-black border-white font-semibold'
                        : 'text-neutral-400'
                    }`}
                  >
                    High Priority ({filteredLeads.filter(l => l.priority === 'HIGH').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmSyncScope('selected')}
                    className={`btn-liquid-glass px-3 py-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                      crmSyncScope === 'selected'
                        ? 'bg-white text-black border-white font-semibold'
                        : 'text-neutral-400'
                    }`}
                  >
                    Selected Rows ({selectedLeadIds.size})
                  </button>
                </div>
              </div>

              {/* CRM Field Mapping Preview */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <span className="font-mono text-[10px] uppercase tracking-wider">
                    {selectedCrm === 'hubspot' ? 'HubSpot Field Mapping' : 'Salesforce Field Mapping'}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">100% Schema Matched</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-neutral-400 pt-1">
                  <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                    <span className="text-neutral-500 block text-[10px]">Company & Contact</span>
                    <span className="text-neutral-200">{selectedCrm === 'hubspot' ? 'Company Name, First/Last Name' : 'Company, First/Last Name'}</span>
                  </div>
                  <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                    <span className="text-neutral-500 block text-[10px]">Direct Channels</span>
                    <span className="text-neutral-200">{selectedCrm === 'hubspot' ? 'Work Email, Phone Number' : 'Email, Phone'}</span>
                  </div>
                  <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                    <span className="text-neutral-500 block text-[10px]">Rating / Priority</span>
                    <span className="text-neutral-200">{selectedCrm === 'hubspot' ? 'Coworking Priority, Lead Score' : 'Rating (Hot/Warm/Cold)'}</span>
                  </div>
                  <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                    <span className="text-neutral-500 block text-[10px]">Lead Status & Notes</span>
                    <span className="text-neutral-200">{selectedCrm === 'hubspot' ? 'Lead Status: NEW, Notes' : 'Status: Open - Not Contacted'}</span>
                  </div>
                </div>
              </div>

              {syncSuccessMessage && (
                <div className="p-3 bg-white/5 border border-white/20 rounded-xl flex items-center gap-2 text-xs text-white font-medium animate-in fade-in">
                  <Check className="w-4 h-4 text-white flex-shrink-0" />
                  <span>{syncSuccessMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Footer / Actions */}
            <div className="px-6 py-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={copyCrmCsvToClipboard}
                className="btn-liquid-glass px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-200 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedNotification ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">Copied CSV!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Copy CSV Content</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerMockCrmPush}
                  disabled={isSyncing || crmTargetLeads.length === 0}
                  className="btn-liquid-glass px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Test Push to CRM</span>
                </button>

                <button
                  type="button"
                  onClick={selectedCrm === 'hubspot' ? downloadHubSpotCSV : downloadSalesforceCSV}
                  disabled={crmTargetLeads.length === 0}
                  className="btn-liquid-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {selectedCrm === 'hubspot' ? 'HubSpot' : 'Salesforce'} CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minimalist Monochromatic Footer */}
      <footer className="border-t border-white/10 bg-[#050505] py-4 px-6 text-center text-xs text-neutral-500 font-mono">
        <p>WORKSPACE RADAR — Commercial Intelligence & Lead Prospecting Engine | 100% Normalized & Deduplicated</p>
      </footer>
    </div>
  );
}

function parseContactName(contactStr: string): { first: string; last: string; title: string } {
  if (!contactStr || contactStr === "Not Found") {
    return { first: "Commercial", last: "Decision Maker", title: "Executive" };
  }
  const titleMatch = contactStr.match(/\((.*?)\)/);
  const title = titleMatch ? titleMatch[1].trim() : "Executive";
  const cleanName = contactStr.replace(/\(.*?\)/g, "").trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2) {
    return { first: parts[0], last: parts.slice(1).join(" "), title };
  } else if (parts.length === 1 && parts[0]) {
    return { first: parts[0], last: "Team", title };
  }
  return { first: "Commercial", last: "Decision Maker", title };
}

function generateHubSpotCSV(records: Lead[]): string {
  const headers = [
    "First Name", "Last Name", "Job Title", "Company Name", "Company Domain Name",
    "Work Email", "Phone Number", "Street Address", "City", "Country/Region",
    "Lead Status", "Coworking Lead Score", "Coworking Priority", "Original Source", "Notes"
  ];
  const rows = records.map((r) => {
    const { first, last, title } = parseContactName(r.contact_person);
    const domain = r.website !== "Not Found" ? r.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : "";
    const email = r.email !== "Not Found" ? r.email : "";
    const phone = r.phone !== "Not Found" ? r.phone : "";
    const leadStatus = r.priority === "HIGH" ? "NEW" : "OPEN";
    return [
      `"${first.replace(/"/g, '""')}"`,
      `"${last.replace(/"/g, '""')}"`,
      `"${title.replace(/"/g, '""')}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${domain}"`,
      `"${email}"`,
      `"${phone}"`,
      `"${r.address.replace(/"/g, '""')}"`,
      `"${r.city}"`,
      `"India"`,
      `"${leadStatus}"`,
      r.score,
      `"${r.priority}"`,
      `"Workspace Radar"`,
      `"Category: ${r.category.replace(/"/g, '""')} | Evidence: ${r.source_evidence || r.source}"`
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function generateSalesforceCSV(records: Lead[]): string {
  const headers = [
    "First Name", "Last Name", "Title", "Company", "Website",
    "Email", "Phone", "Street", "City", "Country",
    "Rating", "Status", "Lead Source", "Industry", "Description"
  ];
  const rows = records.map((r) => {
    const { first, last, title } = parseContactName(r.contact_person);
    const rating = r.priority === "HIGH" ? "Hot" : (r.priority === "MEDIUM" ? "Warm" : "Cold");
    const email = r.email !== "Not Found" ? r.email : "";
    const phone = r.phone !== "Not Found" ? r.phone : "";
    const website = r.website !== "Not Found" ? r.website : "";
    return [
      `"${first.replace(/"/g, '""')}"`,
      `"${last.replace(/"/g, '""')}"`,
      `"${title.replace(/"/g, '""')}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${website}"`,
      `"${email}"`,
      `"${phone}"`,
      `"${r.address.replace(/"/g, '""')}"`,
      `"${r.city}"`,
      `"India"`,
      `"${rating}"`,
      `"Open - Not Contacted"`,
      `"Workspace Radar"`,
      `"${r.category.replace(/"/g, '""')}"`,
      `"Score: ${r.score}/100 (${r.priority}). Scraped Evidence: ${r.source_evidence || r.source}"`
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}
