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

type SearchHit = { title: string; url: string; snippet: string; query: string };

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function unwrapDuckDuckGoUrl(raw: string) {
  const decoded = decodeHtml(raw);
  try {
    const absolute = decoded.startsWith('//') ? `https:${decoded}` : decoded;
    const u = new URL(absolute, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : u.toString();
  } catch {
    return decoded;
  }
}

function parseDuckDuckGoHtml(html: string, query: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const resultRegex = /<div[^>]+class="[^"]*result[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*result[^"]*"|<div[^>]+class="nav-link|<\/body>)/gi;
  let block: RegExpExecArray | null;
  while ((block = resultRegex.exec(html)) !== null) {
    const chunk = block[1];
    const link = chunk.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      ?? chunk.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const snippetMatch = chunk.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    const url = unwrapDuckDuckGoUrl(link[1]);
    hits.push({
      title: stripTags(link[2]),
      url,
      snippet: stripTags(snippetMatch?.[1] ?? ''),
      query
    });
  }

  // Fallback for markup changes: capture result__a anchors even if block wrappers change.
  if (!hits.length) {
    const anchorRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(html)) !== null) {
      hits.push({ title: stripTags(match[2]), url: unwrapDuckDuckGoUrl(match[1]), snippet: '', query });
    }
  }
  return hits;
}

async function searchDuckDuckGo(query: string): Promise<SearchHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.DISCOVERY_HTTP_TIMEOUT_MS || 12_000));
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Influentify/2.0; +creator-research)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseDuckDuckGoHtml(html, query);
  } catch {
    return [];
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
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m?.[0]?.toLowerCase();
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
  let score = 25; // direct Instagram profile URL found through public search
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

function buildQueries(brief: DiscoveryBrief) {
  const countries = brief.countries.length ? brief.countries : ['United States', 'United Kingdom'];
  const niches = brief.niches.length ? brief.niches : ['Fashion'];
  const target = Math.max(1, Math.min(brief.targetCount ?? 100, 500));
  const maxQueries = Math.min(30, Math.max(10, Math.ceil(target / 5)));
  const queries: string[] = [];

  for (const country of countries) {
    const cities = citySeeds[country] ?? [country];
    for (const niche of niches) {
      const terms = nicheSeeds[niche] ?? [niche];
      // Country-level broad searches.
      queries.push(`site:instagram.com "${country}" "${terms[0]}" followers -inurl:/p/ -inurl:/reel/`);
      if (brief.emailRequired) queries.push(`site:instagram.com "${country}" "${terms[0]}" "gmail.com" -inurl:/p/ -inurl:/reel/`);

      // City diversification avoids getting the same globally popular creators repeatedly.
      for (let i = 0; i < Math.min(cities.length, 6); i++) {
        const term = terms[i % terms.length];
        queries.push(`site:instagram.com "${cities[i]}" "${term}" creator followers -inurl:/p/ -inurl:/reel/`);
      }
    }
  }

  return [...new Set(queries)].slice(0, maxQueries);
}

export async function discoverFree(brief: DiscoveryBrief): Promise<DiscoveredProfile[]> {
  const profiles = new Map<string, DiscoveredProfile>();
  const target = Math.max(1, Math.min(brief.targetCount ?? 100, 500));
  const queries = buildQueries(brief);
  const delay = Math.max(250, Number(process.env.DISCOVERY_DELAY_MS || 650));
  let consecutiveEmpty = 0;

  for (const query of queries) {
    const hits = await searchDuckDuckGo(query);
    if (!hits.length) consecutiveEmpty += 1;
    else consecutiveEmpty = 0;

    for (const hit of hits) {
      const handle = extractInstagramHandle(hit.url);
      if (!handle) continue;
      const text = `${hit.title} ${hit.snippet}`;
      const loc = inferLocation(text, brief.countries);
      const niche = inferNiche(text, brief.niches);
      const followers = extractFollowers(text);
      const email = extractEmail(text);
      const existing = profiles.get(handle);
      const evidence = existing?.evidence ?? [];
      evidence.push(hit);

      const base = {
        handle,
        instagramUrl: `https://www.instagram.com/${handle}/`,
        name: existing?.name ?? cleanName(hit.title, handle),
        country: existing?.country ?? loc.country,
        city: existing?.city ?? loc.city,
        niche: existing?.niche ?? niche,
        followers: existing?.followers ?? followers,
        email: existing?.email ?? email,
        website: existing?.website,
        source: 'duckduckgo-public-web',
        sourceUrl: existing?.sourceUrl ?? hit.url,
        sourceSnippet: [existing?.sourceSnippet, hit.snippet].filter(Boolean).join(' | ').slice(0, 1400) || undefined,
        evidence: evidence.slice(0, 8)
      };
      const dataConfidence = confidenceFor(base);
      profiles.set(handle, {
        ...base,
        dataConfidence,
        verificationStatus: verificationFor(dataConfidence, base)
      });
    }

    // Over-discover because exclusions and hard mismatches will remove a lot of candidates later.
    if (profiles.size >= target * 2.2) break;
    if (consecutiveEmpty >= 4) break;
    await sleep(delay);
  }

  return [...profiles.values()]
    .sort((a, b) => b.dataConfidence - a.dataConfidence || (b.followers ?? 0) - (a.followers ?? 0))
    .slice(0, Math.min(target * 2, 500));
}

export async function researchCreatorFree(handle: string, brief: DiscoveryBrief = { countries: [], niches: [] }) {
  const normalized = normalizeInstagramHandle(handle);
  if (!normalized) return null;
  const queries = [
    `"@${normalized}" Instagram followers`,
    `"@${normalized}" email contact creator`,
    `"${normalized}" fashion creator Instagram`
  ];
  const hits: SearchHit[] = [];
  for (const q of queries) {
    hits.push(...await searchDuckDuckGo(q));
    await sleep(Math.max(250, Number(process.env.DISCOVERY_DELAY_MS || 650)));
  }
  const relevant = hits.filter(h => h.url.includes(normalized) || `${h.title} ${h.snippet}`.toLowerCase().includes(normalized));
  const text = relevant.map(h => `${h.title} ${h.snippet}`).join(' | ');
  const loc = inferLocation(text, brief.countries);
  const niche = inferNiche(text, brief.niches);
  const followers = extractFollowers(text);
  const email = extractEmail(text);
  const instagramHit = relevant.find(h => /instagram\.com/i.test(h.url));
  const name = instagramHit ? cleanName(instagramHit.title, normalized) : undefined;
  const base = {
    handle: normalized,
    instagramUrl: `https://www.instagram.com/${normalized}/`,
    name,
    country: loc.country,
    city: loc.city,
    niche,
    followers,
    email,
    website: undefined,
    source: 'duckduckgo-deep-research',
    sourceUrl: instagramHit?.url,
    sourceSnippet: relevant.map(h => h.snippet).filter(Boolean).join(' | ').slice(0, 1800) || undefined,
    evidence: relevant.slice(0, 10)
  };
  const dataConfidence = confidenceFor(base);
  return { ...base, dataConfidence, verificationStatus: verificationFor(dataConfidence, base) } satisfies DiscoveredProfile;
}
