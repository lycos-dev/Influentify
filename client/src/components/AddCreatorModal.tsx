import { Plus, X } from 'lucide-react';
import { useState } from 'react';

const initial = { name:'', handle:'', country:'', city:'', niche:'', followers:'', engagementRate:'', avgLikes:'', avgReelViews:'', email:'', lastPostAt:'', notes:'' };

export default function AddCreatorModal({ open, onClose, onCreate }: { open: boolean; onClose: ()=>void; onCreate: (data: Record<string, unknown>) => Promise<void> }) {
  const [form,setForm] = useState(initial); const [saving,setSaving] = useState(false);
  if (!open) return null;
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
  const submit=async()=>{ setSaving(true); try { const data:Record<string,unknown>={...form}; ['followers','engagementRate','avgLikes','avgReelViews'].forEach(k=>data[k]=(form as any)[k] ? Number((form as any)[k]) : null); data.lastPostAt=form.lastPostAt||null; await onCreate(data); setForm(initial); onClose(); } finally { setSaving(false); }};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal">
    <div className="modal-head"><div><h3>Add creator</h3><p>Add a profile manually. Duplicate and exclusion checks happen automatically.</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
    <div className="modal-grid">
      {[['name','Name','e.g. Sophie Lane'],['handle','Instagram username or URL','@sophielane'],['country','Country','United Kingdom'],['city','City','London'],['niche','Niche','Fashion / Outfits'],['followers','Followers','78000'],['engagementRate','Engagement %','4.8'],['avgLikes','Avg likes','4100'],['avgReelViews','Avg Reel views','62000'],['email','Public email','creator@example.com']].map(([k,l,p])=><label key={k}><span>{l}</span><input value={(form as any)[k]} placeholder={p} onChange={e=>set(k,e.target.value)}/></label>)}
      <label><span>Last post</span><input type="date" value={form.lastPostAt} onChange={e=>set('lastPostAt',e.target.value)}/></label>
      <label className="span-2"><span>Notes</span><textarea rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional research notes"/></label>
    </div>
    <div className="form-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving||!form.handle} onClick={submit}><Plus size={16}/>{saving?'Adding…':'Add creator'}</button></div>
  </div></div>
}
