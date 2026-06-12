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
  owner:      ["dashboard","members","award","redemptions","rewards","staff","display","workouts","challenges","earn","referrals","export","import","settings"],
  manager:    ["dashboard","members","award","redemptions","rewards","display","workouts","challenges","earn","referrals","export","import"],
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

// ── DATE RANGE HELPERS ────────────────────────────────────
function getDateRange(period) {
  const now = new Date();
  const fmt = d => d.toISOString().slice(0,10);
  switch(period) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate()-1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "last7": {
      const w = new Date(now); w.setDate(w.getDate()-6);
      return { from: fmt(w), to: fmt(now) };
    }
    case "last30": {
      const m = new Date(now); m.setDate(m.getDate()-29);
      return { from: fmt(m), to: fmt(now) };
    }
    case "thisMonth": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(start), to: fmt(now) };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(start), to: fmt(end) };
    }
    default:
      return { from: "2000-01-01", to: fmt(now) };
  }
}

function inRange(dateStr, from, to) {
  if(!dateStr) return false;
  const d = dateStr.slice(0,10);
  return d >= from && d <= to;
}

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:#1F2020;color:#FFFDF3;font-family:'Montserrat',sans-serif;}

/* ── LAYOUT ── */
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

/* ── MOBILE BOTTOM NAV ── */
.mob-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#252627;border-top:1px solid #333435;z-index:200;height:56px;}
.mob-nav-inner{display:flex;height:100%;overflow-x:auto;scrollbar-width:none;}
.mob-nav-inner::-webkit-scrollbar{display:none;}
.mob-nav-btn{flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0 14px;background:none;border:none;cursor:pointer;min-width:56px;}
.mob-nav-btn svg{width:18px;height:18px;stroke:#6B6866;stroke-width:1.5;fill:none;transition:stroke .15s;}
.mob-nav-btn.on svg{stroke:#F58020;}
.mob-nav-lbl{font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:#6B6866;font-weight:700;font-family:'Montserrat',sans-serif;transition:color .15s;}
.mob-nav-btn.on .mob-nav-lbl{color:#F58020;}
.mob-topbar{display:none;height:52px;background:#252627;border-bottom:1px solid #333435;align-items:center;justify-content:space-between;padding:0 16px;position:sticky;top:0;z-index:100;}
.mob-topbar-logo{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:#F58020;}
.mob-topbar-staff{font-size:10px;color:#6B6866;font-weight:600;text-align:right;}

/* ── STATS ── */
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
.stat-card{background:#252627;border:1px solid #333435;padding:18px;position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent,#F58020);}
.stat-val{font-family:'Bebas Neue',sans-serif;font-size:38px;line-height:1;color:#FFFDF3;}
.stat-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;margin-top:4px;font-weight:700;}
.stat-sub{font-size:11px;color:#6B6866;margin-top:6px;font-weight:500;}
.stat-delta{font-size:10px;margin-top:4px;font-weight:700;}
.stat-delta.up{color:#22C55E;}
.stat-delta.down{color:#EF4444;}

/* ── PERIOD FILTER ── */
.period-bar{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:20px;}
.period-btn{padding:5px 12px;background:none;border:1px solid #333435;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.period-btn.on{border-color:#F58020;color:#F58020;background:rgba(245,128,32,.08);}
.period-btn:hover{border-color:#F58020;color:#F58020;}

/* ── DASHBOARD GRID ── */
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
.dash-card{background:#252627;border:1px solid #333435;padding:16px;}
.dash-card-title{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-bottom:12px;}

/* ── GENERAL ── */
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
.tbl-wrap{background:#252627;border:1px solid #333435;overflow:hidden;margin-bottom:20px;overflow-x:auto;}
table{width:100%;border-collapse:collapse;min-width:500px;}
th{padding:10px 14px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;border-bottom:1px solid #333435;background:#2A2B2C;white-space:nowrap;}
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
.badge-archived{background:rgba(107,104,102,.2);color:#6B6866;}
.search-row{display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap;}
.search-input{flex:1;min-width:180px;padding:9px 14px;background:#252627;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;outline:none;transition:border-color .15s;}
.search-input::placeholder{color:#6B6866;}
.search-input:focus{border-color:#F58020;}
.av{width:32px;height:32px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:800;flex-shrink:0;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:#252627;border:1px solid #333435;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;animation:slideup .25s cubic-bezier(0.16,1,0.3,1);}
@keyframes slideup{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #333435;}
.modal-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#FFFDF3;}
.modal-close{background:none;border:none;color:#6B6866;font-size:20px;cursor:pointer;padding:4px 8px;}
.modal-body{padding:20px;}
.modal-footer{padding:14px 20px;border-top:1px solid #333435;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;}
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
.reward-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px;}
.rwd-card{background:#252627;border:1px solid #333435;padding:16px;transition:border-color .15s;}
.rwd-card:hover{border-color:rgba(245,128,32,.4);}
.rwd-icon{font-size:24px;margin-bottom:8px;display:block;}
.rwd-name{font-weight:700;color:#FFFDF3;margin-bottom:4px;font-size:14px;}
.rwd-pts{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#F58020;}
.rwd-actions{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;}
.tabs{display:flex;gap:0;border-bottom:1px solid #333435;margin-bottom:20px;overflow-x:auto;}
.tab-btn{padding:9px 18px;background:none;border:none;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B6866;position:relative;transition:color .15s;white-space:nowrap;}
.tab-btn.on{color:#F58020;}
.tab-btn.on::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:#F58020;}
.empty{padding:40px;text-align:center;color:#6B6866;font-size:13px;border:1px solid #333435;}
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#F58020;color:#fff;padding:11px 24px;z-index:9999;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}

/* ── MEMBER CARDS (mobile) ── */
.member-card{background:#252627;border:1px solid #333435;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;}
.member-card-info{flex:1;min-width:0;}
.member-card-name{font-size:14px;font-weight:700;color:#FFFDF3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.member-card-sub{font-size:11px;color:#6B6866;margin-top:2px;}
.member-card-pts{font-family:'Bebas Neue',sans-serif;font-size:24px;color:#F58020;flex-shrink:0;}

/* ── LOGIN ── */
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

/* ── DISPLAY SETTINGS ── */
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

/* ── RESPONSIVE ── */
@media(max-width:768px){
  .sidebar{display:none;}
  .mob-nav{display:flex;}
  .mob-topbar{display:flex;}
  .topbar{display:none;}
  .content{padding:14px;padding-bottom:72px;}
  .stat-grid{grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
  .stat-val{font-size:30px;}
  .dash-grid{grid-template-columns:1fr;}
  .period-bar{gap:6px;}
  .period-btn{padding:6px 10px;font-size:9px;}
  .modal{max-width:100%;max-height:95vh;margin:0;}
  .modal-bg{padding:0;align-items:flex-end;}
  .modal{border-bottom-left-radius:0;border-bottom-right-radius:0;}
  .tbl-wrap{display:none;}
  .tbl-wrap.show-mobile{display:block;}
  .member-list-mobile{display:block;}
  .reward-grid{grid-template-columns:repeat(2,1fr);}
}
@media(min-width:769px){
  .mob-nav{display:none !important;}
  .mob-topbar{display:none !important;}
  .member-list-mobile{display:none;}
}
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
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer&&<div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
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

          {stage === "setup" && (<>
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
          </>)}

          {stage === "confirmpin" && (<>
            <div className="login-step">Confirm Your PIN</div>
            <div className="login-hint">Enter your PIN again to confirm</div>
            <PinInput value={pin2} onChange={v=>{setPin2(v);setError("");}}/>
            {error&&<div className="login-err">{error}</div>}
          </>)}

          {stage === "name" && (<>
            <div className="login-step">Staff Sign In</div>
            <div className="login-hint">Enter your name to continue</div>
            <input className="login-inp" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleNameContinue()}/>
            {error&&<div className="login-err">{error}</div>}
            <button className="login-btn" onClick={handleNameContinue}>Continue</button>
          </>)}

          {stage === "pin" && selStaff && (<>
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
          </>)}
        </div>
      </div>
    </>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────
const PERIODS = [
  { id:"today",     label:"Today" },
  { id:"yesterday", label:"Yesterday" },
  { id:"last7",     label:"Last 7 Days" },
  { id:"thisMonth", label:"This Month" },
  { id:"lastMonth", label:"Last Month" },
  { id:"last30",    label:"Last 30 Days" },
  { id:"all",       label:"All Time" },
];

function Dashboard({members, transactions, redemptions}) {
  const [period, setPeriod] = useState("today");
  const { from, to } = getDateRange(period);

  const active      = members.filter(m=>m.status==="active").length;
  const totalPts    = members.reduce((s,m)=>s+m.points,0);

  const filteredTxns = transactions.filter(t=>inRange(t.date,from,to));
  const filteredRdms = redemptions.filter(r=>inRange(r.date,from,to));
  const newMembers   = members.filter(m=>inRange(m.joinDate||m.join_date,from,to));
  const ptsPeriod    = filteredTxns.reduce((s,t)=>s+(t.pts>0?t.pts:0),0);
  const checkins     = filteredTxns.filter(t=>t.type==="checkin").length;
  const pendingRdms  = redemptions.filter(r=>r.status==="pending").length;
  const periodRdms   = filteredRdms.filter(r=>r.status==="pending").length;

  const TYPE_CFG = {
    checkin:  {label:"Check-in",  color:C.cerulean},
    class:    {label:"Class",     color:C.orange},
    referral: {label:"Referral",  color:C.success},
    bonus:    {label:"Bonus",     color:C.gold},
    manual:   {label:"Manual",    color:C.silver},
    redeem:   {label:"Redeemed",  color:C.danger},
    deduct:   {label:"Deduction", color:C.danger},
    challenge:{label:"Challenge", color:C.cerulean},
  };

  const topMembers = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,5);

  const typeBreakdown = Object.entries(
    filteredTxns.reduce((acc,t)=>{ const k=t.type||"manual"; acc[k]=(acc[k]||0)+(t.pts>0?t.pts:0); return acc; },{})
  ).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <div>
      <div className="period-bar">
        {PERIODS.map(p=>(
          <button key={p.id} className={`period-btn${period===p.id?" on":""}`} onClick={()=>setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat-card" style={{"--accent":C.orange}}>
          <div className="stat-val">{active}</div>
          <div className="stat-lbl">Active Members</div>
          {newMembers.length>0&&<div className="stat-delta up">+{newMembers.length} this period</div>}
        </div>
        <div className="stat-card" style={{"--accent":C.success}}>
          <div className="stat-val">{ptsPeriod.toLocaleString()}</div>
          <div className="stat-lbl">Points Awarded</div>
          <div className="stat-sub">{filteredTxns.filter(t=>t.pts>0).length} transactions</div>
        </div>
        <div className="stat-card" style={{"--accent":C.cerulean}}>
          <div className="stat-val">{checkins}</div>
          <div className="stat-lbl">Check-ins</div>
          <div className="stat-sub">{period==="all"?"all time":"this period"}</div>
        </div>
        <div className="stat-card" style={{"--accent":C.warning}}>
          <div className="stat-val">{pendingRdms}</div>
          <div className="stat-lbl">Pending Redemptions</div>
          {periodRdms>0&&<div className="stat-delta down">{periodRdms} new this period</div>}
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <div className="dash-card-title">Top Members by Points</div>
          {topMembers.map((m,i)=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<topMembers.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,width:24,color:i===0?C.gold:i===1?C.silver:i===2?C.bronze:C.muted,flexShrink:0}}>{i+1}</div>
              <div className="av" style={{background:`${C.orange}22`,color:C.orange,flexShrink:0}}>{initials(m.name)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.name}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:1}}>{m.streak}d streak</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange,flexShrink:0}}>{m.points.toLocaleString()}</div>
            </div>
          ))}
          {topMembers.length===0&&<div style={{color:C.muted,fontSize:12}}>No members yet.</div>}
        </div>

        <div className="dash-card">
          <div className="dash-card-title">Points by Activity — {PERIODS.find(p=>p.id===period)?.label}</div>
          {typeBreakdown.length===0?(
            <div style={{color:C.muted,fontSize:12}}>No activity in this period.</div>
          ):typeBreakdown.map(([type,pts])=>{
            const cfg = TYPE_CFG[type]||{label:type,color:C.muted};
            const max = typeBreakdown[0][1];
            const pct = Math.round((pts/max)*100);
            return(
              <div key={type} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:600,color:C.text}}>{cfg.label}</span>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:cfg.color}}>{pts.toLocaleString()}</span>
                </div>
                <div style={{height:3,background:C.border,borderRadius:2}}>
                  <div style={{height:"100%",width:`${pct}%`,background:cfg.color,borderRadius:2,transition:"width .6s cubic-bezier(0.16,1,0.3,1)"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec-hdr">
        <div className="sec-title">Transactions — {PERIODS.find(p=>p.id===period)?.label}</div>
        <div style={{fontSize:12,color:C.muted,fontWeight:500}}>{filteredTxns.length} total</div>
      </div>

      {filteredTxns.length===0?(
        <div className="empty">No transactions in this period.</div>
      ):(
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Member</th><th>Type</th><th>Points</th><th>Note</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filteredTxns.slice(0,20).map(t=>{
                const cfg=TYPE_CFG[t.type]||{label:t.type,color:C.muted};
                return(
                  <tr key={t.id}>
                    <td style={{fontWeight:600}}>{t.memberName||t.member_name}</td>
                    <td><span className="badge" style={{background:`${cfg.color}18`,color:cfg.color}}>{cfg.label}</span></td>
                    <td style={{color:t.pts>0?C.success:C.danger,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{t.pts>0?"+":""}{t.pts}</td>
                    <td style={{color:C.muted}}>{t.note}</td>
                    <td className="mono" style={{color:C.muted}}>{fmtDate(t.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="member-list-mobile">
        {filteredTxns.slice(0,20).map(t=>{
          const cfg=TYPE_CFG[t.type]||{label:t.type,color:C.muted};
          return(
            <div key={t.id} style={{background:C.surface,border:`1px solid ${C.border}`,padding:"12px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:C.white}}>{t.memberName||t.member_name}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{t.note} · {fmtDate(t.date)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:t.pts>0?C.success:C.danger}}>{t.pts>0?"+":""}{t.pts}</div>
                <span className="badge" style={{background:`${cfg.color}18`,color:cfg.color,marginTop:2}}>{cfg.label}</span>
              </div>
            </div>
          );
        })}
        {filteredTxns.length===0&&<div style={{padding:20,color:C.muted,fontSize:12,textAlign:"center"}}>No transactions in this period.</div>}
      </div>
    </div>
  );
}

// ── MEMBERS ───────────────────────────────────────────────
function Members({members,setMembers,transactions,tiers,onAward,toast,role}){
  const [search,setSearch]         = useState("");
  const [showAdd,setShowAdd]       = useState(false);
  const [selected,setSelected]     = useState(null);
  const [confirmArchive,setConfirmArchive] = useState(false);
  const [archiving,setArchiving]   = useState(false);
  const [showArchived,setShowArchived] = useState(false);
  const [form,setForm]             = useState({name:"",phone:"",email:"",status:"active",birthday:""});
  const [saving,setSaving]         = useState(false);
  const canAdd     = canAccess(role,"members") && role !== "trainer";
  const canArchive = role === "owner" || role === "manager";

  const filtered = members.filter(m=>{
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())||
      m.phone.includes(search)||m.id.includes(search);
    const matchArchive = showArchived ? true : m.status !== "archived";
    return matchSearch && matchArchive;
  });

  const archivedCount = members.filter(m=>m.status==="archived").length;

  const handleAdd = async () => {
    if(!form.name.trim()||!form.phone.trim()) return;
    setSaving(true);
    const nm={...form,id:genId("URZ"),joinDate:today(),points:0,checkins:0,streak:0,pin:null,lastCheckin:null};
    await upsertMember(nm);
    setMembers(prev=>[...prev,normalizeMember(nm)]);
    setShowAdd(false); setForm({name:"",phone:"",email:"",status:"active",birthday:""}); setSaving(false);
    toast("Member added");
  };

  const toggleStatus = async (id, current) => {
    const ns = current==="active" ? "inactive" : "active";
    await updateMemberStatus(id, ns);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,status:ns}:m));
    toast("Status updated");
  };

  const handleResetPin = async (id, name) => {
    await resetMemberPin(id);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,pin:null}:m));
    toast(`PIN reset for ${name}`);
  };

  const handleArchive = async () => {
    if (!sel) return;
    setArchiving(true);
    await updateMemberStatus(sel.id, "archived");
    setMembers(prev => prev.map(m => m.id===sel.id ? {...m, status:"archived"} : m));
    setArchiving(false);
    setConfirmArchive(false);
    setSelected(null);
    toast(`${sel.name} archived`);
  };

  const handleRestore = async () => {
    if (!sel) return;
    setArchiving(true);
    await updateMemberStatus(sel.id, "active");
    setMembers(prev => prev.map(m => m.id===sel.id ? {...m, status:"active"} : m));
    setArchiving(false);
    setSelected(null);
    toast(`${sel.name} restored`);
  };

  const sel = selected ? members.find(m=>m.id===selected) : null;
  const selTxns = sel ? transactions.filter(t=>(t.memberId||t.member_id)===sel.id).slice(0,10) : [];
  const tier = sel ? getTierFn(sel.points, tiers) : null;

  return(<div>
    <div className="search-row">
      <input className="search-input" placeholder="Search by name, phone or ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <button className={`btn ${showArchived?"btn-primary":"btn-ghost"}`} onClick={()=>setShowArchived(!showArchived)}>
        {showArchived?"Showing Archived":`Archived (${archivedCount})`}
      </button>
      {canAdd&&<button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add</button>}
    </div>

    {/* Desktop table */}
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Member</th><th>ID</th><th>Phone</th><th>Tier</th><th>Points</th><th>Status</th><th></th></tr></thead>
        <tbody>{filtered.map(m=>{const t=getTierFn(m.points,tiers);return(
          <tr key={m.id} className="clickable" onClick={()=>setSelected(m.id)} style={{opacity:m.status==="archived"?0.5:1}}>
            <td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="av" style={{background:`${C.orange}22`,color:C.orange}}>{initials(m.name)}</div><div style={{fontWeight:600}}>{m.name}</div></div></td>
            <td className="mono" style={{color:C.muted}}>{m.id}</td>
            <td className="mono">{m.phone}</td>
            <td><span style={{color:t.color,fontWeight:700,fontSize:12}}>{t.icon} {t.name}</span></td>
            <td><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{m.points.toLocaleString()}</span></td>
            <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
            <td onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:6}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(m.id)}>View</button>
              {m.status!=="archived"&&<button className="btn btn-ghost btn-sm" onClick={()=>onAward(m)}>Award</button>}
            </div></td>
          </tr>
        );})}</tbody>
      </table>
    </div>

    {/* Mobile cards */}
    <div className="member-list-mobile">
      {filtered.map(m=>{
        const t=getTierFn(m.points,tiers);
        return(
          <div key={m.id} className="member-card" onClick={()=>setSelected(m.id)} style={{opacity:m.status==="archived"?0.5:1}}>
            <div className="av" style={{background:`${C.orange}22`,color:C.orange,width:40,height:40,fontSize:14}}>{initials(m.name)}</div>
            <div className="member-card-info">
              <div className="member-card-name">{m.name}</div>
              <div className="member-card-sub" style={{color:m.status==="archived"?C.muted:t.color}}>
                {m.status==="archived"?"📦 Archived":`${t.icon} ${t.name}`} · {m.checkins} check-ins
              </div>
            </div>
            <div className="member-card-pts">{m.points.toLocaleString()}</div>
          </div>
        );
      })}
    </div>

    {/* Member detail modal */}
    {sel&&(
      <Modal title={sel.name} onClose={()=>{setSelected(null);setConfirmArchive(false);}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,marginBottom:20}}>
          {[
            {v:sel.points.toLocaleString(),l:"Points"},
            {v:`#${members.filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===sel.id)+1}`,l:"Rank"},
            {v:`${sel.streak}d`,l:"Streak"},
            {v:sel.checkins,l:"Check-ins"}
          ].map((s,i)=>(<div key={i} className="ds-cell"><div className="ds-val">{s.v}</div><div className="ds-lbl">{s.l}</div></div>))}
        </div>
        {sel.status==="archived"&&(
          <div style={{background:"rgba(107,104,102,.12)",border:"1px solid #333435",padding:"10px 14px",marginBottom:16,fontSize:12,color:C.muted,fontWeight:700}}>
            📦 This member is archived and hidden from the active roster.
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div><label className="form-label">Phone</label><div className="mono">{sel.phone}</div></div>
          <div><label className="form-label">Tier</label><div style={{color:tier?.color,fontWeight:700}}>{tier?.icon} {tier?.name}</div></div>
          <div><label className="form-label">Joined</label><div className="mono" style={{color:C.muted}}>{sel.joinDate?fmtDate(sel.joinDate):"—"}</div></div>
          <div><label className="form-label">Birthday</label><div className="mono" style={{color:C.muted}}>{sel.birthday||"—"}</div></div>
          <div><label className="form-label">Referral Code</label><div className="mono" style={{color:C.orange,fontWeight:700}}>{sel.referral_code||"—"}</div></div>
          <div><label className="form-label">PIN</label><div style={{color:sel.pin?C.success:C.danger,fontWeight:700,fontSize:12}}>{sel.pin?"Set":"Not set"}</div></div>
        </div>
        <div style={{marginBottom:16}}>
          <label className="form-label">Point History</label>
          {selTxns.length===0?<div style={{color:C.muted,fontSize:12}}>No transactions yet.</div>:selTxns.map(t=>(
            <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
              <div><div style={{fontSize:13,fontWeight:600}}>{t.note}</div><div className="mono" style={{fontSize:11,color:C.muted}}>{fmtDate(t.date)}</div></div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:t.pts>0?C.success:C.danger}}>{t.pts>0?"+":""}{t.pts}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom: confirmArchive ? 14 : 0}}>
          {sel.status!=="archived"&&<button className="btn btn-primary" onClick={()=>{setSelected(null);setConfirmArchive(false);onAward(sel);}}>Award Points</button>}
          {sel.status!=="archived"&&canAdd&&<button className="btn btn-ghost" onClick={()=>toggleStatus(sel.id,sel.status)}>{sel.status==="active"?"Deactivate":"Activate"}</button>}
          {role==="owner"&&sel.status!=="archived"&&<button className="btn btn-ghost" style={{borderColor:C.warning,color:C.warning}} onClick={()=>handleResetPin(sel.id,sel.name)}>Reset PIN</button>}

          {canArchive && sel.status!=="archived" && (
            <button className="btn btn-danger" onClick={()=>setConfirmArchive(true)}>Archive Member</button>
          )}
          {canArchive && sel.status==="archived" && (
            <button className="btn btn-primary" onClick={handleRestore} disabled={archiving}>
              {archiving?"Restoring…":"Restore Member"}
            </button>
          )}
        </div>

        {/* Confirm archive */}
        {confirmArchive && canArchive && (
          <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",padding:"14px 16px",marginTop:12}}>
            <div style={{fontSize:12,color:C.danger,fontWeight:700,marginBottom:6}}>
              📦 Archive {sel.name}?
            </div>
            <div style={{fontSize:11,color:C.muted,marginBottom:12,lineHeight:1.6}}>
              Archived members are hidden from the active roster, leaderboards, and TV display, but all their data — points, history, and profile — is preserved. You can restore them anytime from the "Archived" filter.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmArchive(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleArchive} disabled={archiving}>
                {archiving?"Archiving…":"Yes, Archive"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    )}

    {showAdd&&(
      <Modal title="Add New Member" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving...":"Add Member"}</button></>}>
        <div className="form-row"><label className="form-label">Full Name *</label><input className="form-input" placeholder="e.g. Alex Rivera" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div className="form-row"><label className="form-label">Phone Number *</label><input className="form-input" placeholder="+961 XX XXX XXX" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
        <div className="form-row"><label className="form-label">Email (optional)</label><input className="form-input" placeholder="member@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
        <div className="form-row"><label className="form-label">Birthday (optional)</label><input className="form-input" type="date" value={form.birthday||""} onChange={e=>setForm({...form,birthday:e.target.value})}/><div className="form-hint">Used to auto-award birthday bonus points</div></div>
      </Modal>
    )}
  </div>);
}

// ── AWARD POINTS ──────────────────────────────────────────
function AwardPoints({members,setMembers,setTransactions,preSelected,toast}){
  const [form,setForm]=useState({memberId:preSelected?.id||"",pts:"",type:"checkin",note:""});
  const [saving,setSaving]=useState(false);
  const REASONS=[
    {v:"checkin",l:"Check-in (50 pts)"},
    {v:"class",l:"Group Class (75 pts)"},
    {v:"referral",l:"Referral (500 pts)"},
    {v:"bonus",l:"Streak / Challenge Bonus"},
    {v:"manual",l:"Manual Adjustment"},
    {v:"deduct",l:"Deduction / Correction"}
  ];
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

  return(
    <div style={{maxWidth:520}}>
      <div className="form-row"><label className="form-label">Member *</label>
        <select className="form-select" value={form.memberId} onChange={e=>setForm({...form,memberId:e.target.value})}>
          <option value="">— choose a member —</option>
          {[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=>(
            <option key={m.id} value={m.id}>{m.name} — {m.points.toLocaleString()} pts</option>
          ))}
        </select>
      </div>
      <div className="form-row"><label className="form-label">Reason *</label>
        <select className="form-select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
          {REASONS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </div>
      <div className="form-row"><label className="form-label">Points *</label>
        <input className="form-input" type="number" min="1" placeholder="e.g. 50" value={form.pts} onChange={e=>setForm({...form,pts:e.target.value})}/>
      </div>
      <div className="form-row"><label className="form-label">Note (optional)</label>
        <input className="form-input" placeholder="e.g. Thursday HIIT class" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
      </div>
      <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
        {saving?"Saving...":(form.type==="deduct"?"Deduct Points":"Award Points")}
      </button>
    </div>
  );
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

  const cancel=async(id)=>{
    await updateRedemptionStatus(id,"cancelled");
    setRedemptions(prev=>prev.map(r=>r.id===id?{...r,status:"cancelled"}:r));
    toast("Cancelled");
  };

  return(<div>
    <div className="tabs">
      {["pending","fulfilled","cancelled"].map(t=>(
        <button key={t} className={`tab-btn${tab===t?" on":""}`} onClick={()=>setTab(t)}>
          {t.charAt(0).toUpperCase()+t.slice(1)} ({redemptions.filter(r=>r.status===t).length})
        </button>
      ))}
    </div>

    {list.length===0 ? <div className="empty">No {tab} redemptions.</div> : (<>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Member</th><th>Reward</th><th>Cost</th><th>Date</th><th>Status</th>{tab==="pending"&&<th>Actions</th>}</tr></thead>
          <tbody>{list.map(r=>(
            <tr key={r.id}>
              <td style={{fontWeight:600}}>{r.memberName||r.member_name}</td>
              <td>{r.reward}</td>
              <td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{r.pts.toLocaleString()}</td>
              <td className="mono" style={{color:C.muted}}>{fmtDate(r.date)}</td>
              <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
              {tab==="pending"&&<td><div style={{display:"flex",gap:6}}>
                <button className="btn btn-success btn-sm" onClick={()=>fulfill(r)}>✓ Fulfill</button>
                <button className="btn btn-danger btn-sm" onClick={()=>cancel(r.id)}>✕</button>
              </div></td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="member-list-mobile">
        {list.map(r=>(
          <div key={r.id} style={{background:C.surface,border:`1px solid ${C.border}`,padding:14,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.white}}>{r.memberName||r.member_name}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{r.reward}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDate(r.date)}</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.orange}}>{r.pts}</div>
            </div>
            {tab==="pending"&&(
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-success btn-sm" style={{flex:1}} onClick={()=>fulfill(r)}>✓ Fulfill</button>
                <button className="btn btn-danger btn-sm" style={{flex:1}} onClick={()=>cancel(r.id)}>✕ Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>)}
  </div>);
}

// ── REWARDS ───────────────────────────────────────────────
function RewardsCatalog({rewards,setRewards,toast}){
  const [editing,setEditing]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({name:"",pts:"",cat:"Access",icon:"🎁",stock:true});
  const [saving,setSaving]=useState(false);

  const saveEdit=async()=>{setSaving(true);await upsertReward(editing);setRewards(prev=>prev.map(r=>r.id===editing.id?editing:r));setEditing(null);setSaving(false);toast("Reward updated");};
  const handleAdd=async()=>{if(!form.name||!form.pts)return;setSaving(true);const nr={...form,pts:Number(form.pts),id:genId("RWD")};await upsertReward(nr);setRewards(prev=>[...prev,nr]);setShowAdd(false);setForm({name:"",pts:"",cat:"Access",icon:"🎁",stock:true});setSaving(false);toast("Reward added");};
  const del=async(id)=>{await deleteReward(id);setRewards(prev=>prev.filter(r=>r.id!==id));toast("Removed");};
  const toggleStock=async(r)=>{const nr={...r,stock:!r.stock};await upsertReward(nr);setRewards(prev=>prev.map(x=>x.id===r.id?nr:x));};

  return(<div>
    <div className="sec-hdr"><div className="sec-title">Rewards ({rewards.length})</div><button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add</button></div>
    <div className="reward-grid">
      {rewards.map(r=>(
        <div key={r.id} className="rwd-card" style={{opacity:r.stock?1:0.5}}>
          <span className="rwd-icon">{r.icon}</span>
          <div className="rwd-name">{r.name}</div>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,marginBottom:4,fontWeight:700}}>{r.cat}</div>
          <div className="rwd-pts">{r.pts.toLocaleString()} <span style={{fontSize:12,color:C.muted}}>PTS</span></div>
          <div style={{fontSize:11,color:r.stock?C.success:C.danger,marginTop:4,fontWeight:700}}>{r.stock?"● In Stock":"● Out of Stock"}</div>
          <div className="rwd-actions">
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditing({...r})}>Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>toggleStock(r)}>{r.stock?"OOS":"In Stock"}</button>
            <button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>

    {editing&&(
      <Modal title="Edit Reward" onClose={()=>setEditing(null)} footer={<><button className="btn btn-ghost" onClick={()=>setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
        {[{l:"Name",k:"name",t:"text"},{l:"Points",k:"pts",t:"number"},{l:"Icon",k:"icon",t:"text"}].map(f=>(
          <div key={f.k} className="form-row"><label className="form-label">{f.l}</label><input className="form-input" type={f.t} value={editing[f.k]} onChange={e=>setEditing({...editing,[f.k]:f.t==="number"?Number(e.target.value):e.target.value})}/></div>
        ))}
        <div className="form-row"><label className="form-label">Category</label><select className="form-select" value={editing.cat} onChange={e=>setEditing({...editing,cat:e.target.value})}>{["Access","Merch","Training"].map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="form-row"><label className="form-label">Stock</label><select className="form-select" value={editing.stock?"true":"false"} onChange={e=>setEditing({...editing,stock:e.target.value==="true"})}><option value="true">In Stock</option><option value="false">Out of Stock</option></select></div>
      </Modal>
    )}
    {showAdd&&(
      <Modal title="Add Reward" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving...":"Add"}</button></>}>
        {[{l:"Name",k:"name",t:"text"},{l:"Points",k:"pts",t:"number"},{l:"Icon",k:"icon",t:"text"}].map(f=>(
          <div key={f.k} className="form-row"><label className="form-label">{f.l}</label><input className="form-input" type={f.t} value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}/></div>
        ))}
        <div className="form-row"><label className="form-label">Category</label><select className="form-select" value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>{["Access","Merch","Training"].map(c=><option key={c}>{c}</option>)}</select></div>
      </Modal>
    )}
  </div>);
}

// ── STAFF MANAGEMENT ──────────────────────────────────────
function StaffManagement({staffList,setStaffList,toast}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({name:"",role:"front_desk"});
  const [pin,setPin]=useState("");
  const [saving,setSaving]=useState(false);

  const handleAdd=async()=>{
    if(!form.name.trim()||!form.role||pin.length<4){toast("Fill in all fields");return;}
    setSaving(true);
    const nm={id:genId("STF"),name:form.name.trim(),role:form.role,pin,status:"active"};
    await upsertStaff(nm);
    setStaffList(prev=>[...prev,nm]);
    setShowAdd(false);setForm({name:"",role:"front_desk"});setPin("");setSaving(false);
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
    <div className="sec-hdr"><div className="sec-title">Staff ({staffList.length})</div><button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add</button></div>

    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{staffList.map(s=>{const r=ROLES[s.role];return(
          <tr key={s.id}>
            <td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="av" style={{background:`${r?.color}22`,color:r?.color}}>{initials(s.name)}</div><div style={{fontWeight:600}}>{s.name}</div></div></td>
            <td><span className="badge" style={{background:`${r?.color}18`,color:r?.color}}>{r?.icon} {r?.label}</span></td>
            <td><span className="badge badge-active">Active</span></td>
            <td><div style={{display:"flex",gap:6}}>
              <button className="btn btn-ghost btn-sm" style={{borderColor:C.warning,color:C.warning}} onClick={()=>handleResetPin(s)}>Reset PIN</button>
              <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(s.id,s.name)}>Remove</button>
            </div></td>
          </tr>
        );})}</tbody>
      </table>
    </div>

    <div className="member-list-mobile">
      {staffList.map(s=>{const r=ROLES[s.role];return(
        <div key={s.id} style={{background:C.surface,border:`1px solid ${C.border}`,padding:14,marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div className="av" style={{background:`${r?.color}22`,color:r?.color,width:40,height:40,fontSize:14}}>{initials(s.name)}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:C.white}}>{s.name}</div>
            <div style={{fontSize:11,color:r?.color,fontWeight:700,marginTop:2}}>{r?.icon} {r?.label}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <button className="btn btn-ghost btn-sm" style={{borderColor:C.warning,color:C.warning}} onClick={()=>handleResetPin(s)}>Reset PIN</button>
            <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(s.id,s.name)}>Remove</button>
          </div>
        </div>
      );})}
    </div>

    {showAdd&&(
      <Modal title="Add Staff Member" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setPin("");}}>Cancel</button><button className="btn btn-primary" onClick={handleAdd} disabled={saving||pin.length<4}>{saving?"Saving...":"Add Staff"}</button></>}>
        <div className="form-row"><label className="form-label">Full Name *</label><input className="form-input" placeholder="e.g. Sara K." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div className="form-row"><label className="form-label">Role *</label>
          <div className="role-grid">{Object.entries(ROLES).filter(([k])=>k!=="owner").map(([k,v])=>(
            <div key={k} className={`role-card${form.role===k?" sel":""}`} onClick={()=>setForm({...form,role:k})}>
              <span className="role-icon">{v.icon}</span>
              <div className="role-name" style={{color:form.role===k?v.color:"#6B6866"}}>{v.label}</div>
            </div>
          ))}</div>
        </div>
        <div className="form-row"><label className="form-label">Set Their PIN *</label><PinInput value={pin} onChange={v=>setPin(v)}/></div>
        <div className="form-hint">Share this PIN privately with the staff member.</div>
      </Modal>
    )}
  </div>);
}

// ── BULK IMPORT ───────────────────────────────────────────
function BulkImport({ members, setMembers, toast }) {
  const [tab, setTab]             = useState("members");
  const [stage, setStage]         = useState("upload");
  const [rows, setRows]           = useState([]);
  const [errors, setErrors]       = useState([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported]   = useState(0);

  const downloadTemplate = (type) => {
    const csv = type === "members"
      ? ["Name,Phone,Email,Birthday","Alex Rivera,+961 70 123 456,alex@email.com,1995-06-15","Sara K.,+961 71 234 567,,1990-03-22"].join("\n")
      : ["Title,Category,Difficulty,Duration,AccessType,PointsCost,PriceLabel,TierRequired,VideoURL,Description","Full Body Burn,Strength,Beginner,45,free,,,,,Great full body workout"].join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`URUZ_${type}_template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/\s+/g,"_"));
    return lines.slice(1).filter(l=>l.trim()).map(line=>{
      const vals = line.split(",").map(v=>v.trim());
      const obj = {}; headers.forEach((h,i)=>obj[h]=vals[i]||""); return obj;
    });
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        const errs = [];
        if(tab==="members") parsed.forEach((r,i)=>{ if(!r.name) errs.push(`Row ${i+2}: Missing name`); if(!r.phone) errs.push(`Row ${i+2}: Missing phone`); });
        else parsed.forEach((r,i)=>{ if(!r.title) errs.push(`Row ${i+2}: Missing title`); });
        setErrors(errs); setRows(parsed); setStage("preview");
      } catch { toast("Could not parse CSV — check the file format"); }
    };
    reader.readAsText(file);
  };

  const handleImportMembers = async () => {
    setImporting(true); let count=0;
    const existingPhones = new Set(members.map(m=>m.phone.replace(/\s+/g,"")));
    for(const row of rows){
      const phone=(row.phone||"").replace(/\s+/g,"");
      if(existingPhones.has(phone)) continue;
      const refCode="URUZ-"+Math.random().toString(36).slice(2,7).toUpperCase();
      const nm={id:genId("URZ"),name:row.name||"",phone:row.phone||"",email:row.email||"",joinDate:today(),points:0,checkins:0,streak:0,status:"active",pin:null,lastCheckin:null,birthday:row.birthday||null,referral_code:refCode};
      await upsertMember(nm); setMembers(prev=>[...prev,normalizeMember(nm)]); existingPhones.add(phone); count++;
    }
    setImported(count); setImporting(false); setStage("done"); toast(`${count} members imported`);
  };

  const handleImportWorkouts = async () => {
    setImporting(true); let count=0;
    for(const row of rows){
      if(!row.title) continue;
      const workout={id:genId("WRK"),title:row.title||"",description:row.description||"",category:row.category||"Strength",difficulty:row.difficulty||"Beginner",duration_mins:Number(row.duration)||30,access_type:row.accesstype||row.access_type||"free",points_cost:Number(row.pointscost||row.points_cost)||0,price_label:row.pricelabel||row.price_label||"",tier_required:row.tierrequired||row.tier_required||null,video_url:row.videourl||row.video_url||"",pdf_url:row.pdfurl||row.pdf_url||"",thumbnail_url:row.thumbnailurl||row.thumbnail_url||"",exercises:[],active:true,created_at:today()};
      await upsertWorkout(workout); count++;
    }
    setImported(count); setImporting(false); setStage("done"); toast(`${count} workouts imported`);
  };

  const reset = () => { setStage("upload"); setRows([]); setErrors([]); setImported(0); };

  return(<div>
    <div className="sec-hdr"><div className="sec-title">Bulk Import</div></div>
    <div className="tabs">
      {["members","workouts"].map(t=>(
        <button key={t} className={`tab-btn${tab===t?" on":""}`} onClick={()=>{setTab(t);reset();}}>
          {t==="members"?"👥 Members":"💪 Workouts"}
        </button>
      ))}
    </div>

    {stage==="upload"&&(<div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white,marginBottom:8}}>Step 1 — Download Template</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:14,lineHeight:1.6}}>Download the CSV template, fill it in Excel or Google Sheets, then upload it back here.</div>
        <button className="btn btn-ghost" onClick={()=>downloadTemplate(tab)}>⬇ Download Template</button>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:20}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white,marginBottom:8}}>Step 2 — Upload Your CSV</div>
        <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"24px",border:`2px dashed ${C.border}`,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:C.muted}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange}
          onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
          <span style={{fontSize:24}}>📂</span> Choose CSV File
          <input type="file" accept=".csv" onChange={handleFile} style={{display:"none"}}/>
        </label>
      </div>
    </div>)}

    {stage==="preview"&&(<div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:13,color:C.muted}}>{rows.length} rows · {errors.length} errors</div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={reset}>← Back</button>
          <button className="btn btn-primary" onClick={tab==="members"?handleImportMembers:handleImportWorkouts} disabled={importing||errors.length>0}>
            {importing?`Importing...`:`Import ${rows.length} ${tab}`}
          </button>
        </div>
      </div>
      {errors.length>0&&(<div style={{background:"rgba(239,68,68,.1)",border:`1px solid ${C.danger}`,padding:14,marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:C.danger,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>⚠ Fix these errors</div>
        {errors.map((e,i)=><div key={i} style={{fontSize:12,color:C.danger,marginBottom:4}}>• {e}</div>)}
      </div>)}
      <div className="tbl-wrap tbl-wrap show-mobile">
        {tab==="members"&&(<table>
          <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r,i)=>{
            const isDupe=members.some(m=>m.phone.replace(/\s+/g,"")===(r.phone||"").replace(/\s+/g,""));
            return(<tr key={i} style={{opacity:isDupe?0.4:1}}>
              <td style={{color:C.muted,fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</td>
              <td style={{fontWeight:600}}>{r.name||<span style={{color:C.danger}}>Missing</span>}</td>
              <td className="mono">{r.phone||<span style={{color:C.danger}}>Missing</span>}</td>
              <td>{isDupe?<span className="badge badge-inactive">Duplicate</span>:<span className="badge badge-active">New</span>}</td>
            </tr>);
          })}</tbody>
        </table>)}
        {tab==="workouts"&&(<table>
          <thead><tr><th>#</th><th>Title</th><th>Category</th><th>Access</th></tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i}>
              <td style={{color:C.muted,fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</td>
              <td style={{fontWeight:600}}>{r.title||<span style={{color:C.danger}}>Missing</span>}</td>
              <td style={{color:C.muted}}>{r.category||"Strength"}</td>
              <td><span className="badge" style={{background:"rgba(245,128,32,.15)",color:C.orange}}>{r.accesstype||r.access_type||"free"}</span></td>
            </tr>
          ))}</tbody>
        </table>)}
      </div>
    </div>)}

    {stage==="done"&&(<div style={{textAlign:"center",padding:"48px 20px"}}>
      <div style={{fontSize:56,marginBottom:16}}>✅</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:C.white,marginBottom:8}}>Import Complete</div>
      <div style={{fontSize:14,color:C.muted,marginBottom:24}}>{imported} {tab} imported successfully</div>
      <button className="btn btn-primary" style={{width:"auto",padding:"10px 28px"}} onClick={reset}>Import More</button>
    </div>)}
  </div>);
}

export { PinInput, Modal, AdminLogin, Dashboard, Members, AwardPoints, Redemptions, RewardsCatalog, StaffManagement, BulkImport };
