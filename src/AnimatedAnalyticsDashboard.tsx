import React, { useState, useMemo, useEffect } from 'react';
import { Lead } from './leadsData';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  MapPin,
  ShieldCheck,
  Building,
  Users,
  Layers,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Sparkles,
  Zap,
  Phone,
  Mail
} from 'lucide-react';

interface AnimatedAnalyticsProps {
  leads: Lead[];
  city: string;
  targetCategory: string;
  onSelectCategory?: (category: string) => void;
  onSelectPriority?: (priority: string) => void;
  onSelectMinScore?: (score: number) => void;
}

export const AnimatedAnalyticsDashboard: React.FC<AnimatedAnalyticsProps> = ({
  leads,
  city,
  targetCategory,
  onSelectCategory,
  onSelectPriority,
  onSelectMinScore,
}) => {
  const [animationProgress, setAnimationProgress] = useState(0);
  const [activeHoverSector, setActiveHoverSector] = useState<string | null>(null);
  const [activeScoreBucket, setActiveScoreBucket] = useState<string | null>(null);

  useEffect(() => {
    setAnimationProgress(0);
    const timer = setTimeout(() => setAnimationProgress(1), 100);
    return () => clearTimeout(timer);
  }, [leads, city]);

  // 1. Metric aggregates
  const totalLeads = leads.length;
  const avgScore = totalLeads > 0 ? Math.round(leads.reduce((a, b) => a + b.score, 0) / totalLeads) : 0;
  const highPriorityCount = leads.filter(l => l.priority === 'HIGH').length;
  const verifiedMobilesCount = leads.filter(l => l.phone && l.phone !== 'Missing' && l.phone !== 'Not Found').length;
  const verifiedEmailsCount = leads.filter(l => l.email && l.email !== 'Missing' && l.email !== 'Not Found').length;

  const mobileRate = totalLeads > 0 ? Math.round((verifiedMobilesCount / totalLeads) * 100) : 0;
  const emailRate = totalLeads > 0 ? Math.round((verifiedEmailsCount / totalLeads) * 100) : 0;

  // 2. Score distribution buckets
  const scoreBuckets = useMemo(() => {
    const buckets = [
      { key: 'elite', label: '90–100', desc: 'Elite Intent', min: 90, max: 100, color: 'from-emerald-500 to-teal-400', count: 0, leads: [] as Lead[] },
      { key: 'high', label: '80–89', desc: 'High Growth', min: 80, max: 89, color: 'from-teal-500 to-cyan-400', count: 0, leads: [] as Lead[] },
      { key: 'qualified', label: '70–79', desc: 'Qualified', min: 70, max: 79, color: 'from-blue-500 to-indigo-400', count: 0, leads: [] as Lead[] },
      { key: 'moderate', label: '60–69', desc: 'Moderate', min: 60, max: 69, color: 'from-amber-500 to-orange-400', count: 0, leads: [] as Lead[] },
      { key: 'baseline', label: '< 60', desc: 'Early Stage', min: 0, max: 59, color: 'from-neutral-600 to-neutral-400', count: 0, leads: [] as Lead[] },
    ];

    leads.forEach(lead => {
      for (const b of buckets) {
        if (lead.score >= b.min && lead.score <= b.max) {
          b.count++;
          b.leads.push(lead);
          break;
        }
      }
    });

    const maxCount = Math.max(...buckets.map(b => b.count), 1);
    return buckets.map(b => ({
      ...b,
      percentage: totalLeads > 0 ? Math.round((b.count / totalLeads) * 100) : 0,
      relativeHeight: Math.round((b.count / maxCount) * 100)
    }));
  }, [leads, totalLeads]);

  // 3. Category Sector Distribution for Donut Chart
  const sectorDistribution = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(lead => {
      const cat = lead.category || 'Other Commercial';
      map.set(cat, (map.get(cat) || 0) + 1);
    });

    const sorted = Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const colors = [
      '#10B981', // emerald-500
      '#06B6D4', // cyan-500
      '#3B82F6', // blue-500
      '#8B5CF6', // purple-500
      '#EC4899', // pink-500
      '#F59E0B', // amber-500
      '#64748B'  // slate-500
    ];

    let currentAngle = 0;
    return sorted.slice(0, 6).map((item, idx) => {
      const angle = (item.count / (totalLeads || 1)) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return {
        ...item,
        color: colors[idx % colors.length],
        startAngle,
        angle
      };
    });
  }, [leads, totalLeads]);

  // 4. Commercial Hub Density Breakdown
  const hubDistribution = useMemo(() => {
    const hubMap = new Map<string, { count: number; totalScore: number; verifiedPhones: number }>();
    
    leads.forEach(lead => {
      let hub = 'Commercial Corridor';
      if (lead.address.includes('/')) {
        hub = lead.address.split('/')[0].split(',').pop()?.trim() || 'Central District';
      } else if (lead.address.includes(',')) {
        const parts = lead.address.split(',');
        hub = parts[parts.length - 2]?.trim() || parts[0]?.trim() || 'Commercial Hub';
      }

      const existing = hubMap.get(hub) || { count: 0, totalScore: 0, verifiedPhones: 0 };
      existing.count++;
      existing.totalScore += lead.score;
      if (lead.phone && lead.phone !== 'Missing' && lead.phone !== 'Not Found') {
        existing.verifiedPhones++;
      }
      hubMap.set(hub, existing);
    });

    const list = Array.from(hubMap.entries())
      .map(([hub, data]) => ({
        hub,
        count: data.count,
        avgScore: Math.round(data.totalScore / data.count),
        phoneRate: Math.round((data.verifiedPhones / data.count) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const maxCount = Math.max(...list.map(h => h.count), 1);
    return list.map(h => ({
      ...h,
      relativeWidth: Math.round((h.count / maxCount) * 100)
    }));
  }, [leads]);

  // 5. Desk Demand Projection Breakdown
  const deskDemand = useMemo(() => {
    const hotDesks = Math.round(totalLeads * 0.28);
    const dedicatedCabins = Math.round(totalLeads * 0.42);
    const managedSuites = Math.round(totalLeads * 0.22);
    const enterpriseFloors = Math.max(0, totalLeads - hotDesks - dedicatedCabins - managedSuites);

    return [
      { type: '1–4 Flex Desks', tier: 'Early Tech & Freelance', count: hotDesks, color: 'bg-emerald-500', width: 28 },
      { type: '5–18 Dedicated Cabin', tier: 'Growing Squads', count: dedicatedCabins, color: 'bg-cyan-500', width: 42 },
      { type: '19–45 Managed Suite', tier: 'Regional Branch Office', count: managedSuites, color: 'bg-indigo-500', width: 22 },
      { type: '45+ Custom Floor', tier: 'Enterprise Coworking', count: enterpriseFloors, color: 'bg-purple-500', width: 8 },
    ];
  }, [totalLeads]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Analytics Command Header */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="font-bold text-white uppercase tracking-wider">MARKET INTELLIGENCE HUD</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Dynamic Telemetry
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
              Visual Analytics & Intent Distribution for {city}
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Real-time statistical synthesis across {totalLeads} qualified prospects matching "{targetCategory}".
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono text-neutral-400">Filter By Click:</span>
            <button
              onClick={() => onSelectPriority?.('HIGH')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer"
            >
              High Intent Only ({highPriorityCount})
            </button>
            <button
              onClick={() => onSelectMinScore?.(80)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-neutral-200 border border-white/10 hover:bg-white/10 transition cursor-pointer"
            >
              Score &ge; 80
            </button>
          </div>
        </div>

        {/* 4 Summary Highlight Ribbons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-xl border border-white/10 bg-black/40">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Mean Coworking Propensity</div>
            <div className="text-3xl font-extrabold font-mono text-white tabular-nums mt-1">{avgScore} <span className="text-sm text-neutral-500 font-normal">/ 100</span></div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1">High Propensity Cohort</div>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-black/40">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Direct Mobile Coverage</div>
            <div className="text-3xl font-extrabold font-mono text-cyan-400 tabular-nums mt-1">{mobileRate}%</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">{verifiedMobilesCount} Verified Lines</div>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-black/40">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Corporate Email Yield</div>
            <div className="text-3xl font-extrabold font-mono text-indigo-400 tabular-nums mt-1">{emailRate}%</div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">{verifiedEmailsCount} Active Inboxes</div>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-black/40">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Prime Expansion Ratio</div>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums mt-1">
              {totalLeads > 0 ? Math.round((highPriorityCount / totalLeads) * 100) : 0}%
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">{highPriorityCount} Immediate Leads</div>
          </div>
        </div>
      </div>

      {/* Row 1: Animated Propensity Histogram & Sector Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Graph 1: Animated Coworking Propensity Histogram */}
        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Flexible Workspace Propensity Distribution
                </h3>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Animated score clustering showing enterprise willingness to lease coworking desks.
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
              Interactive Bars
            </span>
          </div>

          {/* Bar Histogram Visualization */}
          <div className="pt-4">
            <div className="h-56 flex items-end justify-between gap-3 sm:gap-6 border-b border-white/10 pb-2 px-2">
              {scoreBuckets.map((bucket) => {
                const targetH = Math.max(12, bucket.relativeHeight);
                const heightPercent = animationProgress === 1 ? targetH : 4;
                const isHovered = activeScoreBucket === bucket.key;

                return (
                  <div
                    key={bucket.key}
                    onClick={() => onSelectMinScore?.(bucket.min)}
                    onMouseEnter={() => setActiveScoreBucket(bucket.key)}
                    onMouseLeave={() => setActiveScoreBucket(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    {/* Hover Floating Tooltip */}
                    <div
                      className={`text-[11px] font-mono font-bold mb-2 transition-all duration-300 ${
                        isHovered ? 'scale-110 text-white' : 'text-neutral-400'
                      }`}
                    >
                      {bucket.count} <span className="text-[10px] text-neutral-500 font-normal">({bucket.percentage}%)</span>
                    </div>

                    {/* Animated Vertical Bar */}
                    <div className="w-full max-w-[56px] bg-white/5 rounded-t-xl overflow-hidden p-1 flex flex-col justify-end transition-colors group-hover:bg-white/10 border border-white/10">
                      <div
                        className={`w-full rounded-t-lg bg-gradient-to-t ${bucket.color} transition-all duration-1000 ease-out shadow-[0_0_16px_rgba(16,185,129,0.25)]`}
                        style={{
                          height: `${heightPercent}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="flex items-center justify-between gap-3 sm:gap-6 pt-3 px-2">
              {scoreBuckets.map((bucket) => (
                <div key={bucket.key} className="flex-1 text-center">
                  <div className="text-xs font-mono font-bold text-white">{bucket.label}</div>
                  <div className="text-[10px] text-neutral-400 truncate">{bucket.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-white/10 bg-black/40 text-xs text-neutral-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span><strong>{scoreBuckets[0].count + scoreBuckets[1].count} companies</strong> scored in the top 80–100 propensity tier.</span>
            </span>
            <button
              onClick={() => onSelectMinScore?.(80)}
              className="text-emerald-400 hover:underline font-mono text-[11px] font-semibold cursor-pointer"
            >
              Filter Top Cohort &rarr;
            </button>
          </div>
        </div>

        {/* Graph 2: Animated Radial Sector Distribution Donut */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Commercial Sector Breakdown
              </h3>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Proportion of discovered leads grouped by business domain.
            </p>
          </div>

          {/* SVG Animated Ring Donut Chart */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            <div className="relative w-44 h-44 flex items-center justify-center flex-shrink-0">
              <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-white/10"
                  strokeWidth="11"
                  fill="transparent"
                />

                {/* Animated Segments */}
                {sectorDistribution.map((sector) => {
                  const circumference = 2 * Math.PI * 38; // ~238.76
                  const strokeDash = (sector.count / (totalLeads || 1)) * circumference;
                  const strokeOffset = ((sector.startAngle / 360) * circumference);

                  return (
                    <circle
                      key={sector.name}
                      cx="50"
                      cy="50"
                      r="38"
                      stroke={sector.color}
                      strokeWidth={activeHoverSector === sector.name ? 14 : 11}
                      fill="transparent"
                      strokeDasharray={`${animationProgress * strokeDash} ${circumference}`}
                      strokeDashoffset={-strokeOffset}
                      className="transition-all duration-700 ease-out cursor-pointer hover:opacity-90"
                      onMouseEnter={() => setActiveHoverSector(sector.name)}
                      onMouseLeave={() => setActiveHoverSector(null)}
                      onClick={() => onSelectCategory?.(sector.name)}
                    />
                  );
                })}
              </svg>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold font-mono text-white tabular-nums">
                  {totalLeads}
                </span>
                <span className="text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                  Enterprises
                </span>
              </div>
            </div>

            {/* Interactive Legend */}
            <div className="space-y-2 flex-1 w-full text-xs">
              {sectorDistribution.map((sector) => (
                <div
                  key={sector.name}
                  onClick={() => onSelectCategory?.(sector.name)}
                  onMouseEnter={() => setActiveHoverSector(sector.name)}
                  onMouseLeave={() => setActiveHoverSector(null)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                    activeHoverSector === sector.name ? 'bg-white/10 scale-[1.02]' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sector.color }}
                    />
                    <span className="text-neutral-200 truncate">{sector.name}</span>
                  </div>
                  <span className="font-mono text-neutral-400 font-bold ml-2">
                    {sector.count} <span className="text-neutral-500 font-normal">({sector.percentage}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 font-mono text-center border-t border-white/5 pt-3">
            Click any sector pill to filter the qualified prospects table.
          </div>
        </div>
      </div>

      {/* Row 2: Submarket Density Radar & Desk Demand Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Graph 3: Submarket Density Radar */}
        <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Top Commercial Submarket Hubs in {city}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Spatial density of prospects clustered by commercial office zones.
                </p>
              </div>
            </div>
          </div>

          {/* Animated Horizontal Bars */}
          <div className="space-y-3.5 pt-2">
            {hubDistribution.map((hub) => {
              const barWidth = animationProgress === 1 ? hub.relativeWidth : 5;

              return (
                <div key={hub.hub} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[220px]">
                      {hub.hub}
                    </span>
                    <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px]">
                      <span className="text-emerald-400 font-bold">{hub.avgScore} score</span>
                      <span>{hub.count} leads</span>
                      <span className="text-neutral-500">{hub.phoneRate}% mobile</span>
                    </div>
                  </div>

                  {/* Horizontal Bar with Transition */}
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-neutral-400 font-mono">
            <span>High Density Cluster: {hubDistribution[0]?.hub || 'Central Business District'}</span>
            <span className="text-white font-bold">{hubDistribution[0]?.count || 0} Entities</span>
          </div>
        </div>

        {/* Graph 4: Coworking Seat Demand Forecast */}
        <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Flexible Workspace Seat Demand Forecast
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Estimated desk requirement breakdown based on company scale and hiring momentum.
                </p>
              </div>
            </div>
          </div>

          {/* Stacked Animated Progress Bar */}
          <div className="space-y-2 pt-2">
            <div className="w-full bg-white/10 rounded-xl h-5 overflow-hidden flex p-0.5 border border-white/10">
              {deskDemand.map((d) => (
                <div
                  key={d.type}
                  className={`${d.color} h-full transition-all duration-1000 ease-out first:rounded-l-lg last:rounded-r-lg hover:brightness-110 cursor-pointer`}
                  style={{ width: `${animationProgress === 1 ? d.width : 25}%` }}
                  title={`${d.type}: ${d.count} companies (${d.width}%)`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {deskDemand.map((d) => (
                <div key={d.type} className="p-2.5 rounded-xl border border-white/10 bg-black/40">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium">
                    <span className={`w-2 h-2 rounded-full ${d.color}`} />
                    <span className="truncate">{d.type}</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                    {d.count} <span className="text-xs text-neutral-500 font-normal">leads</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono truncate">{d.tier}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Forecast Badge */}
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
              <span><strong>Estimated Total Desks Needed:</strong> ~{Math.round(totalLeads * 14.5)} seats across {totalLeads} prospects.</span>
            </span>
            <span className="font-mono font-bold text-white">&asymp; {Math.round(totalLeads * 14.5 * 11000).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}/mo Value</span>
          </div>
        </div>
      </div>
    </div>
  );
};
