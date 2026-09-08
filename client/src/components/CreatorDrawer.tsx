import { Check, ExternalLink, Mail, MapPin, Pencil, RotateCcw, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Creator } from '../lib/types';
import { ScorePill } from './CreatorTable';

const numberOrBlank = (value: number | null) => value == null ? '' : String(value);

export default function CreatorDrawer({ creator, onClose, onApprove, onVoid, onRestore, onSave }: {
  creator: Creator | null;
  onClose: () => void;
  onApprove: (c: Creator) => void;
  onVoid: (c: Creator) => void;
  onRestore: (c: Creator) => void;
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!creator) return;
    setEdit(false);
    setForm({
      name: creator.name || '', handle: creator.handle, country: creator.country || '', city: creator.city || '', niche: creator.niche || '',
      followers: numberOrBlank(creator.followers), engagementRate: numberOrBlank(creator.engagementRate), avgLikes: numberOrBlank(creator.avgLikes),
      avgReelViews: numberOrBlank(creator.avgReelViews), email: creator.email || '', lastPostAt: creator.lastPostAt ? creator.lastPostAt.slice(0, 10) : '', notes: creator.notes || ''
    });
  }, [creator]);

  if (!creator) return null;
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const save = async () => {
    setSaving(true);
    const numeric = ['followers', 'engagementRate', 'avgLikes', 'avgReelViews'];
    const payload: Record<string, unknown> = { ...form };
    numeric.forEach(k => payload[k] = form[k] === '' ? null : Number(form[k]));
    payload.lastPostAt = form.lastPostAt || null;
    try { await onSave(creator.id, payload); setEdit(false); } finally { setSaving(false); }
  };

  return <div className="drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="drawer">
      <div className="drawer-head"><div><span className={`status-dot ${creator.status.toLowerCase()}`}/>{creator.status.toLowerCase()}</div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
      <div className="profile-hero">
        <div className="avatar xl">{(creator.name || creator.handle).slice(0,1).toUpperCase()}</div>
        <div className="grow"><h2>{creator.name || creator.handle}</h2><a href={creator.instagramUrl} target="_blank" rel="noreferrer">@{creator.handle} <ExternalLink size={12}/></a></div>
        <ScorePill score={creator.score}/>
      </div>

      {!edit ? <>
        <div className="info-grid">
          <div><span>Followers</span><strong><Users size={15}/>{creator.followers?.toLocaleString() || '—'}</strong></div>
          <div><span>Engagement</span><strong>{creator.engagementRate != null ? `${creator.engagementRate}%` : '—'}</strong></div>
          <div><span>Avg. Reels</span><strong>{creator.avgReelViews?.toLocaleString() || '—'}</strong></div>
          <div><span>Avg. Likes</span><strong>{creator.avgLikes?.toLocaleString() || '—'}</strong></div>
        </div>
        <div className="detail-section"><label>Creator profile</label><div className="detail-line"><MapPin size={15}/>{[creator.city, creator.country].filter(Boolean).join(', ') || 'Location not verified'}</div><div className="detail-line"><span className="mini-icon">#</span>{creator.niche || 'Niche not classified'}</div><div className="detail-line"><Mail size={15}/>{creator.email || 'No public email saved'}</div></div>
        {creator.sourceSnippet && <div className="detail-section"><label>Discovery evidence</label><p className="snippet">{creator.sourceSnippet}</p></div>}
        {creator.voidReason && <div className="warning-box"><strong>Void reason</strong><span>{creator.voidReason}</span></div>}
        {creator.notes && <div className="detail-section"><label>Notes</label><p>{creator.notes}</p></div>}
        <button className="secondary wide" onClick={() => setEdit(true)}><Pencil size={15}/> Edit creator data</button>
      </> : <div className="edit-form">
        {[['name','Name'],['handle','Instagram username'],['country','Country'],['city','City'],['niche','Niche'],['followers','Followers'],['engagementRate','Engagement %'],['avgLikes','Avg likes'],['avgReelViews','Avg Reel views'],['email','Public email'],['lastPostAt','Last post date']].map(([key,label]) => <label key={key}><span>{label}</span><input type={key === 'lastPostAt' ? 'date' : 'text'} value={form[key] || ''} onChange={e => set(key,e.target.value)}/></label>)}
        <label><span>Notes</span><textarea rows={4} value={form.notes || ''} onChange={e=>set('notes',e.target.value)}/></label>
        <div className="form-actions"><button className="secondary" onClick={() => setEdit(false)}>Cancel</button><button className="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </div>}

      {!edit && <div className="drawer-actions">
        {creator.status === 'CANDIDATE' && <><button className="approve-btn" onClick={() => onApprove(creator)}><Check size={17}/> Approve creator</button><button className="void-btn" onClick={() => onVoid(creator)}><X size={17}/> Void</button></>}
        {creator.status === 'VOIDED' && <button className="secondary wide" onClick={() => onRestore(creator)}><RotateCcw size={16}/> Restore to candidates</button>}
      </div>}
    </aside>
  </div>;
}
