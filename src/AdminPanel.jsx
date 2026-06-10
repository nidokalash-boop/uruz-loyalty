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
import { PinInput, Modal, AdminLogin, Dashboard, Members, AwardPoints, Redemptions, RewardsCatalog, StaffManagement, BulkImport } from "./AdminComponents1";
import { DisplaySettings, Settings, ChallengesPanel, EarnRules, ExportData, ReferralsPanel } from "./AdminComponents2";
import { WorkoutsPanel } from "./WorkoutsPanel";

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

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:#1F2020;color:#FFFDF3;font-family:'Montserrat',sans-serif;}

/* ── DESKTOP LAYOUT ── */
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

/* ── MOBILE TOPBAR ── */
.mob-topbar{display:none;height:52px;background:#252627;border-bottom:1px solid #333435;align-items:center;justify-content:space-between;padding:0 16px;position:sticky;top:0;z-index:100;flex-shrink:0;}
.mob-topbar-logo{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:#F58020;}
.mob-topbar-right{text-align:right;}
.mob-topbar-page{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:#FFFDF3;}
.mob-topbar-staff{font-size:9px;color:#6B6866;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-top:1px;}

/* ── MOBILE BOTTOM NAV ── */
.mob-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#252627;border-top:1px solid #333435;z-index:200;height:58px;}
.mob-nav-inner{display:flex;height:100%;overflow-x:auto;scrollbar-width:none;padding:0 4px;}
.mob-nav-inner::-webkit-scrollbar{display:none;}
.mob-nav-btn{flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0 10px;background:none;border:none;cursor:pointer;min-width:52px;position:relative;}
.mob-nav-icon{font-size:16px;line-height:1;transition:transform .15s;}
.mob-nav-btn.on .mob-nav-icon{transform:scale(1.15);}
.mob-nav-lbl{font-size:7px;letter-spacing:1px;text-transform:uppercase;color:#6B6866;font-weight:700;font-family:'Montserrat',sans-serif;transition:color .15s;}
.mob-nav-btn.on .mob-nav-lbl{color:#F58020;}
.mob-nav-dot{position:absolute;top:6px;right:6px;width:6px;height:6px;background:#EF4444;border-radius:50%;}

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
.period-btn{padding:6px 12px;background:#252627;border:1px solid #333435;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.period-btn.on{border-color:#F58020;color:#F58020;background:rgba(245,128,32,.08);}
.period-btn:hover{border-color:#F58020;color:#F58020;}

/* ── DASHBOARD CARDS ── */
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
.dash-card{background:#252627;border:1px solid #333435;padding:16px;}
.dash-card-title{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-bottom:14px;}

/* ── MEMBER MOBILE CARDS ── */
.member-card{background:#252627;border:1px solid #333435;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;}
.member-card:active{background:#2A2B2C;}
.member-card-info{flex:1;min-width:0;}
.member-card-name{font-size:14px;font-weight:700;color:#FFFDF3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.member-card-sub{font-size:11px;color:#6B6866;margin-top:2px;}
.member-card-pts{font-family:'Bebas Neue',sans-serif;font-size:24px;color:#F58020;flex-shrink:0;}

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
.tbl-wrap{background:#252627;border:1px solid #333435;overflow:hidden;overflow-x:auto;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;min-width:480px;}
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
.search-row{display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap;}
.search-input{flex:1;min-width:160px;padding:9px 14px;background:#252627;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;outline:none;transition:border-color .15s;}
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

/* ── RESPONSIVE ── */
@media(max-width:768px){
  .sidebar{display:none;}
  .topbar{display:none;}
  .mob-topbar{display:flex;}
  .mob-nav{display:block;}
  .content{padding:14px;padding-bottom:74px;}
  .stat-grid{grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
  .stat-val{font-size:28px;}
  .stat-card{padding:14px;}
  .dash-grid{grid-template-columns:1fr;gap:12px;}
  .period-bar{gap:5px;margin-bottom:14px;}
  .period-btn{padding:5px 9px;font-size:9px;letter-spacing:1px;}
  .modal-bg{padding:0;align-items:flex-end;}
  .modal{max-width:100%;max-height:92vh;border-bottom-left-radius:0;border-bottom-right-radius:0;}
  .tbl-wrap{display:none;}
  .member-list-mobile{display:block;}
  .reward-grid{grid-template-columns:repeat(2,1fr);}
  .sec-hdr{flex-wrap:wrap;gap:8px;}
}
@media(min-width:769px){
  .mob-nav{display:none !important;}
  .mob-topbar{display:none !important;}
  .member-list-mobile{display:none !important;}
}
`;

// ── ROOT ──────────────────────────────────────────────────
const ALL_NAV=[
  {id:"dashboard",  icon:"◉", label:"Dashboard",   emoji:"◉"},
  {id:"members",    icon:"⊞", label:"Members",      emoji:"👥"},
  {id:"award",      icon:"◆", label:"Award",        emoji:"◆"},
  {id:"redemptions",icon:"🎟", label:"Redeem",       emoji:"🎟"},
  {id:"rewards",    icon:"⭐", label:"Rewards",      emoji:"⭐"},
  {id:"staff",      icon:"👥", label:"Staff",        emoji:"🔑"},
  {id:"display",    icon:"📺", label:"TV",           emoji:"📺"},
  {id:"workouts",   icon:"💪", label:"Workouts",     emoji:"💪"},
  {id:"challenges", icon:"⚔",  label:"Challenges",  emoji:"⚔"},
  {id:"earn",       icon:"💰", label:"Earn",         emoji:"💰"},
  {id:"referrals",  icon:"🔗", label:"Referrals",    emoji:"🔗"},
  {id:"export",     icon:"⬇", label:"Export",       emoji:"⬇"},
  {id:"import",     icon:"↑",  label:"Import",       emoji:"↑"},
  {id:"settings",   icon:"⚙", label:"Settings",     emoji:"⚙"},
];

const DEF_DISPLAY = {
  slides: { leaderboard:true, challenges:true, activity:true, spotlight:true },
  slideOrder: ["leaderboard","challenges","activity","spotlight"],
  slideDuration: 12,
  ticker: [],
  challenges: [],
  homeMessages: [],
  checkinMsg: "Scan & Check In",
  checkinSub: "Enter your phone number to check in and earn 50 points",
};

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
      const [m,t,r,rw,ti]=await Promise.all([getMembers(),getTransactions(),getRedemptions(),getRewards(),getTiers()]);
      setMembers(m.map(normalizeMember));setTxns(t);setRdms(r);
      setRewards(rw.length?rw:DEF_REWARDS);
      setTiers(ti.length?ti:DEF_TIERS);
      setLoaded(true);
    })();
  },[]);

  const handleLogin=(session)=>{
    setStaffSession(session);
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
  const currentLabel=ALL_NAV.find(n=>n.id===page)?.label||"";

  return(
    <>
      <style>{CSS}</style>
      <div className="admin">

        {/* ── DESKTOP SIDEBAR ── */}
        <div className="sidebar">
          <div className="sb-brand"><div className="sb-logo">URUZ</div><div className="sb-sub">Member Central</div></div>
          <div className="sb-nav">
            <div className="sb-section">Navigation</div>
            {visibleNav.map(n=>(
              <button key={n.id} className={`sb-btn${page===n.id?" on":""}`} onClick={()=>setPage(n.id)}>
                <span className="sb-icon">{n.icon}</span>
                {n.label}
                {n.id==="redemptions"&&pending>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:10,fontWeight:800,padding:"1px 6px"}}>{pending}</span>}
              </button>
            ))}
          </div>
          <div className="sb-footer">
            <div className="sb-staff-name">{staffSession.name}</div>
            <div className="sb-staff-role" style={{color:roleInfo?.color}}>{roleInfo?.icon} {roleInfo?.label}</div>
            <button className="sb-logout" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>

        <div className="main">
          {/* ── DESKTOP TOPBAR ── */}
          <div className="topbar">
            <div className="topbar-title">{currentLabel}</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.success}}/>
              <div className="topbar-date">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</div>
            </div>
          </div>

          {/* ── MOBILE TOPBAR ── */}
          <div className="mob-topbar">
            <div className="mob-topbar-logo">URUZ</div>
            <div className="mob-topbar-right">
              <div className="mob-topbar-page">{currentLabel}</div>
              <div className="mob-topbar-staff">{roleInfo?.icon} {staffSession.name}</div>
            </div>
          </div>

          {/* ── CONTENT ── */}
          <div className="content" key={page}>
            {page==="dashboard"  &&<Dashboard members={members} transactions={transactions} redemptions={redemptions}/>}
            {page==="members"    &&<Members members={members} setMembers={setMembers} transactions={transactions} tiers={tiers} onAward={goAward} toast={showToast} role={role}/>}
            {page==="award"      &&<AwardPoints members={members} setMembers={setMembers} setTransactions={setTxns} preSelected={awardTarget} toast={showToast}/>}
            {page==="redemptions"&&<Redemptions redemptions={redemptions} setRedemptions={setRdms} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="rewards"    &&<RewardsCatalog rewards={rewards} setRewards={setRewards} toast={showToast}/>}
            {page==="staff"      &&<StaffManagement staffList={staffList} setStaffList={setStaffList} toast={showToast}/>}
            {page==="display"    &&<DisplaySettings toast={showToast}/>}
            {page==="workouts"   &&<WorkoutsPanel members={members} toast={showToast}/>}
            {page==="challenges" &&<ChallengesPanel members={members} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="earn"       &&<EarnRules toast={showToast}/>}
            {page==="referrals"  &&<ReferralsPanel members={members} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="export"     &&<ExportData members={members} transactions={transactions} redemptions={redemptions} tiers={tiers} toast={showToast}/>}
            {page==="import"     &&<BulkImport members={members} setMembers={setMembers} toast={showToast}/>}
            {page==="settings"   &&<Settings tiers={tiers} setTiers={setTiers} toast={showToast}/>}
          </div>
        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <div className="mob-nav">
          <div className="mob-nav-inner">
            {visibleNav.map(n=>(
              <button key={n.id} className={`mob-nav-btn${page===n.id?" on":""}`} onClick={()=>setPage(n.id)}>
                {n.id==="redemptions"&&pending>0&&<div className="mob-nav-dot"/>}
                <span className="mob-nav-icon">{n.emoji}</span>
                <span className="mob-nav-lbl">{n.label}</span>
              </button>
            ))}
            <button className="mob-nav-btn" onClick={handleLogout}>
              <span className="mob-nav-icon">🚪</span>
              <span className="mob-nav-lbl">Sign Out</span>
            </button>
          </div>
        </div>

        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
      </div>
    </>
  );
}
