import { prisma } from './prisma.js';
import { normalizeInstagramHandle } from './handles.js';

export type DiscoveryBrief = {
  countries: string[];
  niches: string[];
  minFollowers?: number | null;
  maxFollowers?: number | null;
  minEngagementRate?: number | null;
  minAvgReelViews?: number | null;
  emailRequired?: boolean;
  activeWithinDays?: number | null;
  targetCount?: number;
};

export type DiscoveredProfile = {
  handle: string;
  instagramUrl: string;
  name?: string;
  country?: string;
  city?: string;
  niche?: string;
  followers?: number;
  email?: string;
  website?: string;
  source: string;
  sourceUrl?: string;
  sourceSnippet?: string;
  dataConfidence: number;
  verificationStatus: 'DISCOVERED' | 'PARTIAL' | 'VERIFIED';
  evidence: Array<{ query: string; title: string; url: string; snippet: string }>;
};

export type DiscoveryUsageStatus = {
  provider: 'Brave Search';
  configured: boolean;
  monthKey: string;
  requestsUsed: number;
  monthlyBudget: number;
  remainingAppBudget: number;
};

export type DiscoveryRun = {
  profiles: DiscoveredProfile[];
  provider: 'Brave Search';
  requestsUsedThisRun: number;
  quotaReached: boolean;
};

type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  query: string;
};

type SearchPlan = {
  query: string;
  countryCode?: string;
  searchLang?: string;
};

type SourcePage = {
  url: string;
  title: string;
  text: string;
  snippet: string;
};

class BraveQuotaError extends Error {}

const blockedInstagramPaths = new Set([
  'p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'direct', 'about', 'developer',
  'legal', 'privacy', 'web', 'challenge', 'tv', 'tags', 'locations'
]);

const countrySignals: Record<string, string[]> = {
  'United States': [
    'united states', ' usa ', ' u.s.', ' us ', 'new york', 'nyc', 'los angeles', 'california',
    'miami', 'florida', 'chicago', 'texas', 'austin', 'dallas', 'atlanta', 'boston', 'seattle',
    'san francisco', 'washington dc', 'brooklyn', 'manhattan'
  ],
  'United Kingdom': [
    'united kingdom', ' uk ', 'england', 'scotland', 'wales', 'london', 'manchester', 'birmingham',
    'bristol', 'leeds', 'liverpool', 'edinburgh', 'glasgow', 'brighton', 'nottingham', 'cardiff'
  ],
  Germany: [
    'germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne',
    'köln', 'düsseldorf', 'stuttgart', 'leipzig'
  ]
};

const citySignals: Record<string, Array<[string, string]>> = {
  'United States': [
    ['new york', 'New York'], ['nyc', 'New York'], ['los angeles', 'Los Angeles'], ['miami', 'Miami'],
    ['chicago', 'Chicago'], ['austin', 'Austin'], ['dallas', 'Dallas'], ['atlanta', 'Atlanta'],
    ['boston', 'Boston'], ['seattle', 'Seattle'], ['san francisco', 'San Francisco'], ['brooklyn', 'New York']
  ],
  'United Kingdom': [
    ['london', 'London'], ['manchester', 'Manchester'], ['birmingham', 'Birmingham'], ['bristol', 'Bristol'],
    ['leeds', 'Leeds'], ['liverpool', 'Liverpool'], ['edinburgh', 'Edinburgh'], ['glasgow', 'Glasgow'],
    ['brighton', 'Brighton'], ['cardiff', 'Cardiff']
  ],
  Germany: [
    ['berlin', 'Berlin'], ['munich', 'Munich'], ['münchen', 'Munich'], ['hamburg', 'Hamburg'],
    ['frankfurt', 'Frankfurt'], ['cologne', 'Cologne'], ['köln', 'Cologne'], ['düsseldorf', 'Düsseldorf']
  ]
};

const nicheSignals: Record<string, string[]> = {
  Fashion: ['fashion', 'outfit', 'outfits', 'ootd', 'style', 'styling', 'wardrobe', 'lookbook', 'clothing'],
  Beauty: ['beauty', 'makeup', 'skincare', 'cosmetics', 'hair', 'glam'],
  Lifestyle: ['lifestyle', 'daily life', 'wellness', 'travel', 'home', 'vlog'],
  'Street Style': ['street style', 'streetstyle', 'streetwear', 'urban style'],
  'Luxury Fashion': ['luxury fashion', 'designer fashion', 'designer bags', 'high fashion', 'luxury style'],
  GRWM: ['grwm', 'get ready with me']
};

const citySeeds: Record<string, string[]> = {
  'United States': ['New York', 'Los Angeles', 'Miami', 'Chicago', 'Austin', 'Dallas', 'Atlanta', 'Boston', 'Seattle', 'San Francisco'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Bristol', 'Leeds', 'Liverpool', 'Edinburgh', 'Glasgow', 'Brighton'],
  Germany: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Düsseldorf']
};

const nicheSeeds: Record<string, string[]> = {
  Fashion: ['fashion creator', 'fashion blogger', 'outfit creator', 'OOTD', 'style influencer'],
  Beauty: ['beauty creator', 'makeup creator', 'beauty influencer', 'GRWM'],
  Lifestyle: ['lifestyle creator', 'lifestyle influencer', 'daily style'],
  'Street Style': ['street style creator', 'streetwear creator', 'street style influencer'],
  'Luxury Fashion': ['luxury fashion creator', 'designer fashion influencer', 'luxury style creator'],
  GRWM: ['GRWM creator', 'get ready with me creator', 'fashion GRWM']
};

const countrySearchConfig: Record<string, { countryCode?: string; searchLang?: string }> = {
  'United States': { countryCode: 'US', searchLang: 'en' },
  'United Kingdom': { countryCode: 'GB', searchLang: 'en' },
  Germany: { countryCode: 'DE', searchLang: 'de' }
};

const nonCreatorWebsiteHosts = [
  'instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'x.com', 'twitter.com',
  'linkedin.com', 'pinterest.com', 'wikipedia.org', 'reddit.com'
];

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function monthlyBudget() {
  const raw = Number(process.env.BRAVE_MONTHLY_REQUEST_BUDGET || 900);
  if (!Number.isFinite(raw)) return 900;
  return Math.max(1, Math.min(Math.floor(raw), 5000));
}

export async function getDiscoveryUsageStatus(): Promise<DiscoveryUsageStatus> {
  const monthKey = currentMonthKey();
  const budget = monthlyBudget();
  const usage = await prisma.searchUsage.findUnique({
    where: { provider_monthKey: { provider: 'brave', monthKey } }
  });
  const requestsUsed = usage?.requests ?? 0;
  return {
    provider: 'Brave Search',
    configured: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    monthKey,
    requestsUsed,
    monthlyBudget: budget,
    remainingAppBudget: Math.max(0, budget - requestsUsed)
  };
}

async function reserveBraveRequest() {
  const monthKey = currentMonthKey();
  const budget = monthlyBudget();
  await prisma.searchUsage.upsert({
    where: { provider_monthKey: { provider: 'brave', monthKey } },
    create: { provider: 'brave', monthKey, requests: 0 },
    update: {}
  });
  const reserved = await prisma.searchUsage.updateMany({
    where: { provider: 'brave', monthKey, requests: { lt: budget } },
    data: { requests: { increment: 1 } }
  });
  if (!reserved.count) {
    throw new BraveQuotaError(`Influentify's monthly Brave request budget (${budget}) has been reached.`);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

function stripHtml(html: string) {
  return normalizeWhitespace(decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ));
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return normalizeWhitespace(decodeHtml(match[1]));
  }
  return '';
}

function pageTitle(html: string) {
  return metaContent(html, 'og:title') || normalizeWhitespace(decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''));
}

function sourcePageText(html: string) {
  const description = metaContent(html, 'og:description') || metaContent(html, 'description');
  const visible = stripHtml(html).slice(0, 30_000);
  return normalizeWhitespace(`${description} ${visible}`);
}

function safePublicHttpUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local')) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    const m = host.match(/^172\.(\d+)\./);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return null;
    if (host === '::1' || host === '[::1]') return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchPublicSource(rawUrl: string): Promise<SourcePage | null> {
  const safe = safePublicHttpUrl(rawUrl);
  if (!safe) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.SOURCE_HTTP_TIMEOUT_MS || 8_000));
  try {
    const res = await fetch(safe, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Influentify/3.0; public-creator-research)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return null;
    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > 2_500_000) return null;
    const html = await res.text();
    if (!html) return null;
    const text = sourcePageText(html);
    return {
      url: res.url || safe.toString(),
      title: pageTitle(html),
      text,
      snippet: text.slice(0, 1800)
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchBrave(plan: SearchPlan): Promise<SearchHit[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is not configured on the server.');

  await reserveBraveRequest();

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', plan.query);
  url.searchParams.set('count', '20');
  url.searchParams.set('extra_snippets', 'true');
  url.searchParams.set('safesearch', 'moderate');
  if (plan.countryCode) url.searchParams.set('country', plan.countryCode);
  if (plan.searchLang) url.searchParams.set('search_lang', plan.searchLang);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.DISCOVERY_HTTP_TIMEOUT_MS || 15_000));

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Brave Search rejected the API key. Check BRAVE_SEARCH_API_KEY in Railway.');
    }
    if (res.status === 429) {
      throw new Error('Brave Search temporarily rate-limited Influentify. Retry in a little while.');
    }
    if (!res.ok) {
      throw new Error(`Brave Search request failed with HTTP ${res.status}.`);
    }

    const data = await res.json() as any;
    const results = Array.isArray(data?.web?.results) ? data.web.results : [];
    // Brave result fields are deliberately kept transient. They are used only to locate source pages;
    // Influentify never writes Brave-returned titles/snippets/URLs into PostgreSQL.
    return results.map((item: any) => ({
      title: String(item?.title || ''),
      url: String(item?.url || ''),
      snippet: normalizeWhitespace([
        item?.description,
        ...(Array.isArray(item?.extra_snippets) ? item.extra_snippets : [])
      ].filter(Boolean).join(' ')),
      query: plan.query
    })).filter((item: SearchHit) => item.url);
  } finally {
    clearTimeout(timeout);
  }
}

function parseCompactNumber(raw: string, suffix?: string) {
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  const s = (suffix ?? '').toLowerCase();
  if (s === 'k') return Math.round(n * 1_000);
  if (s === 'm') return Math.round(n * 1_000_000);
  if (s === 'b') return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

function extractFollowers(text: string) {
  const patterns = [
    /([\d,.]+)\s*([kmb])?\s+followers\b/i,
    /followers\s*[:·-]?\s*([\d,.]+)\s*([kmb])?/i
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return parseCompactNumber(m[1], m[2]);
  }
  return undefined;
}

function extractEmail(text: string) {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  return matches.map(x => x.toLowerCase()).find(x => !x.endsWith('@instagram.com'));
}

function extractInstagramHandle(url: string) {
  try {
    const u = new URL(url);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const first = u.pathname.split('/').filter(Boolean)[0] ?? '';
    const handle = normalizeInstagramHandle(first);
    if (!handle || blockedInstagramPaths.has(handle)) return null;
    return handle;
  } catch {
    const m = url.match(/instagram\.com\/([^/?#]+)/i);
    const handle = normalizeInstagramHandle(m?.[1] ?? '');
    if (!handle || blockedInstagramPaths.has(handle)) return null;
    return handle;
  }
}

function extractHandlesFromSource(page: SourcePage) {
  const handles = new Set<string>();
  const direct = extractInstagramHandle(page.url);
  if (direct) handles.add(direct);

  const text = `${page.title} ${page.text}`;
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const normalized = normalizeInstagramHandle(match[1]);
    if (normalized && !blockedInstagramPaths.has(normalized)) handles.add(normalized);
  }

  const explicitHandleRegex = /(?:instagram|ig)\s*(?:handle|username)?\s*[:\-]?\s*@([A-Za-z0-9._]{1,30})/gi;
  while ((match = explicitHandleRegex.exec(text)) !== null) {
    const normalized = normalizeInstagramHandle(match[1]);
    if (normalized && !blockedInstagramPaths.has(normalized)) handles.add(normalized);
  }
  return [...handles];
}

function inferLocation(text: string, allowedCountries: string[]) {
  const hay = ` ${text.toLowerCase()} `;
  const countries = allowedCountries.length ? allowedCountries : Object.keys(countrySignals);
  let country: string | undefined;
  let city: string | undefined;

  for (const candidate of countries) {
    const signals = countrySignals[candidate] ?? [candidate.toLowerCase()];
    if (signals.some(signal => hay.includes(signal))) {
      country = candidate;
      const cityList = citySignals[candidate] ?? [];
      city = cityList.find(([signal]) => hay.includes(signal))?.[1];
      break;
    }
  }
  return { country, city };
}

function inferNiche(text: string, requested: string[]) {
  const hay = text.toLowerCase();
  const order = requested.length ? requested : Object.keys(nicheSignals);
  let best: { niche?: string; hits: number } = { hits: 0 };
  for (const niche of order) {
    const words = nicheSignals[niche] ?? [niche.toLowerCase()];
    const hits = words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
    if (hits > best.hits) best = { niche, hits };
  }
  return best.niche;
}

function cleanName(title: string, handle: string) {
  let name = title
    .replace(/\|\s*Instagram.*$/i, '')
    .replace(/Instagram photos and videos.*$/i, '')
    .replace(/\(@[^)]+\).*$/i, '')
    .replace(/•.*$/i, '')
    .trim();
  if (!name || name.toLowerCase() === handle.toLowerCase() || /instagram/i.test(name)) return undefined;
  if (name.length > 80) name = name.slice(0, 80).trim();
  return name;
}

function confidenceFor(profile: Omit<DiscoveredProfile, 'dataConfidence' | 'verificationStatus'>) {
  let score = 25;
  if (profile.name) score += 10;
  if (profile.country) score += 15;
  if (profile.city) score += 5;
  if (profile.niche) score += 10;
  if (profile.followers != null) score += 20;
  if (profile.email) score += 15;
  return Math.min(100, score);
}

function verificationFor(confidence: number, profile: Partial<DiscoveredProfile>) {
  if (confidence >= 80 && profile.followers != null && profile.country && profile.niche) return 'VERIFIED' as const;
  if (confidence >= 50) return 'PARTIAL' as const;
  return 'DISCOVERED' as const;
}

function buildSearchPlans(brief: DiscoveryBrief) {
  const countries = brief.countries.length ? brief.countries : ['United States', 'United Kingdom'];
  const niches = brief.niches.length ? brief.niches : ['Fashion'];
  const target = Math.max(1, Math.min(brief.targetCount ?? 100, 500));
  const configuredRunCap = Number(process.env.BRAVE_MAX_REQUESTS_PER_RUN || 24);
  const runCap = Math.max(4, Math.min(Number.isFinite(configuredRunCap) ? Math.floor(configuredRunCap) : 24, 40));
  const desiredRequests = Math.min(runCap, Math.max(6, Math.ceil(target / 5)));
  const plans: SearchPlan[] = [];

  for (const country of countries) {
    const cities = citySeeds[country] ?? [country];
    const config = countrySearchConfig[country] ?? {};
    for (const niche of niches) {
      const terms = nicheSeeds[niche] ?? [niche];
      // Direct profile discovery.
      plans.push({ query: `site:instagram.com "${country}" "${terms[0]}" followers -inurl:/p/ -inurl:/reel/`, ...config });
      // Creator websites/articles often expose Instagram links even when Instagram blocks a datacenter fetch.
      plans.push({ query: `"${country}" "${terms[0]}" Instagram creator`, ...config });
      if (brief.emailRequired) plans.push({ query: `"${country}" "${terms[0]}" Instagram email contact`, ...config });

      for (let i = 0; i < Math.min(cities.length, 8); i++) {
        const term = terms[i % terms.length];
        plans.push({ query: `site:instagram.com "${cities[i]}" "${term}" followers -inurl:/p/ -inurl:/reel/`, ...config });
        if (i < 4) plans.push({ query: `"${cities[i]}" "${term}" Instagram blogger`, ...config });
      }
    }
  }

  const deduped = new Map<string, SearchPlan>();
  for (const plan of plans) deduped.set(`${plan.countryCode || ''}|${plan.query}`, plan);
  return [...deduped.values()].slice(0, desiredRequests);
}

function mergeSourceIntoProfile(
  handle: string,
  page: SourcePage,
  previous: DiscoveredProfile | undefined,
  brief: DiscoveryBrief
) {
  const evidenceItem = { query: 'public-source-fetch', title: page.title, url: page.url, snippet: page.snippet };
  const evidence = [...(previous?.evidence ?? []), evidenceItem]
    .filter((item, index, arr) => arr.findIndex(x => x.url === item.url) === index)
    .slice(-10);
  const evidenceText = evidence.map(e => `${e.title} ${e.snippet}`).join(' | ');
  const location = inferLocation(evidenceText, brief.countries);
  const niche = inferNiche(evidenceText, brief.niches);
  const directInstagram = extractInstagramHandle(page.url) === handle;

  const base = {
    handle,
    instagramUrl: `https://www.instagram.com/${handle}/`,
    name: previous?.name ?? (directInstagram ? cleanName(page.title, handle) : undefined),
    country: previous?.country ?? location.country,
    city: previous?.city ?? location.city,
    niche: previous?.niche ?? niche,
    followers: previous?.followers ?? extractFollowers(evidenceText),
    email: previous?.email ?? extractEmail(evidenceText),
    website: previous?.website ?? (!directInstagram ? page.url : undefined),
    source: 'public-source-fetch',
    sourceUrl: previous?.sourceUrl ?? page.url,
    sourceSnippet: evidence.map(e => e.snippet).filter(Boolean).join(' | ').slice(0, 2200) || undefined,
    evidence
  };
  const dataConfidence = confidenceFor(base);
  return { ...base, dataConfidence, verificationStatus: verificationFor(dataConfidence, base) } satisfies DiscoveredProfile;
}

async function fetchBatch(urls: string[]) {
  const unique = [...new Set(urls)].slice(0, Math.max(2, Number(process.env.SOURCE_FETCHES_PER_QUERY || 8)));
  const out: SourcePage[] = [];
  const concurrency = 4;
  for (let i = 0; i < unique.length; i += concurrency) {
    const pages = await Promise.all(unique.slice(i, i + concurrency).map(fetchPublicSource));
    out.push(...pages.filter((page): page is SourcePage => Boolean(page)));
  }
  return out;
}

export async function discoverFree(brief: DiscoveryBrief): Promise<DiscoveryRun> {
  const profiles = new Map<string, DiscoveredProfile>();
  const target = Math.max(1, Math.min(brief.targetCount ?? 100, 500));
  const plans = buildSearchPlans(brief);
  const delay = Math.max(80, Number(process.env.DISCOVERY_DELAY_MS || 180));
  let requestsUsedThisRun = 0;
  let quotaReached = false;

  for (const plan of plans) {
    let hits: SearchHit[] = [];
    try {
      hits = await searchBrave(plan);
      requestsUsedThisRun += 1;
    } catch (error) {
      if (error instanceof BraveQuotaError) {
        quotaReached = true;
        break;
      }
      throw error;
    }

    // Brave data remains ephemeral: only fetch the original public pages and persist information
    // independently obtained from those source pages.
    const pages = await fetchBatch(hits.map(hit => hit.url));
    for (const page of pages) {
      for (const handle of extractHandlesFromSource(page)) {
        profiles.set(handle, mergeSourceIntoProfile(handle, page, profiles.get(handle), brief));
      }
    }

    if (profiles.size >= target * 2.5) break;
    await sleep(delay);
  }

  return {
    profiles: [...profiles.values()]
      .sort((a, b) => b.dataConfidence - a.dataConfidence || (b.followers ?? 0) - (a.followers ?? 0))
      .slice(0, Math.min(target * 2, 500)),
    provider: 'Brave Search',
    requestsUsedThisRun,
    quotaReached
  };
}

function pickWebsite(pages: SourcePage[], handle: string) {
  for (const page of pages) {
    try {
      const u = new URL(page.url);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      if (nonCreatorWebsiteHosts.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) continue;
      if (`${page.title} ${page.text}`.toLowerCase().includes(handle.toLowerCase())) return u.toString();
    } catch {
      // Ignore malformed source URLs.
    }
  }
  return undefined;
}

export async function researchCreatorFree(handle: string, brief: DiscoveryBrief = { countries: [], niches: [] }) {
  const normalized = normalizeInstagramHandle(handle);
  if (!normalized) return null;

  const researchConfig = brief.countries[0] ? (countrySearchConfig[brief.countries[0]] ?? {}) : { searchLang: 'en' };
  const nicheTerm = brief.niches[0] || 'fashion';
  const plans: SearchPlan[] = [
    { query: `"@${normalized}" Instagram followers`, ...researchConfig },
    { query: `"@${normalized}" Instagram email contact`, ...researchConfig },
    { query: `"${normalized}" Instagram "${nicheTerm}" creator`, ...researchConfig },
    { query: `"${normalized}" (Linktree OR Beacons OR website) contact`, ...researchConfig }
  ];

  const sourcePages: SourcePage[] = [];
  for (const plan of plans) {
    let hits: SearchHit[] = [];
    try {
      hits = await searchBrave(plan);
    } catch (error) {
      if (error instanceof BraveQuotaError) break;
      throw error;
    }
    sourcePages.push(...await fetchBatch(hits.map(hit => hit.url).slice(0, 6)));
    await sleep(Math.max(80, Number(process.env.DISCOVERY_DELAY_MS || 180)));
  }

  const relevant = sourcePages.filter(page => {
    const direct = extractInstagramHandle(page.url);
    if (direct === normalized) return true;
    const handles = extractHandlesFromSource(page);
    return handles.includes(normalized) || `${page.title} ${page.text}`.toLowerCase().includes(normalized.toLowerCase());
  });
  if (!relevant.length) return null;

  const text = relevant.map(page => `${page.title} ${page.text}`).join(' | ');
  const loc = inferLocation(text, brief.countries);
  const niche = inferNiche(text, brief.niches);
  const followers = extractFollowers(text);
  const email = extractEmail(text);
  const instagramPage = relevant.find(page => extractInstagramHandle(page.url) === normalized);
  const name = instagramPage ? cleanName(instagramPage.title, normalized) : undefined;
  const website = pickWebsite(relevant, normalized);
  const evidence = relevant.slice(0, 12).map(page => ({
    query: 'public-source-fetch',
    title: page.title,
    url: page.url,
    snippet: page.snippet
  }));
  const base = {
    handle: normalized,
    instagramUrl: `https://www.instagram.com/${normalized}/`,
    name,
    country: loc.country,
    city: loc.city,
    niche,
    followers,
    email,
    website,
    source: 'public-source-deep-research',
    sourceUrl: instagramPage?.url ?? relevant[0]?.url,
    sourceSnippet: relevant.map(page => page.snippet).filter(Boolean).join(' | ').slice(0, 2400) || undefined,
    evidence
  };
  const dataConfidence = confidenceFor(base);
  return { ...base, dataConfidence, verificationStatus: verificationFor(dataConfidence, base) } satisfies DiscoveredProfile;
}
