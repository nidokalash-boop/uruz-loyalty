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



// ── CHALLENGE ICON SYSTEM ─────────────────────────────────
const ICON_MAP = {
  trophy:   {label:"Trophy",    paths:["M8 21h8M12 17v4","M17 5h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4","M7 5H5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4","M12 17a6 6 0 0 0 6-6V3H6v8a6 6 0 0 0 6 6z"]},
  dumbbell: {label:"Dumbbell",  paths:["M6.5 8.5v7","M17.5 8.5v7"], rects:[{x:4,y:7,w:5,h:10,r:1.5},{x:15,y:7,w:5,h:10,r:1.5}], lines:[{x1:9,y1:12,x2:15,y2:12,sw:2.5}]},
  target:   {label:"Target",    circles:[{cx:12,cy:12,r:10},{cx:12,cy:12,r:6},{cx:12,cy:12,r:2}]},
  fire:     {label:"Fire",      paths:["M12 2c0 6-6 8-6 13a6 6 0 0 0 12 0c0-5-6-7-6-13z","M12 12c0 3-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3-2-6z"]},
  lightning:{label:"Lightning", polygons:["13 2 3 14 12 14 11 22 21 10 12 10 13 2"]},
  star:     {label:"Star",      polygons:["12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"]},
  crown:    {label:"Crown",     paths:["M2 19h20","M2 5l5 8 5-6 5 6 5-8v14H2z"]},
  shield:   {label:"Shield",    paths:["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"]},
  run:      {label:"Running",   paths:["M7.5 13.5l2-3.5 3.5 3 3-5.5","M17 18l-2-4-3 2-1.5 4","M5 21l2-3"], circles:[{cx:13,cy:4,r:2}]},
  clock:    {label:"Timer",     paths:["M12 6v6l4 2"], circles:[{cx:12,cy:12,r:10}]},
  calendar: {label:"Calendar",  paths:["M3 10h18","M16 2v4","M8 2v4"], rects:[{x:3,y:4,w:18,h:18,r:2}]},
  group:    {label:"Group",     paths:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"], circles:[{cx:9,cy:7,r:4}]},
  sunrise:  {label:"Early Bird",paths:["M12 2v4","M4.22 10.22l2.83 2.83","M1 18h22","M19.78 10.22l-2.83 2.83","M18 18a6 6 0 0 0-12 0"]},
  heart:    {label:"Heart",     paths:["M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"]},
  medal:    {label:"Medal",     paths:["M9 2h6l2 5H7z","M12 8v6"], circles:[{cx:12,cy:14,r:6}]},
  diamond:  {label:"Diamond",   polygons:["12 2 22 9 18 20 6 20 2 9"]},
  rocket:   {label:"Rocket",    paths:["M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z","M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"]},
  mountain: {label:"Mountain",  paths:["M8 3L2 21h20L14 3z","M14 3l3.5 7-5.5 3-5.5-3L10 3"]},
  boxing:   {label:"Boxing",    paths:["M4 8h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z","M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2","M12 4v4"]},
  checkin:  {label:"Check-in",  paths:["M12 2v3","M12 19v3","M2 12h3","M19 12h3"], circles:[{cx:12,cy:12,r:3}]},
};

function IconSVG({ id, size=18, color="currentColor", strokeWidth=1.5 }) {
  const icon = ICON_MAP[id] || ICON_MAP.trophy;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {icon.paths&&icon.paths.map((p,i)=><path key={i} d={p}/>)}
      {icon.circles&&icon.circles.map((c,i)=><circle key={i} cx={c.cx} cy={c.cy} r={c.r}/>)}
      {icon.rects&&icon.rects.map((r,i)=><rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.r||0}/>)}
      {icon.lines&&icon.lines.map((l,i)=><line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={l.sw||strokeWidth}/>)}
      {icon.polygons&&icon.polygons.map((p,i)=><polygon key={i} points={p}/>)}
    </svg>
  );
}

function IconPicker({ value, onChange }) {
  return (
    <div style={{marginTop:8}}>
      <label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#6B6866",fontWeight:700,display:"block",marginBottom:8}}>Challenge Icon</label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:6}}>
        {Object.entries(ICON_MAP).map(([id, icon])=>(
          <div key={id}
            title={icon.label}
            onClick={()=>onChange(id)}
            style={{
              width:36,height:36,
              background:value===id?"rgba(245,128,32,.15)":"#2A2B2C",
              border:value===id?"1px solid #F58020":"1px solid #333435",
              display:"flex",alignItems:"center",justifyContent:"center",
              cursor:"pointer",transition:"all .15s",
            }}>
            <IconSVG id={id} size={16} color={value===id?"#F58020":"#6B6866"}/>
          </div>
        ))}
      </div>
      {value && <div style={{marginTop:6,fontSize:11,color:"#F58020",fontWeight:600}}>Selected: {ICON_MAP[value]?.label||value}</div>}
    </div>
  );
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
  ],
  homeMessages: [
    "Every rep is a deposit into your future self.",
    "Show up. Put in the work. The results follow.",
    "Strength isn't given — it's built, session by session.",
    "Your only competition is who you were yesterday.",
    "The gym doesn't care about your excuses. Neither should you.",
    "Built different. Trained harder.",
    "One more set. Always one more set.",
  ],
  checkinMsg: "Scan & Check In",
  checkinSub: "Enter your phone number to check in and earn 50 points",
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
            <IconPicker value={c.id_icon||c.icon} onChange={v=>updateChallenge(i,"id_icon",v)}/>
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
      <div className="display-section-title">Check-in Page Message</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14,lineHeight:1.6}}>Customize the headline and subtitle shown on the QR check-in page.</div>
      <label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,display:"block",marginBottom:6}}>Headline</label>
      <input className="form-input" value={settings.checkinMsg||""} onChange={e=>setSettings(s=>({...s,checkinMsg:e.target.value}))} placeholder="Scan & Check In" style={{marginBottom:12}}/>
      <label style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700,display:"block",marginBottom:6}}>Subtitle</label>
      <input className="form-input" value={settings.checkinSub||""} onChange={e=>setSettings(s=>({...s,checkinSub:e.target.value}))} placeholder="Enter your phone number to check in and earn 50 points"/>
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
// FIX: fetches displaySettings directly instead of relying on prop
function ChallengesPanel({members, setMembers, setTransactions, toast}) {
  const [enrollments, setEnrollments] = useState([]);
  const [challenges, setChallenges]   = useState([]);
  const [loaded, setLoaded]           = useState(false);

  useEffect(() => {
    (async () => {
      const [enrs, ds] = await Promise.all([getEnrollments(), getDisplaySettings()]);
      setEnrollments(enrs);
      if (ds) {
        try {
          const cfg = JSON.parse(ds.config || "{}");
          const all = cfg.challenges || DEF_DISPLAY.challenges;
          setChallenges(all.filter(c => c.active !== false));
        } catch {
          setChallenges(DEF_DISPLAY.challenges.filter(c => c.active !== false));
        }
      } else {
        setChallenges(DEF_DISPLAY.challenges.filter(c => c.active !== false));
      }
      setLoaded(true);
    })();
  }, []);

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
        <div className="empty">No active challenges. Add them in TV Display → Active Challenges, then save.</div>
      )}

      {challenges.map(c => {
        const cEnrollments = enrollments.filter(e => e.challengeId === String(c.id));
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


export { DisplaySettings, Settings, ChallengesPanel, EarnRules, ExportData, ReferralsPanel };
