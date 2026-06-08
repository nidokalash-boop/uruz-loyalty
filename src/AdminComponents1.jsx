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
  profile: (color = "currentColor", size = 24) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  rewards: (color = "#F58020", size = 24) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
  import: (color = "currentColor", size = 24) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
};

const ROLES = {
  owner:      { label:"Owner",      color:"#F58020", level:4 },
  manager:    { label:"Manager",    color:"#D4AF37", level:3 },
  front_desk: { label:"Front Desk", color:"#026F91", level:2 },
  trainer:    { label:"Trainer",    color:"#22C55E", level:1 },
};

function getTierFn(pts, tiers) { return [...tiers].sort((a,b)=>b.min-a.min).find(t=>pts>=t.min)||tiers[0]; }
function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return d||""; } }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function saveStaffSession(d) { try { localStorage.setItem("uruz:staff",JSON.stringify(d)); } catch {} }

function PinInput({ value, onChange }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  const handle = k => { if(k==="⌫") onChange(value.slice(0,-1)); else if(k==="") return; else if(value.length<4) onChange(value+k); };
  return (
    <div>
      <div className="pin-row">{[0,1,2,3].map(i=><div key={i} className={`pin-digit${value[i]?" filled":""}${value.length===i?" active":""}`}>{value[i]?"●":""}</div>)}</div>
      <div className="pin-pad">{keys.map((k,i)=><div key={i} className={`pin-key${k==="⌫"?" del":""}${k===""?" empty":""}`} onClick={()=>handle(k)}>{k}</div>)}</div>
    </div>
  );
}

function Modal({title,onClose,children,footer}){
  return(<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-hdr"><div className="modal-title">{title}</div><button className="modal-close" onClick={onClose}>✕</button></div><div className="modal-body">{children}</div>{footer&&<div className="modal-footer">{footer}</div>}</div></div>);
}

function AdminLogin({ onLogin, staffList }) {
  const [stage, setStage]   = useState(staffList.length === 0 ? "setup" : "name");
  const [name, setName]     = useState("");
  const [role, setRole]     = useState("");
  const [pin, setPin]       = useState("");
  const [pin2, setPin2]     = useState("");
  const [selStaff, setSelStaff] = useState(null);
  const [error, setError]   = useState("");

  const handleNameContinue = () => {
    const found = staffList.find(s => s.name.toLowerCase() === name.trim().toLowerCase());
    if (!found) { setError("Staff profile node unverified in index registry."); return; }
    setSelStaff(found); setError(""); setStage("pin");
  };

  useEffect(() => {
    if (stage === "pin" && pin.length === 4) {
      if (pin !== selStaff.pin) { setError("Invalid PIN entry."); setPin(""); return; }
      saveStaffSession({ id: selStaff.id, name: selStaff.name, role: selStaff.role });
      onLogin({ id: selStaff.id, name: selStaff.name, role: selStaff.role });
    }
  }, [pin]);

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-brand">URUZ</div>
        <div className="login-sub">Member Central — Admin Suite</div>
        <div className="login-divider"/>

        {stage === "setup" && (
          <>
            <div className="login-step">Owner Terminal Deployment</div>
            <div className="form-row">
              <label className="form-label">Full Name</label>
              <input className="login-inp" value={name} onChange={e=>setName(e.target.value)}/>
            </div>
            <div className="form-row">
              <label className="form-label">Role Definition</label>
              <div className="role-grid">
                {Object.entries(ROLES).map(([k,v])=>(
                  <div key={k} className={`role-card${role===k?" sel":""}`} onClick={()=>setRole(k)}>
                    <span className="role-icon-wrap" style={{color:v.color}}>{ICONS.profile(v.color)}</span>
                    <div className="role-name" style={{color:role===k?v.color:"#6B6866"}}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-row"><label className="form-label">Access Pin</label><PinInput value={pin} onChange={setPin}/></div>
            <button className="login-btn" disabled={pin.length<4||!role||!name} onClick={()=>setStage("confirmpin")}>Deploy Instance</button>
          </>
        )}

        {stage === "confirmpin" && (
          <>
            <div className="login-step">Verify Token Security PIN</div>
            <PinInput value={pin2} onChange={async(v)=>{
              setPin2(v); if(v.length===4 && v===pin) {
                const owner = { id: genId("STF"), name: name.trim(), role, pin, status: "active" };
                await upsertStaff(owner); saveStaffSession(owner); onLogin(owner);
              }
            }}/>
          </>
        )}

        {stage === "name" && (
          <>
            <div className="login-step">Staff Terminal Access</div>
            <input className="login-inp" placeholder="Registered Name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleNameContinue()}/>
            <button className="login-btn" onClick={handleNameContinue}>Query Node</button>
          </>
        )}

        {stage === "pin" && selStaff && (
          <>
            <div className="staff-chip">
              <div className="chip-av" style={{background:`${ROLES[selStaff.role]?.color}15`, color:ROLES[selStaff.role]?.color}}>{initials(selStaff.name)}</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#FFFDF3"}}>{selStaff.name}</div>
                <div style={{fontSize:11,color:ROLES[selStaff.role]?.color,fontWeight:700,textTransform:"uppercase"}}>{ROLES[selStaff.role]?.label} Profile</div>
              </div>
            </div>
            <PinInput value={pin} onChange={setPin}/>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({members,transactions,redemptions}){
  const active=members.filter(m=>m.status==="active").length;
  const pending=redemptions.filter(r=>r.status==="pending").length;
  const todayTxns=transactions.filter(t=>t.date===today());
  const todayPts=todayTxns.reduce((s,t)=>s+(t.pts>0?t.pts:0),0);
  const totalPts=members.reduce((s,m)=>s+m.points,0);
  const TYPE_CFG={checkin:{label:"Check-in",color:C.cerulean},class:{label:"Class Split",color:C.orange},referral:{label:"Referral Influx",color:C.success},bonus:{label:"Bonus Metric",color:C.gold},manual:{label:"Adjustment",color:C.silver},redeem:{label:"Claim Event",color:C.danger}};

  return(<div><div className="stat-grid">{[{val:active,lbl:"Active Matrix Nodes",sub:`${members.length} Total` ,accent:C.orange},{val:totalPts.toLocaleString(),lbl:"Volume Issued",sub:"System total",accent:C.cerulean},{val:todayPts,lbl:"Metrics Logged Today",sub:`${todayTxns.length} events`,accent:C.success},{val:pending,lbl:"Pending Reward Adjustments",sub:"Awaiting execution",accent:C.warning}].map((s,i)=>(<div key={i} className="stat-card" style={{"--accent":s.accent}}><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>))}</div><div className="sec-hdr"><div className="sec-title">Realtime Activity Array Feed</div></div><div className="tbl-wrap"><table><thead><tr><th>Target Node Name</th><th>Categorization</th><th>Metric Influx</th><th>System Identifier Note</th><th>Sync Time</th></tr></thead><tbody>{transactions.slice(0,8).map(t=>{const cfg=TYPE_CFG[t.type]||{label:t.type,color:C.muted};return(<tr key={t.id}><td style={{fontWeight:600}}>{t.memberName||t.member_name}</td><td><span className="badge" style={{background:`${cfg.color}15`,color:cfg.color}}>{cfg.label}</span></td><td style={{color:t.pts>0?C.success:C.danger,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{t.pts>0?"+":""}{t.pts}</td><td style={{color:C.muted}}>{t.note}</td><td className="mono" style={{color:C.muted}}>{fmtDate(t.date)}</td></tr>);})}</tbody></table></div></div>);
}

function Members({members,setMembers,transactions,tiers,onAward,toast,role}){
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const filtered=members.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.phone.includes(search)||m.id.includes(search));
  const sel=selected?members.find(m=>m.id===selected):null;

  return(<div>
    <div className="search-row"><input className="search-input" placeholder="Query name, phone or registration identity..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="tbl-wrap"><table><thead><tr><th>Node Member Profile</th><th>ID Block</th><th>Device Endpoint</th><th>Tier Status</th><th>Metric Volume</th><th>State</th><th>Actions</th></tr></thead><tbody>{filtered.map(m=>{const t=getTierFn(m.points,tiers);return(<tr key={m.id} className="clickable" onClick={()=>setSelected(m.id)}><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="av" style={{background:`${C.orange}15`,color:C.orange}}>{initials(m.name)}</div><div style={{fontWeight:600}}>{m.name}</div></div></td><td className="mono" style={{color:C.muted}}>{m.id}</td><td className="mono">{m.phone}</td><td><span style={{color:t.color,fontWeight:700,fontSize:12}}>{t.name}</span></td><td><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{m.points.toLocaleString()}</span></td><td><span className={`badge badge-${m.status}`}>{m.status}</span></td><td><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>setSelected(m.id)}>Query</button><button className="btn btn-ghost btn-sm" onClick={(e)=>{e.stopPropagation();onAward(m);}}>Mutate</button></div></td></tr>);})}</tbody></table></div>
    {sel&&(<Modal title={`Profile Architecture — ${sel.name}`} onClose={()=>setSelected(null)}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,marginBottom:20}}>{[{v:sel.points.toLocaleString(),l:"Points"},{v:`#${members.filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===sel.id)+1}`,l:"Rank"},{v:`${sel.streak}d`,l:"Streak Track"},{v:sel.checkins,l:"Logs"}].map((s,i)=>(<div key={i} className="ds-cell"><div className="ds-val">{s.v}</div><div className="ds-lbl">{s.l}</div></div>))}</div>
      <div style={{display:"flex",gap:8,marginTop:16}}><button className="btn btn-primary" onClick={()=>{setSelected(null);onAward(sel);}}>Award Points Modifier</button></div>
    </Modal>)}
  </div>);
}

function AwardPoints({members,setMembers,setTransactions,preSelected,toast}){
  const [form,setForm]=useState({memberId:preSelected?.id||"",pts:"",type:"checkin",note:""});
  const [saving,setSaving]=useState(false);

  return(<div style={{maxWidth:520}}>
    <div className="form-row">
      <label className="form-label">Target Architecture Node *</label>
      <select className="form-select" value={form.memberId} onChange={e=>setForm({...form,memberId:e.target.value})}><option value="">— choose node array item —</option>{[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=>(<option key={m.id} value={m.id}>{m.name} ({m.points} pts)</option>))}</select>
    </div>
    <div className="form-row">
      <label className="form-label">Point Volume Input *</label>
      <input className="form-input" type="number" value={form.pts} onChange={e=>setForm({...form,pts:e.target.value})}/>
    </div>
    <button className="btn btn-primary" disabled={saving} onClick={async()=>{
      const m=members.find(x=>x.id===form.memberId); if(!m||!form.pts) return; setSaving(true);
      const pts=Number(form.pts); const nPoints=Math.max(0,m.points+pts);
      await upsertMember({...m,points:nPoints}); setMembers(p=>p.map(x=>x.id===m.id?{...x,points:nPoints}:x));
      const txn={id:genId("TXN"),memberId:m.id,memberName:m.name,type:form.type,pts,note:form.note||"Manual Entry",date:today()};
      await addTransaction(txn); setTransactions(p=>[txn,...p]); setSaving(false); toast("Array modification applied successfully");
    }}>Execute Parameter Update</button>
  </div>);
}

function Redemptions({redemptions,setRedemptions,setMembers,setTransactions,toast}){
  const [tab,setTab]=useState("pending");
  return(<div>
    <div className="tabs">{["pending","fulfilled","cancelled"].map(t=>(<button key={t} className={`tab-btn${tab===t?" on":""}`} onClick={()=>setTab(t)}>{t} ({redemptions.filter(r=>r.status===t).length})</button>))}</div>
    <div className="tbl-wrap"><table><thead><tr><th>User Block</th><th>Claim Asset Requested</th><th>Score Cost</th><th>Action Trigger</th></tr></thead><tbody>{redemptions.filter(r=>r.status===tab).map(r=>(<tr key={r.id}><td>{r.memberName}</td><td>{r.reward}</td><td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{r.pts}</td><td>{tab==="pending"&&<button className="btn btn-success btn-sm" onClick={async()=>{
      await updateRedemptionStatus(r.id,"fulfilled"); setRedemptions(p=>p.map(x=>x.id===r.id?{...x,status:"fulfilled"}:x));
      setMembers(m=>m.map(x=>x.id===r.memberId?{...x,points:Math.max(0,x.points-r.pts)}:x));
      const txn={id:genId("TXN"),memberId:r.memberId,memberName:r.memberName,type:"redeem",pts:-r.pts,note:`Asset Release: ${r.reward}`,date:today()};
      await addTransaction(txn); setTransactions(p=>[txn,...p]); toast("Asset processing complete");
    }}>✓ Authorize</button>}</td></tr>))}</tbody></table></div>
  </div>);
}

function RewardsCatalog({rewards,setRewards,toast}){
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Asset Rewards Library Registry</div></div>
      <div className="reward-grid">{rewards.map(r=>(<div key={r.id} className="rwd-card"><span className="rwd-icon-wrap">{ICONS.rewards(C.orange)}</span><div className="rwd-name">{r.name}</div><div className="rwd-pts">{r.pts} <span style={{fontSize:12,color:C.muted}}>PTS</span></div></div>))}</div>
    </div>
  );
}

function StaffManagement({staffList,setStaffList,toast}){
  return(<div>
    <div className="sec-hdr"><div className="sec-title">Administrative Operator Roles ({staffList.length})</div></div>
    <div className="tbl-wrap"><table><thead><tr><th>Name String</th><th>Security Access Level</th><th>State Clear</th></tr></thead><tbody>{staffList.map(s=>(<tr key={s.id}><td>{s.name}</td><td><span className="badge" style={{color:ROLES[s.role]?.color}}>{ROLES[s.role]?.label}</span></td><td><span className="badge badge-active">Active</span></td></tr>))}</tbody></table></div>
  </div>);
}

function BulkImport({ members, setMembers, toast }) {
  return (
    <div style={{textAlign:"center", padding:40}}>
      <div style={{color:C.muted, marginBottom:16}}>{ICONS.import(C.muted)}</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.white}}>Bulk Node Influx Channel</div>
      <div style={{fontSize:12, color:C.muted, marginTop:4}}>CSV pipeline configurations can be compiled directly via developer interface templates.</div>
    </div>
  );
}

export { PinInput, Modal, AdminLogin, Dashboard, Members, AwardPoints, Redemptions, RewardsCatalog, StaffManagement, BulkImport };
