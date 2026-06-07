import { useState, useEffect } from "react";
import {
  getMembers, upsertMember, updateMemberStatus, resetMemberPin,
  getTransactions, addTransaction,
  getRedemptions, updateRedemptionStatus,
  getRewards, upsertReward, deleteReward,
  getTiers, upsertTier
} from "./supabase";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`;

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444", warning:"#F5A623",
  gold:"#D4AF37", silver:"#A8A9AD", bronze:"#CD7F32", iron:"#6B7280",
};

const DEF_TIERS = [
  { id:"t1", name:"Iron",   min:0,     color:C.iron,    icon:"⚙" },
  { id:"t2", name:"Bronze", min:1000,  color:C.bronze,  icon:"🔶" },
  { id:"t3", name:"Silver", min:2500,  color:C.silver,  icon:"⬡" },
  { id:"t4", name:"Gold",   min:5000,  color:C.gold,    icon:"◆" },
  { id:"t5", name:"Elite",  min:10000, color:C.cerulean,icon:"★" },
];
const DEF_REWARDS = [
  { id:"RWD-001", name:"Guest Day Pass",         pts:300,  cat:"Access",   icon:"🎟", stock:true  },
  { id:"RWD-002", name:"URUZ Shaker Bottle",     pts:500,  cat:"Merch",    icon:"🥤", stock:true  },
  { id:"RWD-003", name:"1-Month Locker Rental",  pts:750,  cat:"Access",   icon:"🔐", stock:true  },
  { id:"RWD-004", name:"URUZ Premium Tee",       pts:900,  cat:"Merch",    icon:"👕", stock:true  },
  { id:"RWD-005", name:"Free Personal Training", pts:1500, cat:"Training", icon:"🏋", stock:true  },
  { id:"RWD-006", name:"1-Month Membership",     pts:3000, cat:"Access",   icon:"⚡", stock:true  },
  { id:"RWD-007", name:"URUZ Hoodie",            pts:1200, cat:"Merch",    icon:"🧥", stock:false },
  { id:"RWD-008", name:"Nutrition Consult",      pts:800,  cat:"Training", icon:"🥗", stock:true  },
];

function normalizeMember(m) {
  return {
    id:          m.id,
    name:        m.name        || "",
    phone:       m.phone       || "",
    email:       m.email       || "",
    joinDate:    m.join_date   || m.joinDate || "",
    points:      m.points      ?? 0,
    checkins:    m.checkins    ?? 0,
    streak:      m.streak      ?? 0,
    status:      m.status      || "active",
    pin:         m.pin         || null,
    lastCheckin: m.last_checkin|| m.lastCheckin || null,
  };
}

function getTier(pts, tiers) { return [...tiers].sort((a,b)=>b.min-a.min).find(t=>pts>=t.min)||tiers[0]; }
function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return d||""; } }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:#1F2020;color:#FFFDF3;font-family:'Montserrat',sans-serif;}
.admin{display:flex;height:100vh;overflow:hidden;background:#1F2020;}
.sidebar{width:210px;flex-shrink:0;background:#252627;border-right:1px solid #333435;display:flex;flex-direction:column;overflow:hidden;}
.sb-brand{padding:20px 18px 16px;border-bottom:1px solid #333435;}
.sb-logo{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:#F58020;}
.sb-sub{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-top:2px;}
.sb-nav{flex:1;padding:10px 0;overflow-y:auto;}
.sb-section{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;padding:12px 18px 6px;}
.sb-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 18px;background:none;border:none;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:600;color:#6B6866;text-align:left;transition:all .15s;}
.sb-btn:hover{color:#FFFDF3;background:rgba(255,255,255,.04);}
.sb-btn.on{color:#F58020;background:rgba(245,128,32,.1);border-left:2px solid #F58020;}
.sb-icon{font-size:15px;width:18px;text-align:center;}
.sb-footer{padding:14px 18px;border-top:1px solid #333435;font-size:11px;color:#6B6866;font-weight:500;}
.sb-admin{color:#FFFDF3;font-weight:700;font-size:13px;}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.topbar{height:54px;flex-shrink:0;background:#252627;border-bottom:1px solid #333435;display:flex;align-items:center;justify-content:space-between;padding:0 24px;}
.topbar-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#FFFDF3;}
.topbar-date{font-size:11px;color:#6B6866;font-weight:500;font-family:'JetBrains Mono',monospace;}
.content{flex:1;overflow-y:auto;padding:24px;}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
.stat-card{background:#252627;border:1px solid #333435;padding:18px;position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent,#F58020);}
.stat-val{font-family:'Bebas Neue',sans-serif;font-size:42px;line-height:1;color:#FFFDF3;letter-spacing:1px;}
.stat-lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;margin-top:4px;font-weight:700;}
.stat-sub{font-size:11px;color:#6B6866;margin-top:6px;font-weight:500;}
.sec-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.sec-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:#FFFDF3;}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;transition:all .15s;}
.btn-primary{background:#F58020;color:#fff;}
.btn-primary:hover{background:#F59340;}
.btn-ghost{background:none;border:1px solid #333435;color:#6B6866;}
.btn-ghost:hover{border-color:#F58020;color:#F58020;}
.btn-danger{background:none;border:1px solid #EF4444;color:#EF4444;}
.btn-danger:hover{background:#EF4444;color:#fff;}
.btn-success{background:#22C55E;color:#fff;}
.btn-sm{padding:5px 10px;font-size:10px;}
.tbl-wrap{background:#252627;border:1px solid #333435;overflow:hidden;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;}
th{padding:10px 14px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;border-bottom:1px solid #333435;background:#2A2B2C;}
td{padding:11px 14px;font-size:13px;font-weight:500;border-bottom:1px solid #333435;vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr.clickable:hover td{background:rgba(245,128,32,.04);cursor:pointer;}
.mono{font-family:'JetBrains Mono',monospace;font-size:12px;}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.badge-active{background:rgba(34,197,94,.15);color:#22C55E;}
.badge-inactive{background:rgba(239,68,68,.12);color:#EF4444;}
.badge-pending{background:rgba(245,166,35,.15);color:#F5A623;}
.badge-fulfilled{background:rgba(34,197,94,.15);color:#22C55E;}
.badge-cancelled{background:rgba(107,104,102,.2);color:#6B6866;}
.search-row{display:flex;gap:10px;margin-bottom:16px;align-items:center;}
.search-input{flex:1;padding:9px 14px;background:#252627;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;outline:none;transition:border-color .15s;}
.search-input::placeholder{color:#6B6866;}
.search-input:focus{border-color:#F58020;}
.av{width:32px;height:32px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:800;flex-shrink:0;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;animation:fadein .2s ease;}
@keyframes fadein{from{opacity:0;}to{opacity:1;}}
.modal{background:#252627;border:1px solid #333435;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;animation:slideup .25s cubic-bezier(0.16,1,0.3,1);}
@keyframes slideup{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #333435;}
.modal-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#FFFDF3;}
.modal-close{background:none;border:none;color:#6B6866;font-size:20px;cursor:pointer;}
.modal-close:hover{color:#FFFDF3;}
.modal-body{padding:20px;}
.modal-footer{padding:14px 20px;border-top:1px solid #333435;display:flex;gap:10px;justify-content:flex-end;}
.form-row{margin-bottom:14px;}
.form-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-bottom:6px;display:block;}
.form-input,.form-select{width:100%;padding:9px 12px;background:#2A2B2C;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;outline:none;transition:border-color .15s;}
.form-input::placeholder{color:#6B6866;}
.form-input:focus,.form-select:focus{border-color:#F58020;}
.form-select option{background:#2A2B2C;}
.form-hint{font-size:11px;color:#6B6866;margin-top:4px;font-weight:400;}
.ds-cell{background:#2A2B2C;padding:14px 12px;text-align:center;}
.ds-val{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#FFFDF3;line-height:1;}
.ds-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;margin-top:3px;font-weight:700;}
.reward-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px;}
.rwd-card{background:#252627;border:1px solid #333435;padding:16px;transition:border-color .15s;}
.rwd-card:hover{border-color:rgba(245,128,32,.4);}
.rwd-icon{font-size:24px;margin-bottom:8px;display:block;}
.rwd-name{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:700;color:#FFFDF3;margin-bottom:4px;}
.rwd-pts{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#F58020;}
.rwd-actions{display:flex;gap:6px;margin-top:12px;}
.tabs{display:flex;gap:0;border-bottom:1px solid #333435;margin-bottom:20px;}
.tab-btn{padding:9px 18px;background:none;border:none;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B6866;position:relative;transition:color .15s;}
.tab-btn.on{color:#F58020;}
.tab-btn.on::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:#F58020;}
.empty{padding:40px;text-align:center;color:#6B6866;font-size:13px;font-weight:500;border:1px solid #333435;}
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#F58020;color:#fff;padding:11px 24px;z-index:9999;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}
::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-track{background:#1F2020;}::-webkit-scrollbar-thumb{background:#333435;}
`;

function useToast() {
  const [t,setT]=useState({msg:"",on:false});
  const show=(msg,dur=2500)=>{setT({msg,on:true});setTimeout(()=>setT(x=>({...x,on:false})),dur);};
  return [t,show];
}

function Modal({title,onClose,children,footer}){
  return(<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-hdr"><div className="modal-title">{title}</div><button className="modal-close" onClick={onClose}>✕</button></div><div className="modal-body">{children}</div>{footer&&<div className="modal-footer">{footer}</div>}</div></div>);
}

function Dashboard({members,transactions,redemptions}){
  const active=members.filter(m=>m.status==="active").length;
  const pending=redemptions.filter(r=>r.status==="pending").length;
  const todayTxns=transactions.filter(t=>t.date===today());
  const todayPts=todayTxns.reduce((s,t)=>s+(t.pts>0?t.pts:0),0);
  const totalPts=members.reduce((s,m)=>s+m.points,0);
  const recent=[...transactions].slice(0,8);
  const TYPE_CFG={checkin:{label:"Check-in",color:C.cerulean},class:{label:"Class",color:C.orange},referral:{label:"Referral",color:C.success},bonus:{label:"Bonus",color:C.gold},manual:{label:"Manual",color:C.silver},redeem:{label:"Redeemed",color:C.danger},deduct:{label:"Deduction",color:C.danger}};
  return(<div><div className="stat-grid">{[{val:active,lbl:"Active Members",sub:`${members.length} total`,accent:C.orange},{val:totalPts.toLocaleString(),lbl:"Total Points Issued",sub:"across all members",accent:C.cerulean},{val:todayPts,lbl:"Points Awarded Today",sub:`${todayTxns.length} transactions`,accent:C.success},{val:pending,lbl:"Pending Redemptions",sub:"awaiting fulfilment",accent:C.warning}].map((s,i)=>(<div key={i} className="stat-card" style={{"--accent":s.accent}}><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>))}</div><div className="sec-hdr"><div className="sec-title">Recent Transactions</div></div><div className="tbl-wrap"><table><thead><tr><th>Member</th><th>Type</th><th>Points</th><th>Note</th><th>Date</th></tr></thead><tbody>{recent.map(t=>{const cfg=TYPE_CFG[t.type]||{label:t.type,color:C.muted};return(<tr key={t.id}><td><div style={{fontWeight:600}}>{t.memberName||t.member_name}</div></td><td><span className="badge" style={{background:`${cfg.color}18`,color:cfg.color}}>{cfg.label}</span></td><td style={{color:t.pts>0?C.success:C.danger,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{t.pts>0?"+":""}{t.pts}</td><td style={{color:C.muted}}>{t.note}</td><td className="mono" style={{color:C.muted}}>{fmtDate(t.date)}</td></tr>);})}</tbody></table></div></div>);
}

function Members({members,setMembers,transactions,tiers,onAward,toast}){
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [selected,setSelected]=useState(null);
  const [form,setForm]=useState({name:"",phone:"",email:"",status:"active"});
  const [saving,setSaving]=useState(false);

  const filtered=members.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.phone.includes(search)||m.id.includes(search));

  const handleAdd=async()=>{
    if(!form.name.trim()||!form.phone.trim()) return;
    setSaving(true);
    const nm={...form,id:genId("URZ"),joinDate:today(),points:0,checkins:0,streak:0,pin:null,lastCheckin:null};
    await upsertMember(nm);
    setMembers(prev=>[...prev,normalizeMember(nm)]);
    setShowAdd(false);setForm({name:"",phone:"",email:"",status:"active"});
    setSaving(false);toast("Member added successfully");
  };

  const toggleStatus=async(id,current)=>{
    const ns=current==="active"?"inactive":"active";
    await updateMemberStatus(id,ns);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,status:ns}:m));
    toast("Member status updated");
  };

  const handleResetPin=async(id,name)=>{
    await resetMemberPin(id);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,pin:null}:m));
    toast(`PIN reset for ${name}`);
  };

  const sel=selected?members.find(m=>m.id===selected):null;
  const selTxns=sel?transactions.filter(t=>(t.memberId||t.member_id)===sel.id).slice(0,10):[];
  const tier=sel?getTier(sel.points,tiers):null;

  return(<div>
    <div className="search-row"><input className="search-input" placeholder="Search by name, phone or ID…" value={search} onChange={e=>setSearch(e.target.value)}/><button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Member</button></div>
    <div className="tbl-wrap"><table><thead><tr><th>Member</th><th>ID</th><th>Phone</th><th>Tier</th><th>Points</th><th>Streak</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map(m=>{const t=getTier(m.points,tiers);return(<tr key={m.id} className="clickable" onClick={()=>setSelected(m.id)}><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="av" style={{background:`${C.orange}22`,color:C.orange}}>{initials(m.name)}</div><div style={{fontWeight:600}}>{m.name}</div></div></td><td className="mono" style={{color:C.muted}}>{m.id}</td><td className="mono">{m.phone}</td><td><span style={{color:t.color,fontWeight:700,fontSize:12}}>{t.icon} {t.name}</span></td><td><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{m.points.toLocaleString()}</span></td><td>🔥 {m.streak}d</td><td><span className={`badge badge-${m.status}`}>{m.status}</span></td><td onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>setSelected(m.id)}>View</button><button className="btn btn-ghost btn-sm" onClick={()=>onAward(m)}>Award</button></div></td></tr>);})}</tbody></table></div>

    {sel&&(<Modal title={`Member — ${sel.name}`} onClose={()=>setSelected(null)}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,marginBottom:20}}>
        {[{v:sel.points.toLocaleString(),l:"Points"},{v:`#${members.filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===sel.id)+1}`,l:"Rank"},{v:`🔥 ${sel.streak}d`,l:"Streak"},{v:sel.checkins,l:"Check-ins"}].map((s,i)=>(<div key={i} className="ds-cell"><div className="ds-val">{s.v}</div><div className="ds-lbl">{s.l}</div></div>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <div><label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,display:"block",marginBottom:4}}>ID</label><div className="mono" style={{color:C.muted,fontSize:12}}>{sel.id}</div></div>
        <div><label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,display:"block",marginBottom:4}}>Tier</label><div style={{color:tier?.color,fontWeight:700}}>{tier?.icon} {tier?.name}</div></div>
        <div><label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,display:"block",marginBottom:4}}>Phone</label><div className="mono">{sel.phone}</div></div>
        <div><label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,display:"block",marginBottom:4}}>Joined</label><div className="mono" style={{color:C.muted}}>{sel.joinDate?fmtDate(sel.joinDate):"—"}</div></div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,display:"block",marginBottom:8}}>Point History</label>
        {selTxns.length===0?<div style={{color:C.muted,fontSize:12}}>No transactions yet.</div>:selTxns.map(t=>(<div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}><div><div style={{fontSize:13,fontWeight:600}}>{t.note}</div><div className="mono" style={{fontSize:11,color:C.muted}}>{fmtDate(t.date)}</div></div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:t.pts>0?C.success:C.danger}}>{t.pts>0?"+":""}{t.pts}</div></div>))}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="btn btn-primary" onClick={()=>{setSelected(null);onAward(sel);}}>Award Points</button>
        <button className="btn btn-ghost" onClick={()=>toggleStatus(sel.id,sel.status)}>{sel.status==="active"?"Deactivate":"Activate"}</button>
        <button className="btn btn-ghost" style={{borderColor:C.warning,color:C.warning}} onClick={()=>handleResetPin(sel.id,sel.name)}>Reset PIN</button>
      </div>
      <div style={{marginTop:12,fontSize:11,color:C.muted,fontWeight:500}}>PIN Status: <span style={{color:sel.pin?C.success:C.danger,fontWeight:700}}>{sel.pin?"Set":"Not set"}</span></div>
    </Modal>)}

    {showAdd&&(<Modal title="Add New Member" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving...":"Add Member"}</button></>}>
      <div className="form-row"><label className="form-label">Full Name *</label><input className="form-input" placeholder="e.g. Alex Rivera" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
      <div className="form-row"><label className="form-label">Phone Number *</label><input className="form-input" placeholder="+961 XX XXX XXX" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
      <div className="form-row"><label className="form-label">Email (optional)</label><input className="form-input" placeholder="member@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
      <div className="form-hint">A unique member ID will be generated automatically.</div>
    </Modal>)}
  </div>);
}

function AwardPoints({members,setMembers,setTransactions,preSelected,toast}){
  const [form,setForm]=useState({memberId:preSelected?.id||"",pts:"",type:"checkin",note:""});
  const [saving,setSaving]=useState(false);
  const REASONS=[{v:"checkin",l:"Check-in (50 pts suggested)"},{v:"class",l:"Group Class (75 pts suggested)"},{v:"referral",l:"Referral (500 pts suggested)"},{v:"bonus",l:"Streak / Challenge Bonus"},{v:"manual",l:"Manual Adjustment"},{v:"deduct",l:"Deduction / Correction"}];
  useEffect(()=>{if(preSelected)setForm(f=>({...f,memberId:preSelected.id}));},[preSelected]);

  const handleSubmit=async()=>{
    const m=members.find(x=>x.id===form.memberId);
    if(!m||!form.pts||isNaN(Number(form.pts))) return;
    setSaving(true);
    const pts=form.type==="deduct"?-Math.abs(Number(form.pts)):Math.abs(Number(form.pts));
    const note=form.note||REASONS.find(r=>r.v===form.type)?.l.split(" (")[0]||form.type;
    const newPoints=Math.max(0,m.points+pts);
    await upsertMember({...m,points:newPoints,joinDate:m.joinDate});
    setMembers(prev=>prev.map(x=>x.id===m.id?{...x,points:newPoints}:x));
    const txn={id:genId("TXN"),memberId:m.id,memberName:m.name,type:form.type,pts,note,date:today()};
    await addTransaction(txn);
    setTransactions(prev=>[txn,...prev]);
    setForm({memberId:"",pts:"",type:"checkin",note:""});
    setSaving(false);
    toast(`${pts>0?"+":""}${pts} pts ${pts>0?"awarded to":"deducted from"} ${m.name}`);
  };

  return(<div style={{maxWidth:520}}>
    <div className="form-row"><label className="form-label">Select Member *</label><select className="form-select" value={form.memberId} onChange={e=>setForm({...form,memberId:e.target.value})}><option value="">— choose a member —</option>{[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=>(<option key={m.id} value={m.id}>{m.name} — {m.id} ({m.points.toLocaleString()} pts)</option>))}</select></div>
    <div className="form-row"><label className="form-label">Reason *</label><select className="form-select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{REASONS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}</select></div>
    <div className="form-row"><label className="form-label">Points Amount *</label><input className="form-input" type="number" min="1" placeholder="e.g. 50" value={form.pts} onChange={e=>setForm({...form,pts:e.target.value})}/>{form.type==="deduct"&&<div className="form-hint" style={{color:C.danger}}>Points will be deducted from the member's balance.</div>}</div>
    <div className="form-row"><label className="form-label">Note (optional)</label><input className="form-input" placeholder="e.g. Attended Thursday HIIT class" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{marginTop:4}}>{saving?"Saving...":(form.type==="deduct"?"Deduct Points":"Award Points")}</button>
  </div>);
}

function Redemptions({redemptions,setRedemptions,setMembers,setTransactions,toast}){
  const [tab,setTab]=useState("pending");
  const list=redemptions.filter(r=>r.status===tab);

  const fulfill=async(rdm)=>{
    await updateRedemptionStatus(rdm.id,"fulfilled");
    const pts=Math.abs(rdm.pts);
    setRedemptions(prev=>prev.map(r=>r.id===rdm.id?{...r,status:"fulfilled"}:r));
    setMembers(prev=>prev.map(m=>m.id===(rdm.memberId||rdm.member_id)?{...m,points:Math.max(0,m.points-pts)}:m));
    const txn={id:genId("TXN"),memberId:rdm.memberId||rdm.member_id,memberName:rdm.memberName||rdm.member_name,type:"redeem",pts:-pts,note:`Redeemed: ${rdm.reward}`,date:today()};
    await addTransaction(txn);
    setTransactions(prev=>[txn,...prev]);
    toast(`Fulfilled: ${rdm.reward}`);
  };

  const cancel=async(id)=>{
    await updateRedemptionStatus(id,"cancelled");
    setRedemptions(prev=>prev.map(r=>r.id===id?{...r,status:"cancelled"}:r));
    toast("Redemption cancelled");
  };

  return(<div>
    <div className="tabs">{["pending","fulfilled","cancelled"].map(t=>(<button key={t} className={`tab-btn${tab===t?" on":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)} ({redemptions.filter(r=>r.status===t).length})</button>))}</div>
    {list.length===0?<div className="empty">No {tab} redemptions.</div>:<div className="tbl-wrap"><table><thead><tr><th>Member</th><th>Reward</th><th>Cost</th><th>Requested</th><th>Status</th>{tab==="pending"&&<th>Actions</th>}</tr></thead><tbody>{list.map(r=>(<tr key={r.id}><td style={{fontWeight:600}}>{r.memberName||r.member_name}</td><td>{r.reward}</td><td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{r.pts.toLocaleString()}</td><td className="mono" style={{color:C.muted}}>{fmtDate(r.date)}</td><td><span className={`badge badge-${r.status}`}>{r.status}</span></td>{tab==="pending"&&<td><div style={{display:"flex",gap:6}}><button className="btn btn-success btn-sm" onClick={()=>fulfill(r)}>✓ Fulfill</button><button className="btn btn-danger btn-sm" onClick={()=>cancel(r.id)}>✕ Cancel</button></div></td>}</tr>))}</tbody></table></div>}
  </div>);
}

function RewardsCatalog({rewards,setRewards,toast}){
  const [editing,setEditing]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({name:"",pts:"",cat:"Access",icon:"🎁",stock:true});
  const [saving,setSaving]=useState(false);

  const saveEdit=async()=>{setSaving(true);await upsertReward(editing);setRewards(prev=>prev.map(r=>r.id===editing.id?editing:r));setEditing(null);setSaving(false);toast("Reward updated");};
  const handleAdd=async()=>{if(!form.name||!form.pts) return;setSaving(true);const nr={...form,pts:Number(form.pts),id:genId("RWD")};await upsertReward(nr);setRewards(prev=>[...prev,nr]);setShowAdd(false);setForm({name:"",pts:"",cat:"Access",icon:"🎁",stock:true});setSaving(false);toast("Reward added");};
  const del=async(id)=>{await deleteReward(id);setRewards(prev=>prev.filter(r=>r.id!==id));toast("Reward removed");};
  const toggleStock=async(r)=>{const nr={...r,stock:!r.stock};await upsertReward(nr);setRewards(prev=>prev.map(x=>x.id===r.id?nr:x));};

  return(<div>
    <div className="sec-hdr"><div className="sec-title">Rewards Catalog ({rewards.length})</div><button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Reward</button></div>
    <div className="reward-grid">{rewards.map(r=>(<div key={r.id} className="rwd-card" style={{opacity:r.stock?1:0.5}}><span className="rwd-icon">{r.icon}</span><div className="rwd-name">{r.name}</div><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,marginBottom:4,fontWeight:700}}>{r.cat}</div><div className="rwd-pts">{r.pts.toLocaleString()} <span style={{fontSize:12,color:C.muted}}>PTS</span></div><div style={{fontSize:11,color:r.stock?C.success:C.danger,marginTop:4,fontWeight:700}}>{r.stock?"● In Stock":"● Out of Stock"}</div><div className="rwd-actions"><button className="btn btn-ghost btn-sm" onClick={()=>setEditing({...r})}>Edit</button><button className="btn btn-ghost btn-sm" onClick={()=>toggleStock(r)}>{r.stock?"OOS":"In Stock"}</button><button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}>✕</button></div></div>))}</div>
    {editing&&(<Modal title="Edit Reward" onClose={()=>setEditing(null)} footer={<><button className="btn btn-ghost" onClick={()=>setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving?"Saving...":"Save"}</button></>}>{[{l:"Name",k:"name",t:"text"},{l:"Points Cost",k:"pts",t:"number"},{l:"Icon (emoji)",k:"icon",t:"text"}].map(f=>(<div key={f.k} className="form-row"><label className="form-label">{f.l}</label><input className="form-input" type={f.t} value={editing[f.k]} onChange={e=>setEditing({...editing,[f.k]:f.t==="number"?Number(e.target.value):e.target.value})}/></div>))}<div className="form-row"><label className="form-label">Category</label><select className="form-select" value={editing.cat} onChange={e=>setEditing({...editing,cat:e.target.value})}>{["Access","Merch","Training"].map(c=><option key={c}>{c}</option>)}</select></div><div className="form-row"><label className="form-label">Stock</label><select className="form-select" value={editing.stock?"true":"false"} onChange={e=>setEditing({...editing,stock:e.target.value==="true"})}><option value="true">In Stock</option><option value="false">Out of Stock</option></select></div></Modal>)}
    {showAdd&&(<Modal title="Add New Reward" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving...":"Add Reward"}</button></>}>{[{l:"Name",k:"name",t:"text"},{l:"Points Cost",k:"pts",t:"number"},{l:"Icon (emoji)",k:"icon",t:"text"}].map(f=>(<div key={f.k} className="form-row"><label className="form-label">{f.l}</label><input className="form-input" type={f.t} value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}/></div>))}<div className="form-row"><label className="form-label">Category</label><select className="form-select" value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>{["Access","Merch","Training"].map(c=><option key={c}>{c}</option>)}</select></div></Modal>)}
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
    setTiers(sorted);setSaving(false);toast("Tier settings saved");
  };
  const update=(id,field,val)=>setLocal(prev=>prev.map(t=>t.id===id?{...t,[field]:field==="min"?Number(val):val}:t));

  return(<div style={{maxWidth:600}}>
    <div className="sec-hdr" style={{marginBottom:8}}><div className="sec-title">Check-In QR Code</div></div>
    <div style={{background:"#252627",border:"1px solid #333435",padding:20,marginBottom:28}}>
      <div style={{fontSize:13,color:C.muted,fontWeight:500,marginBottom:16,lineHeight:1.6}}>Print this QR code and display it at the gym entrance. Members scan it to check in and earn 50 points automatically.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button className="btn btn-primary" style={{width:"auto",padding:"8px 20px"}} onClick={()=>setShowQR(true)}>Show QR Code</button>
        <a href={`${siteUrl}/checkin`} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",padding:"8px 20px",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",textDecoration:"none"}}>Test Check-In Page</a>
      </div>
    </div>
    {showQR&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowQR(false)}><div style={{background:"#252627",border:`1px solid ${C.border}`,padding:32,maxWidth:380,width:"100%",textAlign:"center"}} onClick={e=>e.stopPropagation()}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:2,color:"#FFFDF3",marginBottom:4}}>Check-In QR Code</div><div style={{fontSize:11,color:C.muted,marginBottom:20,fontWeight:500}}>Display at the gym entrance</div><div style={{background:"#fff",padding:16,display:"inline-block",marginBottom:16}}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(siteUrl+"/checkin")}&bgcolor=ffffff&color=1F2020&margin=0`} alt="QR" width={240} height={240}/></div><div style={{fontSize:11,color:C.muted,marginBottom:20,fontFamily:"'JetBrains Mono',monospace"}}>{siteUrl}/checkin</div><div style={{display:"flex",gap:8,justifyContent:"center"}}><button className="btn btn-primary" style={{width:"auto",padding:"8px 20px"}} onClick={()=>window.print()}>Print</button><button className="btn btn-ghost" style={{width:"auto",padding:"8px 20px"}} onClick={()=>setShowQR(false)}>Close</button></div></div></div>)}
    <div className="sec-hdr"><div className="sec-title">Tier Configuration</div><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Saving...":"Save Tiers"}</button></div>
    <div style={{marginBottom:8,fontSize:12,color:C.muted,fontWeight:500}}>Edit tier names, minimum point thresholds, and icons.</div>
    <div className="tbl-wrap" style={{marginTop:16}}><table><thead><tr><th>#</th><th>Icon</th><th>Tier Name</th><th>Min Points</th><th>Color</th></tr></thead><tbody>{[...local].sort((a,b)=>a.min-b.min).map((t,i)=>(<tr key={t.id}><td style={{color:C.muted,fontWeight:700}}>{i+1}</td><td><input className="form-input" style={{width:60,textAlign:"center",fontSize:20}} value={t.icon} onChange={e=>update(t.id,"icon",e.target.value)}/></td><td><input className="form-input" value={t.name} onChange={e=>update(t.id,"name",e.target.value)}/></td><td><input className="form-input" type="number" min="0" value={t.min} onChange={e=>update(t.id,"min",e.target.value)} disabled={i===0} style={{opacity:i===0?0.5:1}}/>{i===0&&<div className="form-hint">Always starts at 0</div>}</td><td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,background:t.color,border:`1px solid ${C.border}`}}/><input className="form-input" value={t.color} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}} onChange={e=>update(t.id,"color",e.target.value)}/></div></td></tr>))}</tbody></table></div>
  </div>);
}

const NAV=[{id:"dashboard",icon:"◉",label:"Dashboard"},{id:"members",icon:"⊞",label:"Members"},{id:"award",icon:"◆",label:"Award Points"},{id:"redemptions",icon:"🎟",label:"Redemptions"},{id:"rewards",icon:"⭐",label:"Rewards"},{id:"settings",icon:"⚙",label:"Settings"}];

export default function AdminPanel(){
  const [page,setPage]           = useState("dashboard");
  const [members,setMembers]     = useState([]);
  const [transactions,setTxns]  = useState([]);
  const [redemptions,setRdms]   = useState([]);
  const [rewards,setRewards]    = useState(DEF_REWARDS);
  const [tiers,setTiers]        = useState(DEF_TIERS);
  const [awardTarget,setAwardTarget] = useState(null);
  const [loaded,setLoaded]      = useState(false);
  const [toast,showToast]       = useToast();

  useEffect(()=>{
    (async()=>{
      const [m,t,r,rw,ti]=await Promise.all([getMembers(),getTransactions(),getRedemptions(),getRewards(),getTiers()]);
      setMembers(m.map(normalizeMember));setTxns(t);setRdms(r);
      setRewards(rw.length?rw:DEF_REWARDS);
      setTiers(ti.length?ti:DEF_TIERS);
      setLoaded(true);
    })();
  },[]);

  const goAward=(member)=>{setAwardTarget(member);setPage("award");};
  const pending=redemptions.filter(r=>r.status==="pending").length;

  if(!loaded) return(<><style>{CSS}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1F2020"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:4,color:"#F58020"}}>LOADING…</div></div></>);

  return(
    <>
      <style>{CSS}</style>
      <div className="admin">
        <div className="sidebar">
          <div className="sb-brand"><div className="sb-logo">URUZ</div><div className="sb-sub">Admin Panel</div></div>
          <div className="sb-nav">
            <div className="sb-section">Navigation</div>
            {NAV.map(n=>(<button key={n.id} className={`sb-btn${page===n.id?" on":""}`} onClick={()=>setPage(n.id)}><span className="sb-icon">{n.icon}</span>{n.label}{n.id==="redemptions"&&pending>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:10,fontWeight:800,padding:"1px 6px"}}>{pending}</span>}</button>))}
          </div>
          <div className="sb-footer"><div className="sb-admin">Staff Admin</div><div style={{marginTop:2}}>URUZ Athletics</div></div>
        </div>
        <div className="main">
          <div className="topbar"><div className="topbar-title">{NAV.find(n=>n.id===page)?.label}</div><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:8,height:8,borderRadius:"50%",background:C.success}}/><div className="topbar-date">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div></div></div>
          <div className="content" key={page}>
            {page==="dashboard"  &&<Dashboard members={members} transactions={transactions} redemptions={redemptions}/>}
            {page==="members"    &&<Members members={members} setMembers={setMembers} transactions={transactions} tiers={tiers} onAward={goAward} toast={showToast}/>}
            {page==="award"      &&<AwardPoints members={members} setMembers={setMembers} setTransactions={setTxns} preSelected={awardTarget} toast={showToast}/>}
            {page==="redemptions"&&<Redemptions redemptions={redemptions} setRedemptions={setRdms} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="rewards"    &&<RewardsCatalog rewards={rewards} setRewards={setRewards} toast={showToast}/>}
            {page==="settings"   &&<Settings tiers={tiers} setTiers={setTiers} toast={showToast}/>}
          </div>
        </div>
        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
      </div>
    </>
  );
}
