import { useState, useEffect } from "react";
import {
  getMembers, upsertMember,
  getDisplaySettings, saveDisplaySettings,
  getEnrollments, completeEnrollment,
  getEarnRules, upsertEarnRule, deleteEarnRule,
  getReferrals, addReferral, addTransaction, upsertTier
} from "./supabase";

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444", warning:"#F5A623",
  gold:"#D4AF37", silver:"#A8A9AD", bronze:"#CD7F32", iron:"#6B7280",
};

function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return d||""; } }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

function Modal({title,onClose,children,footer}){
  return(<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-hdr"><div className="modal-title">{title}</div><button className="modal-close" onClick={onClose}>✕</button></div><div className="modal-body">{children}</div>{footer&&<div className="modal-footer">{footer}</div>}</div></div>);
}

const DEF_DISPLAY = {
  slides: { leaderboard:true, challenges:true, activity:true, spotlight:true },
  slideOrder: ["leaderboard","challenges","activity","spotlight"],
  slideDuration: 12,
  ticker: ["Train your strength — every visit earns points"],
  challenges: [{ id:1, name:"Weekly Warrior", desc:"Check in 5× this week", pts:150, deadline:"3 days", active:true, goal:1 }],
  homeMessages: ["Every rep is a deposit into your future self."]
};

function DisplaySettings({toast}){
  const [settings,setSettings]=useState(DEF_DISPLAY);
  const [saving,setSaving]=useState(false);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    getDisplaySettings().then(data=>{
      if(data){try{setSettings({...DEF_DISPLAY,...JSON.parse(data.config||"{}")});}catch{}}
      setLoaded(true);
    });
  },[]);

  if(!loaded) return <div style={{color:C.muted,padding:20}}>Loading…</div>;
  return(<div>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
      <button className="btn btn-primary" onClick={async()=>{setSaving(true); await saveDisplaySettings({config:JSON.stringify(settings)}); setSaving(false); toast("Display Configuration Saved");}} disabled={saving}>Save All Settings</button>
    </div>
    <div className="display-section">
      <div className="display-section-title">Slide Rotation Control</div>
      <input type="range" min="5" max="30" value={settings.slideDuration} onChange={e=>setSettings(s=>({...s,slideDuration:Number(e.target.value)}))} style={{width:"100%",marginBottom:16,accentColor:C.orange}}/>
      {["leaderboard","challenges","activity","spotlight"].map(k=>(
        <div key={k} className="slide-row">
          <div className={`toggle${settings.slides[k]?" on":""}`} onClick={()=>setSettings(s=>({...s,slides:{...s.slides,[k]:!s.slides[k]}}))}/>
          <span style={{fontSize:14,fontWeight:500,color:settings.slides[k]?C.white:C.muted, display:"inline-flex", alignItems:"center", gap:6}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/></svg>
            {k.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  </div>);
}

function Settings({tiers,setTiers,toast}){
  const [local,setLocal]=useState(tiers.map(t=>({...t})));
  const [saving,setSaving]=useState(false);
  return(<div style={{maxWidth:600}}>
    <div className="sec-hdr"><div className="sec-title">Tier Configuration Panel</div><button className="btn btn-primary" onClick={async()=>{setSaving(true); for(const t of local) await upsertTier(t); setTiers(local); setSaving(false); toast("Tiers Synchronized");}} disabled={saving}>Save Tiers</button></div>
    <div className="tbl-wrap" style={{marginTop:16}}><table><thead><tr><th>#</th><th>Name</th><th>Min Points</th></tr></thead><tbody>{local.map((t,i)=>(<tr key={t.id}><td>{i+1}</td><td><input className="form-input" value={t.name} onChange={e=>setLocal(prev=>prev.map(x=>x.id===t.id?{...x,name:e.target.value}:x))}/></td><td><input className="form-input" type="number" value={t.min} onChange={e=>setLocal(prev=>prev.map(x=>x.id===t.id?{...x,min:Number(e.target.value)}:x))} disabled={i===0}/></td></tr>))}</tbody></table></div>
  </div>);
}

function ChallengesPanel({members, setMembers, setTransactions, toast, displaySettings}) {
  const [enrollments, setEnrollments] = useState([]);
  useEffect(() => { getEnrollments().then(setEnrollments); }, []);
  const challenges = displaySettings?.challenges ? displaySettings.challenges.filter(c => c.active !== false) : [];

  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Challenges Track logs</div></div>
      {challenges.map(c => (
        <div key={c.id} style={{background:C.surface, border:`1px solid ${C.border}`, padding:16, marginBottom:12, borderRadius:8}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700, color:C.white}}>{c.name}</div>
              <div style={{fontSize:12, color:C.muted}}>{c.desc}</div>
            </div>
            <button className="btn btn-success btn-sm" onClick={async()=>{
              const activeEnr = enrollments.find(e => e.challengeId === String(c.id) && !e.completed);
              if(!activeEnr) return;
              await completeEnrollment(activeEnr.id, today());
              toast("Challenge Verified");
            }}>Verify System Metrics</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EarnRules({ toast }) {
  return (
    <div className="empty">
      <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.white}}>Core Platform Earn Configuration</div>
      <p style={{fontSize:12, color:C.muted, marginTop:4}}>Rule adjustments are controlled through the database layout layer logs.</p>
    </div>
  );
}

function ReferralsPanel({ members, setMembers, setTransactions, toast }) {
  return (
    <div className="empty">
      <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.white}}>Ambassador Framework Index</div>
    </div>
  );
}

function ExportData({ members, transactions, redemptions, tiers, toast }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr", gap:14}}>
      <div className="interactive-card" style={{margin:0, textAlign:"center"}}>
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.5" style={{marginBottom:10}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.white}}>CSV Core Engine compilation Export</div>
        <button className="btn btn-primary" style={{marginTop:14, width:"auto"}} onClick={()=>toast("Compiling Spreadsheet Data Structure...")}>Download Core Records</button>
      </div>
    </div>
  );
}

export { DisplaySettings, Settings, ChallengesPanel, EarnRules, ExportData, ReferralsPanel };
