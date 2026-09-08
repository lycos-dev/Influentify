export type ScoreInput = {
  followers?: number | null;
  engagementRate?: number | null;
  avgReelViews?: number | null;
  lastPostAt?: Date | string | null;
  country?: string | null;
  niche?: string | null;
  email?: string | null;
  dataConfidence?: number | null;
};

export type ScoreBrief = {
  countries?: string[];
  niches?: string[];
  minFollowers?: number | null;
  maxFollowers?: number | null;
  minEngagementRate?: number | null;
  minAvgReelViews?: number | null;
  emailRequired?: boolean;
  activeWithinDays?: number | null;
};

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

export function scoreCreator(c: ScoreInput, brief: ScoreBrief = {}) {
  let score = 0;

  // Follower strength: 20 points. Favor strong counts while respecting campaign bounds.
  const followers = c.followers ?? 0;
  if (followers > 0) {
    const floor = brief.minFollowers ?? 10_000;
    const ceiling = brief.maxFollowers ?? Math.max(floor * 10, 500_000);
    score += 20 * clamp((Math.log10(Math.max(followers, floor)) - Math.log10(Math.max(floor, 1))) /
      Math.max(0.5, Math.log10(Math.max(ceiling, floor + 1)) - Math.log10(Math.max(floor, 1))));
  }

  // Engagement: 25 points. 5%+ receives full credit.
  if (c.engagementRate != null) score += 25 * clamp(c.engagementRate / 5);

  // Reels performance: 20 points. View/follower ratio is more useful than raw views alone.
  if (c.avgReelViews != null && followers > 0) {
    score += 20 * clamp(c.avgReelViews / followers, 0, 1);
  } else if (c.avgReelViews != null) {
    score += 20 * clamp(c.avgReelViews / 100_000);
  }

  // Niche match: 15 points.
  const creatorNiche = (c.niche ?? '').toLowerCase();
  const niches = (brief.niches ?? []).map(n => n.toLowerCase());
  if (niches.length === 0) score += creatorNiche ? 10 : 0;
  else if (niches.some(n => creatorNiche.includes(n) || n.includes(creatorNiche))) score += 15;

  // Recency: 10 points.
  if (c.lastPostAt) {
    const days = (Date.now() - new Date(c.lastPostAt).getTime()) / 86_400_000;
    const activeWindow = brief.activeWithinDays ?? 30;
    score += 10 * clamp(1 - days / Math.max(activeWindow, 1));
  }

  // Contactability: 5 points.
  if (c.email) score += 5;

  // Country match: 5 points.
  const countries = (brief.countries ?? []).map(x => x.toLowerCase());
  if (!countries.length) score += c.country ? 3 : 0;
  else if (c.country && countries.includes(c.country.toLowerCase())) score += 5;

  return Math.round(score * 10) / 10;
}

/** Strict qualification: every requested field must be known and satisfy the brief. */
export function creatorPassesBrief(c: ScoreInput, brief: ScoreBrief = {}) {
  if (brief.countries?.length && (!c.country || !brief.countries.map(x => x.toLowerCase()).includes(c.country.toLowerCase()))) return false;
  if (brief.niches?.length) {
    const n = (c.niche ?? '').toLowerCase().trim();
    if (!n || !brief.niches.some(x => n.includes(x.toLowerCase()) || x.toLowerCase().includes(n))) return false;
  }
  if (brief.minFollowers != null && (c.followers == null || c.followers < brief.minFollowers)) return false;
  if (brief.maxFollowers != null && (c.followers == null || c.followers > brief.maxFollowers)) return false;
  if (brief.minEngagementRate != null && (c.engagementRate == null || c.engagementRate < brief.minEngagementRate)) return false;
  if (brief.minAvgReelViews != null && (c.avgReelViews == null || c.avgReelViews < brief.minAvgReelViews)) return false;
  if (brief.emailRequired && !c.email) return false;
  if (brief.activeWithinDays != null) {
    if (!c.lastPostAt) return false;
    const days = (Date.now() - new Date(c.lastPostAt).getTime()) / 86_400_000;
    if (days > brief.activeWithinDays) return false;
  }
  return true;
}

/**
 * Discovery qualification: known data may reject a creator, but missing public-web data does not.
 * This is important for a no-paid-API workflow: unknown metrics are surfaced for review rather than
 * being silently discarded.
 */
export function creatorPotentiallyMatchesBrief(c: ScoreInput, brief: ScoreBrief = {}) {
  if (brief.countries?.length && c.country && !brief.countries.map(x => x.toLowerCase()).includes(c.country.toLowerCase())) return false;
  if (brief.niches?.length && c.niche) {
    const n = c.niche.toLowerCase().trim();
    if (n && !brief.niches.some(x => n.includes(x.toLowerCase()) || x.toLowerCase().includes(n))) return false;
  }
  if (brief.minFollowers != null && c.followers != null && c.followers < brief.minFollowers) return false;
  if (brief.maxFollowers != null && c.followers != null && c.followers > brief.maxFollowers) return false;
  if (brief.minEngagementRate != null && c.engagementRate != null && c.engagementRate < brief.minEngagementRate) return false;
  if (brief.minAvgReelViews != null && c.avgReelViews != null && c.avgReelViews < brief.minAvgReelViews) return false;
  if (brief.activeWithinDays != null && c.lastPostAt) {
    const days = (Date.now() - new Date(c.lastPostAt).getTime()) / 86_400_000;
    if (days > brief.activeWithinDays) return false;
  }
  return true;
}

export function requiredFieldCoverage(c: ScoreInput, brief: ScoreBrief = {}) {
  const checks: boolean[] = [];
  if (brief.countries?.length) checks.push(Boolean(c.country));
  if (brief.niches?.length) checks.push(Boolean(c.niche));
  if (brief.minFollowers != null || brief.maxFollowers != null) checks.push(c.followers != null);
  if (brief.minEngagementRate != null) checks.push(c.engagementRate != null);
  if (brief.minAvgReelViews != null) checks.push(c.avgReelViews != null);
  if (brief.emailRequired) checks.push(Boolean(c.email));
  if (brief.activeWithinDays != null) checks.push(Boolean(c.lastPostAt));
  if (!checks.length) return 100;
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
