import { Check, ExternalLink, Mail, MoreHorizontal, RotateCcw, Search, X } from 'lucide-react';
import type { Creator } from '../lib/types';

const compact = (n: number | null) => {
  if (n == null) return '—';
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
};

export function ScorePill({ score }: { score: number }) {
  const cls = score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'low';
  return <span className={`score-pill ${cls}`}>{score.toFixed(1)}</span>;
}

function Confidence({ value = 0, status = '' }: { value?: number; status?: string }) {
  const cls = value >= 80 ? 'high' : value >= 50 ? 'mid' : 'low';
  const label = status === 'VERIFIED_FOR_BRIEF' ? 'brief verified' : `${value}% data`;
  return <span className={`confidence-pill ${cls}`}>{label}</span>;
}

export default function CreatorTable({
  creators,
  loading,
  search,
  onSearch,
  onOpen,
  onApprove,
  onVoid,
  onRestore,
  emptyText = 'No creators found.'
}: {
  creators: Creator[];
  loading?: boolean;
  search: string;
  onSearch: (value: string) => void;
  onOpen: (creator: Creator) => void;
  onApprove: (creator: Creator) => void;
  onVoid: (creator: Creator) => void;
  onRestore: (creator: Creator) => void;
  emptyText?: string;
}) {
  return <div className="table-card">
    <div className="table-toolbar">
      <div className="searchbox"><Search size={17} /><input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search name, handle, niche or email" /></div>
      <div className="toolbar-caption">{creators.length} creator{creators.length === 1 ? '' : 's'}</div>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr><th>Creator</th><th>Location</th><th>Niche</th><th>Followers</th><th>Engagement</th><th>Reels</th><th>Contact</th><th>Fit score</th><th></th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={9}><div className="empty-row"><span className="spinner" /> Loading creators…</div></td></tr> :
          creators.length === 0 ? <tr><td colSpan={9}><div className="empty-row">{emptyText}</div></td></tr> :
          creators.map(c => <tr key={c.id} onClick={() => onOpen(c)} className="creator-row">
            <td><div className="creator-cell"><div className="avatar">{(c.name || c.handle).slice(0, 1).toUpperCase()}</div><div><div className="creator-name">{c.name || c.handle}</div><a onClick={e => e.stopPropagation()} href={c.instagramUrl} target="_blank" rel="noreferrer">@{c.handle} <ExternalLink size={11}/></a></div></div></td>
            <td><div className="primary-cell">{c.country || 'Unknown'}</div><div className="muted-cell">{c.city || ''}</div></td>
            <td><span className="tag subtle">{c.niche || 'Unclassified'}</span></td>
            <td className="metric-cell">{compact(c.followers)}</td>
            <td className="metric-cell">{c.engagementRate != null ? `${c.engagementRate.toFixed(1)}%` : '—'}</td>
            <td className="metric-cell">{compact(c.avgReelViews)}</td>
            <td>{c.email ? <span className="contact-ok"><Mail size={14}/> Email</span> : <span className="muted-cell">No email</span>}</td>
            <td><div className="score-stack"><ScorePill score={c.score}/><Confidence value={c.dataConfidence || 0} status={c.verificationStatus || ''}/></div></td>
            <td onClick={e => e.stopPropagation()}>
              <div className="row-actions">
                {c.status === 'CANDIDATE' && <><button className="icon-btn good" title="Approve" onClick={() => onApprove(c)}><Check size={16}/></button><button className="icon-btn bad" title="Void" onClick={() => onVoid(c)}><X size={16}/></button></>}
                {c.status === 'VOIDED' && <button className="icon-btn" title="Restore to candidates" onClick={() => onRestore(c)}><RotateCcw size={15}/></button>}
                {c.status === 'APPROVED' && <button className="icon-btn" title="Details" onClick={() => onOpen(c)}><MoreHorizontal size={16}/></button>}
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
