export type CreatorStatus = 'CANDIDATE' | 'APPROVED' | 'VOIDED';

export type Creator = {
  id: string;
  name: string | null;
  handle: string;
  instagramUrl: string;
  country: string | null;
  city: string | null;
  niche: string | null;
  followers: number | null;
  engagementRate: number | null;
  avgLikes: number | null;
  avgReelViews: number | null;
  email: string | null;
  website?: string | null;
  lastPostAt: string | null;
  score: number;
  status: CreatorStatus;
  source?: string | null;
  sourceUrl?: string | null;
  sourceSnippet?: string | null;
  sourceEvidence?: unknown;
  dataConfidence?: number;
  verificationStatus?: string;
  notes?: string | null;
  voidReason?: string | null;
};

export type Stats = {
  total: number;
  candidates: number;
  approved: number;
  voided: number;
  exclusions: number;
  avgScore: number;
};

export type Brief = {
  name: string;
  countries: string[];
  niches: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagementRate: number | null;
  minAvgReelViews: number | null;
  emailRequired: boolean;
  activeWithinDays: number | null;
  targetCount: number;
};

export type Exclusion = {
  id: string;
  handle: string;
  type: 'USED' | 'VOIDED';
  reason?: string | null;
  sourceFile?: string | null;
  createdAt: string;
};


export type DiscoveryStatus = {
  provider: 'Brave Search';
  configured: boolean;
  monthKey: string;
  requestsUsed: number;
  monthlyBudget: number;
  remainingAppBudget: number;
};
