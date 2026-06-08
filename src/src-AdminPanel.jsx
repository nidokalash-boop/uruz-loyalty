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

const ROLES = {
  owner:      { label:"Owner",      color:"#F58020", icon:"👑", level:4 },
  manager:    { label:"Manager",    color:"#D4AF37", icon:"⭐", level:3 },
  front_desk: { label:"Front Desk", color:"#026F91", icon:"🔑", level:2 },
  trainer:    { label:"Trainer",    color:"#22C55E", icon:"💪", level:1 },
};

const PERMISSIONS = {
  owner:      ["dashboard","members","award","redemptions","rewards","staff","display","workouts","challenges","earn","referrals","export","settings"],
  manager:    ["dashboard","members","award","redemptions","rewards","display","workouts","challenges","earn","referrals","export"],
  front_desk: ["dashboard","members","award","redemptions"],
  trainer:    ["dashboard","members","award"],
};

function canAccess(role, page) {
  return (PERMISSIONS[role] || []).includes(page);
}

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
    lastCheckin:   m.last_checkin   || m.lastCheckin   || null,
    birthday:      m.birthday       || null,
    referral_code: m.referral_code  || null,
  };
}

function getTierFn(pts, tiers) { return [...tiers].sort((a,b)=>b.min-a.min).find(t=>pts>=t.min)||tiers[0]; }
function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return d||""; } }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function getStaffSession() { try { const v=localStorage.getItem("uruz:staff"); return v?JSON.parse(v):null; } catch { return null; } }
function saveStaffSession(d) { try { localStorage.setItem("uruz:staff",JSON.stringify(d)); } catch {} }
function clearStaffSession() { try { localStorage.removeItem("uruz:staff"); } catch {} }

function useToast() {
  const [t,setT]=useState({msg:"",on:false});
  const show=(msg)=>{setT({msg,on:true});setTimeout(()=>setT(x=>({...x,on:false})),2500);};
  return [t,show];
}

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:#1F2020;color:#FFFDF3;font-family:'Montserrat',sans-serif;}
.admin{display:flex;height:100vh;overflow:hidden;background:#1F2020;}
.sidebar{width:220px;flex-shrink:0;background:#252627;border-right:1px solid #333435;display:flex;flex-direction:column;overflow:hidden;}
.sb-brand{padding:20px 18px 16px;border-bottom:1px solid #333435;}
.sb-logo{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:#F58020;}
.sb-sub{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-top:2px;}
.sb-nav{flex:1;padding:10px 0;overflow-y:auto;}
.sb-section{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;padding:12px 18px 6px;}
.sb-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 18px;background:none;border:none;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:600;color:#6B6866;text-align:left;transition:all .15s;}
.sb-btn:hover{color:#FFFDF3;background:rgba(255,255,255,.04);}
.sb-btn.on{color:#F58020;background:rgba(245,128,32,.1);border-left:2px solid #F58020;}
.sb-btn:disabled{opacity:0.3;cursor:not-allowed;}
.sb-icon{font-size:15px;width:18px;text-align:center;}
.sb-footer{padding:14px 18px;border-top:1px solid #333435;}
.sb-staff-name{color:#FFFDF3;font-weight:700;font-size:13px;}
.sb-staff-role{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-top:2px;}
.sb-logout{width:100%;margin-top:10px;padding:7px;background:none;border:1px solid #333435;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.sb-logout:hover{border-color:#EF4444;color:#EF4444;}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.topbar{height:54px;flex-shrink:0;background:#252627;border-bottom:1px solid #333435;display:flex;align-items:center;justify-content:space-between;padding:0 24px;}
.topbar-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#FFFDF3;}
.topbar-date{font-size:11px;color:#6B6866;font-weight:500;font-family:'JetBrains Mono',monospace;}
.content{flex:1;overflow-y:auto;padding:24px;}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
.stat-card{background:#252627;border:1px solid #333435;padding:18px;position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent,#F58020);}
.stat-val{font-family:'Bebas Neue',sans-serif;font-size:42px;line-height:1;color:#FFFDF3;}
.stat-lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;margin-top:4px;font-weight:700;}
.stat-sub{font-size:11px;color:#6B6866;margin-top:6px;font-weight:500;}
.sec-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.sec-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:#FFFDF3;}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;transition:all .15s;}
.btn-primary{background:#F58020;color:#fff;}
.btn-primary:hover{background:#F59340;}
.btn-primary:disabled{background:#333435;color:#6B6866;cursor:not-allowed;}
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
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;}
.modal{background:#252627;border:1px solid #333435;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;animation:slideup .25s cubic-bezier(0.16,1,0.3,1);}
@keyframes slideup{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #333435;}
.modal-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#FFFDF3;}
.modal-close{background:none;border:none;color:#6B6866;font-size:20px;cursor:pointer;}
.modal-body{padding:20px;}
.modal-footer{padding:14px 20px;border-top:1px solid #333435;display:flex;gap:10px;justify-content:flex-end;}
.form-row{margin-bottom:14px;}
.form-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-bottom:6px;display:block;}
.form-input,.form-select{width:100%;padding:9px 12px;background:#2A2B2C;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;outline:none;transition:border-color .15s;}
.form-input::placeholder{color:#6B6866;}
.form-input:focus,.form-select:focus{border-color:#F58020;}
.form-select option{background:#2A2B2C;}
.form-hint{font-size:11px;color:#6B6866;margin-top:4px;}
.ds-cell{background:#2A2B2C;padding:14px 12px;text-align:center;}
.ds-val{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#FFFDF3;line-height:1;}
.ds-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;margin-top:3px;font-weight:700;}
.reward-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px;}
.rwd-card{background:#252627;border:1px solid #333435;padding:16px;transition:border-color .15s;}
.rwd-card:hover{border-color:rgba(245,128,32,.4);}
.rwd-icon{font-size:24px;margin-bottom:8px;display:block;}
.rwd-name{font-weight:700;color:#FFFDF3;margin-bottom:4px;font-size:14px;}
.rwd-pts{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#F58020;}
.rwd-actions{display:flex;gap:6px;margin-top:12px;}
.tabs{display:flex;gap:0;border-bottom:1px solid #333435;margin-bottom:20px;}
.tab-btn{padding:9px 18px;background:none;border:none;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B6866;position:relative;transition:color .15s;}
.tab-btn.on{color:#F58020;}
.tab-btn.on::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:#F58020;}
.empty{padding:40px;text-align:center;color:#6B6866;font-size:13px;border:1px solid #333435;}
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#F58020;color:#fff;padding:11px 24px;z-index:9999;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}

/* LOGIN */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#1F2020;position:relative;overflow:hidden;}
.login-wrap::before{content:'URUZ';position:fixed;right:-30px;bottom:-20px;font-family:'Bebas Neue',sans-serif;font-size:200px;letter-spacing:8px;color:rgba(245,128,32,0.04);pointer-events:none;user-select:none;}
.login-box{width:100%;max-width:400px;background:#252627;border:1px solid #333435;padding:36px 28px;}
.login-brand{font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:4px;color:#F58020;text-align:center;}
.login-sub{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#6B6866;text-align:center;margin-top:3px;font-weight:700;}
.login-divider{height:1px;background:#333435;margin:24px 0;}
.login-step{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#FFFDF3;text-align:center;margin-bottom:6px;}
.login-hint{font-size:12px;color:#6B6866;text-align:center;margin-bottom:20px;line-height:1.6;}
.login-inp{width:100%;padding:12px 14px;background:#2A2B2C;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:500;outline:none;transition:border-color .15s;margin-bottom:14px;}
.login-inp:focus{border-color:#F58020;}
.login-btn{width:100%;padding:13px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:background .15s;margin-bottom:10px;}
.login-btn:hover{background:#F59340;}
.login-btn:disabled{background:#333435;color:#6B6866;cursor:not-allowed;}
.login-btn-ghost{width:100%;padding:13px;background:none;border:1px solid #333435;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.login-btn-ghost:hover{border-color:#F58020;color:#F58020;}
.login-err{font-size:12px;color:#EF4444;text-align:center;margin-bottom:12px;font-weight:500;}
.role-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
.role-card{padding:14px;background:#2A2B2C;border:1px solid #333435;cursor:pointer;text-align:center;transition:all .15s;}
.role-card:hover,.role-card.sel{border-color:#F58020;background:rgba(245,128,32,.08);}
.role-icon{font-size:24px;display:block;margin-bottom:6px;}
.role-name{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.pin-row{display:flex;gap:10px;justify-content:center;margin-bottom:20px;}
.pin-digit{width:52px;height:64px;background:#2A2B2C;border:1px solid #333435;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:32px;color:#F58020;transition:border-color .15s;}
.pin-digit.filled{border-color:#F58020;}
.pin-digit.active{border-color:#F58020;box-shadow:0 0 0 1px #F58020;}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}
.pin-key{padding:16px;background:#2A2B2C;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:18px;font-weight:700;cursor:pointer;text-align:center;transition:all .15s;user-select:none;}
.pin-key:hover{background:#333435;border-color:#F58020;}
.pin-key:active{background:#F58020;color:#fff;}
.pin-key.del{color:#6B6866;font-size:14px;}
.pin-key.empty{background:transparent;border-color:transparent;pointer-events:none;}
.staff-chip{display:flex;align-items:center;gap:12px;background:#2A2B2C;border:1px solid #333435;padding:12px 14px;margin-bottom:20px;}
.chip-av{width:40px;height:40px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;flex-shrink:0;}

/* DISPLAY SETTINGS */
.display-section{background:#252627;border:1px solid #333435;padding:20px;margin-bottom:16px;}
.display-section-title{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:#FFFDF3;margin-bottom:14px;}
.slide-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #333435;}
.slide-row:last-child{border-bottom:none;}
.toggle{width:40px;height:22px;background:#333435;border-radius:11px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;}
.toggle.on{background:#F58020;}
.toggle::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .2s;}
.toggle.on::after{transform:translateX(18px);}
.ch-edit-row{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:center;margin-bottom:10px;}

::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#1F2020;}::-webkit-scrollbar-thumb{background:#333435;}
`;

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

// ── ADMIN LOGIN ───────────────────────────────────────────
function AdminLogin({ onLogin, staffList }) {
  const [stage, setStage]   = useState(staffList.length === 0 ? "setup" : "name");
  const [name, setName]     = useState("");
  const [role, setRole]     = useState("");
  const [pin, setPin]       = useState("");
  const [pin2, setPin2]     = useState("");
  const [selStaff, setSelStaff] = useState(null);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const handleNameContinue = () => {
    const found = staffList.find(s => s.name.toLowerCase() === name.trim().toLowerCase());
    if (!found) { setError("Staff member not found. Ask the owner to add you."); return; }
    setSelStaff(found); setError(""); setStage("pin");
  };

  const handlePin = () => {
    if (pin !== selStaff.pin) { setError("Incorrect PIN."); setPin(""); return; }
    saveStaffSession({ id: selStaff.id, name: selStaff.name, role: selStaff.role });
    onLogin({ id: selStaff.id, name: selStaff.name, role: selStaff.role });
  };

  useEffect(() => { if (stage === "pin" && pin.length === 4) handlePin(); }, [pin, stage]);

  const handleSetup = async () => {
    if (!name.trim() || !role || pin.length < 4) { setError("Fill in all fields."); return; }
    setSaving(true);
    const owner = { id: genId("STF"), name: name.trim(), role, pin, status: "active" };
    await upsertStaff(owner);
    saveStaffSession({ id: owner.id, name: owner.name, role: owner.role });
    onLogin({ id: owner.id, name: owner.name, role: owner.role });
  };

  const handleConfirmPin = async () => {
    if (pin2 !== pin) { setError("PINs don't match."); setPin2(""); return; }
    if (!name.trim() || !role) { setError("Fill in all fields."); return; }
    setSaving(true);
    const owner = { id: genId("STF"), name: name.trim(), role, pin, status: "active" };
    await upsertStaff(owner);
    saveStaffSession({ id: owner.id, name: owner.name, role: owner.role });
    onLogin({ id: owner.id, name: owner.name, role: owner.role });
  };

  useEffect(() => { if (stage === "confirmpin" && pin2.length === 4) handleConfirmPin(); }, [pin2, stage]);

  return (
    <>
      <style>{CSS}</style>
      <div className="login-wrap">
        <div className="login-box">
          <div className="login-brand">URUZ</div>
          <div className="login-sub">Member Central — Admin</div>
          <div className="login-divider"/>

          {stage === "setup" && (
            <>
              <div className="login-step">First Time Setup</div>
              <div className="login-hint">Create your owner account to get started</div>
              <div className="form-row">
                <label className="form-label">Your Name</label>
                <input className="login-inp" placeholder="e.g. Nidal" value={name} onChange={e=>setName(e.target.value)}/>
              </div>
              <div className="form-row">
                <label className="form-label">Your Role</label>
                <div className="role-grid">
                  {Object.entries(ROLES).map(([k,v])=>(
                    <div key={k} className={`role-card${role===k?" sel":""}`} onClick={()=>setRole(k)}>
                      <span className="role-icon">{v.icon}</span>
                      <div className="role-name" style={{color:role===k?v.color:"#6B6866"}}>{v.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">Create Your PIN</label>
                <PinInput value={pin} onChange={v=>{setPin(v);setError("");}}/>
              </div>
              {error&&<div className="login-err">{error}</div>}
              <button className="login-btn" onClick={()=>{if(!name||!role||pin.length<4){setError("Complete all fields.");return;}setStage("confirmpin");}} disabled={pin.length<4||!role||!name}>Continue</button>
            </>
          )}

          {stage === "confirmpin" && (
            <>
              <div className="login-step">Confirm Your PIN</div>
              <div className="login-hint">Enter your PIN again to confirm</div>
              <PinInput value={pin2} onChange={v=>{setPin2(v);setError("");}}/>
              {error&&<div className="login-err">{error}</div>}
            </>
          )}

          {stage === "name" && (
            <>
              <div className="login-step">Staff Sign In</div>
              <div className="login-hint">Enter your name to continue</div>
              <input className="login-inp" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleNameContinue()}/>
              {error&&<div className="login-err">{error}</div>}
              <button className="login-btn" onClick={handleNameContinue}>Continue</button>
            </>
          )}

          {stage === "pin" && selStaff && (
            <>
              <div className="staff-chip">
                <div className="chip-av" style={{background:`${ROLES[selStaff.role]?.color}22`,color:ROLES[selStaff.role]?.color}}>
                  {initials(selStaff.name)}
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#FFFDF3"}}>{selStaff.name}</div>
                  <div style={{fontSize:11,color:ROLES[selStaff.role]?.color,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{ROLES[selStaff.role]?.icon} {ROLES[selStaff.role]?.label}</div>
                </div>
              </div>
              <div className="login-hint">Enter your PIN</div>
              <PinInput value={pin} onChange={v=>{setPin(v);setError("");}}/>
              {error&&<div className="login-err">{error}</div>}
              <button className="login-btn-ghost" onClick={()=>{setStage("name");setPin("");setSelStaff(null);setName("");}}>Back</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────
function Dashboard({members,transactions,redemptions}){
  const active=members.filter(m=>m.status==="active").length;
  const pending=redemptions.filter(r=>r.status==="pending").length;
  const todayTxns=transactions.filter(t=>t.date===today());
  const todayPts=todayTxns.reduce((s,t)=>s+(t.pts>0?t.pts:0),0);
  const totalPts=members.reduce((s,m)=>s+m.points,0);
  const recent=[...transactions].slice(0,8);
  const TYPE_CFG={checkin:{label:"Check-in",color:C.cerulean},class:{label:"Class",color:C.orange},referral:{label:"Referral",color:C.success},bonus:{label:"Bonus",color:C.gold},manual:{label:"Manual",color:C.silver},redeem:{label:"Redeemed",color:C.danger},deduct:{label:"Deduction",color:C.danger}};
  return(<div><div className="stat-grid">{[{val:active,lbl:"Active Members",sub:`${members.length} total`,accent:C.orange},{val:totalPts.toLocaleString(),lbl:"Total Points Issued",sub:"across all members",accent:C.cerulean},{val:todayPts,lbl:"Points Today",sub:`${todayTxns.length} transactions`,accent:C.success},{val:pending,lbl:"Pending Redemptions",sub:"awaiting fulfilment",accent:C.warning}].map((s,i)=>(<div key={i} className="stat-card" style={{"--accent":s.accent}}><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>))}</div><div className="sec-hdr"><div className="sec-title">Recent Transactions</div></div><div className="tbl-wrap"><table><thead><tr><th>Member</th><th>Type</th><th>Points</th><th>Note</th><th>Date</th></tr></thead><tbody>{recent.map(t=>{const cfg=TYPE_CFG[t.type]||{label:t.type,color:C.muted};return(<tr key={t.id}><td style={{fontWeight:600}}>{t.memberName||t.member_name}</td><td><span className="badge" style={{background:`${cfg.color}18`,color:cfg.color}}>{cfg.label}</span></td><td style={{color:t.pts>0?C.success:C.danger,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{t.pts>0?"+":""}{t.pts}</td><td style={{color:C.muted}}>{t.note}</td><td className="mono" style={{color:C.muted}}>{fmtDate(t.date)}</td></tr>);})}</tbody></table></div></div>);
}

// ── MEMBERS ───────────────────────────────────────────────
function Members({members,setMembers,transactions,tiers,onAward,toast,role}){
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [selected,setSelected]=useState(null);
  const [form,setForm]=useState({name:"",phone:"",email:"",status:"active",birthday:""});
  const [saving,setSaving]=useState(false);
  const canAdd=canAccess(role,"members")&&role!=="trainer";
  const filtered=members.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.phone.includes(search)||m.id.includes(search));

  const handleAdd=async()=>{
    if(!form.name.trim()||!form.phone.trim()) return;
    setSaving(true);
    const nm={...form,id:genId("URZ"),joinDate:today(),points:0,checkins:0,streak:0,pin:null,lastCheckin:null};
    await upsertMember(nm);
    setMembers(prev=>[...prev,normalizeMember(nm)]);
    setShowAdd(false);setForm({name:"",phone:"",email:"",status:"active",birthday:""});setSaving(false);
    toast("Member added");
  };

  const toggleStatus=async(id,current)=>{
    const ns=current==="active"?"inactive":"active";
    await updateMemberStatus(id,ns);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,status:ns}:m));
    toast("Status updated");
  };

  const handleResetPin=async(id,name)=>{
    await resetMemberPin(id);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,pin:null}:m));
    toast(`PIN reset for ${name}`);
  };

  const sel=selected?members.find(m=>m.id===selected):null;
  const selTxns=sel?transactions.filter(t=>(t.memberId||t.member_id)===sel.id).slice(0,10):[];
  const tier=sel?getTierFn(sel.points,tiers):null;

  return(<div>
    <div className="search-row">
      <input className="search-input" placeholder="Search by name, phone or ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
      {canAdd&&<button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Member</button>}
    </div>
    <div className="tbl-wrap"><table><thead><tr><th>Member</th><th>ID</th><th>Phone</th><th>Tier</th><th>Points</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map(m=>{const t=getTierFn(m.points,tiers);return(<tr key={m.id} className="clickable" onClick={()=>setSelected(m.id)}><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="av" style={{background:`${C.orange}22`,color:C.orange}}>{initials(m.name)}</div><div style={{fontWeight:600}}>{m.name}</div></div></td><td className="mono" style={{color:C.muted}}>{m.id}</td><td className="mono">{m.phone}</td><td><span style={{color:t.color,fontWeight:700,fontSize:12}}>{t.icon} {t.name}</span></td><td><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{m.points.toLocaleString()}</span></td><td><span className={`badge badge-${m.status}`}>{m.status}</span></td><td onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>setSelected(m.id)}>View</button><button className="btn btn-ghost btn-sm" onClick={()=>onAward(m)}>Award</button></div></td></tr>);})}</tbody></table></div>

    {sel&&(<Modal title={`Member — ${sel.name}`} onClose={()=>setSelected(null)}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,marginBottom:20}}>
        {[{v:sel.points.toLocaleString(),l:"Points"},{v:`#${members.filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===sel.id)+1}`,l:"Rank"},{v:`🔥${sel.streak}d`,l:"Streak"},{v:sel.checkins,l:"Check-ins"}].map((s,i)=>(<div key={i} className="ds-cell"><div className="ds-val">{s.v}</div><div className="ds-lbl">{s.l}</div></div>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <div><label className="form-label">ID</label><div className="mono" style={{color:C.muted,fontSize:12}}>{sel.id}</div></div>
        <div><label className="form-label">Tier</label><div style={{color:tier?.color,fontWeight:700}}>{tier?.icon} {tier?.name}</div></div>
        <div><label className="form-label">Phone</label><div className="mono">{sel.phone}</div></div>
        <div><label className="form-label">Joined</label><div className="mono" style={{color:C.muted}}>{sel.joinDate?fmtDate(sel.joinDate):"—"}</div></div>
        <div><label className="form-label">Birthday</label><div className="mono" style={{color:C.muted}}>{sel.birthday||"—"}</div></div>
        <div><label className="form-label">Referral Code</label><div className="mono" style={{color:C.orange,fontWeight:700}}>{sel.referral_code||"—"}</div></div>
      </div>
      <div style={{marginBottom:16}}>
        <label className="form-label">Point History</label>
        {selTxns.length===0?<div style={{color:C.muted,fontSize:12}}>No transactions yet.</div>:selTxns.map(t=>(<div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}><div><div style={{fontSize:13,fontWeight:600}}>{t.note}</div><div className="mono" style={{fontSize:11,color:C.muted}}>{fmtDate(t.date)}</div></div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:t.pts>0?C.success:C.danger}}>{t.pts>0?"+":""}{t.pts}</div></div>))}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="btn btn-primary" onClick={()=>{setSelected(null);onAward(sel);}}>Award Points</button>
        {canAdd&&<button className="btn btn-ghost" onClick={()=>toggleStatus(sel.id,sel.status)}>{sel.status==="active"?"Deactivate":"Activate"}</button>}
        {role==="owner"&&<button className="btn btn-ghost" style={{borderColor:C.warning,color:C.warning}} onClick={()=>handleResetPin(sel.id,sel.name)}>Reset PIN</button>}
      </div>
      <div style={{marginTop:12,fontSize:11,color:C.muted}}>PIN: <span style={{color:sel.pin?C.success:C.danger,fontWeight:700}}>{sel.pin?"Set":"Not set"}</span></div>
    </Modal>)}

    {showAdd&&(<Modal title="Add New Member" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving...":"Add Member"}</button></>}>
      <div className="form-row"><label className="form-label">Full Name *</label><input className="form-input" placeholder="e.g. Alex Rivera" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
      <div className="form-row"><label className="form-label">Phone Number *</label><input className="form-input" placeholder="+961 XX XXX XXX" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
      <div className="form-row"><label className="form-label">Email (optional)</label><input className="form-input" placeholder="member@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
      <div className="form-row"><label className="form-label">Birthday (optional)</label><input className="form-input" type="date" value={form.birthday||""} onChange={e=>setForm({...form,birthday:e.target.value})}/><div className="form-hint">Used to auto-award birthday bonus points</div></div>
    </Modal>)}
  </div>);
}

// ── AWARD POINTS ──────────────────────────────────────────
function AwardPoints({members,setMembers,setTransactions,preSelected,toast}){
  const [form,setForm]=useState({memberId:preSelected?.id||"",pts:"",type:"checkin",note:""});
  const [saving,setSaving]=useState(false);
  const REASONS=[{v:"checkin",l:"Check-in (50 pts)"},{v:"class",l:"Group Class (75 pts)"},{v:"referral",l:"Referral (500 pts)"},{v:"bonus",l:"Streak / Challenge Bonus"},{v:"manual",l:"Manual Adjustment"},{v:"deduct",l:"Deduction / Correction"}];
  useEffect(()=>{if(preSelected)setForm(f=>({...f,memberId:preSelected.id}));},[preSelected]);

  const handleSubmit=async()=>{
    const m=members.find(x=>x.id===form.memberId);
    if(!m||!form.pts||isNaN(Number(form.pts))) return;
    setSaving(true);
    const pts=form.type==="deduct"?-Math.abs(Number(form.pts)):Math.abs(Number(form.pts));
    const note=form.note||REASONS.find(r=>r.v===form.type)?.l.split(" (")[0]||form.type;
    const newPoints=Math.max(0,m.points+pts);
    await upsertMember({...m,points:newPoints});
    setMembers(prev=>prev.map(x=>x.id===m.id?{...x,points:newPoints}:x));
    const txn={id:genId("TXN"),memberId:m.id,memberName:m.name,type:form.type,pts,note,date:today()};
    await addTransaction(txn);
    setTransactions(prev=>[txn,...prev]);
    setForm({memberId:"",pts:"",type:"checkin",note:""});setSaving(false);
    toast(`${pts>0?"+":""}${pts} pts ${pts>0?"awarded to":"deducted from"} ${m.name}`);
  };

  return(<div style={{maxWidth:520}}>
    <div className="form-row"><label className="form-label">Member *</label><select className="form-select" value={form.memberId} onChange={e=>setForm({...form,memberId:e.target.value})}><option value="">— choose a member —</option>{[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=>(<option key={m.id} value={m.id}>{m.name} — {m.points.toLocaleString()} pts</option>))}</select></div>
    <div className="form-row"><label className="form-label">Reason *</label><select className="form-select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{REASONS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}</select></div>
    <div className="form-row"><label className="form-label">Points *</label><input className="form-input" type="number" min="1" placeholder="e.g. 50" value={form.pts} onChange={e=>setForm({...form,pts:e.target.value})}/></div>
    <div className="form-row"><label className="form-label">Note (optional)</label><input className="form-input" placeholder="e.g. Thursday HIIT class" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving?"Saving...":(form.type==="deduct"?"Deduct Points":"Award Points")}</button>
  </div>);
}

// ── REDEMPTIONS ───────────────────────────────────────────
function Redemptions({redemptions,setRedemptions,setMembers,setTransactions,toast}){
  const [tab,setTab]=useState("pending");
  const list=redemptions.filter(r=>r.status===tab);

  const fulfill=async(rdm)=>{
    await updateRedemptionStatus(rdm.id,"fulfilled");
    const pts=Math.abs(rdm.pts);
    setRedemptions(prev=>prev.map(r=>r.id===rdm.id?{...r,status:"fulfilled"}:r));
    setMembers(prev=>prev.map(m=>m.id===(rdm.memberId||rdm.member_id)?{...m,points:Math.max(0,m.points-pts)}:m));
    const txn={id:genId("TXN"),memberId:rdm.memberId||rdm.member_id,memberName:rdm.memberName||rdm.member_name,type:"redeem",pts:-pts,note:`Redeemed: ${rdm.reward}`,date:today()};
    await addTransaction(txn);setTransactions(prev=>[txn,...prev]);
    toast(`Fulfilled: ${rdm.reward}`);
  };

  const cancel=async(id)=>{await updateRedemptionStatus(id,"cancelled");setRedemptions(prev=>prev.map(r=>r.id===id?{...r,status:"cancelled"}:r));toast("Cancelled");};

  return(<div>
    <div className="tabs">{["pending","fulfilled","cancelled"].map(t=>(<button key={t} className={`tab-btn${tab===t?" on":""}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)} ({redemptions.filter(r=>r.status===t).length})</button>))}</div>
    {list.length===0?<div className="empty">No {tab} redemptions.</div>:<div className="tbl-wrap"><table><thead><tr><th>Member</th><th>Reward</th><th>Cost</th><th>Date</th><th>Status</th>{tab==="pending"&&<th>Actions</th>}</tr></thead><tbody>{list.map(r=>(<tr key={r.id}><td style={{fontWeight:600}}>{r.memberName||r.member_name}</td><td>{r.reward}</td><td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{r.pts.toLocaleString()}</td><td className="mono" style={{color:C.muted}}>{fmtDate(r.date)}</td><td><span className={`badge badge-${r.status}`}>{r.status}</span></td>{tab==="pending"&&<td><div style={{display:"flex",gap:6}}><button className="btn btn-success btn-sm" onClick={()=>fulfill(r)}>✓ Fulfill</button><button className="btn btn-danger btn-sm" onClick={()=>cancel(r.id)}>✕</button></div></td>}</tr>))}</tbody></table></div>}
  </div>);
}

// ── REWARDS ───────────────────────────────────────────────
function RewardsCatalog({rewards,setRewards,toast}){
  const [editing,setEditing]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({name:"",pts:"",cat:"Access",icon:"🎁",stock:true});
  const [saving,setSaving]=useState(false);

  const saveEdit=async()=>{setSaving(true);await upsertReward(editing);setRewards(prev=>prev.map(r=>r.id===editing.id?editing:r));setEditing(null);setSaving(false);toast("Reward updated");};
  const handleAdd=async()=>{if(!form.name||!form.pts) return;setSaving(true);const nr={...form,pts:Number(form.pts),id:genId("RWD")};await upsertReward(nr);setRewards(prev=>[...prev,nr]);setShowAdd(false);setForm({name:"",pts:"",cat:"Access",icon:"🎁",stock:true});setSaving(false);toast("Reward added");};
  const del=async(id)=>{await deleteReward(id);setRewards(prev=>prev.filter(r=>r.id!==id));toast("Removed");};
  const toggleStock=async(r)=>{const nr={...r,stock:!r.stock};await upsertReward(nr);setRewards(prev=>prev.map(x=>x.id===r.id?nr:x));};

  return(<div>
    <div className="sec-hdr"><div className="sec-title">Rewards ({rewards.length})</div><button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Reward</button></div>
    <div className="reward-grid">{rewards.map(r=>(<div key={r.id} className="rwd-card" style={{opacity:r.stock?1:0.5}}><span className="rwd-icon">{r.icon}</span><div className="rwd-name">{r.name}</div><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,marginBottom:4,fontWeight:700}}>{r.cat}</div><div className="rwd-pts">{r.pts.toLocaleString()} <span style={{fontSize:12,color:C.muted}}>PTS</span></div><div style={{fontSize:11,color:r.stock?C.success:C.danger,marginTop:4,fontWeight:700}}>{r.stock?"● In Stock":"● Out of Stock"}</div><div className="rwd-actions"><button className="btn btn-ghost btn-sm" onClick={()=>setEditing({...r})}>Edit</button><button className="btn btn-ghost btn-sm" onClick={()=>toggleStock(r)}>{r.stock?"OOS":"In Stock"}</button><button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}>✕</button></div></div>))}</div>
    {editing&&(<Modal title="Edit Reward" onClose={()=>setEditing(null)} footer={<><button className="btn btn-ghost" onClick={()=>setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving?"Saving...":"Save"}</button></>}>{[{l:"Name",k:"name",t:"text"},{l:"Points",k:"pts",t:"number"},{l:"Icon",k:"icon",t:"text"}].map(f=>(<div key={f.k} className="form-row"><label className="form-label">{f.l}</label><input className="form-input" type={f.t} value={editing[f.k]} onChange={e=>setEditing({...editing,[f.k]:f.t==="number"?Number(e.target.value):e.target.value})}/></div>))}<div className="form-row"><label className="form-label">Category</label><select className="form-select" value={editing.cat} onChange={e=>setEditing({...editing,cat:e.target.value})}>{["Access","Merch","Training"].map(c=><option key={c}>{c}</option>)}</select></div><div className="form-row"><label className="form-label">Stock</label><select className="form-select" value={editing.stock?"true":"false"} onChange={e=>setEditing({...editing,stock:e.target.value==="true"})}><option value="true">In Stock</option><option value="false">Out of Stock</option></select></div></Modal>)}
    {showAdd&&(<Modal title="Add Reward" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving...":"Add"}</button></>}>{[{l:"Name",k:"name",t:"text"},{l:"Points",k:"pts",t:"number"},{l:"Icon",k:"icon",t:"text"}].map(f=>(<div key={f.k} className="form-row"><label className="form-label">{f.l}</label><input className="form-input" type={f.t} value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}/></div>))}<div className="form-row"><label className="form-label">Category</label><select className="form-select" value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>{["Access","Merch","Training"].map(c=><option key={c}>{c}</option>)}</select></div></Modal>)}
  </div>);
}

// ── STAFF MANAGEMENT ──────────────────────────────────────
function StaffManagement({staffList,setStaffList,toast}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({name:"",role:"front_desk",pin:""});
  const [pin,setPin]=useState("");
  const [saving,setSaving]=useState(false);

  const handleAdd=async()=>{
    if(!form.name.trim()||!form.role||pin.length<4){toast("Fill in all fields");return;}
    setSaving(true);
    const nm={id:genId("STF"),name:form.name.trim(),role:form.role,pin,status:"active"};
    await upsertStaff(nm);
    setStaffList(prev=>[...prev,nm]);
    setShowAdd(false);setForm({name:"",role:"front_desk",pin:""});setPin("");setSaving(false);
    toast(`${nm.name} added as ${ROLES[nm.role].label}`);
  };

  const handleDelete=async(id,name)=>{
    await deleteStaff(id);
    setStaffList(prev=>prev.filter(s=>s.id!==id));
    toast(`${name} removed`);
  };

  const handleResetPin=async(s)=>{
    const newPin="0000";
    await upsertStaff({...s,pin:newPin});
    setStaffList(prev=>prev.map(x=>x.id===s.id?{...x,pin:newPin}:x));
    toast(`PIN reset to 0000 for ${s.name}`);
  };

  return(<div>
    <div className="sec-hdr"><div className="sec-title">Staff Accounts ({staffList.length})</div><button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Staff</button></div>
    <div className="tbl-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{staffList.map(s=>{const r=ROLES[s.role];return(<tr key={s.id}><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="av" style={{background:`${r?.color}22`,color:r?.color}}>{initials(s.name)}</div><div style={{fontWeight:600}}>{s.name}</div></div></td><td><span className="badge" style={{background:`${r?.color}18`,color:r?.color}}>{r?.icon} {r?.label}</span></td><td><span className="badge badge-active">Active</span></td><td><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" style={{borderColor:C.warning,color:C.warning}} onClick={()=>handleResetPin(s)}>Reset PIN</button><button className="btn btn-danger btn-sm" onClick={()=>handleDelete(s.id,s.name)}>Remove</button></div></td></tr>);})}</tbody></table></div>

    {showAdd&&(<Modal title="Add Staff Member" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setPin("");}}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving||pin.length<4}>{saving?"Saving...":"Add Staff"}</button></>}>
      <div className="form-row"><label className="form-label">Full Name *</label><input className="form-input" placeholder="e.g. Sara K." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
      <div className="form-row"><label className="form-label">Role *</label>
        <div className="role-grid">{Object.entries(ROLES).filter(([k])=>k!=="owner").map(([k,v])=>(<div key={k} className={`role-card${form.role===k?" sel":""}`} onClick={()=>setForm({...form,role:k})}><span className="role-icon">{v.icon}</span><div className="role-name" style={{color:form.role===k?v.color:"#6B6866"}}>{v.label}</div></div>))}</div>
      </div>
      <div className="form-row"><label className="form-label">Set Their PIN *</label><PinInput value={pin} onChange={v=>{setPin(v);}}/></div>
      <div className="form-hint">Share this PIN privately with the staff member. They can ask you to reset it if forgotten.</div>
    </Modal>)}
  </div>);
}

// ── DISPLAY SETTINGS ─────────────────────────────────────
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
    { id:1, name:"Weekly Warrior",  desc:"Check in 5× this week",          pts:150,  deadline:"3 days",  icon:"⚔",  active:true },
    { id:2, name:"Iron Will",       desc:"15-day consecutive streak",      pts:300,  deadline:"4 days",  icon:"🔥", active:true },
    { id:3, name:"Bring the Crew",  desc:"Refer 2 new members",            pts:1000, deadline:"24 days", icon:"👥", active:true },
    { id:4, name:"Early Bird",      desc:"Attend 3 AM classes this month", pts:200,  deadline:"12 days", icon:"🌅", active:true },
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

  const SLIDE_LABELS={leaderboard:"🏆 Leaderboard",challenges:"⚔ Challenges",activity:"📍 Live Activity",spotlight:"★ Member Spotlight"};

  if(!loaded) return <div style={{color:C.muted,padding:20}}>Loading…</div>;

  return(<div>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Saving...":"Save All Settings"}</button>
    </div>

    <div className="display-section">
      <div className="display-section-title">Slide Rotation</div>
      <div style={{marginBottom:12,fontSize:12,color:C.muted}}>Slide duration: <strong style={{color:C.white}}>{settings.slideDuration} seconds</strong></div>
      <input type="range" min="5" max="30" value={settings.slideDuration} onChange={e=>setSettings(s=>({...s,slideDuration:Number(e.target.value)}))} style={{width:"100%",marginBottom:16,accentColor:C.orange}}/>
      {["leaderboard","challenges","activity","spotlight"].map(k=>(
        <div key={k} className="slide-row">
          <div className={`toggle${settings.slides[k]?" on":""}`} onClick={()=>toggleSlide(k)}/>
          <span style={{fontSize:14,fontWeight:500,color:settings.slides[k]?C.white:C.muted}}>{SLIDE_LABELS[k]}</span>
        </div>
      ))}
    </div>

    <div className="display-section">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div className="display-section-title" style={{marginBottom:0}}>Active Challenges</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setSettings(s=>({...s,challenges:[...s.challenges,{id:Date.now(),name:"New Challenge",desc:"Description here",pts:100,deadline:"7 days",icon:"⚡",active:true,goal:1}]}))}>+ Add</button>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>These show on the challenges slide and member portal.</div>
      {settings.challenges.map((c,i)=>(
        <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`,padding:14,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div className={`toggle${c.active?" on":""}`} onClick={()=>toggleChallenge(i)}/>
            <span style={{fontSize:13,fontWeight:700,color:c.active?C.white:C.muted}}>{c.icon} {c.name}</span>
          </div>
          <div className="ch-edit-row">
            <input className="form-input" placeholder="Challenge name" value={c.name} onChange={e=>updateChallenge(i,"name",e.target.value)}/>
            <input className="form-input" placeholder="Description" value={c.desc} onChange={e=>updateChallenge(i,"desc",e.target.value)}/>
            <input className="form-input" type="number" placeholder="Pts" value={c.pts} onChange={e=>updateChallenge(i,"pts",e.target.value)} style={{width:80}}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:10}}>
            <input className="form-input" placeholder="Deadline (e.g. 3 days)" value={c.deadline} onChange={e=>updateChallenge(i,"deadline",e.target.value)}/>
            <input className="form-input" placeholder="Icon emoji" value={c.icon} onChange={e=>updateChallenge(i,"icon",e.target.value)} style={{width:80}}/>
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
  </div>);
}

// ── SETTINGS / TIERS ─────────────────────────────────────
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
    <div className="sec-hdr" style={{marginBottom:8}}><div className="sec-title">Check-In QR Code</div></div>
    <div style={{background:"#252627",border:`1px solid ${C.border}`,padding:20,marginBottom:28}}>
      <div style={{fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.6}}>Print and display at the gym entrance. Members scan to check in and earn 50 pts automatically.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button className="btn btn-primary" style={{width:"auto",padding:"8px 20px"}} onClick={()=>setShowQR(true)}>Show QR Code</button>
        <a href={`${siteUrl}/checkin`} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",padding:"8px 20px",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Montserrat',sans-serif",textDecoration:"none"}}>Test Check-In</a>
      </div>
    </div>
    {showQR&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowQR(false)}><div style={{background:"#252627",border:`1px solid ${C.border}`,padding:32,maxWidth:380,width:"100%",textAlign:"center"}} onClick={e=>e.stopPropagation()}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:2,color:"#FFFDF3",marginBottom:4}}>Check-In QR Code</div><div style={{fontSize:11,color:C.muted,marginBottom:20}}>Display at the gym entrance</div><div style={{background:"#fff",padding:16,display:"inline-block",marginBottom:16}}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(siteUrl+"/checkin")}&bgcolor=ffffff&color=1F2020&margin=0`} alt="QR" width={240} height={240}/></div><div style={{fontSize:11,color:C.muted,marginBottom:20,fontFamily:"'JetBrains Mono',monospace"}}>{siteUrl}/checkin</div><div style={{display:"flex",gap:8,justifyContent:"center"}}><button className="btn btn-primary" style={{width:"auto",padding:"8px 20px"}} onClick={()=>window.print()}>Print</button><button className="btn btn-ghost" style={{width:"auto",padding:"8px 20px"}} onClick={()=>setShowQR(false)}>Close</button></div></div></div>)}
    <div className="sec-hdr"><div className="sec-title">Tier Configuration</div><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Saving...":"Save Tiers"}</button></div>
    <div className="tbl-wrap" style={{marginTop:16}}><table><thead><tr><th>#</th><th>Icon</th><th>Name</th><th>Min Points</th><th>Color</th></tr></thead><tbody>{[...local].sort((a,b)=>a.min-b.min).map((t,i)=>(<tr key={t.id}><td style={{color:C.muted,fontWeight:700}}>{i+1}</td><td><input className="form-input" style={{width:60,textAlign:"center",fontSize:20}} value={t.icon} onChange={e=>update(t.id,"icon",e.target.value)}/></td><td><input className="form-input" value={t.name} onChange={e=>update(t.id,"name",e.target.value)}/></td><td><input className="form-input" type="number" min="0" value={t.min} onChange={e=>update(t.id,"min",e.target.value)} disabled={i===0} style={{opacity:i===0?.5:1}}/></td><td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,background:t.color,border:`1px solid ${C.border}`}}/><input className="form-input" value={t.color} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}} onChange={e=>update(t.id,"color",e.target.value)}/></div></td></tr>))}</tbody></table></div>
  </div>);
}


// ── CHALLENGES PANEL ─────────────────────────────────────
function ChallengesPanel({members, setMembers, setTransactions, toast, displaySettings}) {
  const [enrollments, setEnrollments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getEnrollments().then(data => { setEnrollments(data); setLoaded(true); });
  }, []);

  const challenges = displaySettings?.challenges
    ? displaySettings.challenges.filter(c => c.active !== false)
    : [];

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
        <div className="sec-title">Challenge Enrollments</div>
        <div style={{fontSize:12,color:C.muted,fontWeight:500}}>{enrollments.length} total enrollments</div>
      </div>

      {challenges.length === 0 && (
        <div className="empty">No active challenges. Add them in the TV Display settings.</div>
      )}

      {challenges.map(c => {
        const cEnrollments = enrollments.filter(e => e.challengeId === String(c.id));
        const pending = cEnrollments.filter(e => !e.completed);
        const done = cEnrollments.filter(e => e.completed);
        return (
          <div key={c.id} style={{background:C.surface,border:`1px solid ${C.border}`,marginBottom:16}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>{c.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:C.white}}>{c.name}</div>
                <div style={{fontSize:12,color:C.muted}}>{c.desc}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>+{c.pts} PTS</div>
                <div style={{fontSize:11,color:C.muted}}>⏱ {c.deadline}</div>
              </div>
            </div>

            {cEnrollments.length === 0 ? (
              <div style={{padding:"14px 18px",color:C.muted,fontSize:13}}>No members enrolled yet.</div>
            ) : (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    <th style={{padding:"8px 18px",textAlign:"left",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,background:C.card}}>Member</th>
                    <th style={{padding:"8px 18px",textAlign:"left",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,background:C.card}}>Enrolled</th>
                    <th style={{padding:"8px 18px",textAlign:"left",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,background:C.card}}>Status</th>
                    <th style={{padding:"8px 18px",background:C.card}}></th>
                  </tr>
                </thead>
                <tbody>
                  {cEnrollments.map(e => (
                    <tr key={e.id} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"10px 18px",fontWeight:600,fontSize:13}}>{e.memberName}</td>
                      <td style={{padding:"10px 18px",fontSize:12,color:C.muted,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(e.enrolledDate)}</td>
                      <td style={{padding:"10px 18px"}}>
                        {e.completed
                          ? <span className="badge badge-fulfilled">✓ Completed</span>
                          : <span className="badge badge-pending">In Progress</span>
                        }
                      </td>
                      <td style={{padding:"10px 18px"}}>
                        {!e.completed && (
                          <button className="btn btn-success btn-sm" onClick={() => handleComplete(e)}>
                            Mark Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ── EARN RULES ───────────────────────────────────────────
const DEF_EARN_RULES = [
  { id:"ER-001", icon:"📍", action:"Daily Check-in",            pts:"50",   note:"Scan QR at entrance",   active:true, sort_order:0 },
  { id:"ER-002", icon:"🧑‍🏫", action:"Group Class Attendance",   pts:"75",   note:"Per class",             active:true, sort_order:1 },
  { id:"ER-003", icon:"💪", action:"Personal Training Session",  pts:"100",  note:"Per session",           active:true, sort_order:2 },
  { id:"ER-004", icon:"👥", action:"Refer a Friend",             pts:"500",  note:"When they join",        active:true, sort_order:3 },
  { id:"ER-005", icon:"🛒", action:"In-Gym Purchase",            pts:"3%",   note:"Of spend",              active:true, sort_order:4 },
  { id:"ER-006", icon:"🔥", action:"7-Day Streak Bonus",         pts:"100",  note:"Auto-awarded",          active:true, sort_order:5 },
  { id:"ER-007", icon:"📅", action:"30-Day Streak Bonus",        pts:"400",  note:"Auto-awarded",          active:true, sort_order:6 },
  { id:"ER-008", icon:"🎂", action:"Birthday Bonus",             pts:"300",  note:"Once a year",           active:true, sort_order:7 },
];

function EarnRules({ toast }) {
  const [rules, setRules]     = useState([]);
  const [loaded, setLoaded]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ icon:"⭐", action:"", pts:"", note:"", active:true });
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getEarnRules();
      if (data.length === 0) {
        for (const rule of DEF_EARN_RULES) {
          await upsertEarnRule(rule);
        }
        setRules(DEF_EARN_RULES);
      } else {
        setRules(data);
      }
      setLoaded(true);
    })();
  }, []);

  const handleAdd = async () => {
    if (!form.action || !form.pts) return;
    setSaving(true);
    const nr = { ...form, id: genId("ER"), sort_order: rules.length };
    await upsertEarnRule(nr);
    setRules(prev => [...prev, nr]);
    setShowAdd(false);
    setForm({ icon:"⭐", action:"", pts:"", note:"", active:true });
    setSaving(false);
    toast("Earn rule added");
  };

  const saveEdit = async () => {
    setSaving(true);
    await upsertEarnRule(editing);
    setRules(prev => prev.map(r => r.id === editing.id ? editing : r));
    setEditing(null);
    setSaving(false);
    toast("Earn rule updated");
  };

  const del = async (id) => {
    await deleteEarnRule(id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast("Earn rule removed");
  };

  const toggleActive = async (rule) => {
    const updated = { ...rule, active: !rule.active };
    await upsertEarnRule(updated);
    setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
  };

  if (!loaded) return <div style={{color:C.muted,padding:20}}>Loading…</div>;

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Ways to Earn ({rules.filter(r=>r.active).length} active)</div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Rule</button>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:16,fontWeight:500}}>
        These show in the member portal under the Earn tab. Toggle off to hide without deleting.
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th>Icon</th><th>Action</th><th>Points</th><th>Note</th><th>Active</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id} style={{opacity:r.active?1:0.5}}>
                <td style={{fontSize:22,textAlign:"center",width:50}}>{r.icon}</td>
                <td style={{fontWeight:600}}>{r.action}</td>
                <td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{r.pts}</td>
                <td style={{color:C.muted,fontSize:12}}>{r.note}</td>
                <td>
                  <div className={`toggle${r.active?" on":""}`} onClick={() => toggleActive(r)}/>
                </td>
                <td>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({...r})}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(r.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title="Edit Earn Rule" onClose={() => setEditing(null)} footer={<>
          <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving?"Saving...":"Save"}</button>
        </>}>
          <div className="form-row"><label className="form-label">Icon (emoji)</label><input className="form-input" value={editing.icon} onChange={e=>setEditing({...editing,icon:e.target.value})}/></div>
          <div className="form-row"><label className="form-label">Action Name</label><input className="form-input" value={editing.action} onChange={e=>setEditing({...editing,action:e.target.value})}/></div>
          <div className="form-row"><label className="form-label">Points (number or % )</label><input className="form-input" value={editing.pts} onChange={e=>setEditing({...editing,pts:e.target.value})}/></div>
          <div className="form-row"><label className="form-label">Note</label><input className="form-input" value={editing.note} onChange={e=>setEditing({...editing,note:e.target.value})}/></div>
          <div className="form-row">
            <label className="form-label">Active</label>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div className={`toggle${editing.active?" on":""}`} onClick={()=>setEditing({...editing,active:!editing.active})}/>
              <span style={{fontSize:13,color:editing.active?C.success:C.muted}}>{editing.active?"Visible to members":"Hidden"}</span>
            </div>
          </div>
        </Modal>
      )}

      {showAdd && (
        <Modal title="Add Earn Rule" onClose={() => setShowAdd(false)} footer={<>
          <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving...":"Add Rule"}</button>
        </>}>
          <div className="form-row"><label className="form-label">Icon (emoji)</label><input className="form-input" placeholder="e.g. 🏃" value={form.icon} onChange={e=>setForm({...form,icon:e.target.value})}/></div>
          <div className="form-row"><label className="form-label">Action Name *</label><input className="form-input" placeholder="e.g. Attend Yoga Class" value={form.action} onChange={e=>setForm({...form,action:e.target.value})}/></div>
          <div className="form-row"><label className="form-label">Points * (number or %)</label><input className="form-input" placeholder="e.g. 75 or 5%" value={form.pts} onChange={e=>setForm({...form,pts:e.target.value})}/></div>
          <div className="form-row"><label className="form-label">Note</label><input className="form-input" placeholder="e.g. Per class" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
        </Modal>
      )}
    </div>
  );
}




// ── WORKOUTS PANEL ────────────────────────────────────────
function WorkoutsPanel({ members, toast }) {
  const [workouts, setWorkouts]   = useState([]);
  const [unlocks, setUnlocks]     = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [view, setView]           = useState("list"); // list | edit | unlock
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [exercises, setExercises] = useState([]);
  const [unlockForm, setUnlockForm] = useState({ workoutId:"", memberId:"" });

  const BLANK = { id:"", title:"", description:"", category:"Strength", difficulty:"Beginner", duration_mins:30, thumbnail_url:"", video_url:"", pdf_url:"", access_type:"free", points_cost:0, price_label:"", tier_required:"Gold", active:true, created_at:"" };
  const CATS = ["Strength","Cardio","HIIT","Mobility","Yoga","Boxing","CrossFit","Other"];
  const DIFFS = ["Beginner","Intermediate","Advanced"];
  const TIERS = ["Iron","Bronze","Silver","Gold","Elite"];
  const ACCESS = [
    { v:"free",   l:"Free — available to all" },
    { v:"points", l:"Points — member redeems points" },
    { v:"paid",   l:"Paid — staff unlocks after payment" },
    { v:"tier",   l:"Tier — auto-unlocks by tier" },
  ];

  useEffect(() => {
    Promise.all([getAllWorkouts(), getAllUnlocks()]).then(([w,u]) => {
      setWorkouts(w); setUnlocks(u); setLoaded(true);
    });
  }, []);

  const startNew = () => { setEditing({...BLANK, id:genId("WRK"), created_at:today()}); setExercises([]); setView("edit"); };
  const startEdit = (w) => { setEditing({...w}); setExercises(Array.isArray(w.exercises)?w.exercises:[]); setView("edit"); };

  const handleSave = async () => {
    if (!editing.title.trim()) { toast("Title is required"); return; }
    setSaving(true);
    const workout = { ...editing, exercises };
    await upsertWorkout(workout);
    setWorkouts(prev => {
      const exists = prev.find(w=>w.id===workout.id);
      return exists ? prev.map(w=>w.id===workout.id?workout:w) : [workout,...prev];
    });
    setSaving(false);
    toast(`${editing.title} saved`);
    setView("list");
  };

  const handleDelete = async (id, title) => {
    await deleteWorkout(id);
    setWorkouts(prev=>prev.filter(w=>w.id!==id));
    toast(`${title} deleted`);
  };

  const toggleActive = async (w) => {
    const updated = {...w, active:!w.active};
    await upsertWorkout(updated);
    setWorkouts(prev=>prev.map(x=>x.id===w.id?updated:x));
    toast(updated.active?"Workout published":"Workout hidden");
  };

  const handleUnlock = async () => {
    if (!unlockForm.workoutId || !unlockForm.memberId) return;
    const already = unlocks.find(u=>u.workoutId===unlockForm.workoutId&&u.memberId===unlockForm.memberId);
    if (already) { toast("Already unlocked for this member"); return; }
    const unlock = { id:genId("UNL"), workoutId:unlockForm.workoutId, memberId:unlockForm.memberId, unlockedBy:"staff", date:today() };
    await unlockWorkout(unlock);
    setUnlocks(prev=>[...prev,unlock]);
    const w = workouts.find(x=>x.id===unlockForm.workoutId);
    const m = members.find(x=>x.id===unlockForm.memberId);
    toast(`Unlocked "${w?.title}" for ${m?.name}`);
    setUnlockForm({workoutId:"",memberId:""});
  };

  const addExercise = () => setExercises(prev=>[...prev,{name:"",sets:"3",reps:"10",weight:"",rest:"60s",notes:""}]);
  const updateExercise = (i,f,v) => setExercises(prev=>prev.map((e,j)=>j===i?{...e,[f]:v}:e));
  const removeExercise = (i) => setExercises(prev=>prev.filter((_,j)=>j!==i));

  const ACCESS_CFG = { free:{color:"#22C55E"}, points:{color:"#F58020"}, paid:{color:"#026F91"}, tier:{color:"#D4AF37"} };

  if (!loaded) return <div style={{color:C.muted,padding:20}}>Loading…</div>;

  // ── EDIT VIEW ──
  if (view === "edit" && editing) return (
    <div>
      <div className="sec-hdr">
        <button className="btn btn-ghost" onClick={()=>setView("list")}>← Back</button>
        <div className="sec-title">{editing.id&&workouts.find(w=>w.id===editing.id)?"Edit Workout":"New Workout"}</div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?"Saving...":"Save Workout"}</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Title *</label><input className="form-input" placeholder="e.g. Full Body Burn" value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></div>
        <div className="form-row"><label className="form-label">Category</label><select className="form-select" value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="form-row"><label className="form-label">Difficulty</label><select className="form-select" value={editing.difficulty} onChange={e=>setEditing({...editing,difficulty:e.target.value})}>{DIFFS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div className="form-row"><label className="form-label">Duration (mins)</label><input className="form-input" type="number" min="1" value={editing.duration_mins} onChange={e=>setEditing({...editing,duration_mins:Number(e.target.value)})}/></div>
        <div className="form-row"><label className="form-label">Access Type</label><select className="form-select" value={editing.access_type} onChange={e=>setEditing({...editing,access_type:e.target.value})}>{ACCESS.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}</select></div>
        {editing.access_type==="points"&&<div className="form-row"><label className="form-label">Points Cost</label><input className="form-input" type="number" min="0" value={editing.points_cost} onChange={e=>setEditing({...editing,points_cost:Number(e.target.value)})}/></div>}
        {editing.access_type==="paid"&&<div className="form-row"><label className="form-label">Price Label</label><input className="form-input" placeholder="e.g. $9.99" value={editing.price_label} onChange={e=>setEditing({...editing,price_label:e.target.value})}/></div>}
        {editing.access_type==="tier"&&<div className="form-row"><label className="form-label">Required Tier</label><select className="form-select" value={editing.tier_required} onChange={e=>setEditing({...editing,tier_required:e.target.value})}>{TIERS.map(t=><option key={t}>{t}</option>)}</select></div>}
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Description</label><textarea className="form-input" rows={3} placeholder="What will members get out of this workout?" value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})} style={{resize:"vertical"}}/></div>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Thumbnail URL</label><input className="form-input" placeholder="https://..." value={editing.thumbnail_url} onChange={e=>setEditing({...editing,thumbnail_url:e.target.value})}/><div className="form-hint">Link to a cover image (JPG/PNG/WebP)</div></div>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Video URL (YouTube)</label><input className="form-input" placeholder="https://youtube.com/watch?v=..." value={editing.video_url} onChange={e=>setEditing({...editing,video_url:e.target.value})}/></div>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">PDF URL</label><input className="form-input" placeholder="https://..." value={editing.pdf_url} onChange={e=>setEditing({...editing,pdf_url:e.target.value})}/><div className="form-hint">Link to a PDF workout plan (Google Drive, Dropbox, etc.)</div></div>
      </div>

      {/* Exercises */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:16,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white}}>Exercises ({exercises.length})</div>
          <button className="btn btn-primary btn-sm" onClick={addExercise}>+ Add Exercise</button>
        </div>
        {exercises.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No exercises added. Add some or leave blank if using video/PDF only.</div>}
        {exercises.map((ex,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,padding:12,marginBottom:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto auto",gap:8,marginBottom:8}}>
              <input className="form-input" placeholder="Exercise name" value={ex.name} onChange={e=>updateExercise(i,"name",e.target.value)}/>
              <input className="form-input" placeholder="Sets" value={ex.sets} onChange={e=>updateExercise(i,"sets",e.target.value)} style={{width:60}}/>
              <input className="form-input" placeholder="Reps" value={ex.reps} onChange={e=>updateExercise(i,"reps",e.target.value)} style={{width:60}}/>
              <input className="form-input" placeholder="Rest" value={ex.rest} onChange={e=>updateExercise(i,"rest",e.target.value)} style={{width:70}}/>
              <button className="btn btn-danger btn-sm" onClick={()=>removeExercise(i)}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <input className="form-input" placeholder="Weight (e.g. 60kg)" value={ex.weight} onChange={e=>updateExercise(i,"weight",e.target.value)}/>
              <input className="form-input" placeholder="Notes" value={ex.notes} onChange={e=>updateExercise(i,"notes",e.target.value)}/>
            </div>
          </div>
        ))}
      </div>

      <div className="form-row">
        <label className="form-label">Published</label>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className={`toggle${editing.active?" on":""}`} onClick={()=>setEditing({...editing,active:!editing.active})}/>
          <span style={{fontSize:13,color:editing.active?C.success:C.muted}}>{editing.active?"Visible to members":"Hidden"}</span>
        </div>
      </div>
    </div>
  );

  // ── LIST VIEW ──
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Workouts ({workouts.length})</div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={()=>setView("unlock")}>🔓 Unlock for Member</button>
          <button className="btn btn-primary" onClick={startNew}>+ New Workout</button>
        </div>
      </div>

      {view==="unlock"&&(
        <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white,marginBottom:14}}>Unlock Workout for Member</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"flex-end"}}>
            <div><label className="form-label">Workout</label><select className="form-select" value={unlockForm.workoutId} onChange={e=>setUnlockForm({...unlockForm,workoutId:e.target.value})}><option value="">— select workout —</option>{workouts.filter(w=>w.access_type==="paid"||w.access_type==="points").map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></div>
            <div><label className="form-label">Member</label><select className="form-select" value={unlockForm.memberId} onChange={e=>setUnlockForm({...unlockForm,memberId:e.target.value})}><option value="">— select member —</option>{[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <button className="btn btn-success" onClick={handleUnlock} disabled={!unlockForm.workoutId||!unlockForm.memberId}>Unlock</button>
          </div>
          <div style={{marginTop:12,fontSize:11,color:C.muted}}>Use this to unlock paid workouts after a member pays at the front desk. Points-based unlocks happen automatically when members redeem in the portal.</div>
        </div>
      )}

      {workouts.length===0&&<div className="empty">No workouts yet. Create your first one!</div>}

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Workout</th><th>Category</th><th>Access</th><th>Unlocks</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {workouts.map(w=>{
              const wUnlocks=unlocks.filter(u=>u.workoutId===w.id).length;
              const cfg=ACCESS_CFG[w.access_type];
              return(
                <tr key={w.id}>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      {w.thumbnail_url?<img src={w.thumbnail_url} style={{width:36,height:36,objectFit:"cover",borderRadius:2}} alt=""/>:<div style={{width:36,height:36,background:C.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💪</div>}
                      <div><div style={{fontWeight:700,fontSize:13}}>{w.title}</div><div style={{fontSize:11,color:C.muted}}>{w.difficulty} · {w.duration_mins}m</div></div>
                    </div>
                  </td>
                  <td style={{color:C.muted,fontSize:12}}>{w.category}</td>
                  <td><span className="badge" style={{background:`${cfg?.color}18`,color:cfg?.color}}>{w.access_type==="points"?`${w.points_cost} pts`:w.access_type==="tier"?w.tier_required:w.access_type}</span></td>
                  <td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:wUnlocks>0?C.success:C.muted}}>{wUnlocks}</td>
                  <td><span className={`badge badge-${w.active?"active":"inactive"}`}>{w.active?"Published":"Hidden"}</span></td>
                  <td>
                    <div style={{display:"flex",gap:6}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>startEdit(w)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>toggleActive(w)}>{w.active?"Hide":"Show"}</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(w.id,w.title)}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── REFERRALS ─────────────────────────────────────────────
function ReferralsPanel({ members, setMembers, setTransactions, toast }) {
  const [referrals, setReferrals] = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ referrerId:"", newMemberId:"" });
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    getReferrals().then(data => { setReferrals(data); setLoaded(true); });
  }, []);

  const handleAdd = async () => {
    const referrer = members.find(m => m.id === form.referrerId);
    const newMember = members.find(m => m.id === form.newMemberId);
    if (!referrer || !newMember) return;
    setSaving(true);
    const REF_PTS = 500;
    const ref = {
      id: genId("REF"),
      referrerId: referrer.id,
      referrerName: referrer.name,
      referrerCode: referrer.referral_code || "",
      newMemberId: newMember.id,
      newMemberName: newMember.name,
      pts: REF_PTS,
      date: today(),
    };
    await addReferral(ref);
    // Award points to referrer
    const newPoints = referrer.points + REF_PTS;
    await upsertMember({...referrer, points: newPoints});
    setMembers(prev => prev.map(m => m.id===referrer.id ? {...m,points:newPoints} : m));
    const txn = { id:genId("TXN"), memberId:referrer.id, memberName:referrer.name, type:"referral", pts:REF_PTS, note:`Referral — ${newMember.name}`, date:today() };
    await addTransaction(txn);
    setTransactions(prev => [txn,...prev]);
    setReferrals(prev => [ref,...prev]);
    setShowAdd(false);
    setForm({ referrerId:"", newMemberId:"" });
    setSaving(false);
    toast(`Referral logged — +${REF_PTS} pts awarded to ${referrer.name}`);
  };

  if (!loaded) return <div style={{color:C.muted,padding:20}}>Loading…</div>;

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Referrals ({referrals.length})</div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Log Referral</button>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:16,fontWeight:500}}>
        Members earn 500 pts for each successful referral. Referrals are auto-logged when new members use a referral code. You can also log them manually here.
      </div>

      {referrals.length === 0 ? (
        <div className="empty">No referrals yet.</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Referred By</th><th>New Member</th><th>Code</th><th>Points</th><th>Date</th>
            </tr></thead>
            <tbody>
              {referrals.map(r => (
                <tr key={r.id}>
                  <td style={{fontWeight:600}}>{r.referrerName}</td>
                  <td>{r.newMemberName}</td>
                  <td className="mono" style={{color:C.orange}}>{r.referrerCode||"—"}</td>
                  <td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.success}}>+{r.pts}</td>
                  <td className="mono" style={{color:C.muted}}>{fmtDate(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Member referral codes */}
      <div style={{marginTop:24}}>
        <div className="sec-title" style={{marginBottom:14}}>Member Referral Codes</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Member</th><th>Referral Code</th><th>Total Referrals</th></tr></thead>
            <tbody>
              {[...members].filter(m=>m.status==="active").sort((a,b)=>a.name.localeCompare(b.name)).map(m => {
                const count = referrals.filter(r => r.referrerId === m.id).length;
                return (
                  <tr key={m.id}>
                    <td style={{fontWeight:600}}>{m.name}</td>
                    <td className="mono" style={{color:C.orange,fontWeight:700}}>{m.referral_code||"—"}</td>
                    <td><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:count>0?C.success:C.muted}}>{count}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Modal title="Log Manual Referral" onClose={() => setShowAdd(false)} footer={<>
          <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={saving||!form.referrerId||!form.newMemberId}>
            {saving?"Saving...":"Log Referral (+500 pts)"}
          </button>
        </>}>
          <div className="form-row">
            <label className="form-label">Who referred? *</label>
            <select className="form-select" value={form.referrerId} onChange={e=>setForm({...form,referrerId:e.target.value})}>
              <option value="">— select member —</option>
              {[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=>(
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Who did they refer? *</label>
            <select className="form-select" value={form.newMemberId} onChange={e=>setForm({...form,newMemberId:e.target.value})}>
              <option value="">— select new member —</option>
              {[...members].filter(m=>m.id!==form.referrerId).sort((a,b)=>a.name.localeCompare(b.name)).map(m=>(
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-hint">500 points will be automatically awarded to the referring member.</div>
        </Modal>
      )}
    </div>
  );
}

// ── EXPORT DATA ───────────────────────────────────────────
function ExportData({ members, transactions, redemptions, tiers, toast }) {
  const [exporting, setExporting] = useState(null);

  const toCSV = (headers, rows) => {
    const escape = v => {
      const s = String(v === null || v === undefined ? "" : v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const lines = [headers.join(","), ...rows.map(r => r.map(escape).join(","))];
    return lines.join("\n");
  };

  const download = (filename, csv) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const getTierName = (pts) => {
    const sorted = [...tiers].sort((a,b)=>b.min-a.min);
    return (sorted.find(t=>pts>=t.min)||tiers[0])?.name || "Iron";
  };

  const exports = [
    {
      id: "members",
      label: "Members",
      icon: "👥",
      desc: "All member data — points, tiers, streaks, check-ins",
      fn: async () => {
        const headers = ["ID","Name","Phone","Email","Join Date","Points","Tier","Checkins","Streak","Status"];
        const rows = [...members].sort((a,b)=>b.points-a.points).map(m => [
          m.id, m.name, m.phone, m.email||"",
          m.joinDate||m.join_date||"",
          m.points, getTierName(m.points),
          m.checkins, m.streak, m.status
        ]);
        download(`URUZ_Members_${today()}.csv`, toCSV(headers, rows));
      }
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      icon: "🏆",
      desc: "Members ranked by points",
      fn: async () => {
        const headers = ["Rank","Name","Phone","Points","Tier","Streak","Check-ins","Status"];
        const sorted = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points);
        const rows = sorted.map((m,i) => [
          i+1, m.name, m.phone, m.points,
          getTierName(m.points), m.streak, m.checkins, m.status
        ]);
        download(`URUZ_Leaderboard_${today()}.csv`, toCSV(headers, rows));
      }
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: "📋",
      desc: "Full points history — all awards and deductions",
      fn: async () => {
        const headers = ["ID","Member","Type","Points","Note","Date"];
        const rows = transactions.map(t => [
          t.id, t.memberName||t.member_name||"",
          t.type, t.pts, t.note||"", t.date||""
        ]);
        download(`URUZ_Transactions_${today()}.csv`, toCSV(headers, rows));
      }
    },
    {
      id: "redemptions",
      label: "Redemptions",
      icon: "🎟",
      desc: "All reward redemption requests and their status",
      fn: async () => {
        const { getRedemptions } = await import("./supabase");
        const rdms = await getRedemptions();
        const headers = ["ID","Member","Reward","Points","Status","Date"];
        const rows = rdms.map(r => [
          r.id, r.memberName||r.member_name||"",
          r.reward, r.pts, r.status, r.date||""
        ]);
        download(`URUZ_Redemptions_${today()}.csv`, toCSV(headers, rows));
      }
    },
    {
      id: "enrollments",
      label: "Challenge Enrollments",
      icon: "⚔",
      desc: "Who joined which challenges and their completion status",
      fn: async () => {
        const { getEnrollments } = await import("./supabase");
        const enrs = await getEnrollments();
        const headers = ["ID","Member","Challenge","Progress","Goal","Completed","Enrolled Date","Completed Date"];
        const rows = enrs.map(e => [
          e.id, e.memberName||e.member_name||"",
          e.challengeName||e.challenge_name||"",
          e.progress||0, e.goal||1,
          e.completed?"Yes":"No",
          e.enrolledDate||e.enrolled_date||"",
          e.completedDate||e.completed_date||""
        ]);
        download(`URUZ_Enrollments_${today()}.csv`, toCSV(headers, rows));
      }
    },
    {
      id: "earn_rules",
      label: "Earn Rules",
      icon: "💰",
      desc: "Current points earning configuration",
      fn: async () => {
        const { getEarnRules } = await import("./supabase");
        const rules = await getEarnRules();
        const headers = ["Icon","Action","Points","Note","Active"];
        const rows = rules.map(r => [r.icon||"", r.action||"", r.pts||"", r.note||"", r.active?"Yes":"No"]);
        download(`URUZ_EarnRules_${today()}.csv`, toCSV(headers, rows));
      }
    },
  ];

  const handleExport = async (exp) => {
    setExporting(exp.id);
    try {
      await exp.fn();
      toast(`${exp.label} exported successfully`);
    } catch(e) {
      toast(`Export failed — try again`);
    }
    setExporting(null);
  };

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Export Data</div>
        <div style={{fontSize:12,color:C.muted,fontWeight:500}}>Downloads as CSV — opens in Excel or Google Sheets</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {exports.map(exp => (
          <div key={exp.id} style={{background:C.surface,border:`1px solid ${C.border}`,padding:20,transition:"border-color .2s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(245,128,32,.4)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <div style={{fontSize:28}}>{exp.icon}</div>
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:C.white}}>{exp.label}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{exp.desc}</div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{width:"100%",marginTop:4}}
              onClick={() => handleExport(exp)}
              disabled={exporting === exp.id}
            >
              {exporting === exp.id ? "Exporting…" : "⬇ Download CSV"}
            </button>
          </div>
        ))}
      </div>

      <div style={{marginTop:24,background:C.surface,border:`1px solid ${C.border}`,padding:16}}>
        <div style={{fontSize:11,color:C.muted,lineHeight:1.8}}>
          <strong style={{color:C.white}}>How to open CSV files:</strong><br/>
          • <strong style={{color:C.white}}>Excel:</strong> Double-click the downloaded file<br/>
          • <strong style={{color:C.white}}>Google Sheets:</strong> File → Import → Upload the CSV<br/>
          • <strong style={{color:C.white}}>Numbers (Mac):</strong> Double-click the downloaded file
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────
const ALL_NAV=[
  {id:"dashboard",  icon:"◉", label:"Dashboard"},
  {id:"members",    icon:"⊞", label:"Members"},
  {id:"award",      icon:"◆", label:"Award Points"},
  {id:"redemptions",icon:"🎟", label:"Redemptions"},
  {id:"rewards",    icon:"⭐", label:"Rewards"},
  {id:"staff",      icon:"👥", label:"Staff"},
  {id:"display",    icon:"📺", label:"TV Display"},
  {id:"workouts",   icon:"💪", label:"Workouts"},
  {id:"challenges", icon:"⚔",  label:"Challenges"},
  {id:"earn",       icon:"💰", label:"Earn Rules"},
  {id:"referrals",  icon:"👥", label:"Referrals"},
  {id:"export",     icon:"⬇", label:"Export Data"},
  {id:"settings",   icon:"⚙", label:"Settings"},
];

export default function AdminPanel(){
  const [staffSession,setStaffSession] = useState(null);
  const [staffList,setStaffList]       = useState([]);
  const [page,setPage]                 = useState("dashboard");
  const [members,setMembers]           = useState([]);
  const [transactions,setTxns]         = useState([]);
  const [redemptions,setRdms]          = useState([]);
  const [rewards,setRewards]           = useState(DEF_REWARDS);
  const [tiers,setTiers]               = useState(DEF_TIERS);
  const [awardTarget,setAwardTarget]   = useState(null);
  const [loaded,setLoaded]             = useState(false);
  const [toast,showToast]              = useToast();

  const [displaySettings, setDisplaySettings] = useState(null);

  useEffect(()=>{
    (async()=>{
      const sl=await getStaff();
      setStaffList(sl);
      const session=getStaffSession();
      if(session){
        const valid=sl.find(s=>s.id===session.id&&s.pin===session.pin);
        if(valid) setStaffSession(session);
        else clearStaffSession();
      }
      const [m,t,r,rw,ti,ds]=await Promise.all([getMembers(),getTransactions(),getRedemptions(),getRewards(),getTiers(),getDisplaySettings()]);
      setMembers(m.map(normalizeMember));setTxns(t);setRdms(r);
      setRewards(rw.length?rw:DEF_REWARDS);
      setTiers(ti.length?ti:DEF_TIERS);
      if(ds){try{setDisplaySettings({...DEF_DISPLAY,...JSON.parse(ds.config||"{}")});}catch{}}
      setLoaded(true);
    })();
  },[]);

  const handleLogin=(session)=>{
    setStaffSession(session);
    // reload staff list after potential first-time setup
    getStaff().then(setStaffList);
  };

  const handleLogout=()=>{clearStaffSession();setStaffSession(null);};
  const goAward=(member)=>{setAwardTarget(member);setPage("award");};
  const pending=redemptions.filter(r=>r.status==="pending").length;

  if(!loaded) return(<><style>{CSS}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1F2020"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:4,color:"#F58020"}}>LOADING…</div></div></>);

  if(!staffSession) return <AdminLogin onLogin={handleLogin} staffList={staffList}/>;

  const role=staffSession.role;
  const roleInfo=ROLES[role];
  const visibleNav=ALL_NAV.filter(n=>canAccess(role,n.id));

  return(
    <>
      <style>{CSS}</style>
      <div className="admin">
        <div className="sidebar">
          <div className="sb-brand"><div className="sb-logo">URUZ</div><div className="sb-sub">Member Central</div></div>
          <div className="sb-nav">
            <div className="sb-section">Navigation</div>
            {visibleNav.map(n=>(<button key={n.id} className={`sb-btn${page===n.id?" on":""}`} onClick={()=>setPage(n.id)}><span className="sb-icon">{n.icon}</span>{n.label}{n.id==="redemptions"&&pending>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:10,fontWeight:800,padding:"1px 6px"}}>{pending}</span>}</button>))}
          </div>
          <div className="sb-footer">
            <div className="sb-staff-name">{staffSession.name}</div>
            <div className="sb-staff-role" style={{color:roleInfo?.color}}>{roleInfo?.icon} {roleInfo?.label}</div>
            <button className="sb-logout" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
        <div className="main">
          <div className="topbar">
            <div className="topbar-title">{ALL_NAV.find(n=>n.id===page)?.label}</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.success}}/>
              <div className="topbar-date">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</div>
            </div>
          </div>
          <div className="content" key={page}>
            {page==="dashboard"  &&<Dashboard members={members} transactions={transactions} redemptions={redemptions}/>}
            {page==="members"    &&<Members members={members} setMembers={setMembers} transactions={transactions} tiers={tiers} onAward={goAward} toast={showToast} role={role}/>}
            {page==="award"      &&<AwardPoints members={members} setMembers={setMembers} setTransactions={setTxns} preSelected={awardTarget} toast={showToast}/>}
            {page==="redemptions"&&<Redemptions redemptions={redemptions} setRedemptions={setRdms} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="rewards"    &&<RewardsCatalog rewards={rewards} setRewards={setRewards} toast={showToast}/>}
            {page==="staff"      &&<StaffManagement staffList={staffList} setStaffList={setStaffList} toast={showToast}/>}
            {page==="display"    &&<DisplaySettings toast={showToast}/>}
            {page==="workouts"   &&<WorkoutsPanel members={members} toast={showToast}/>}
            {page==="challenges" &&<ChallengesPanel members={members} setMembers={setMembers} setTransactions={setTxns} toast={showToast} displaySettings={displaySettings}/>}
            {page==="earn"       &&<EarnRules toast={showToast}/>}
            {page==="referrals"  &&<ReferralsPanel members={members} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="export"     &&<ExportData members={members} transactions={transactions} redemptions={redemptions} tiers={tiers} toast={showToast}/>}
            {page==="settings"   &&<Settings tiers={tiers} setTiers={setTiers} toast={showToast}/>}
          </div>
        </div>
        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
      </div>
    </>
  );
}