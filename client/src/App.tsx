import { useEffect, useMemo, useState } from 'react';
import {
  ArchiveX, BarChart3, CheckCircle2, ChevronRight, Database, Download, FileUp, Filter,
  LayoutDashboard, Plus, Search, Sparkles, Target, UploadCloud, UserCheck, Users, XCircle
} from 'lucide-react';
import CreatorTable from './components/CreatorTable';
import CreatorDrawer from './components/CreatorDrawer';
import AddCreatorModal from './components/AddCreatorModal';
import { api } from './lib/api';
import type { Brief, Creator, CreatorStatus, Exclusion, Stats } from './lib/types';

type View = 'dashboard' | 'discover' | 'candidates' | 'approved' | 'voided' | 'vault';

const emptyStats: Stats = { total:0, candidates:0, approved:0, voided:0, exclusions:0, avgScore:0 };
const defaultBrief: Brief = {
  name: 'Hacoo Fashion Creators', countries: ['United States', 'United Kingdom'], niches: ['Fashion'],
  minFollowers: 10000, maxFollowers: null, minEngagementRate: 2, minAvgReelViews: null,
  emailRequired: true, activeWithinDays: 30, targetCount: 100
};

const nav = [
  { id:'dashboard' as View, label:'Overview', icon:LayoutDashboard },
  { id:'discover' as View, label:'Discover', icon:Sparkles },
  { id:'candidates' as View, label:'Candidates', icon:Users },
  { id:'approved' as View, label:'Approved', icon:UserCheck },
  { id:'voided' as View, label:'Voided', icon:ArchiveX },
  { id:'vault' as View, label:'Data Vault', icon:Database }
];

function fmt(n:number){ return Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n); }

export default function App(){
  const [view,setView]=useState<View>('dashboard');
  const [stats,setStats]=useState<Stats>(emptyStats);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<Creator|null>(null);
  const [addOpen,setAddOpen]=useState(false);
  const [toast,setToast]=useState<{type:'ok'|'bad',text:string}|null>(null);
  const [brief,setBrief]=useState<Brief>(defaultBrief);
  const [discoveryNote,setDiscoveryNote]=useState('');
  const [discovering,setDiscovering]=useState(false);
  const [exclusions,setExclusions]=useState<Exclusion[]>([]);
  const [importing,setImporting]=useState<'USED'|'VOIDED'|null>(null);

  const statusForView = (v:View): CreatorStatus|undefined => v==='candidates'?'CANDIDATE':v==='approved'?'APPROVED':v==='voided'?'VOIDED':undefined;
  const showToast=(text:string,type:'ok'|'bad'='ok')=>{setToast({text,type});setTimeout(()=>setToast(null),3200)};

  async function refreshStats(){ try{setStats(await api.stats())}catch{} }
  async function loadCreators(status?:CreatorStatus){ setLoading(true); try{setCreators(await api.creators(status,search))}catch(e:any){showToast(e.message,'bad')}finally{setLoading(false)} }
  async function loadVault(){ try{setExclusions(await api.exclusions())}catch(e:any){showToast(e.message,'bad')} }

  useEffect(()=>{ refreshStats(); },[]);
  useEffect(()=>{
    const status=statusForView(view);
    if(status || view==='dashboard') loadCreators(status);
    if(view==='vault') loadVault();
  },[view]);
  useEffect(()=>{
    if(!['candidates','approved','voided'].includes(view)) return;
    const t=setTimeout(()=>loadCreators(statusForView(view)),250); return()=>clearTimeout(t);
  },[search]);

  const topCreators=useMemo(()=>creators.filter(c=>c.status!=='VOIDED').slice(0,6),[creators]);

  async function approve(c:Creator){ try{await api.approve(c.id);setSelected(null);showToast(`@${c.handle} approved and added to the used list.`);await Promise.all([refreshStats(),loadCreators(statusForView(view))]);}catch(e:any){showToast(e.message,'bad')} }
  async function voidCreator(c:Creator){ const reason=window.prompt(`Why are you voiding @${c.handle}?`,'Not a campaign fit'); if(reason===null)return; try{await api.void(c.id,reason);setSelected(null);showToast(`@${c.handle} moved to Voided.`);await Promise.all([refreshStats(),loadCreators(statusForView(view))]);}catch(e:any){showToast(e.message,'bad')} }
  async function restore(c:Creator){ try{await api.candidate(c.id);setSelected(null);showToast(`@${c.handle} restored to Candidates.`);await Promise.all([refreshStats(),loadCreators(statusForView(view))]);}catch(e:any){showToast(e.message,'bad')} }
  async function saveCreator(id:string,payload:Record<string,unknown>){ try{const updated=await api.updateCreator(id,payload);setSelected(updated);showToast('Creator updated.');await Promise.all([refreshStats(),loadCreators(statusForView(view))]);}catch(e:any){showToast(e.message,'bad');throw e} }
  async function createCreator(payload:Record<string,unknown>){ try{await api.createCreator(payload);showToast('Creator added to Candidates.');await Promise.all([refreshStats(),loadCreators(statusForView(view))]);}catch(e:any){showToast(e.message,'bad');throw e} }

  async function discover(){ setDiscovering(true);setDiscoveryNote(''); try{const r=await api.discover(brief);setCreators(r.results);setDiscoveryNote(`${r.note} ${r.newlyAdded} new profile${r.newlyAdded===1?'':'s'} added; ${r.results.length} current matches ranked.`);showToast(`Discovery finished: ${r.results.length} matches.`);await refreshStats();}catch(e:any){showToast(e.message,'bad')}finally{setDiscovering(false)} }

  async function importFile(file:File,type:'USED'|'VOIDED'){ setImporting(type); try{const r=await api.importExclusions(file,type);showToast(`${r.inserted} new ${type.toLowerCase()} handles imported (${r.alreadyKnown} already known).`);await Promise.all([loadVault(),refreshStats()]);}catch(e:any){showToast(e.message,'bad')}finally{setImporting(null)} }

  const updateBrief=(key:keyof Brief,value:any)=>setBrief(b=>({...b,[key]:value}));
  const title = nav.find(n=>n.id===view)?.label || 'Influencer Reach';

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">IR</div><div><strong>Influencer Reach</strong><span>Creator intelligence</span></div></div>
      <nav>{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={view===item.id?'active':''} onClick={()=>{setSearch('');setView(item.id)}}><Icon size={18}/><span>{item.label}</span>{item.id==='candidates'&&stats.candidates>0?<em>{stats.candidates}</em>:null}</button>})}</nav>
      <div className="sidebar-foot"><div className="railway-badge"><span className="pulse"/>Railway-ready</div><p>Deterministic de-duplication<br/>No AI required</p></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><div className="eyebrow">CREATOR OPERATIONS</div><h1>{title}</h1></div><div className="top-actions"><button className="secondary" onClick={()=>setAddOpen(true)}><Plus size={16}/> Add creator</button><a className="primary linkbtn" href="/api/export.xlsx?status=APPROVED"><Download size={16}/> Export approved</a></div></header>

      {view==='dashboard' && <section className="page dashboard-page">
        <div className="hero-card"><div><span className="kicker"><Sparkles size={14}/> Influencer sourcing workspace</span><h2>Build cleaner creator lists,<br/>without finding the same person twice.</h2><p>Search, qualify, approve, void, and export creators from one source of truth.</p><button className="primary hero-cta" onClick={()=>setView('discover')}>Start creator discovery <ChevronRight size={17}/></button></div><div className="hero-orbit"><div className="orbit o1">Verified<br/><strong>Emails</strong></div><div className="orbit o2">Exact<br/><strong>Dedupe</strong></div><div className="orbit o3">Ranked<br/><strong>Fit</strong></div><div className="center-score"><span>Pipeline</span><strong>{stats.total}</strong><small>creators</small></div></div></div>

        <div className="stat-grid">
          <div className="stat-card"><div className="stat-icon"><Users size={19}/></div><span>Candidate pool</span><strong>{stats.candidates.toLocaleString()}</strong><small>Awaiting review</small></div>
          <div className="stat-card"><div className="stat-icon"><CheckCircle2 size={19}/></div><span>Approved creators</span><strong>{stats.approved.toLocaleString()}</strong><small>Protected from future duplicates</small></div>
          <div className="stat-card"><div className="stat-icon"><XCircle size={19}/></div><span>Voided profiles</span><strong>{stats.voided.toLocaleString()}</strong><small>Excluded from discovery</small></div>
          <div className="stat-card"><div className="stat-icon"><BarChart3 size={19}/></div><span>Average fit score</span><strong>{stats.avgScore.toFixed(1)}</strong><small>Across active records</small></div>
        </div>

        <div className="dashboard-grid">
          <div className="panel"><div className="panel-head"><div><h3>Top creator candidates</h3><p>Highest-ranked profiles in your current database.</p></div><button className="text-btn" onClick={()=>setView('candidates')}>View all</button></div>
            <div className="mini-list">{topCreators.length?topCreators.map((c,i)=><button key={c.id} onClick={()=>setSelected(c)}><span className="rank">{String(i+1).padStart(2,'0')}</span><div className="avatar">{(c.name||c.handle)[0].toUpperCase()}</div><div className="mini-name"><strong>{c.name||c.handle}</strong><span>@{c.handle}</span></div><div className="mini-metric"><strong>{c.followers?fmt(c.followers):'—'}</strong><span>followers</span></div><div className="mini-score">{c.score.toFixed(1)}</div></button>):<div className="empty-panel">Add or discover creators to populate your shortlist.</div>}</div>
          </div>
          <div className="panel pipeline-panel"><div className="panel-head"><div><h3>List health</h3><p>Your exclusion memory prevents repeat work.</p></div></div>
            <div className="ring-wrap"><div className="ring" style={{'--pct':`${Math.min(100,stats.total?((stats.approved+stats.voided)/stats.total*100):0)}%`} as any}><div><strong>{stats.total?Math.round((stats.approved+stats.voided)/stats.total*100):0}%</strong><span>reviewed</span></div></div></div>
            <div className="health-rows"><div><span><i className="dot candidate"/>Candidates</span><strong>{stats.candidates}</strong></div><div><span><i className="dot approved"/>Approved</span><strong>{stats.approved}</strong></div><div><span><i className="dot voided"/>Voided</span><strong>{stats.voided}</strong></div><div><span><i className="dot excluded"/>Saved exclusions</span><strong>{stats.exclusions}</strong></div></div>
          </div>
        </div>
      </section>}

      {view==='discover' && <section className="page discover-page">
        <div className="discover-layout">
          <div className="brief-card">
            <div className="section-title"><div className="section-icon"><Target size={19}/></div><div><h2>Campaign brief</h2><p>Define the exact creators you want to source.</p></div></div>
            <div className="form-stack">
              <label><span>Campaign name</span><input value={brief.name} onChange={e=>updateBrief('name',e.target.value)}/></label>
              <div className="field-block"><span className="field-label">Countries</span><div className="chips">{['United States','United Kingdom','Germany'].map(c=><button key={c} className={brief.countries.includes(c)?'chip active':'chip'} onClick={()=>updateBrief('countries',brief.countries.includes(c)?brief.countries.filter(x=>x!==c):[...brief.countries,c])}>{c}</button>)}</div></div>
              <div className="field-block"><span className="field-label">Niches</span><div className="chips">{['Fashion','Beauty','Lifestyle','Street Style','Luxury Fashion','GRWM'].map(n=><button key={n} className={brief.niches.includes(n)?'chip active':'chip'} onClick={()=>updateBrief('niches',brief.niches.includes(n)?brief.niches.filter(x=>x!==n):[...brief.niches,n])}>{n}</button>)}</div></div>
              <div className="two-col"><label><span>Min followers</span><input type="number" value={brief.minFollowers??''} onChange={e=>updateBrief('minFollowers',e.target.value?Number(e.target.value):null)}/></label><label><span>Max followers</span><input type="number" placeholder="No maximum" value={brief.maxFollowers??''} onChange={e=>updateBrief('maxFollowers',e.target.value?Number(e.target.value):null)}/></label></div>
              <div className="two-col"><label><span>Min engagement %</span><input type="number" step="0.1" value={brief.minEngagementRate??''} onChange={e=>updateBrief('minEngagementRate',e.target.value?Number(e.target.value):null)}/></label><label><span>Min Reel views</span><input type="number" placeholder="Optional" value={brief.minAvgReelViews??''} onChange={e=>updateBrief('minAvgReelViews',e.target.value?Number(e.target.value):null)}/></label></div>
              <div className="two-col"><label><span>Active within</span><select value={brief.activeWithinDays??''} onChange={e=>updateBrief('activeWithinDays',e.target.value?Number(e.target.value):null)}><option value="">Any time</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option></select></label><label><span>Target count</span><input type="number" min="1" max="500" value={brief.targetCount} onChange={e=>updateBrief('targetCount',Number(e.target.value)||100)}/></label></div>
              <label className="toggle-row"><div><strong>Public email required</strong><span>Only keep creators with a saved outreach email.</span></div><input type="checkbox" checked={brief.emailRequired} onChange={e=>updateBrief('emailRequired',e.target.checked)}/><i/></label>
              <button className="primary discover-btn" onClick={discover} disabled={discovering}><Search size={17}/>{discovering?'Searching and ranking…':'Find matching creators'}</button>
            </div>
          </div>
          <div className="results-panel">
            <div className="results-head"><div><span className="eyebrow">LIVE SHORTLIST</span><h2>Discovery results</h2></div><div className="result-count"><strong>{creators.length}</strong><span>matches</span></div></div>
            {discoveryNote && <div className="info-banner"><Sparkles size={16}/><span>{discoveryNote}</span></div>}
            <CreatorTable creators={creators} loading={discovering} search={search} onSearch={setSearch} onOpen={setSelected} onApprove={approve} onVoid={voidCreator} onRestore={restore} emptyText="Run your campaign brief to find matching creators."/>
          </div>
        </div>
      </section>}

      {['candidates','approved','voided'].includes(view) && <section className="page list-page">
        <div className="page-intro"><div><h2>{view==='candidates'?'Review candidates':view==='approved'?'Approved creator master list':'Voided creator archive'}</h2><p>{view==='candidates'?'Approve strong fits or void creators you never want surfaced again.':view==='approved'?'Every approved handle is automatically protected against future duplicates.':'These handles are permanently excluded from normal discovery unless you restore them.'}</p></div><div className="list-meta"><Filter size={15}/>{creators.length} shown</div></div>
        <CreatorTable creators={creators} loading={loading} search={search} onSearch={setSearch} onOpen={setSelected} onApprove={approve} onVoid={voidCreator} onRestore={restore}/>
      </section>}

      {view==='vault' && <section className="page vault-page">
        <div className="page-intro"><div><h2>Exclusion memory</h2><p>Import every previous Hacoo list and every voided list. Handles are normalized once, then blocked automatically.</p></div></div>
        <div className="import-grid">
          <ImportCard title="Previous / Used creators" subtitle="Import old campaign spreadsheets so approved creators are never suggested again." icon={<UserCheck size={20}/>} loading={importing==='USED'} onFile={f=>importFile(f,'USED')}/>
          <ImportCard title="Voided creators" subtitle="Import profiles that should never appear in future discovery results." icon={<ArchiveX size={20}/>} loading={importing==='VOIDED'} onFile={f=>importFile(f,'VOIDED')}/>
        </div>
        <div className="panel vault-table"><div className="panel-head"><div><h3>Saved exclusions</h3><p>{exclusions.length.toLocaleString()} normalized handles across all imported files.</p></div><div className="legend"><span><i className="dot approved"/>Used</span><span><i className="dot voided"/>Voided</span></div></div>
          <div className="exclusion-list">{exclusions.slice(0,300).map(x=><div key={x.id}><div className={`exclusion-icon ${x.type.toLowerCase()}`}>{x.type==='USED'?<CheckCircle2 size={15}/>:<XCircle size={15}/>}</div><div><strong>@{x.handle}</strong><span>{x.sourceFile||x.reason||'Saved manually'}</span></div><em>{x.type}</em></div>)}{!exclusions.length&&<div className="empty-panel">No exclusions imported yet.</div>}</div>
        </div>
      </section>}
    </main>

    <CreatorDrawer creator={selected} onClose={()=>setSelected(null)} onApprove={approve} onVoid={voidCreator} onRestore={restore} onSave={saveCreator}/>
    <AddCreatorModal open={addOpen} onClose={()=>setAddOpen(false)} onCreate={createCreator}/>
    {toast&&<div className={`toast ${toast.type}`}>{toast.type==='ok'?<CheckCircle2 size={17}/>:<XCircle size={17}/>}<span>{toast.text}</span></div>}
  </div>;
}

function ImportCard({title,subtitle,icon,loading,onFile}:{title:string;subtitle:string;icon:any;loading:boolean;onFile:(f:File)=>void}){
  return <label className="import-card"><input type="file" accept=".xlsx,.csv,.txt,.md" onChange={e=>{const f=e.target.files?.[0];if(f)onFile(f);e.currentTarget.value=''}}/><div className="import-icon">{loading?<span className="spinner"/>:icon}</div><div><h3>{title}</h3><p>{subtitle}</p><span className="file-types">XLSX · CSV · TXT · MD</span></div><button className="secondary" type="button"><UploadCloud size={16}/>{loading?'Importing…':'Choose file'}</button></label>
}
