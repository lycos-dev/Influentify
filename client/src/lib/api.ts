import type { Brief, Creator, CreatorStatus, Exclusion, Stats } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.error || data || `Request failed (${response.status})`);
  return data as T;
}

export const api = {
  stats: () => request<Stats>('/api/stats'),
  creators: (status?: CreatorStatus, search = '') => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (search) qs.set('search', search);
    qs.set('take', '500');
    return request<Creator[]>(`/api/creators?${qs}`);
  },
  createCreator: (payload: Record<string, unknown>) => request<Creator>('/api/creators', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }),
  updateCreator: (id: string, payload: Record<string, unknown>) => request<Creator>(`/api/creators/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }),
  approve: (id: string) => request<Creator>(`/api/creators/${id}/approve`, { method: 'POST' }),
  void: (id: string, reason: string) => request<Creator>(`/api/creators/${id}/void`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason })
  }),
  candidate: (id: string) => request<Creator>(`/api/creators/${id}/candidate`, { method: 'POST' }),
  discover: (brief: Brief) => request<{ provider: string; newlyAdded: number; existingMatches: number; results: Creator[]; note: string }>('/api/discovery/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(brief)
  }),
  exclusions: (type?: 'USED' | 'VOIDED') => request<Exclusion[]>(`/api/exclusions${type ? `?type=${type}` : ''}`),
  importExclusions: (file: File, type: 'USED' | 'VOIDED') => {
    const body = new FormData(); body.append('file', file); body.append('type', type);
    return request<{ scanned: number; inserted: number; alreadyKnown: number; type: string }>('/api/exclusions/import', { method: 'POST', body });
  }
};
