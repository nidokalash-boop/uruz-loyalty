import { useState, useEffect } from "react";
import {
  getMembers, upsertMember, updateMemberStatus, resetMemberPin,
  getTransactions, addTransaction,
  getRedemptions, updateRedemptionStatus,
  getRewards, upsertReward, deleteReward,
  getTiers, upsertTier,
  getStaff, upsertStaff, deleteStaff,
  getDisplaySettings, saveDisplaySettings,
  getEnrollments, completeEnrollment,
  getEarnRules, upsertEarnRule, deleteEarnRule,
  getReferrals, addReferral,
  getAllWorkouts, upsertWorkout, deleteWorkout,
  getAllUnlocks, unlockWorkout
} from "./supabase";

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444", warning:"#F5A623",
  gold:"#D4AF37", silver:"#A8A9AD", bronze:"#CD7F32", iron:"#6B7280",
};

const ICONS = {
  challenges: (color = "#F58020", size = 18) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>,
  earn: (color = "#F58020", size = 22) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  export: (color = "#F58020", size = 28) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  lock: (color = "currentColor", size = 12) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
};

function Modal({title,onClose,children,footer}){
  return(<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-hdr"><div className="modal-title">{title}</div><button className="modal-close" onClick={onClose}>✕</button></div><div className="modal-body">{children}</div>{footer&&<div className="modal-footer">{footer}</div>}</div></div>);
}

function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return d||""; } }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

const DEF_DISPLAY = {
  slides: { leaderboard:true, challenges:true, activity:true, spotlight:true },
  slideOrder: ["leaderboard","challenges","activity","spotlight"],
  slideDuration: 12,
  ticker: [
    "Train your strength — every visit earns points",
    "Refer a friend and earn 500 pts — ask the front desk",
    "Join the movement — every body belongs here",
    "Personal Training sessions earn 100 pts — book today",
    "Built for the neighborhood — powered by you",
  ],
  challenges: [
    { id:1, name:"Weekly Warrior",  desc:"Check in 5× this week",          pts:150,  deadline:"3 days",  active:true, goal:1 },
    { id:2, name:"Iron Will",       desc:"15-day consecutive streak",      pts:300,  deadline:"4 days",  active:true, goal:1 },
    { id:3, name:"Bring the Crew",  desc:"Refer 2 new members",            pts:1000, deadline:"24 days", active:true, goal:1 },
    { id:4, name:"Early Bird",      desc:"Attend 3 AM classes this month", pts:200,  deadline:"12 days", active:true, goal:1 },
  ],
  homeMessages: [
    "Every rep is a deposit into your future self.",
    "Show up. Put in the work. The results follow.",
    "Strength isn't given — it's built, session by session.",
    "Your only competition is who you were yesterday.",
    "The gym doesn't care about your excuses. Neither should you.",
    "Built different. Trained harder.",
    "One more set. Always one more set.",
  ]
};

function DisplaySettings({toast}){
  const [settings,setSettings]=useState(DEF_DISPLAY);
  const [saving,setSaving]=useState(false);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      const data=await getDisplaySettings();
      if(data){
        try { setSettings({...DEF_DISPLAY,...JSON.parse(data.config||"{}") }); }
        catch { setSettings(DEF_DISPLAY); }
      }
      setLoaded(true);
    })();
  },[]);

  const save=async()=>{
    setSaving(true);
    await saveDisplaySettings({config:JSON.stringify(settings)});
    setSaving(false);toast("Display settings saved — TV will update within 60 seconds");
  };

  const toggleSlide=(key)=>setSettings(s=>({...s,slides:{...s.slides,[key]:!s.slides[key]}}));
  const updateTicker=(i,val)=>setSettings(s=>({...s,ticker:s.ticker.map((t,j)=>j===i?val:t)}));
  const addTicker=()=>setSettings(s=>({...s,ticker:[...s.ticker,""]}));
  const removeTicker=(i)=>setSettings(s=>({...s,ticker:s.ticker.filter((_,j)=>j!==i)}));
  const updateChallenge=(i,field,val)=>setSettings(s=>({...s,challenges:s.challenges.map((c,j)=>j===i?{...c,[field]:field==="pts"?Number(val):val}:c)}));
  const toggleChallenge=(i)=>setSettings(s=>({...s,challenges:s.challenges.map((c,j)=>j===i?{...c,active:!c.active}:c)}));
  const SLIDE_LABELS={leaderboard:"Leaderboard Data",challenges:"Active Challenges",activity:"Live Activity Feed",spotlight:"Member Spotlight"};

  if(!loaded) return <div style={{color:C.muted,padding:20}}>Loading…</div>;
  return(<div>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Saving...":"Save All Settings"}</button>
    </div>

    <div className="display-section">
      <div className="display-section-title">Slide Rotation Engine</div>
      <div style={{marginBottom:12,fontSize:12,color:C.muted}}>Slide duration: <strong style={{color:C.white}}>{settings.slideDuration} seconds</strong></div>
      <input type="range" min="5" max="30" value={settings.slideDuration} onChange={e=>setSettings(s=>({...s,slideDuration:Number(e.target.value)}))} style={{width:"100%",marginBottom:16,accentColor:C.orange}}/>
      {["leaderboard","challenges","activity","spotlight"].map(k=>(
        <div key={k} className="slide-row">
          <div className={`toggle${settings.slides[k]?" on":""}`} onClick={()=>toggleSlide(k)}/>
          <span style={{fontSize:14,fontWeight:500,color:settings.slides[k]?C.white:C.muted, display:"inline-flex", alignItems:"center", gap:6}}>
            {k==="leaderboard" && ICONS.challenges(settings.slides[k]?C.orange:C.muted)}
            {k==="challenges" && ICONS.challenges(settings.slides[k]?C.orange:C.muted)}
            {SLIDE_LABELS[k]}
          </span>
        </div>
      ))}
    </div>

    <div className="display-section">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div className="display-section-title" style={{marginBottom:0}}>Active Sync Challenges</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setSettings(s=>({...s,challenges:[...s.challenges,{id:Date.now(),name:"New Challenge",desc:"Description here",pts:100,deadline:"7 days",active:true,goal:1}]}))}>+ Add</button>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>These show on the challenges slide and member portal.</div>
      {settings.challenges.map((c,i)=>(
        <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`,padding:14,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div className={`toggle${c.active?" on":""}`} onClick={()=>toggleChallenge(i)}/>
            <span style={{fontSize:13,fontWeight:700,color:c.active?C.white:C.muted, display:"inline-flex", alignItems:"center", gap:6}}>
              {ICONS.challenges(c.active?C.orange:C.muted)} {c.name}
            </span>
          </div>
          <div className="ch-edit-row">
            <input className="form-input" placeholder="Challenge name" value={c.name} onChange={e=>updateChallenge(i,"name",e.target.value)}/>
            <input className="form-input" placeholder="Description" value={c.desc} onChange={e=>updateChallenge(i,"desc",e.target.value)}/>
            <input className="form-input" type="number" placeholder="Pts" value={c.pts} onChange={e=>updateChallenge(i,"pts",e.target.value)} style={{width:80}}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:10}}>
            <input className="form-input" placeholder="Deadline (e.g. 3 days)" value={c.deadline} onChange={e=>updateChallenge(i,"deadline",e.target.value)}/>
            <input className="form-input" type="number" placeholder="Goal #" value={c.goal||1} onChange={e=>updateChallenge(i,"goal",Number(e.target.value))} style={{width:80}}/>
          </div>
          <div style={{marginTop:8}}>
            <button className="btn btn-danger btn-sm" onClick={()=>setSettings(s=>({...s,challenges:s.challenges.filter((_,j)=>j!==i)}))}>Remove Challenge</button>
          </div>
        </div>
      ))}
    </div>

    <div className="display-section">
      <div className="display-section-title">Ticker Messages</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>These scroll across the bottom of the TV display.</div>
      {settings.ticker.map((t,i)=>(
        <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
          <input className="form-input" style={{flex:1}} value={t} onChange={e=>updateTicker(i,e.target.value)} placeholder="Ticker message…"/>
          <button className="btn btn-danger btn-sm" onClick={()=>removeTicker(i)}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost" style={{marginTop:4}} onClick={addTicker}>+ Add Message</button>
    </div>

    <div className="display-section">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div className="display-section-title" style={{marginBottom:0}}>Home Screen Messages</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setSettings(s=>({...s,homeMessages:[...(s.homeMessages||[]),"New motivational message here"]}))}>+ Add</button>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>These rotate daily on the member portal home screen.</div>
      {(settings.homeMessages||[]).map((t,i)=>(
        <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
          <input className="form-input" style={{flex:1}} value={t} onChange={e=>setSettings(s=>({...s,homeMessages:s.homeMessages.map((m,j)=>j===i?e.target.value:m)}))} placeholder="Motivational message…"/>
          <button className="btn btn-danger btn-sm" onClick={()=>setSettings(s=>({...s,homeMessages:s.homeMessages.filter((_,j)=>j!==i)}))}>✕</button>
        </div>
      ))}
    </div>
  </div>);
}

function Settings({tiers,setTiers,toast}){
  const [local,setLocal]=useState(tiers.map(t=>({...t})));
  const [saving,setSaving]=useState(false);
  const [showQR,setShowQR]=useState(false);
  const siteUrl=typeof window!=="undefined"?window.location.origin:"https://uruz-loyalty.vercel.app";

  const save=async()=>{
    setSaving(true);
    const sorted=[...local].sort((a,b)=>Number(a.min)-Number(b.min));
    for(const t of sorted) await upsertTier(t);
    setTiers(sorted);setSaving(false);toast("Tiers saved");
  };
  const update=(id,f,v)=>setLocal(prev=>prev.map(t=>t.id===id?{...t,[f]:f==="min"?Number(v):v}:t));

  return(<div style={{maxWidth:600}}>
    <div className="sec-hdr" style={{marginBottom:8}}><div className="sec-title">Check-In Interface QR Link</div></div>
    <div style={{background:"#252627",border:`1px solid ${C.border}`,padding:20,marginBottom:28}}>
      <div style={{fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.6}}>Print and display at the gym entrance. Members scan to check in and earn 50 pts automatically.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button className="btn btn-primary" style={{width:"auto",padding:"8px 20px"}} onClick={()=>setShowQR(true)}>Show QR Code</button>
        <a href={`${siteUrl}/checkin`} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",padding:"8px 20px",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",textDecoration:"none"}}>Test Check-In</a>
      </div>
    </div>
    {showQR&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowQR(false)}><div style={{background:"#252627",border:`1px solid ${C.border}`,padding:32,maxWidth:380,width:"100%",textAlign:"center"}} onClick={e=>e.stopPropagation()}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:2,color:"#FFFDF3",marginBottom:4}}>Check-In Terminal Target</div><div style={{fontSize:11,color:C.muted,marginBottom:20}}>Display at the gym entrance</div><div style={{background:"#fff",padding:16,display:"inline-block",marginBottom:16}}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(siteUrl+"/checkin")}&bgcolor=ffffff&color=1F2020&margin=0`} alt="QR" width={240} height={240}/></div><div style={{fontSize:11,color:C.muted,marginBottom:20,fontFamily:"'JetBrains Mono',monospace"}}>{siteUrl}/checkin</div><div style={{display:"flex",gap:8,justifyContent:"center"}}><button className="btn btn-primary" style={{width:"auto",padding:"8px 20px"}} onClick={()=>window.print()}>Print</button><button className="btn btn-ghost" style={{width:"auto",padding:"8px 20px"}} onClick={()=>setShowQR(false)}>Close</button></div></div></div>)}
    <div className="sec-hdr"><div className="sec-title">Tier Metric Scaling Configuration</div><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Saving...":"Save Tiers"}</button></div>
    <div className="tbl-wrap" style={{marginTop:16}}><table><thead><tr><th>#</th><th>Indicator</th><th>Name</th><th>Min Points</th><th>Color Mapping</th></tr></thead><tbody>{[...local].sort((a,b)=>a.min-b.min).map((t,i)=>(<tr key={t.id}><td style={{color:C.muted,fontWeight:700}}>{i+1}</td><td><input className="form-input" style={{width:60,textAlign:"center",fontSize:14}} value={t.icon || ""} onChange={e=>update(t.id,"icon",e.target.value)}/></td><td><input className="form-input" value={t.name} onChange={e=>update(t.id,"name",e.target.value)}/></td><td><input className="form-input" type="number" min="0" value={t.min} onChange={e=>update(t.id,"min",e.target.value)} disabled={i===0} style={{opacity:i===0?.5:1}}/></td><td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,background:t.color,border:`1px solid ${C.border}`}}/><input className="form-input" value={t.color} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}} onChange={e=>update(t.id,"color",e.target.value)}/></div></td></tr>))}</tbody></table></div>
  </div>);
}

function ChallengesPanel({members, setMembers, setTransactions, toast, displaySettings}) {
  const [enrollments, setEnrollments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getEnrollments().then(data => { setEnrollments(data); setLoaded(true); });
  }, []);

  const challenges = displaySettings?.challenges ? displaySettings.challenges.filter(c => c.active !== false) : [];

  const handleComplete = async (enrollment) => {
    const pts = challenges.find(c => String(c.id) === enrollment.challengeId)?.pts || 0;
    await completeEnrollment(enrollment.id, today());
    setEnrollments(prev => prev.map(e => e.id === enrollment.id ? {...e, completed:true, completedDate:today()} : e));
    if (pts > 0) {
      const m = members.find(x => x.id === enrollment.memberId);
      if (m) {
        const newPoints = m.points + pts;
        await upsertMember({...m, points: newPoints});
        setMembers(prev => prev.map(x => x.id === m.id ? {...x, points: newPoints} : x));
        const txn = { id: genId("TXN"), memberId: m.id, memberName: m.name, type: "challenge", pts, note: `Completed: ${enrollment.challengeName}`, date: today() };
        await addTransaction(txn);
        setTransactions(prev => [txn, ...prev]);
      }
    }
    toast(`Challenge completed — ${pts > 0 ? `+${pts} pts awarded` : "no auto-points for this type"}`);
  };

  if (!loaded) return <div style={{color:C.muted, padding:20}}>Loading…</div>;

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Challenge Sync Matrix Logs</div>
        <div style={{fontSize:12,color:C.muted,fontWeight:500}}>{enrollments.length} active enrollments</div>
      </div>

      {challenges.length === 0 && (
        <div className="empty">No active challenges. Add them in the TV Display settings.</div>
      )}

      {challenges.map(c => {
        const cEnrollments = enrollments.filter(e => e.challengeId === String(c.id));
        return (
          <div key={c.id} style={{background:C.surface,border:`1px solid ${C.border}`,marginBottom:16, borderRadius:8, overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
              <span style={{display:"inline-flex", alignItems:"center"}}>{ICONS.challenges(C.orange)}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:C.white}}>{c.name}</div>
                <div style={{fontSize:12,color:C.muted}}>{c.desc}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>+{c.pts} PTS</div>
                <div style={{fontSize:11,color:C.muted, display:"inline-flex", alignItems:"center", gap:4}}>{ICONS.lock(C.muted)} {c
