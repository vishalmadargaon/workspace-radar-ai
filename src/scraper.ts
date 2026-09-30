/**
 * Real-time Web Scraper & Contact Intelligence Engine
 * Visits live company websites, inspects contact pages, extracts genuine emails,
 * mobile/phone numbers, decision makers, and public search engine evidence.
 */

export interface ScrapeResult {
  name: string;
  website: string;
  email: string;
  phone: string;
  contact_person: string;
  address?: string;
  emails_found: string[];
  phones_found: string[];
  source_evidence: string;
  scraped_at: string;
  success: boolean;
  status_log: string[];
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const COMMON_CONTACT_PATHS = [
  '',
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/team'
];

/**
 * Normalizes an Indian phone number into standard formatting.
 * Prioritizes 10-digit mobile numbers (+91 9XXXX XXXXX) and genuine landlines.
 */
export function formatScrapedPhone(raw: string): string {
  if (!raw) return 'Not Found';
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    const main = digits.slice(2);
    if (main[0] >= '6' && main[0] <= '9') {
      return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
    } else if (main.startsWith('22')) {
      return `+91 22 ${main.slice(2, 6)} ${main.slice(6)}`;
    }
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
  } else if (digits.length === 10) {
    if (digits[0] >= '6' && digits[0] <= '9') {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    } else if (digits.startsWith('22')) {
      return `+91 22 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    const main = digits.slice(1);
    if (main.startsWith('22')) {
      return `+91 22 ${main.slice(2, 6)} ${main.slice(6)}`;
    } else if (main[0] >= '6' && main[0] <= '9') {
      return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
    }
  }

  return raw.trim();
}

/**
 * Validates and cleans scraped emails.
 * Filters out image extensions, package version tags (@1.0.0), and trackers.
 */
export function filterRealEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const lower = email.toLowerCase().trim();
  const parts = lower.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;

  // Local part must contain alphanumeric characters
  if (!/^[a-zA-Z0-9_.-]+$/.test(local)) return false;

  // Domain must have an alphabetic top-level domain (e.g. .com, .in, .ai, .io)
  // Disallows npm packages with versions like splide@3.2.2 or axe@4.1.0
  if (!/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/.test(domain)) return false;

  const invalidExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.css', '.js'];
  if (invalidExtensions.some(ext => lower.endsWith(ext))) return false;

  const invalidDomains = ['sentry.io', 'example.com', 'domain.com', 'wixpress.com', 'w3.org', 'schema.org'];
  if (invalidDomains.some(d => lower.includes(d))) return false;

  return true;
}

/**
 * Extracts emails, phones, and contacts from raw HTML content.
 */
export function extractDataFromHTML(html: string, baseUrl: string) {
  const emails: string[] = [];
  const phones: string[] = [];
  let foundExecutive: string | null = null;

  // 1. Mailto links
  const mailtoMatches = Array.from(html.matchAll(/mailto:([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/gi));
  for (const m of mailtoMatches) {
    const em = m[1].toLowerCase().trim();
    if (filterRealEmail(em) && !emails.includes(em)) {
      emails.push(em);
    }
  }

  // 2. Tel links
  const telMatches = Array.from(html.matchAll(/tel:([+0-9\s\-().]+)/gi));
  for (const m of telMatches) {
    const raw = m[1].trim();
    const formatted = formatScrapedPhone(raw);
    if (formatted !== 'Not Found' && !phones.includes(formatted)) {
      phones.push(formatted);
    }
  }

  // 3. Schema.org JSON-LD
  const jsonLdMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const jm of jsonLdMatches) {
    try {
      const data = JSON.parse(jm[1]);
      const processObj = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.telephone && typeof obj.telephone === 'string') {
          const formatted = formatScrapedPhone(obj.telephone);
          if (formatted !== 'Not Found' && !phones.includes(formatted)) phones.push(formatted);
        }
        if (obj.email && typeof obj.email === 'string' && filterRealEmail(obj.email)) {
          if (!emails.includes(obj.email.toLowerCase())) emails.push(obj.email.toLowerCase());
        }
        if (obj.founder || obj.founder?.name) {
          const founderName = typeof obj.founder === 'string' ? obj.founder : obj.founder?.name;
          if (founderName && !foundExecutive) foundExecutive = `${founderName} (Founder)`;
        }
      };
      if (Array.isArray(data)) data.forEach(processObj);
      else processObj(data);
    } catch {
      // Ignore JSON parse errors in script tags
    }
  }

  // 4. Regex body search for emails
  const bodyEmailMatches = html.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || [];
  for (const em of bodyEmailMatches) {
    const clean = em.toLowerCase().trim();
    if (filterRealEmail(clean) && !emails.includes(clean)) {
      // Prefer domain match if applicable
      emails.push(clean);
    }
  }

  // 5. Regex body search for Indian mobile numbers (+91 9XXXX XXXXX, +91 8XXXX, +91 7XXXX, +91 6XXXX)
  const mobileMatches = html.match(/(?:\+91[\s\-]?)?[6-9]\d{4}[\s\-]?\d{5}/g) || [];
  for (const mob of mobileMatches) {
    const formatted = formatScrapedPhone(mob);
    if (formatted !== 'Not Found' && !phones.includes(formatted)) {
      phones.push(formatted);
    }
  }

  // 6. Regex body search for genuine landlines
  const landlineMatches = html.match(/(?:\+91[\s\-]?)?22[\s\-]?\d{4}[\s\-]?\d{4}/g) || [];
  for (const ll of landlineMatches) {
    const formatted = formatScrapedPhone(ll);
    if (formatted !== 'Not Found' && !phones.includes(formatted)) {
      phones.push(formatted);
    }
  }

  // 7. Leadership & Executive patterns
  if (!foundExecutive) {
    const leadershipPatterns = [
      /(?:CEO|Founder|Co-Founder|Managing Director|Director)[:\s\-–]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})[,\s\-–]+(?:CEO|Founder|Co-Founder|Managing Director|Director)/i
    ];
    for (const pat of leadershipPatterns) {
      const match = html.match(pat);
      if (match && match[1] && !match[1].includes('Company') && !match[1].includes('Software')) {
        foundExecutive = match[1].trim();
        break;
      }
    }
  }

  return { emails, phones, foundExecutive };
}

/**
 * Searches public search engine (DuckDuckGo HTML) if site doesn't have phone/email.
 */
export async function searchPublicContactDetails(businessName: string, city: string = 'Mumbai'): Promise<{ emails: string[]; phones: string[] }> {
  const emails: string[] = [];
  const phones: string[] = [];

  try {
    const query = encodeURIComponent(`"${businessName}" ${city} contact email phone office`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;

    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const text = await res.text();
      const extracted = extractDataFromHTML(text, searchUrl);
      for (const e of extracted.emails) {
        if (!emails.includes(e)) emails.push(e);
      }
      for (const p of extracted.phones) {
        if (!phones.includes(p)) phones.push(p);
      }
    }
  } catch (err: any) {
    // Graceful fallback on search timeout
  }

  return { emails, phones };
}

/**
 * Main scraper function: visits live website, extracts original contact details.
 */
export async function scrapeRealBusinessContacts(
  websiteUrl: string,
  businessName: string,
  city: string = 'Mumbai'
): Promise<ScrapeResult> {
  const statusLog: string[] = [];
  const allEmails: string[] = [];
  const allPhones: string[] = [];
  let executive: string | null = null;
  let verifiedEvidenceUrl = websiteUrl;

  statusLog.push(`Initiating live web scrape for ${businessName}...`);

  if (!websiteUrl || websiteUrl === 'Not Found' || !websiteUrl.startsWith('http')) {
    statusLog.push('No valid website URL. Querying public business search...');
    const searchRes = await searchPublicContactDetails(businessName, city);
    allEmails.push(...searchRes.emails);
    allPhones.push(...searchRes.phones);

    return {
      name: businessName,
      website: websiteUrl || 'Not Found',
      email: allEmails[0] || 'Not Found',
      phone: allPhones[0] || 'Not Found',
      contact_person: 'Not Found',
      emails_found: allEmails,
      phones_found: allPhones,
      source_evidence: 'Public Web Search Engine (Live Discovery)',
      scraped_at: new Date().toISOString(),
      success: allEmails.length > 0 || allPhones.length > 0,
      status_log: statusLog
    };
  }

  const cleanBase = websiteUrl.replace(/\/+$/, '');

  // 1. Visit Homepage first
  try {
    statusLog.push(`Fetching live homepage: ${cleanBase}...`);
    const homeRes = await fetch(cleanBase, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(2500),
      redirect: 'follow'
    });

    if (homeRes.ok) {
      const html = await homeRes.text();
      const extracted = extractDataFromHTML(html, cleanBase);
      allEmails.push(...extracted.emails);
      allPhones.push(...extracted.phones);
      if (extracted.foundExecutive) executive = extracted.foundExecutive;
      statusLog.push(`Homepage parsed: ${extracted.emails.length} emails, ${extracted.phones.length} phones found.`);
    }
  } catch (e: any) {
    statusLog.push(`Homepage connection timeout or block: ${e.message}`);
  }

  // 2. If missing phone or email, inspect /contact
  if (allEmails.length === 0 || allPhones.length === 0) {
    for (const subPath of ['/contact']) {
      const targetUrl = `${cleanBase}${subPath}`;
      try {
        statusLog.push(`Inspecting ${targetUrl}...`);
        const subRes = await fetch(targetUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(2000),
          redirect: 'follow'
        });

        if (subRes.ok) {
          const html = await subRes.text();
          const extracted = extractDataFromHTML(html, targetUrl);
          for (const em of extracted.emails) {
            if (!allEmails.includes(em)) allEmails.push(em);
          }
          for (const ph of extracted.phones) {
            if (!allPhones.includes(ph)) allPhones.push(ph);
          }
          if (extracted.foundExecutive && !executive) {
            executive = extracted.foundExecutive;
          }
          if (extracted.emails.length > 0 || extracted.phones.length > 0) {
            verifiedEvidenceUrl = targetUrl;
            break;
          }
        }
      } catch {
        // Continue to next path
      }
    }
  }

  // 3. Fallback to public search query if site didn't yield phone or email
  if (allEmails.length === 0 || allPhones.length === 0) {
    statusLog.push(`Searching public verified listings for ${businessName}...`);
    const searchRes = await searchPublicContactDetails(businessName, city);
    for (const em of searchRes.emails) {
      if (!allEmails.includes(em)) allEmails.push(em);
    }
    for (const ph of searchRes.phones) {
      if (!allPhones.includes(ph)) allPhones.push(ph);
    }
    if (searchRes.phones.length > 0 || searchRes.emails.length > 0) {
      verifiedEvidenceUrl = `Public Web Search (${cleanBase})`;
    }
  }

  // Pick best email prioritizing business contact addresses
  let bestEmail = 'Not Found';
  if (allEmails.length > 0) {
    const priorityPrefixes = ['careers', 'bd', 'contact', 'info', 'sales', 'hello', 'enquiries', 'support', 'business'];
    const sorted = [...allEmails].sort((a, b) => {
      const aIdx = priorityPrefixes.findIndex(p => a.startsWith(p));
      const bIdx = priorityPrefixes.findIndex(p => b.startsWith(p));
      const aScore = aIdx === -1 ? 999 : aIdx;
      const bScore = bIdx === -1 ? 999 : bIdx;
      return aScore - bScore;
    });
    bestEmail = sorted[0];
  }

  // Pick best phone prioritizing standard mobile numbers
  let bestPhone = 'Not Found';
  if (allPhones.length > 0) {
    // Prefer +91 9... or +91 8... or +91 7... mobile numbers
    const mobileFirst = allPhones.find(p => p.startsWith('+91 9') || p.startsWith('+91 8') || p.startsWith('+91 7') || p.startsWith('+91 6'));
    bestPhone = mobileFirst || allPhones[0];
  }

  statusLog.push(`Scrape completed. Selected: ${bestEmail}, ${bestPhone}`);

  return {
    name: businessName,
    website: websiteUrl,
    email: bestEmail,
    phone: bestPhone,
    contact_person: executive || 'Not Found',
    emails_found: allEmails,
    phones_found: allPhones,
    source_evidence: verifiedEvidenceUrl,
    scraped_at: new Date().toISOString(),
    success: bestEmail !== 'Not Found' || bestPhone !== 'Not Found',
    status_log: statusLog
  };
}
