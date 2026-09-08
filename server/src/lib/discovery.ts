import { normalizeInstagramHandle } from './handles.js';

export type DiscoveryBrief = {
  countries: string[];
  niches: string[];
  minFollowers?: number | null;
  maxFollowers?: number | null;
  targetCount?: number;
};

export type DiscoveredProfile = {
  handle: string;
  instagramUrl: string;
  name?: string;
  country?: string;
  niche?: string;
  source: string;
  sourceSnippet?: string;
};

function buildQueries(brief: DiscoveryBrief) {
  const countries = brief.countries.length ? brief.countries : [''];
  const niches = brief.niches.length ? brief.niches : ['fashion creator'];
  const phrases = ['instagram influencer', 'instagram creator', 'fashion blogger', 'outfit creator'];
  const queries: string[] = [];
  for (const country of countries) {
    for (const niche of niches) {
      for (const phrase of phrases.slice(0, 2)) {
        queries.push(`site:instagram.com ${country} ${niche} ${phrase} -inurl:/p/ -inurl:/reel/`);
      }
    }
  }
  return [...new Set(queries)].slice(0, 8);
}

export async function discoverWithSerper(brief: DiscoveryBrief): Promise<DiscoveredProfile[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];

  const profiles = new Map<string, DiscoveredProfile>();
  for (const q of buildQueries(brief)) {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, num: 20 })
    });
    if (!res.ok) continue;
    const data = await res.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
    for (const item of data.organic ?? []) {
      const link = item.link ?? '';
      const match = link.match(/instagram\.com\/([^/?#]+)/i);
      const handle = normalizeInstagramHandle(match?.[1] ?? '');
      if (!handle) continue;
      const blockedPaths = new Set(['p', 'reel', 'reels', 'explore', 'accounts', 'stories']);
      if (blockedPaths.has(handle)) continue;
      profiles.set(handle, {
        handle,
        instagramUrl: `https://www.instagram.com/${handle}/`,
        name: item.title?.split('•')[0]?.split('(')[0]?.trim(),
        country: brief.countries.length === 1 ? brief.countries[0] : undefined,
        niche: brief.niches[0],
        source: 'serper',
        sourceSnippet: item.snippet
      });
    }
    if (profiles.size >= (brief.targetCount ?? 100)) break;
  }
  return [...profiles.values()].slice(0, brief.targetCount ?? 100);
}
