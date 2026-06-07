import { useState, useEffect } from "react";
import {
  getMembers, getMemberByPhone, getMemberById, upsertMember,
  updateMemberPin, getTransactions, addTransaction,
  getRedemptions, addRedemption, getRewards, getTiers,
  getMemberEnrollments, enrollInChallenge, getDisplaySettings
} from "./supabase";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@300;400;500;600;700;800&display=swap');`;

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444",
  gold:"#D4AF37", silver:"#A8A9AD", bronze:"#CD7F32",
};

const DEF_TIERS = [
  { id:"t1", name:"Iron",   min:0,     color:"#6B7280", icon:"⚙" },
  { id:"t2", name:"Bronze", min:1000,  color:"#CD7F32", icon:"🔶" },
  { id:"t3", name:"Silver", min:2500,  color:"#A8A9AD", icon:"⬡" },
  { id:"t4", name:"Gold",   min:5000,  color:"#D4AF37", icon:"◆" },
  { id:"t5", name:"Elite",  min:10000, color:"#026F91", icon:"★" },
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
const HOW_TO_EARN = [
  { icon:"📍", action:"Daily Check-in",            pts:50,   note:"Scan the QR code at the entrance" },
  { icon:"🧑‍🏫", action:"Group Class Attendance",   pts:75,   note:"Per class" },
  { icon:"💪", action:"Personal Training Session",  pts:100,  note:"Per session" },
  { icon:"👥", action:"Refer a Friend",             pts:500,  note:"When they join" },
  { icon:"🛒", action:"In-Gym Purchase",            pts:"3%", note:"Of spend" },
  { icon:"🔥", action:"7-Day Streak Bonus",         pts:100,  note:"Auto-awarded" },
  { icon:"📅", action:"30-Day Streak Bonus",        pts:400,  note:"Auto-awarded" },
  { icon:"🎂", action:"Birthday Bonus",             pts:300,  note:"Once a year" },
];
const DEF_CHALLENGES = [
  { id:1, name:"Weekly Warrior",  desc:"Check in 5x this week",          pts:150,  goal:5,  deadline:"3 days left",  icon:"⚔", active:true },
  { id:2, name:"Early Bird",      desc:"Attend 3 AM classes this month", pts:200,  goal:3,  deadline:"12 days left", icon:"🌅", active:true },
  { id:3, name:"Bring the Crew",  desc:"Refer 2 new members",            pts:1000, goal:2,  deadline:"24 days left", icon:"👥", active:true },
  { id:4, name:"Iron Will",       desc:"15-day consecutive streak",      pts:300,  goal:15, deadline:"4 days left",  icon:"🔥", active:true },
];

async function sload(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
async function ssave(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function getSession() { try { const v=localStorage.getItem("uruz:session"); return v?JSON.parse(v):null; } catch { return null; } }
function saveSession(d) { try { localStorage.setItem("uruz:session",JSON.stringify(d)); } catch {} }
function clearSession()  { try { localStorage.removeItem("uruz:session"); } catch {} }

function normalizeMember(m) {
  return {
    id:          m.id,
    name:        m.name        || "",
    phone:       m.phone       || "",
    email:       m.email       || "",
    joinDate:    m.join_date   || m.joinDate || new Date().toISOString().slice(0,10),
    points:      m.points      ?? 0,
    checkins:    m.checkins    ?? 0,
    streak:      m.streak      ?? 0,
    status:      m.status      || "active",
    pin:         m.pin         || null,
    lastCheckin: m.last_checkin|| m.lastCheckin || null,
  };
}

function getTier(pts, tiers) { return [...tiers].sort((a,b)=>b.min-a.min).find(t=>pts>=t.min)||tiers[0]; }
function getNext(pts, tiers) { const s=[...tiers].sort((a,b)=>a.min-b.min); const cur=s.filter(t=>pts>=t.min).pop(); const i=s.indexOf(cur); return i<s.length-1?s[i+1]:null; }
function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); } catch { return d; } }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

const LOGO_URL = "https://raw.githubusercontent.com/nidokalash-boop/uruz-loyalty/main/URUZ%20LOGO%2001-10%20(1).png";

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body,#root{background:#1F2020;color:#FFFDF3;font-family:'Montserrat',sans-serif;}
.app{min-height:100vh;background:#1F2020;color:#FFFDF3;font-family:'Montserrat',sans-serif;max-width:920px;margin:0 auto;padding-bottom:60px;}
.screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden;}
.box{width:100%;max-width:380px;background:#252627;border:1px solid #333435;padding:36px 28px;}
.brand-sub{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#6B6866;text-align:center;margin-top:3px;font-weight:700;margin-bottom:0;}
.divider{height:1px;background:#333435;margin:24px 0;}
.step-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#FFFDF3;margin-bottom:6px;text-align:center;}
.step-sub{font-size:12px;color:#6B6866;text-align:center;margin-bottom:20px;font-weight:500;line-height:1.6;}
.lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-bottom:8px;display:block;}
.inp{width:100%;padding:12px 14px;background:#2A2B2C;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:500;outline:none;transition:border-color .15s;margin-bottom:14px;}
.inp:focus{border-color:#F58020;}
.inp::placeholder{color:#6B6866;}
.btn{width:100%;padding:14px;border:none;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .15s;margin-bottom:10px;}
.btn:last-child{margin-bottom:0;}
.btn-primary{background:#F58020;color:#fff;}
.btn-primary:hover{background:#F59340;}
.btn-primary:disabled{background:#333435;color:#6B6866;cursor:not-allowed;}
.btn-ghost{background:none;border:1px solid #333435;color:#6B6866;}
.btn-ghost:hover{border-color:#F58020;color:#F58020;}
.err{font-size:12px;color:#EF4444;text-align:center;margin-bottom:12px;font-weight:500;}
.hint{font-size:11px;color:#6B6866;text-align:center;line-height:1.6;margin-top:8px;}
.link{color:#F58020;cursor:pointer;font-weight:700;}
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
.member-chip{display:flex;align-items:center;gap:12px;background:#2A2B2C;border:1px solid #333435;padding:12px 14px;margin-bottom:20px;}
.chip-av{width:36px;height:36px;background:rgba(245,128,32,.15);border:1px solid rgba(245,128,32,.3);display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;color:#F58020;flex-shrink:0;}
.hdr{background:linear-gradient(135deg,#1a1208 0%,#1F2020 65%);border-bottom:1px solid #333435;padding:28px 24px 0;position:relative;overflow:hidden;}
.hdr::after{display:none;}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;}
.brand-mark{font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:5px;color:#F58020;opacity:.85;margin-bottom:6px;}
.member-name{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:2px;line-height:1;color:#FFFDF3;}
.member-meta{font-size:11px;color:#6B6866;margin-top:4px;font-weight:400;}
.tier-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid currentColor;}
.pts-row{display:flex;align-items:flex-end;gap:10px;margin-bottom:18px;}
.pts-val{font-family:'Bebas Neue',sans-serif;font-size:68px;line-height:1;color:#F58020;letter-spacing:-1px;}
.pts-lbl{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#6B6866;margin-bottom:12px;font-weight:600;}
.prog-labels{display:flex;justify-content:space-between;font-size:11px;color:#6B6866;margin-bottom:7px;font-weight:500;}
.prog-track{height:3px;background:#333435;}
.prog-fill{height:100%;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);}
.stats-strip{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #333435;margin:18px -24px 0;}
.stat-cell{padding:14px 10px;text-align:center;border-right:1px solid #333435;}
.stat-cell:last-child{border-right:none;}
.stat-num{font-family:'Bebas Neue',sans-serif;font-size:28px;line-height:1;color:#FFFDF3;}
.stat-lbl{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#6B6866;margin-top:3px;font-weight:600;}
.nav{display:flex;border-bottom:1px solid #333435;background:#252627;position:sticky;top:0;z-index:100;}
.nav-btn{flex:1;padding:14px 4px;background:none;border:none;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:color .2s;position:relative;text-align:center;}
.nav-btn.on{color:#F58020;}
.nav-btn.on::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:#F58020;}
.content{padding:24px;animation:up .35s ease both;}
@keyframes up{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.sec-label{font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#6B6866;margin-bottom:14px;display:flex;align-items:center;gap:10px;}
.sec-label::after{content:'';flex:1;height:1px;background:#333435;}
.act-row{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid #333435;gap:12px;}
.act-row:last-child{border-bottom:none;}
.act-icon{width:36px;height:36px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.act-label{font-size:14px;font-weight:500;color:#FFFDF3;}
.act-date{font-size:11px;color:#6B6866;margin-top:2px;}
.act-pts{font-family:'Bebas Neue',sans-serif;font-size:20px;}
.rewards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:14px;}
.rwd-card{background:#2A2B2C;border:1px solid #333435;padding:18px 16px;position:relative;transition:border-color .2s,transform .2s;}
.rwd-card:hover:not(.oos){border-color:#F58020;transform:translateY(-2px);}
.rwd-card.oos{opacity:.42;}
.rwd-icon{font-size:28px;margin-bottom:10px;display:block;}
.rwd-cat{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#6B6866;margin-bottom:6px;font-weight:700;}
.rwd-name{font-size:15px;font-weight:700;color:#FFFDF3;line-height:1.25;margin-bottom:12px;}
.rwd-footer{display:flex;align-items:center;justify-content:space-between;}
.rwd-cost{font-family:'Bebas Neue',sans-serif;font-size:24px;color:#F58020;}
.rdm-btn{padding:6px 14px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:background .15s;}
.rdm-btn:hover{background:#F59340;}
.rdm-btn:disabled{background:#333435;color:#6B6866;cursor:not-allowed;}
.rdm-btn.pending-btn{background:#026F91;}
.oos-tag{position:absolute;top:10px;right:10px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;background:#333435;color:#6B6866;padding:2px 7px;font-weight:700;}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;}
.pill{padding:5px 14px;border:1px solid #333435;background:none;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.pill.on,.pill:hover{border-color:#F58020;color:#F58020;background:rgba(245,128,32,.08);}
.ch-card{background:#2A2B2C;border:1px solid #333435;padding:18px;margin-bottom:12px;transition:border-color .2s;}
.ch-top{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;}
.ch-icon-w{width:42px;height:42px;background:rgba(245,128,32,.1);border:1px solid rgba(245,128,32,.28);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.ch-name{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#FFFDF3;line-height:1;margin-bottom:4px;letter-spacing:1px;}
.ch-desc{font-size:12px;color:#6B6866;}
.ch-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;}
.ch-dl{font-size:11px;color:#6B6866;font-weight:500;}
.ch-rew{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#F58020;}
.ch-track{height:4px;background:#333435;}
.ch-fill{height:100%;background:linear-gradient(90deg,#026F91,#F58020);transition:width 1s cubic-bezier(0.16,1,0.3,1);}
.ch-bar-lbl{display:flex;justify-content:space-between;font-size:11px;color:#6B6866;margin-top:6px;font-weight:500;}
.lb-row{display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #333435;gap:13px;}
.lb-row:last-child{border-bottom:none;}
.lb-row.me{background:rgba(245,128,32,.06);margin:0 -24px;padding-left:24px;padding-right:24px;border-left:2px solid #F58020;}
.lb-rank{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#6B6866;width:28px;text-align:center;flex-shrink:0;}
.lb-rank.top{color:#D4AF37;}
.lb-av{width:36px;height:36px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;flex-shrink:0;background:#333435;color:#FFFDF3;}
.lb-name{flex:1;font-size:14px;font-weight:500;}
.lb-name .you{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#F58020;background:rgba(245,128,32,.14);padding:1px 5px;margin-left:7px;font-weight:700;}
.lb-streak{font-size:12px;color:#6B6866;font-weight:500;}
.lb-pts{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#FFFDF3;text-align:right;min-width:70px;}
.tier-ladder{display:flex;border:1px solid #333435;overflow:hidden;margin-bottom:24px;}
.tier-rung{flex:1;padding:14px 8px;text-align:center;border-right:1px solid #333435;}
.tier-rung:last-child{border-right:none;}
.tier-rung.cur{background:rgba(245,128,32,.07);}
.tier-rung-icon{font-size:18px;display:block;margin-bottom:4px;}
.tier-rung-name{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;}
.tier-rung-min{font-size:10px;color:#6B6866;margin-top:3px;font-weight:500;}
.earn-tbl{width:100%;border-collapse:collapse;}
.earn-tbl tr{border-bottom:1px solid #333435;}
.earn-tbl tr:last-child{border-bottom:none;}
.earn-tbl td{padding:13px 8px;font-size:14px;vertical-align:middle;}
.earn-action{color:#FFFDF3;font-weight:600;}
.earn-note{color:#6B6866;font-size:11px;margin-top:2px;}
.earn-pts{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#F58020;text-align:right;white-space:nowrap;}
.rdm-pending{background:rgba(2,111,145,.1);border:1px solid rgba(2,111,145,.3);padding:10px 14px;margin-bottom:14px;}
.rdm-pending-title{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#026F91;font-weight:700;margin-bottom:8px;}
.rdm-pending-item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(2,111,145,.2);}
.rdm-pending-item:last-child{border-bottom:none;}
.toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(20px);background:#F58020;color:#fff;padding:12px 28px;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;z-index:1000;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}
.icon-btn{background:none;border:1px solid #333435;color:#6B6866;padding:5px 10px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .15s;}
.icon-btn:hover{border-color:#F58020;color:#F58020;}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#1F2020;}::-webkit-scrollbar-thumb{background:#333435;}
`;

function PinInput({ value, onChange, label }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  const handle = k => { if(k==="⌫") onChange(value.slice(0,-1)); else if(k==="") return; else if(value.length<4) onChange(value+k); };
  return (
    <div>
      {label && <div className="step-sub">{label}</div>}
      <div className="pin-row">{[0,1,2,3].map(i=><div key={i} className={`pin-digit${value[i]?" filled":""}${value.length===i?" active":""}`}>{value[i]?"●":""}</div>)}</div>
      <div className="pin-pad">{keys.map((k,i)=><div key={i} className={`pin-key${k==="⌫"?" del":""}${k===""?" empty":""}`} onClick={()=>handle(k)}>{k}</div>)}</div>
    </div>
  );
}

function LoginFlow({ onLogin }) {
  const [stage,setStage]       = useState("phone");
  const [phone,setPhone]       = useState("");
  const [member,setMember]     = useState(null);
  const [pin,setPin]           = useState("");
  const [pin2,setPin2]         = useState("");
  const [error,setError]       = useState("");
  const [loading,setLoading]   = useState(false);
  const [regName,setRegName]   = useState("");
  const [regPhone,setRegPhone] = useState("");

  const handlePhone = async () => {
    setError(""); setLoading(true);
    const m = await getMemberByPhone(phone);
    setLoading(false);
    if (!m) { setError("No active member found. Register below or ask the front desk."); return; }
    setMember(normalizeMember(m));
    setStage(m.pin ? "pin" : "setpin");
  };

  const handlePin = async () => {
    setError("");
    if (pin !== member.pin) { setError("Incorrect PIN. Try again."); setPin(""); return; }
    saveSession({ memberId: member.id });
    onLogin(member.id);
  };

  useEffect(() => { if(stage==="pin" && pin.length===4) handlePin(); }, [pin, stage]);

  const handleSetPin = () => { if(pin.length<4){setError("Enter all 4 digits.");return;} setPin2("");setError("");setStage("confirmpin"); };

  const handleConfirmPin = async () => {
    if(pin2!==pin){setError("PINs don't match. Try again.");setPin2("");return;}
    const { updateMemberPin } = await import("./supabase");
    await updateMemberPin(member.id, pin);
    saveSession({ memberId: member.id });
    onLogin(member.id);
  };

  useEffect(() => { if(stage==="confirmpin" && pin2.length===4) handleConfirmPin(); }, [pin2, stage]);

  const handleRegister = async () => {
    setError("");
    if(!regName.trim()||!regPhone.trim()){setError("Please fill in all fields.");return;}
    setLoading(true);
    const existing = await getMemberByPhone(regPhone);
    if(existing){setError("This number is already registered.");setLoading(false);return;}
    const nm = { id:genId("URZ"), name:regName.trim(), phone:regPhone.trim(), email:"", joinDate:today(), points:0, checkins:0, streak:0, status:"active", pin:null };
    await upsertMember(nm);
    setLoading(false);
    setMember(nm); setPin(""); setStage("setpin");
  };

  const LogoBox = () => (
    <div style={{textAlign:"center",marginBottom:0}}>
      <img src={LOGO_URL} alt="URUZ" style={{height:56,display:"block",margin:"0 auto 6px",width:"auto"}}/>
      <div className="brand-sub">Loyalty Program</div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="screen">
        {stage==="phone"&&(
          <div className="box">
            <LogoBox/><div className="divider"/>
            <div className="step-title">Welcome Back</div>
            <label className="lbl">Your Phone Number</label>
            <input className="inp" placeholder="+961 XX XXX XXX" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handlePhone()}/>
            {error&&<div className="err">{error}</div>}
            <button className="btn btn-primary" onClick={handlePhone} disabled={loading}>{loading?"Checking...":"Sign In"}</button>
            <div className="hint">Not a member? <span className="link" onClick={()=>{setError("");setStage("register");}}>Register here</span></div>
          </div>
        )}
        {stage==="pin"&&member&&(
          <div className="box">
            <LogoBox/><div className="divider"/>
            <div className="member-chip">
              <div className="chip-av">{initials(member.name)}</div>
              <div><div style={{fontSize:14,fontWeight:700,color:"#FFFDF3"}}>{member.name}</div><div style={{fontSize:11,color:"#6B6866"}}>{member.phone}</div></div>
            </div>
            <PinInput value={pin} onChange={v=>{setPin(v);setError("");}} label="Enter your 4-digit PIN"/>
            {error&&<div className="err">{error}</div>}
            <button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>{setStage("phone");setPin("");setMember(null);}}>Back</button>
          </div>
        )}
        {stage==="setpin"&&member&&(
          <div className="box">
            <LogoBox/><div className="divider"/>
            <div className="step-title">Create Your PIN</div>
            <PinInput value={pin} onChange={v=>{setPin(v);setError("");}} label="Choose a 4-digit PIN to secure your account"/>
            {error&&<div className="err">{error}</div>}
            <button className="btn btn-primary" onClick={handleSetPin} disabled={pin.length<4}>Continue</button>
          </div>
        )}
        {stage==="confirmpin"&&(
          <div className="box">
            <LogoBox/><div className="divider"/>
            <div className="step-title">Confirm PIN</div>
            <PinInput value={pin2} onChange={v=>{setPin2(v);setError("");}} label="Enter your PIN again to confirm"/>
            {error&&<div className="err">{error}</div>}
          </div>
        )}
        {stage==="register"&&(
          <div className="box">
            <LogoBox/><div className="divider"/>
            <div className="step-title">New Member</div>
            <div className="step-sub">Register to start earning points from day one</div>
            <label className="lbl">Full Name</label>
            <input className="inp" placeholder="e.g. Alex Rivera" value={regName} onChange={e=>setRegName(e.target.value)}/>
            <label className="lbl">Phone Number</label>
            <input className="inp" placeholder="+961 XX XXX XXX" value={regPhone} onChange={e=>setRegPhone(e.target.value)}/>
            {error&&<div className="err">{error}</div>}
            <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>{loading?"Creating...":"Create Account"}</button>
            <button className="btn btn-ghost" onClick={()=>{setStage("phone");setError("");}}>Back to Sign In</button>
          </div>
        )}
      </div>
    </>
  );
}

function ActivityTab({ transactions, memberId }) {
  const cfg={checkin:{e:"📍",bg:"rgba(2,111,145,.15)"},challenge:{e:"🏆",bg:"rgba(212,175,55,.15)"},referral:{e:"👥",bg:"rgba(34,197,94,.15)"},purchase:{e:"🛒",bg:"rgba(168,85,247,.15)"},redeem:{e:"🎟",bg:"rgba(239,68,68,.15)"},class:{e:"💪",bg:"rgba(245,128,32,.15)"},bonus:{e:"⭐",bg:"rgba(212,175,55,.15)"},manual:{e:"✏",bg:"rgba(168,85,247,.15)"},deduct:{e:"➖",bg:"rgba(239,68,68,.15)"}};
  const myTxns=transactions.filter(t=>t.memberId===memberId||t.member_id===memberId).slice(0,15);
  if(!myTxns.length) return <div style={{color:"#6B6866",fontSize:13,padding:"20px 0"}}>No activity yet. Check in today to start earning!</div>;
  return (<div><div className="sec-label">Your Activity</div>{myTxns.map(a=>{const k=cfg[a.type]||cfg.checkin;return(<div key={a.id} className="act-row"><div className="act-icon" style={{background:k.bg}}>{k.e}</div><div style={{flex:1}}><div className="act-label">{a.note}</div><div className="act-date">{fmtDate(a.date)}</div></div><div className="act-pts" style={{color:a.pts>0?"#22C55E":"#EF4444"}}>{a.pts>0?"+":""}{a.pts}</div></div>);})}</div>);
}

function EarnTab({ tiers, memberPts }) {
  const cur=getTier(memberPts,tiers);
  return (<div><div className="sec-label">Tier Path</div><div className="tier-ladder">{[...tiers].sort((a,b)=>a.min-b.min).map(t=>(<div key={t.id} className={`tier-rung${t.name===cur.name?" cur":""}`}><span className="tier-rung-icon">{t.icon}</span><div className="tier-rung-name" style={{color:t.color}}>{t.name}</div><div className="tier-rung-min">{t.min.toLocaleString()}+</div></div>))}</div><div className="sec-label">Ways to Earn</div><table className="earn-tbl"><tbody>{HOW_TO_EARN.map((e,i)=>(<tr key={i}><td style={{width:38,textAlign:"center",fontSize:20}}>{e.icon}</td><td><div className="earn-action">{e.action}</div><div className="earn-note">{e.note}</div></td><td className="earn-pts">{typeof e.pts==="number"?`+${e.pts}`:e.pts} <span style={{fontSize:11,color:"#6B6866"}}>PTS</span></td></tr>))}</tbody></table></div>);
}

function RewardsTab({ rewards, memberPts, myRedemptions, onRequest }) {
  const [filter,setFilter]=useState("All");
  const cats=["All","Access","Merch","Training"];
  const list=filter==="All"?rewards:rewards.filter(r=>r.cat===filter);
  const pendingNames=myRedemptions.filter(r=>r.status==="pending").map(r=>r.reward);
  return (<div><div style={{marginBottom:18}}><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#6B6866",marginBottom:4,fontWeight:600}}>Your Balance</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,color:"#F58020",lineHeight:1}}>{memberPts.toLocaleString()} <span style={{fontSize:16,color:"#6B6866"}}>PTS</span></div></div>{myRedemptions.filter(r=>r.status==="pending").length>0&&(<div className="rdm-pending"><div className="rdm-pending-title">⏳ Pending Redemptions</div>{myRedemptions.filter(r=>r.status==="pending").map(r=>(<div key={r.id} className="rdm-pending-item"><span style={{fontSize:13,fontWeight:500}}>{r.reward}</span><span style={{fontSize:11,color:"#026F91",fontWeight:700}}>See front desk</span></div>))}</div>)}<div className="pills">{cats.map(c=><button key={c} className={`pill${filter===c?" on":""}`} onClick={()=>setFilter(c)}>{c}</button>)}</div><div className="rewards-grid">{list.map(r=>{const ip=pendingNames.includes(r.name);return(<div key={r.id} className={`rwd-card${!r.stock?" oos":""}`}>{!r.stock&&<span className="oos-tag">Sold Out</span>}<span className="rwd-icon">{r.icon}</span><div className="rwd-cat">{r.cat}</div><div className="rwd-name">{r.name}</div><div className="rwd-footer"><div className="rwd-cost">{r.pts.toLocaleString()}</div><button className={`rdm-btn${ip?" pending-btn":""}`} disabled={(!ip&&memberPts<r.pts)||!r.stock} onClick={()=>!ip&&onRequest(r)}>{ip?"Requested":memberPts<r.pts?"Need more":"Request"}</button></div></div>);})}</div></div>);
}

function ChallengesTab({ memberId, challenges }) {
  const [enrollments, setEnrollments] = useState([]);
  const [joining, setJoining]         = useState(null);
  const [toastMsg, setToastMsg]       = useState("");
  const [toastOn, setToastOn]         = useState(false);

  const showToast = msg => { setToastMsg(msg); setToastOn(true); setTimeout(()=>setToastOn(false),2600); };

  useEffect(() => {
    if (memberId) getMemberEnrollments(memberId).then(setEnrollments);
  }, [memberId]);

  const isEnrolled = cid => enrollments.find(e => e.challengeId === String(cid));

  const handleJoin = async (c) => {
    if (joining) return;
    setJoining(c.id);
    const enrollment = {
      id: genId("ENR"),
      challengeId: String(c.id),
      challengeName: c.name,
      memberId,
      memberName: "",
      progress: 0,
      goal: c.goal || 1,
      enrolledDate: today(),
    };
    await enrollInChallenge(enrollment);
    setEnrollments(prev => [...prev, {...enrollment, completed:false}]);
    setJoining(null);
    showToast(`Joined: ${c.name}!`);
  };

  return (
    <div>
      <div className="sec-label">Active Challenges</div>
      {challenges.map(c => {
        const enrolled  = isEnrolled(c.id);
        const progress  = enrolled ? enrolled.progress : 0;
        const goal      = c.goal || 1;
        const pct       = Math.min(100, Math.round((progress/goal)*100));
        const completed = enrolled?.completed;
        return (
          <div key={c.id} className="ch-card" style={{borderColor:completed?"#22C55E":enrolled?"rgba(245,128,32,.4)":undefined}}>
            <div className="ch-top">
              <div className="ch-icon-w">{c.icon}</div>
              <div style={{flex:1}}>
                <div className="ch-name">{c.name}</div>
                <div className="ch-desc">{c.desc}</div>
              </div>
              {completed ? (
                <div style={{background:"rgba(34,197,94,.15)",color:"#22C55E",padding:"4px 10px",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>✓ Done</div>
              ) : enrolled ? (
                <div style={{background:"rgba(245,128,32,.15)",color:"#F58020",padding:"4px 10px",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>Joined</div>
              ) : (
                <button onClick={()=>handleJoin(c)} disabled={joining===c.id}
                  style={{background:"#F58020",border:"none",color:"#fff",padding:"6px 14px",fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
                  {joining===c.id?"...":"Join"}
                </button>
              )}
            </div>
            <div className="ch-meta">
              <span className="ch-dl">⏱ {c.deadline}</span>
              <span className="ch-rew">+{c.pts} PTS</span>
            </div>
            {enrolled && <>
              <div className="ch-track"><div className="ch-fill" style={{width:`${pct}%`}}/></div>
              <div className="ch-bar-lbl"><span>{progress}/{goal} complete</span><span style={{color:pct>=100?"#22C55E":"#6B6866"}}>{pct}%</span></div>
            </>}
          </div>
        );
      })}
      <div className={`toast${toastOn?" on":""}`}>✓ {toastMsg}</div>
    </div>
  );
}

function LeaderboardTab({ members, memberId }) {
  const sorted=[...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points);
  const top10=sorted.slice(0,10);
  const meIdx=sorted.findIndex(m=>m.id===memberId);
  const me=sorted[meIdx];
  return (<div><div className="sec-label">This Month's Rankings</div>{top10.map((m,i)=>{const r=i+1;const av=r===1?{background:"rgba(212,175,55,.22)",color:"#D4AF37",border:"1px solid rgba(212,175,55,.55)"}:r===2?{background:"rgba(168,169,173,.22)",color:"#A8A9AD",border:"1px solid rgba(168,169,173,.55)"}:r===3?{background:"rgba(205,127,50,.22)",color:"#CD7F32",border:"1px solid rgba(205,127,50,.55)"}:{};return(<div key={m.id} className={`lb-row${m.id===memberId?" me":""}`}><div className={`lb-rank${r<=3?" top":""}`}>{r}</div><div className="lb-av" style={av}>{initials(m.name)}</div><div className="lb-name">{m.name}{m.id===memberId&&<span className="you">You</span>}</div><div className="lb-streak">🔥 {m.streak}d</div><div className="lb-pts">{m.points.toLocaleString()}</div></div>);})}{me&&meIdx>=10&&<><div style={{textAlign:"center",padding:"10px 0",color:"#6B6866",fontSize:12}}>• • •</div><div className="lb-row me"><div className="lb-rank">{meIdx+1}</div><div className="lb-av" style={{background:"rgba(245,128,32,.22)",color:"#F58020",border:"1px solid rgba(245,128,32,.55)"}}>{initials(me.name)}</div><div className="lb-name">{me.name}<span className="you">You</span></div><div className="lb-streak">🔥 {me.streak}d</div><div className="lb-pts">{me.points.toLocaleString()}</div></div></>}</div>);
}

const TABS=[{id:"activity",label:"Activity"},{id:"earn",label:"Earn"},{id:"rewards",label:"Rewards"},{id:"challenges",label:"Challenges"},{id:"leaderboard",label:"Rankings"}];

export default function MemberPortal() {
  const [memberId,setMemberId]   = useState(null);
  const [member,setMember]       = useState(null);
  const [members,setMembers]     = useState([]);
  const [transactions,setTxns]   = useState([]);
  const [redemptions,setRdms]    = useState([]);
  const [rewards,setRewards]     = useState(DEF_REWARDS);
  const [tiers,setTiers]         = useState(DEF_TIERS);
  const [challenges,setChallenges] = useState(DEF_CHALLENGES);
  const [tab,setTab]             = useState("activity");
  const [loaded,setLoaded]       = useState(false);
  const [toast,setToast]         = useState({msg:"",on:false});

  const showToast = msg => { setToast({msg,on:true}); setTimeout(()=>setToast(t=>({...t,on:false})),2600); };

  const loadData = async (id) => {
    const mid = id||memberId;
    const [m,t,r,rw,ti,ds] = await Promise.all([
      getMembers(), getTransactions(), getRedemptions(), getRewards(), getTiers(), getDisplaySettings()
    ]);
    const normalized = m.map(normalizeMember);
    setMembers(normalized); setTxns(t); setRdms(r);
    setRewards(rw.length?rw:DEF_REWARDS);
    setTiers(ti.length?ti:DEF_TIERS);
    if (ds) {
      try {
        const settings = JSON.parse(ds.config||"{}");
        if (settings.challenges && settings.challenges.length > 0) {
          setChallenges(settings.challenges.filter(c=>c.active!==false));
        }
      } catch {}
    }
    const found = normalized.find(x=>x.id===mid);
    setMember(found||null);
    setLoaded(true);
  };

  useEffect(()=>{
    const session=getSession();
    if(session?.memberId){setMemberId(session.memberId);loadData(session.memberId);}
  },[]);

  const handleLogin=(id)=>{setMemberId(id);loadData(id);};

  const handleRequest=async(reward)=>{
    const rdm={id:genId("RDM"),memberId:member.id,memberName:member.name,reward:reward.name,pts:reward.pts,status:"pending",date:today()};
    await addRedemption(rdm);
    setRdms(prev=>[rdm,...prev]);
    showToast(`Requested: ${reward.name} — see the front desk`);
  };

  const handleLogout=()=>{clearSession();setMemberId(null);setMember(null);setLoaded(false);};

  if(!memberId) return <LoginFlow onLogin={handleLogin}/>;
  if(!loaded) return (<><style>{CSS}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1F2020"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:4,color:"#F58020"}}>LOADING…</div></div></>);
  if(!member) return (<><style>{CSS}</style><div className="screen"><div className="box"><img src={LOGO_URL} alt="URUZ" style={{height:56,display:"block",margin:"0 auto 6px",width:"auto"}}/><div className="brand-sub">Loyalty Program</div><div className="divider"/><div className="step-title">Account Not Found</div><div className="step-sub">Your account could not be loaded. Please sign in again or contact the front desk.</div><button className="btn btn-primary" onClick={handleLogout}>Back to Sign In</button></div></div></>);

  const tier=getTier(member.points,tiers);
  const next=getNext(member.points,tiers);
  const tierPct=next?Math.round(((member.points-tier.min)/(next.min-tier.min))*100):100;
  const rank=[...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===member.id)+1;
  const myRdms=redemptions.filter(r=>r.memberId===member.id||r.member_id===member.id);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="hdr">
          <div className="hdr-top">
            <div>
              <div style={{marginBottom:8}}>
                <img src={LOGO_URL} alt="URUZ" style={{height:52,width:"auto"}}/>
              </div>
              <div className="member-name">{member.name}</div>
              <div className="member-meta">Member since {new Date(member.joinDate).toLocaleDateString("en-GB",{month:"short",year:"numeric"})} · {member.id}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <div className="tier-badge" style={{color:tier.color,borderColor:tier.color,background:`${tier.color}18`}}>{tier.icon} {tier.name}</div>
              <div style={{display:"flex",gap:6}}>
                <button className="icon-btn" onClick={()=>loadData()}>↻</button>
                <button className="icon-btn" onClick={handleLogout}>Sign Out</button>
              </div>
            </div>
          </div>
          <div className="pts-row"><div className="pts-val">{member.points.toLocaleString()}</div><div className="pts-lbl">Points</div></div>
          {next&&<><div className="prog-labels"><span>{tier.name}</span><span style={{color:next.color}}>{(next.min-member.points).toLocaleString()} to {next.name}</span></div><div className="prog-track"><div className="prog-fill" style={{width:`${tierPct}%`,background:`linear-gradient(90deg,#026F91,#F58020)`}}/></div></>}
          <div className="stats-strip">
            <div className="stat-cell"><div className="stat-num" style={{color:"#F58020"}}>#{rank}</div><div className="stat-lbl">Club Rank</div></div>
            <div className="stat-cell"><div className="stat-num">🔥 {member.streak}</div><div className="stat-lbl">Day Streak</div></div>
            <div className="stat-cell"><div className="stat-num">{member.checkins}</div><div className="stat-lbl">Check-ins</div></div>
          </div>
        </div>
        <div className="nav">{TABS.map(t=><button key={t.id} className={`nav-btn${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
        <div className="content" key={tab}>
          {tab==="activity"   &&<ActivityTab transactions={transactions} memberId={member.id}/>}
          {tab==="earn"       &&<EarnTab tiers={tiers} memberPts={member.points}/>}
          {tab==="rewards"    &&<RewardsTab rewards={rewards} memberPts={member.points} myRedemptions={myRdms} onRequest={handleRequest}/>}
          {tab==="challenges" &&<ChallengesTab memberId={member.id} challenges={challenges}/>}
          {tab==="leaderboard"&&<LeaderboardTab members={members} memberId={member.id}/>}
        </div>
        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
      </div>
    </>
  );
}
