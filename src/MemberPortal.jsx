import { useState, useEffect } from "react";
import {
  getMembers, getMemberByPhone, getMemberById, upsertMember,
  updateMemberPin, getTransactions, addTransaction,
  getRedemptions, addRedemption, getRewards, getTiers,
  getMemberEnrollments, enrollInChallenge, getDisplaySettings,
  getEarnRules, addReferral, getMemberByReferralCode,
  getWorkouts, getMemberUnlocks, unlockWorkout
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

function getSession() { try { const v=localStorage.getItem("uruz:session"); return v?JSON.parse(v):null; } catch { return null; } }
function saveSession(d) { try { localStorage.setItem("uruz:session",JSON.stringify(d)); } catch {} }
function clearSession()  { try { localStorage.removeItem("uruz:session"); } catch {} }

function normalizeMember(m) {
  return {
    id:            m.id,
    name:          m.name          || "",
    phone:         m.phone         || "",
    email:         m.email         || "",
    joinDate:      m.join_date     || m.joinDate || new Date().toISOString().slice(0,10),
    points:        m.points        ?? 0,
    checkins:      m.checkins      ?? 0,
    streak:        m.streak        ?? 0,
    status:        m.status        || "active",
    pin:           m.pin           || null,
    lastCheckin:   m.last_checkin  || m.lastCheckin  || null,
    birthday:      m.birthday      || null,
    referral_code: m.referral_code || null,
    tier_reached:  m.tier_reached  || null,
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

/* APP SHELL */
.app{
  min-height:100vh;
  background:#1F2020;
  color:#FFFDF3;
  font-family:'Montserrat',sans-serif;
  max-width:520px;
  margin:0 auto;
  padding-bottom:72px;
  position:relative;
}

/* TOP BAR */
.topbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 20px 12px;
  background:#1F2020;
  position:sticky;top:0;z-index:100;
  border-bottom:1px solid #333435;
}
.topbar-logo{height:32px;width:auto;}
.topbar-greeting{
  font-family:'Bebas Neue',sans-serif;
  font-size:16px;letter-spacing:2px;color:#FFFDF3;
}
.topbar-pts{
  font-family:'Bebas Neue',sans-serif;
  font-size:20px;color:#F58020;letter-spacing:1px;
}

/* BOTTOM NAV */
.bottom-nav{
  position:fixed;bottom:0;left:50%;
  transform:translateX(-50%);
  width:100%;max-width:520px;
  background:#252627;
  border-top:1px solid #333435;
  display:flex;z-index:200;
  height:64px;
}
.nav-item{
  flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  gap:4px;background:none;border:none;
  cursor:pointer;transition:all .15s;
  color:#6B6866;font-family:'Montserrat',sans-serif;
}
.nav-item.active{color:#F58020;}
.nav-item.active .nav-dot{background:#F58020;}
.nav-icon{font-size:20px;line-height:1;}
.nav-label{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;}
.nav-dot{width:4px;height:4px;border-radius:50%;background:transparent;margin-top:-2px;}

/* CONTENT */
.content{padding:0;animation:up .3s ease both;}
@keyframes up{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

/* ── HOME TAB ── */
.home-hero{
  background:linear-gradient(135deg,#1a1208 0%,#1F2020 70%);
  padding:24px 20px 20px;
  position:relative;overflow:hidden;
}
.home-hero::after{
  content:'URUZ';
  position:absolute;right:-20px;top:-10px;
  font-family:'Bebas Neue',sans-serif;
  font-size:120px;letter-spacing:8px;
  color:rgba(245,128,32,0.05);
  pointer-events:none;user-select:none;
}
.hero-name{
  font-family:'Bebas Neue',sans-serif;
  font-size:32px;letter-spacing:2px;
  line-height:1;color:#FFFDF3;
  margin-bottom:4px;
}
.hero-sub{font-size:11px;color:#6B6866;font-weight:500;}
.hero-pts{
  font-family:'Bebas Neue',sans-serif;
  font-size:56px;line-height:1;
  color:#F58020;letter-spacing:-1px;
  margin:16px 0 4px;
}
.hero-pts-lbl{
  font-size:10px;letter-spacing:3px;
  text-transform:uppercase;color:#6B6866;
  font-weight:600;margin-bottom:12px;
}
.tier-badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:4px 12px;
  font-family:'Montserrat',sans-serif;
  font-size:11px;font-weight:700;
  letter-spacing:2px;text-transform:uppercase;
  border:1px solid currentColor;
}
.prog-bar-wrap{margin-top:14px;}
.prog-labels{display:flex;justify-content:space-between;font-size:11px;color:#6B6866;margin-bottom:6px;font-weight:500;}
.prog-track{height:3px;background:#333435;}
.prog-fill{height:100%;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);}

.stats-row{
  display:grid;grid-template-columns:repeat(3,1fr);
  border-top:1px solid #333435;
  background:#1F2020;
}
.stat-cell{padding:12px 8px;text-align:center;border-right:1px solid #333435;}
.stat-cell:last-child{border-right:none;}
.stat-num{font-family:'Bebas Neue',sans-serif;font-size:24px;line-height:1;color:#FFFDF3;}
.stat-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;margin-top:2px;font-weight:600;}

.home-section{padding:20px 20px 0;}
.sec-label{
  font-size:10px;font-weight:700;letter-spacing:3px;
  text-transform:uppercase;color:#6B6866;
  margin-bottom:12px;display:flex;align-items:center;gap:10px;
}
.sec-label::after{content:'';flex:1;height:1px;background:#333435;}

.quick-card{
  background:#252627;border:1px solid #333435;
  padding:16px;margin-bottom:10px;
  display:flex;align-items:center;gap:14px;
}
.qc-icon{font-size:24px;flex-shrink:0;}
.qc-label{font-size:14px;font-weight:600;color:#FFFDF3;}
.qc-sub{font-size:11px;color:#6B6866;margin-top:2px;}
.qc-pts{
  font-family:'Bebas Neue',sans-serif;
  font-size:22px;color:#F58020;
  margin-left:auto;flex-shrink:0;
}

.act-row{display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #333435;gap:12px;}
.act-row:last-child{border-bottom:none;}
.act-icon{width:34px;height:34px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.act-label{font-size:13px;font-weight:500;color:#FFFDF3;}
.act-date{font-size:11px;color:#6B6866;margin-top:1px;}
.act-pts{font-family:'Bebas Neue',sans-serif;font-size:18px;margin-left:auto;}

/* ── LOYALTY TAB ── */
.loyalty-wrap{padding:0 20px;}
.loyalty-tabs{
  display:flex;border-bottom:1px solid #333435;
  margin-bottom:0;
  background:#1F2020;
  flex-shrink:0;
}
.ltab{
  flex:1;padding:12px 4px;background:none;border:none;
  color:#6B6866;font-family:'Montserrat',sans-serif;
  font-size:10px;font-weight:700;letter-spacing:1.5px;
  text-transform:uppercase;cursor:pointer;
  position:relative;text-align:center;transition:color .2s;
}
.ltab.on{color:#F58020;}
.ltab.on::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:#F58020;}

/* rewards */
.rewards-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
.rwd-card{background:#252627;border:1px solid #333435;padding:16px;position:relative;transition:border-color .2s;}
.rwd-card:hover:not(.oos){border-color:#F58020;}
.rwd-card.oos{opacity:.42;}
.rwd-icon{font-size:26px;margin-bottom:8px;display:block;}
.rwd-cat{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;margin-bottom:4px;font-weight:700;}
.rwd-name{font-size:13px;font-weight:700;color:#FFFDF3;line-height:1.3;margin-bottom:10px;}
.rwd-footer{display:flex;align-items:center;justify-content:space-between;}
.rwd-cost{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#F58020;}
.rdm-btn{padding:5px 12px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;}
.rdm-btn:disabled{background:#333435;color:#6B6866;cursor:not-allowed;}
.rdm-btn.pending-btn{background:#026F91;}
.oos-tag{position:absolute;top:8px;right:8px;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;background:#333435;color:#6B6866;padding:2px 6px;font-weight:700;}

/* challenges */
.ch-card{background:#252627;border:1px solid #333435;padding:16px;margin-bottom:10px;transition:border-color .2s;}
.ch-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;}
.ch-icon-w{width:38px;height:38px;background:rgba(245,128,32,.1);border:1px solid rgba(245,128,32,.28);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
.ch-name{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#FFFDF3;line-height:1;margin-bottom:3px;letter-spacing:1px;}
.ch-desc{font-size:11px;color:#6B6866;}
.ch-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.ch-dl{font-size:11px;color:#6B6866;font-weight:500;}
.ch-rew{font-family:'Bebas Neue',sans-serif;font-size:16px;color:#F58020;}
.ch-track{height:4px;background:#333435;}
.ch-fill{height:100%;background:linear-gradient(90deg,#026F91,#F58020);transition:width 1s cubic-bezier(0.16,1,0.3,1);}
.ch-bar-lbl{display:flex;justify-content:space-between;font-size:11px;color:#6B6866;margin-top:5px;font-weight:500;}

/* leaderboard */
.lb-row{display:flex;align-items:center;padding:11px 0;border-bottom:1px solid #333435;gap:12px;}
.lb-row:last-child{border-bottom:none;}
.lb-row.me{background:rgba(245,128,32,.06);margin:0 -20px;padding-left:20px;padding-right:20px;border-left:2px solid #F58020;}
.lb-rank{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#6B6866;width:26px;text-align:center;flex-shrink:0;}
.lb-rank.top{color:#D4AF37;}
.lb-av{width:32px;height:32px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:800;flex-shrink:0;background:#333435;color:#FFFDF3;}
.lb-name{flex:1;font-size:13px;font-weight:500;}
.lb-name .you{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#F58020;background:rgba(245,128,32,.14);padding:1px 5px;margin-left:6px;font-weight:700;}
.lb-streak{font-size:11px;color:#6B6866;}
.lb-pts{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#FFFDF3;text-align:right;min-width:60px;}

/* earn */
.tier-ladder{display:flex;border:1px solid #333435;overflow:hidden;margin-bottom:20px;}
.tier-rung{flex:1;padding:12px 6px;text-align:center;border-right:1px solid #333435;}
.tier-rung:last-child{border-right:none;}
.tier-rung.cur{background:rgba(245,128,32,.07);}
.tier-rung-icon{font-size:16px;display:block;margin-bottom:3px;}
.tier-rung-name{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.tier-rung-min{font-size:9px;color:#6B6866;margin-top:2px;font-weight:500;}
.earn-tbl{width:100%;border-collapse:collapse;}
.earn-tbl tr{border-bottom:1px solid #333435;}
.earn-tbl tr:last-child{border-bottom:none;}
.earn-tbl td{padding:11px 6px;font-size:13px;vertical-align:middle;}
.earn-action{color:#FFFDF3;font-weight:600;font-size:13px;}
.earn-note{color:#6B6866;font-size:11px;margin-top:1px;}
.earn-pts{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#F58020;text-align:right;white-space:nowrap;}

/* pending redemptions */
.rdm-pending{background:rgba(2,111,145,.1);border:1px solid rgba(2,111,145,.3);padding:10px 14px;margin-bottom:14px;}
.rdm-pending-title{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#026F91;font-weight:700;margin-bottom:8px;}
.rdm-pending-item{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(2,111,145,.2);}
.rdm-pending-item:last-child{border-bottom:none;}

/* pills */
.pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
.pill{padding:4px 12px;border:1px solid #333435;background:none;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.pill.on,.pill:hover{border-color:#F58020;color:#F58020;background:rgba(245,128,32,.08);}

/* ── WORKOUTS TAB (placeholder) ── */
.coming-soon{
  display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:60px 20px;text-align:center;
  min-height:50vh;
}
.cs-icon{font-size:56px;margin-bottom:16px;}
.cs-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#FFFDF3;margin-bottom:8px;}
.cs-sub{font-size:13px;color:#6B6866;line-height:1.6;max-width:260px;}

/* ── WORKOUTS TAB ── */
.pill{padding:4px 12px;border:1px solid #333435;background:none;color:#6B6866;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.pill.on,.pill:hover{border-color:#F58020;color:#F58020;background:rgba(245,128,32,.08);}

/* ── PROFILE TAB ── */
.profile-wrap{padding:20px;}
.profile-header{
  display:flex;align-items:center;gap:16px;
  background:#252627;border:1px solid #333435;
  padding:20px;margin-bottom:16px;
}
.profile-av{
  width:56px;height:56px;border-radius:2px;
  background:rgba(245,128,32,.15);border:2px solid #F58020;
  display:flex;align-items:center;justify-content:center;
  font-family:'Bebas Neue',sans-serif;font-size:22px;color:#F58020;
  flex-shrink:0;
}
.profile-name{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px;color:#FFFDF3;line-height:1;}
.profile-id{font-size:11px;color:#6B6866;margin-top:3px;font-family:'Montserrat',sans-serif;}
.profile-tier{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;}

.profile-section{background:#252627;border:1px solid #333435;margin-bottom:12px;overflow:hidden;}
.profile-section-title{
  font-size:10px;font-weight:700;letter-spacing:2.5px;
  text-transform:uppercase;color:#6B6866;
  padding:12px 16px;border-bottom:1px solid #333435;
}
.profile-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid #333435;
}
.profile-row:last-child{border-bottom:none;}
.profile-row-label{font-size:12px;color:#6B6866;font-weight:500;}
.profile-row-value{font-size:13px;color:#FFFDF3;font-weight:600;text-align:right;}

.ref-box{
  background:#252627;border:1px solid #333435;padding:16px;margin-bottom:12px;
}
.ref-code{
  font-family:'Bebas Neue',sans-serif;font-size:28px;
  color:#F58020;letter-spacing:3px;text-align:center;
  padding:12px;background:#2A2B2C;border:1px dashed #F58020;
  margin:10px 0;
}
.ref-hint{font-size:11px;color:#6B6866;text-align:center;line-height:1.6;}

.btn-signout{
  width:100%;padding:14px;background:none;
  border:1px solid #EF4444;color:#EF4444;
  font-family:'Montserrat',sans-serif;font-size:12px;
  font-weight:700;letter-spacing:2px;text-transform:uppercase;
  cursor:pointer;transition:all .15s;margin-top:8px;
}
.btn-signout:hover{background:#EF4444;color:#fff;}

/* ── LOGIN / AUTH SCREENS ── */
.screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden;background:#1F2020;}
.box{width:100%;max-width:380px;background:#252627;border:1px solid #333435;padding:36px 28px;}
.brand-sub{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#6B6866;text-align:center;margin-top:3px;font-weight:700;}
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

/* TOAST */
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:#F58020;color:#fff;padding:11px 24px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;z-index:1000;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}

::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#1F2020;}::-webkit-scrollbar-thumb{background:#333435;}
`;

// ── TIER CELEBRATION ─────────────────────────────────────
function TierCelebration({ tier, onDismiss }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",padding:32,animation:"fadein .4s ease"}}>
      <style>{`@keyframes fadein{from{opacity:0;}to{opacity:1;}} @keyframes bounce{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}`}</style>
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {[...Array(30)].map((_,i)=>(<div key={i} style={{position:"absolute",width:`${6+Math.random()*8}px`,height:`${6+Math.random()*8}px`,borderRadius:2,left:`${Math.random()*100}%`,background:["#F58020","#D4AF37","#026F91","#FFFDF3","#22C55E"][i%5],animation:`fall ${1.5+Math.random()*2}s linear ${Math.random()*2}s infinite`}}/>))}
      </div>
      <style>{`@keyframes fall{from{transform:translateY(-20px) rotate(0deg);opacity:1;}to{transform:translateY(100vh) rotate(720deg);opacity:0;}}`}</style>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:80,color:tier.color,lineHeight:1,textAlign:"center",animation:"bounce 1s ease infinite",marginBottom:8}}>{tier.icon}</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:6,color:"#6B6866",textAlign:"center",marginBottom:8,textTransform:"uppercase"}}>You've reached</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:72,letterSpacing:4,color:tier.color,lineHeight:1,textAlign:"center"}}>{tier.name}</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:3,color:"#6B6866",textAlign:"center",marginTop:4,textTransform:"uppercase"}}>Tier</div>
      <div style={{fontSize:14,color:"#FFFDF3",textAlign:"center",margin:"24px 0",fontWeight:500,lineHeight:1.6,maxWidth:280}}>You've earned your way to a new level. Keep pushing — every rep counts.</div>
      <button onClick={onDismiss} style={{background:tier.color,border:"none",color:"#fff",padding:"14px 40px",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Let's Go! 💪</button>
    </div>
  );
}

// ── PIN INPUT ─────────────────────────────────────────────
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

// ── LOGIN FLOW ────────────────────────────────────────────
function LoginFlow({ onLogin }) {
  const [stage,setStage]           = useState("phone");
  const [phone,setPhone]           = useState("");
  const [member,setMember]         = useState(null);
  const [pin,setPin]               = useState("");
  const [pin2,setPin2]             = useState("");
  const [error,setError]           = useState("");
  const [loading,setLoading]       = useState(false);
  const [regName,setRegName]       = useState("");
  const [regPhone,setRegPhone]     = useState("");
  const [regBirthday,setRegBirthday] = useState("");
  const [regRefCode,setRegRefCode] = useState("");

  // Pre-fill referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setRegRefCode(ref.toUpperCase());
  }, []);

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
    if(pin2!==pin){setError("PINs don't match.");setPin2("");return;}
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
    const newId = genId("URZ");
    const refCode = "URUZ-" + newId.slice(-5).toUpperCase();
    const nm = { id:newId, name:regName.trim(), phone:regPhone.trim(), email:"", joinDate:today(), points:0, checkins:0, streak:0, status:"active", pin:null, birthday:regBirthday||null, referral_code:refCode };
    await upsertMember(nm);
    if (regRefCode.trim()) {
      const referrer = await getMemberByReferralCode(regRefCode.trim());
      if (referrer) {
        const REF_PTS = 500;
        await upsertMember({...referrer, points:(referrer.points||0)+REF_PTS});
        await addReferral({ id:genId("REF"), referrerId:referrer.id, referrerName:referrer.name, referrerCode:regRefCode.trim(), newMemberId:nm.id, newMemberName:nm.name, pts:REF_PTS, date:today() });
        await addTransaction({ id:genId("TXN"), memberId:referrer.id, memberName:referrer.name, type:"referral", pts:REF_PTS, note:`Referral — ${nm.name}`, date:today() });
      }
    }
    setLoading(false);
    setMember({...nm, referral_code:refCode}); setPin(""); setStage("setpin");
  };

  const LogoBox = () => (
    <div style={{textAlign:"center",marginBottom:0}}>
      <img src={LOGO_URL} alt="URUZ" style={{height:56,display:"block",margin:"0 auto 6px",width:"auto"}}/>
      <div className="brand-sub">Member Central</div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="screen">
        {stage==="phone"&&(<div className="box"><LogoBox/><div className="divider"/><div className="step-title">Welcome Back</div><label className="lbl">Your Phone Number</label><input className="inp" placeholder="+961 XX XXX XXX" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handlePhone()}/>{error&&<div className="err">{error}</div>}<button className="btn btn-primary" onClick={handlePhone} disabled={loading}>{loading?"Checking...":"Sign In"}</button><div className="hint">Not a member? <span className="link" onClick={()=>{setError("");setStage("register");}}>Register here</span></div></div>)}
        {stage==="pin"&&member&&(<div className="box"><LogoBox/><div className="divider"/><div className="member-chip"><div className="chip-av">{initials(member.name)}</div><div><div style={{fontSize:14,fontWeight:700,color:"#FFFDF3"}}>{member.name}</div><div style={{fontSize:11,color:"#6B6866"}}>{member.phone}</div></div></div><PinInput value={pin} onChange={v=>{setPin(v);setError("");}} label="Enter your 4-digit PIN"/>{error&&<div className="err">{error}</div>}<button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>{setStage("phone");setPin("");setMember(null);}}>Back</button></div>)}
        {stage==="setpin"&&member&&(<div className="box"><LogoBox/><div className="divider"/><div className="step-title">Create Your PIN</div><PinInput value={pin} onChange={v=>{setPin(v);setError("");}} label="Choose a 4-digit PIN to secure your account"/>{error&&<div className="err">{error}</div>}<button className="btn btn-primary" onClick={handleSetPin} disabled={pin.length<4}>Continue</button></div>)}
        {stage==="confirmpin"&&(<div className="box"><LogoBox/><div className="divider"/><div className="step-title">Confirm PIN</div><PinInput value={pin2} onChange={v=>{setPin2(v);setError("");}} label="Enter your PIN again to confirm"/>{error&&<div className="err">{error}</div>}</div>)}
        {stage==="register"&&(<div className="box"><LogoBox/><div className="divider"/><div className="step-title">Join URUZ</div><div className="step-sub">Start earning points from day one</div><label className="lbl">Full Name</label><input className="inp" placeholder="e.g. Alex Rivera" value={regName} onChange={e=>setRegName(e.target.value)}/><label className="lbl">Phone Number</label><input className="inp" placeholder="+961 XX XXX XXX" value={regPhone} onChange={e=>setRegPhone(e.target.value)}/><label className="lbl">Birthday (optional)</label><input className="inp" type="date" value={regBirthday} onChange={e=>setRegBirthday(e.target.value)} style={{marginBottom:14}}/><label className="lbl">Referral Code (optional)</label><input className="inp" placeholder="e.g. URUZ-ABC12" value={regRefCode} onChange={e=>setRegRefCode(e.target.value.toUpperCase())} style={{marginBottom:14}}/>{error&&<div className="err">{error}</div>}<button className="btn btn-primary" onClick={handleRegister} disabled={loading}>{loading?"Creating...":"Create Account"}</button><button className="btn btn-ghost" onClick={()=>{setStage("phone");setError("");}}>Back to Sign In</button></div>)}
      </div>
    </>
  );
}

// ── HOME TAB ──────────────────────────────────────────────
const URUZ_QUOTES = [
  "Every rep is a deposit into your future self.",
  "Show up. Put in the work. The results follow.",
  "Strength isn't given — it's built, session by session.",
  "Your only competition is who you were yesterday.",
  "The gym doesn't care about your excuses. Neither should you.",
  "Built different. Trained harder.",
];

function HomeTab({ member, members, transactions, tiers, challenges, enrollments, workouts, onTabChange, homeMessages }) {
  const tier = getTier(member.points, tiers);
  const next = getNext(member.points, tiers);
  const tierPct = next ? Math.round(((member.points-tier.min)/(next.min-tier.min))*100) : 100;
  const rank = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===member.id)+1;
  const myTxns = transactions.filter(t=>t.memberId===member.id||t.member_id===member.id).slice(0,3);
  const myEnrollments = enrollments.filter(e=>(e.memberId===member.id||e.member_id===member.id)&&!e.completed);
  const msgs = homeMessages && homeMessages.length > 0 ? homeMessages : URUZ_QUOTES;
  const quote = msgs[new Date().getDay() % msgs.length];
  const todayMMDD = new Date().toISOString().slice(5,10);
  const isBirthday = member.birthday && member.birthday.slice(5,10) === todayMMDD;
  const newWorkouts = workouts.filter(w=>w.active&&(w.access_type==="free")).slice(0,2);
  const featuredChallenge = challenges.find(c=>!myEnrollments.find(e=>e.challengeId===String(c.id))) || null;

  const actCfg={checkin:{e:"📍",bg:"rgba(2,111,145,.15)"},challenge:{e:"🏆",bg:"rgba(212,175,55,.15)"},referral:{e:"👥",bg:"rgba(34,197,94,.15)"},purchase:{e:"🛒",bg:"rgba(168,85,247,.15)"},redeem:{e:"🎟",bg:"rgba(239,68,68,.15)"},class:{e:"💪",bg:"rgba(245,128,32,.15)"},bonus:{e:"⭐",bg:"rgba(212,175,55,.15)"},manual:{e:"✏",bg:"rgba(168,85,247,.15)"},deduct:{e:"➖",bg:"rgba(239,68,68,.15)"}};

  return (
    <div style={{paddingBottom:20}}>
      {/* Hero */}
      <div className="home-hero">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <img src={LOGO_URL} alt="URUZ" style={{height:28,width:"auto"}}/>
          <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"#6B6866",fontWeight:700}}>Member Central</div>
        </div>
        <div className="hero-name">Hey, {member.name.split(" ")[0]} 👋</div>
        <div className="hero-sub">Member since {new Date(member.joinDate).toLocaleDateString("en-GB",{month:"short",year:"numeric"})} · {tier.icon} {tier.name}</div>
        <div className="hero-pts">{member.points.toLocaleString()}</div>
        <div className="hero-pts-lbl">Points</div>
        <div className="tier-badge" style={{color:tier.color,borderColor:tier.color,background:`${tier.color}18`}}>{tier.icon} {tier.name}</div>
        {next&&<div className="prog-bar-wrap"><div className="prog-labels"><span style={{color:tier.color}}>{tier.name}</span><span style={{color:next.color}}>{(next.min-member.points).toLocaleString()} pts to {next.name}</span></div><div className="prog-track"><div className="prog-fill" style={{width:`${tierPct}%`,background:`linear-gradient(90deg,#026F91,#F58020)`}}/></div></div>}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-cell"><div className="stat-num" style={{color:"#F58020"}}>#{rank}</div><div className="stat-lbl">Club Rank</div></div>
        <div className="stat-cell"><div className="stat-num">🔥{member.streak}</div><div className="stat-lbl">Streak</div></div>
        <div className="stat-cell"><div className="stat-num">{member.checkins}</div><div className="stat-lbl">Check-ins</div></div>
      </div>

      {/* Quick Actions */}
      <div className="home-section">
        <div className="sec-label">Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[
            {icon:"📍",label:"Check In",action:()=>window.open("/checkin","_blank"),color:"#026F91"},
            {icon:"🎟",label:"Redeem",action:()=>onTabChange("loyalty"),color:"#F58020"},
            {icon:"🏆",label:"Rankings",action:()=>onTabChange("loyalty"),color:"#D4AF37"},
          ].map((a,i)=>(
            <button key={i} onClick={a.action} style={{
              background:`${a.color}15`,border:`1px solid ${a.color}44`,
              padding:"14px 8px",display:"flex",flexDirection:"column",
              alignItems:"center",gap:6,cursor:"pointer",transition:"all .15s",
              fontFamily:"'Montserrat',sans-serif",
            }}
            onTouchStart={e=>e.currentTarget.style.background=`${a.color}30`}
            onTouchEnd={e=>e.currentTarget.style.background=`${a.color}15`}>
              <span style={{fontSize:22}}>{a.icon}</span>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:a.color}}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Birthday or Motivational Quote */}
      {isBirthday ? (
        <div style={{margin:"0 20px",background:"linear-gradient(135deg,rgba(245,128,32,.2),rgba(212,175,55,.15))",border:"1px solid rgba(245,128,32,.5)",padding:"16px 18px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:6}}>🎂</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"#F58020",marginBottom:4}}>Happy Birthday, {member.name.split(" ")[0]}!</div>
          <div style={{fontSize:13,color:"#FFFDF3",lineHeight:1.6,fontWeight:500}}>Wishing you a powerful year ahead. Your 300 birthday points have been added! 🎁</div>
        </div>
      ) : (
        <div style={{margin:"0 20px",background:"linear-gradient(135deg,rgba(245,128,32,.12),rgba(2,111,145,.12))",border:"1px solid rgba(245,128,32,.2)",padding:"16px 18px"}}>
          <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#F58020",fontWeight:700,marginBottom:6}}>Today's Mindset</div>
          <div style={{fontSize:14,color:"#FFFDF3",lineHeight:1.6,fontWeight:500,fontStyle:"italic"}}>"{quote}"</div>
        </div>
      )}

      {/* Active Challenges */}
      {myEnrollments.length > 0 && (
        <div className="home-section">
          <div className="sec-label" style={{cursor:"pointer"}} onClick={()=>onTabChange("challenges")}>Active Challenges <span style={{color:"#F58020",fontSize:10}}>See all →</span></div>
          {myEnrollments.slice(0,2).map(e=>{
            const c = challenges.find(x=>String(x.id)===e.challengeId)||{};
            const pct = Math.min(100,Math.round(((e.progress||0)/(e.goal||1))*100));
            return (
              <div key={e.id} style={{background:"#252627",border:"1px solid rgba(245,128,32,.3)",padding:"14px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontSize:18}}>{c.icon||"⚔"}</span>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#FFFDF3"}}>{c.name||e.challengeName}</div><div style={{fontSize:11,color:"#6B6866",marginTop:1}}>{pct}% complete · +{c.pts||0} pts</div></div>
                </div>
                <div style={{height:4,background:"#333435"}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#026F91,#F58020)"}}/></div>
              </div>
            );
          })}
        </div>
      )}

      {/* Featured Challenge (if not joined any) */}
      {myEnrollments.length === 0 && featuredChallenge && (
        <div className="home-section">
          <div className="sec-label">Featured Challenge</div>
          <div style={{background:"linear-gradient(135deg,#1a1208,#252627)",border:"1px solid rgba(245,128,32,.3)",padding:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <div style={{width:44,height:44,background:"rgba(245,128,32,.15)",border:"1px solid rgba(245,128,32,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{featuredChallenge.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:1,color:"#FFFDF3"}}>{featuredChallenge.name}</div>
                <div style={{fontSize:11,color:"#6B6866"}}>{featuredChallenge.desc}</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#F58020"}}>+{featuredChallenge.pts}</div>
            </div>
            <button onClick={()=>onTabChange("challenges")} style={{width:"100%",padding:"10px",background:"#F58020",border:"none",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>
              View Challenges
            </button>
          </div>
        </div>
      )}

      {/* New Workouts */}
      {newWorkouts.length > 0 && (
        <div className="home-section">
          <div className="sec-label" style={{cursor:"pointer"}} onClick={()=>onTabChange("workouts")}>New Workouts <span style={{color:"#F58020",fontSize:10}}>See all →</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {newWorkouts.map(w=>(
              <div key={w.id} onClick={()=>onTabChange("workouts")} style={{background:"#252627",border:"1px solid #333435",overflow:"hidden",cursor:"pointer"}}>
                <div style={{height:80,background:"#1F2020",position:"relative"}}>
                  {w.thumbnail_url?<img src={w.thumbnail_url} alt={w.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>💪</div>}
                  <div style={{position:"absolute",top:6,right:6,background:"rgba(34,197,94,.9)",padding:"2px 6px",fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#fff"}}>Free</div>
                </div>
                <div style={{padding:"8px 10px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#FFFDF3",lineHeight:1.3}}>{w.title}</div>
                  <div style={{fontSize:10,color:"#6B6866",marginTop:2}}>{w.category} · {w.duration_mins}m</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="home-section">
        <div className="sec-label">Recent Activity</div>
        {myTxns.length === 0 ? (
          <div style={{color:"#6B6866",fontSize:13,padding:"16px 0",textAlign:"center"}}>No activity yet. Check in to start earning!</div>
        ) : myTxns.map(a=>{
          const k=actCfg[a.type]||actCfg.checkin;
          return (
            <div key={a.id} className="act-row">
              <div className="act-icon" style={{background:k.bg}}>{k.e}</div>
              <div style={{flex:1}}><div className="act-label">{a.note}</div><div className="act-date">{fmtDate(a.date)}</div></div>
              <div className="act-pts" style={{color:a.pts>0?"#22C55E":"#EF4444"}}>{a.pts>0?"+":""}{a.pts}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LOYALTY TAB ───────────────────────────────────────────
function LoyaltyTab({ member, members, transactions, redemptions, rewards, tiers, challenges, earnRules, memberId, onRequest }) {
  const [sub, setSub] = useState("activity");
  const [enrollments, setEnrollments] = useState([]);
  const [filter, setFilter] = useState("All");
  const [toastMsg, setToastMsg] = useState(""); const [toastOn, setToastOn] = useState(false);
  const showToast = msg => { setToastMsg(msg); setToastOn(true); setTimeout(()=>setToastOn(false),2600); };
  const [joining, setJoining] = useState(null);

  useEffect(() => { if(memberId) getMemberEnrollments(memberId).then(setEnrollments); }, [memberId]);

  const myTxns = transactions.filter(t=>t.memberId===memberId||t.member_id===memberId).slice(0,20);
  const myRdms = redemptions.filter(r=>r.memberId===memberId||r.member_id===memberId);
  const pendingNames = myRdms.filter(r=>r.status==="pending").map(r=>r.reward);
  const rules = earnRules && earnRules.length > 0 ? earnRules : HOW_TO_EARN;
  const cur = getTier(member.points, tiers);

  const handleJoin = async (c) => {
    if(joining) return; setJoining(c.id);
    const enrollment = { id:genId("ENR"), challengeId:String(c.id), challengeName:c.name, memberId, memberName:member.name, progress:0, goal:c.goal||1, enrolledDate:today() };
    await enrollInChallenge(enrollment);
    setEnrollments(prev=>[...prev,{...enrollment,completed:false}]);
    setJoining(null); showToast(`Joined: ${c.name}!`);
  };

  const isEnrolled = cid => enrollments.find(e=>e.challengeId===String(cid));
  const cats = ["All","Access","Merch","Training"];
  const rewardList = filter==="All" ? rewards : rewards.filter(r=>r.cat===filter);

  const sorted=[...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points);
  const top10=sorted.slice(0,10);
  const meIdx=sorted.findIndex(m=>m.id===memberId);
  const me=sorted[meIdx];

  const actCfg={checkin:{e:"📍",bg:"rgba(2,111,145,.15)"},challenge:{e:"🏆",bg:"rgba(212,175,55,.15)"},referral:{e:"👥",bg:"rgba(34,197,94,.15)"},purchase:{e:"🛒",bg:"rgba(168,85,247,.15)"},redeem:{e:"🎟",bg:"rgba(239,68,68,.15)"},class:{e:"💪",bg:"rgba(245,128,32,.15)"},bonus:{e:"⭐",bg:"rgba(212,175,55,.15)"},manual:{e:"✏",bg:"rgba(168,85,247,.15)"},deduct:{e:"➖",bg:"rgba(239,68,68,.15)"}};

  const SUBS=[{id:"activity",l:"Activity"},{id:"rewards",l:"Rewards"},{id:"challenges",l:"Challenges"},{id:"earn",l:"Earn"},{id:"rankings",l:"Rankings"}];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 64px)"}}>
      <div className="loyalty-tabs">
        {SUBS.map(s=><button key={s.id} className={`ltab${sub===s.id?" on":""}`} onClick={()=>setSub(s.id)}>{s.l}</button>)}
      </div>
      <div className="loyalty-wrap" key={sub} style={{flex:1,overflowY:"auto",paddingTop:16}}>

        {sub==="activity"&&(
          <div>{myTxns.length===0?<div style={{color:"#6B6866",fontSize:13,padding:"20px 0",textAlign:"center"}}>No activity yet!</div>:myTxns.map(a=>{const k=actCfg[a.type]||actCfg.checkin;return(<div key={a.id} className="act-row"><div className="act-icon" style={{background:k.bg}}>{k.e}</div><div style={{flex:1}}><div className="act-label">{a.note}</div><div className="act-date">{fmtDate(a.date)}</div></div><div className="act-pts" style={{color:a.pts>0?"#22C55E":"#EF4444"}}>{a.pts>0?"+":""}{a.pts}</div></div>);})}</div>
        )}

        {sub==="rewards"&&(
          <div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#6B6866",marginBottom:4,fontWeight:600}}>Balance</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:"#F58020",lineHeight:1}}>{member.points.toLocaleString()} <span style={{fontSize:14,color:"#6B6866"}}>PTS</span></div>
            </div>
            {myRdms.filter(r=>r.status==="pending").length>0&&(<div className="rdm-pending"><div className="rdm-pending-title">⏳ Pending</div>{myRdms.filter(r=>r.status==="pending").map(r=>(<div key={r.id} className="rdm-pending-item"><span style={{fontSize:12,fontWeight:500}}>{r.reward}</span><span style={{fontSize:10,color:"#026F91",fontWeight:700}}>See front desk</span></div>))}</div>)}
            <div className="pills">{cats.map(c=><button key={c} className={`pill${filter===c?" on":""}`} onClick={()=>setFilter(c)}>{c}</button>)}</div>
            <div className="rewards-grid">{rewardList.map(r=>{const ip=pendingNames.includes(r.name);return(<div key={r.id} className={`rwd-card${!r.stock?" oos":""}`}>{!r.stock&&<span className="oos-tag">Out</span>}<span className="rwd-icon">{r.icon}</span><div className="rwd-cat">{r.cat}</div><div className="rwd-name">{r.name}</div><div className="rwd-footer"><div className="rwd-cost">{r.pts.toLocaleString()}</div><button className={`rdm-btn${ip?" pending-btn":""}`} disabled={(!ip&&member.points<r.pts)||!r.stock} onClick={()=>!ip&&onRequest(r)}>{ip?"Requested":member.points<r.pts?"Need more":"Request"}</button></div></div>);})}</div>
          </div>
        )}

        {sub==="challenges"&&(
          <div>
            {challenges.map(c=>{const enrolled=isEnrolled(c.id);const progress=enrolled?enrolled.progress:0;const goal=c.goal||1;const pct=Math.min(100,Math.round((progress/goal)*100));const completed=enrolled?.completed;return(
              <div key={c.id} className="ch-card" style={{borderColor:completed?"#22C55E":enrolled?"rgba(245,128,32,.4)":undefined}}>
                <div className="ch-top">
                  <div className="ch-icon-w">{c.icon}</div>
                  <div style={{flex:1}}><div className="ch-name">{c.name}</div><div className="ch-desc">{c.desc}</div></div>
                  {completed?(<div style={{background:"rgba(34,197,94,.15)",color:"#22C55E",padding:"3px 8px",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>✓ Done</div>):enrolled?(<div style={{background:"rgba(245,128,32,.15)",color:"#F58020",padding:"3px 8px",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>Joined</div>):(<button onClick={()=>handleJoin(c)} disabled={joining===c.id} style={{background:"#F58020",border:"none",color:"#fff",padding:"5px 12px",fontFamily:"'Montserrat',sans-serif",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{joining===c.id?"...":"Join"}</button>)}
                </div>
                <div className="ch-meta"><span className="ch-dl">⏱ {c.deadline}</span><span className="ch-rew">+{c.pts} PTS</span></div>
                {enrolled&&<><div className="ch-track"><div className="ch-fill" style={{width:`${pct}%`}}/></div><div className="ch-bar-lbl"><span>{progress}/{goal}</span><span style={{color:pct>=100?"#22C55E":"#6B6866"}}>{pct}%</span></div></>}
              </div>
            );})}
            <div className={`toast${toastOn?" on":""}`}>✓ {toastMsg}</div>
          </div>
        )}

        {sub==="earn"&&(
          <div>
            <div className="sec-label" style={{marginBottom:12}}>Tier Path</div>
            <div className="tier-ladder">{[...tiers].sort((a,b)=>a.min-b.min).map(t=>(<div key={t.id} className={`tier-rung${t.name===cur.name?" cur":""}`}><span className="tier-rung-icon">{t.icon}</span><div className="tier-rung-name" style={{color:t.color}}>{t.name}</div><div className="tier-rung-min">{t.min.toLocaleString()}+</div></div>))}</div>
            <div className="sec-label" style={{marginBottom:12}}>Ways to Earn</div>
            <table className="earn-tbl"><tbody>{rules.map((e,i)=>(<tr key={e.id||i}><td style={{width:36,textAlign:"center",fontSize:18}}>{e.icon}</td><td><div className="earn-action">{e.action}</div><div className="earn-note">{e.note}</div></td><td className="earn-pts">{typeof e.pts==="number"?`+${e.pts}`:e.pts} <span style={{fontSize:10,color:"#6B6866"}}>PTS</span></td></tr>))}</tbody></table>
          </div>
        )}

        {sub==="rankings"&&(
          <div>
            <div className="sec-label" style={{marginBottom:12}}>This Month</div>
            {top10.map((m,i)=>{const r=i+1;const av=r===1?{background:"rgba(212,175,55,.22)",color:"#D4AF37",border:"1px solid rgba(212,175,55,.55)"}:r===2?{background:"rgba(168,169,173,.22)",color:"#A8A9AD",border:"1px solid rgba(168,169,173,.55)"}:r===3?{background:"rgba(205,127,50,.22)",color:"#CD7F32",border:"1px solid rgba(205,127,50,.55)"}:{};return(<div key={m.id} className={`lb-row${m.id===memberId?" me":""}`}><div className={`lb-rank${r<=3?" top":""}`}>{r}</div><div className="lb-av" style={av}>{initials(m.name)}</div><div className="lb-name">{m.name}{m.id===memberId&&<span className="you">You</span>}</div><div className="lb-streak">🔥{m.streak}d</div><div className="lb-pts">{m.points.toLocaleString()}</div></div>);})}
            {me&&meIdx>=10&&<><div style={{textAlign:"center",padding:"10px 0",color:"#6B6866",fontSize:12}}>• • •</div><div className="lb-row me"><div className="lb-rank">{meIdx+1}</div><div className="lb-av" style={{background:"rgba(245,128,32,.22)",color:"#F58020",border:"1px solid rgba(245,128,32,.55)"}}>{initials(me.name)}</div><div className="lb-name">{me.name}<span className="you">You</span></div><div className="lb-streak">🔥{me.streak}d</div><div className="lb-pts">{me.points.toLocaleString()}</div></div></>}
          </div>
        )}
      </div>
    </div>
  );
}


// ── CHALLENGES TAB ───────────────────────────────────────
function ChallengesTab({ member, challenges }) {
  const [enrollments, setEnrollments] = useState([]);
  const [joining, setJoining]         = useState(null);
  const [toastMsg, setToastMsg]       = useState("");
  const [toastOn, setToastOn]         = useState(false);

  const showToast = msg => { setToastMsg(msg); setToastOn(true); setTimeout(()=>setToastOn(false),2600); };

  useEffect(() => {
    if (member.id) getMemberEnrollments(member.id).then(setEnrollments);
  }, [member.id]);

  const isEnrolled = cid => enrollments.find(e=>e.challengeId===String(cid));

  const handleJoin = async (c) => {
    if(joining) return; setJoining(c.id);
    const enrollment = { id:genId("ENR"), challengeId:String(c.id), challengeName:c.name, memberId:member.id, memberName:member.name, progress:0, goal:c.goal||1, enrolledDate:today() };
    await enrollInChallenge(enrollment);
    setEnrollments(prev=>[...prev,{...enrollment,completed:false}]);
    setJoining(null); showToast(`Joined: ${c.name}!`);
  };

  const active = challenges.filter(c => { const e=isEnrolled(c.id); return e&&!e.completed; });
  const available = challenges.filter(c => !isEnrolled(c.id));
  const completed = challenges.filter(c => { const e=isEnrolled(c.id); return e&&e.completed; });

  const ChallengeCard = ({c, enrolled, compact}) => {
    const progress = enrolled ? enrolled.progress : 0;
    const goal = c.goal || 1;
    const pct = Math.min(100, Math.round((progress/goal)*100));
    const isCompleted = enrolled?.completed;
    return (
      <div className="ch-card" style={{borderColor:isCompleted?"#22C55E":enrolled?"rgba(245,128,32,.4)":undefined,marginBottom:10}}>
        <div className="ch-top">
          <div className="ch-icon-w">{c.icon}</div>
          <div style={{flex:1}}>
            <div className="ch-name">{c.name}</div>
            <div className="ch-desc">{c.desc}</div>
          </div>
          {isCompleted ? (
            <div style={{background:"rgba(34,197,94,.15)",color:"#22C55E",padding:"3px 8px",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>✓ Done</div>
          ) : enrolled ? (
            <div style={{background:"rgba(245,128,32,.15)",color:"#F58020",padding:"3px 8px",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>Joined</div>
          ) : (
            <button onClick={()=>handleJoin(c)} disabled={joining===c.id}
              style={{background:"#F58020",border:"none",color:"#fff",padding:"5px 12px",fontFamily:"'Montserrat',sans-serif",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
              {joining===c.id?"...":"Join"}
            </button>
          )}
        </div>
        <div className="ch-meta">
          <span className="ch-dl">⏱ {c.deadline}</span>
          <span className="ch-rew">+{c.pts} PTS</span>
        </div>
        {enrolled && !isCompleted && <>
          <div className="ch-track"><div className="ch-fill" style={{width:`${pct}%`}}/></div>
          <div className="ch-bar-lbl"><span>{progress}/{goal}</span><span style={{color:pct>=100?"#22C55E":"#6B6866"}}>{pct}%</span></div>
        </>}
      </div>
    );
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 64px)"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #333435",flexShrink:0}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:"#FFFDF3"}}>Challenges</div>
        <div style={{fontSize:11,color:"#6B6866",marginTop:2}}>{active.length} active · {available.length} available · {completed.length} completed</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px 20px"}}>
        {active.length > 0 && <>
          <div className="sec-label">In Progress</div>
          {active.map(c=><ChallengeCard key={c.id} c={c} enrolled={isEnrolled(c.id)}/>)}
        </>}
        {available.length > 0 && <>
          <div className="sec-label">Available</div>
          {available.map(c=><ChallengeCard key={c.id} c={c} enrolled={null}/>)}
        </>}
        {completed.length > 0 && <>
          <div className="sec-label">Completed</div>
          {completed.map(c=><ChallengeCard key={c.id} c={c} enrolled={isEnrolled(c.id)}/>)}
        </>}
        {challenges.length === 0 && <div style={{color:"#6B6866",fontSize:13,textAlign:"center",padding:"40px 0"}}>No active challenges right now. Check back soon!</div>}
      </div>
      <div className={`toast${toastOn?" on":""}`}>✓ {toastMsg}</div>
    </div>
  );
}

// ── WORKOUTS TAB ─────────────────────────────────────────
function WorkoutsTab({ member, tiers }) {
  const [workouts, setWorkouts]   = useState([]);
  const [unlocks, setUnlocks]     = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [selected, setSelected]   = useState(null);
  const [catFilter, setCatFilter] = useState("All");
  const [diffFilter, setDiffFilter] = useState("All");
  const [toast, setToast]         = useState({msg:"",on:false});
  const [redeeming, setRedeeming] = useState(null);

  const showToast = msg => { setToast({msg,on:true}); setTimeout(()=>setToast(t=>({...t,on:false})),2600); };

  useEffect(() => {
    Promise.all([getWorkouts(), getMemberUnlocks(member.id)]).then(([w, u]) => {
      setWorkouts(w); setUnlocks(u); setLoaded(true);
    });
  }, [member.id]);

  const isUnlocked = wid => unlocks.some(u => u.workoutId === wid);

  const memberTier = getTier(member.points, tiers);
  const tierOrder = ["Iron","Bronze","Silver","Gold","Elite"];

  const canAccess = (w) => {
    if (w.access_type === "free") return true;
    if (w.access_type === "points" && isUnlocked(w.id)) return true;
    if (w.access_type === "paid" && isUnlocked(w.id)) return true;
    if (w.access_type === "tier") {
      const reqIdx = tierOrder.indexOf(w.tier_required);
      const memIdx = tierOrder.indexOf(memberTier.name);
      return memIdx >= reqIdx;
    }
    return false;
  };

  const handleRedeem = async (w) => {
    if (member.points < w.points_cost) { showToast("Not enough points"); return; }
    setRedeeming(w.id);
    const unlock = { id: genId("UNL"), workoutId: w.id, memberId: member.id, unlockedBy: "points", date: today() };
    await unlockWorkout(unlock);
    await upsertMember({...member, points: member.points - w.points_cost});
    await addTransaction({ id:genId("TXN"), memberId:member.id, memberName:member.name, type:"redeem", pts:-w.points_cost, note:`Unlocked: ${w.title}`, date:today() });
    setUnlocks(prev => [...prev, unlock]);
    setRedeeming(null);
    showToast(`Unlocked: ${w.title}!`);
  };

  const cats = ["All", ...new Set(workouts.map(w=>w.category))];
  const diffs = ["All","Beginner","Intermediate","Advanced"];

  const filtered = workouts.filter(w => {
    if (catFilter !== "All" && w.category !== catFilter) return false;
    if (diffFilter !== "All" && w.difficulty !== diffFilter) return false;
    return true;
  });

  const ACCESS_CFG = {
    free:   { label:"Free",     color:"#22C55E", icon:"✓" },
    points: { label:"Points",   color:"#F58020", icon:"⭐" },
    paid:   { label:"Purchase", color:"#026F91", icon:"💳" },
    tier:   { label:"Tier",     color:"#D4AF37", icon:"◆" },
  };

  if (!loaded) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"50vh"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:4,color:"#F58020"}}>LOADING…</div></div>;

  if (selected) {
    const w = selected;
    const accessible = canAccess(w);
    const exercises = Array.isArray(w.exercises) ? w.exercises : [];
    return (
      <div style={{animation:"up .3s ease both"}}>
        {/* Back button */}
        <div style={{padding:"16px 20px 0",display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:"#F58020",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>← Back</button>
        </div>

        {/* Thumbnail */}
        {w.thumbnail_url && <div style={{width:"100%",height:200,overflow:"hidden",background:"#252627"}}>
          <img src={w.thumbnail_url} alt={w.title} style={{width:"100%",height:"100%",objectFit:"cover",opacity:accessible?1:0.4}}/>
        </div>}

        <div style={{padding:"20px 20px 0"}}>
          {/* Title */}
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:8}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"#FFFDF3",lineHeight:1}}>{w.title}</div>
              <div style={{fontSize:11,color:"#6B6866",marginTop:4}}>{w.category} · {w.difficulty} · {w.duration_mins} min</div>
            </div>
            <div style={{background:`${ACCESS_CFG[w.access_type]?.color}18`,border:`1px solid ${ACCESS_CFG[w.access_type]?.color}`,padding:"4px 10px",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:ACCESS_CFG[w.access_type]?.color,flexShrink:0}}>
              {accessible?"Unlocked":ACCESS_CFG[w.access_type]?.label}
            </div>
          </div>

          {w.description && <div style={{fontSize:13,color:"#A8A9AD",lineHeight:1.6,marginBottom:16}}>{w.description}</div>}

          {/* Lock overlay / unlock CTA */}
          {!accessible && (
            <div style={{background:"#252627",border:"1px solid #333435",padding:16,marginBottom:16,textAlign:"center"}}>
              {w.access_type==="points" && <>
                <div style={{fontSize:32,marginBottom:8}}>⭐</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#FFFDF3",marginBottom:4}}>Unlock for {w.points_cost} points</div>
                <div style={{fontSize:12,color:"#6B6866",marginBottom:12}}>You have {member.points.toLocaleString()} pts</div>
                <button onClick={()=>handleRedeem(w)} disabled={member.points<w.points_cost||redeeming===w.id} style={{background:"#F58020",border:"none",color:"#fff",padding:"10px 24px",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",opacity:member.points<w.points_cost?0.5:1}}>
                  {redeeming===w.id?"Unlocking...":"Redeem Points"}
                </button>
              </>}
              {w.access_type==="paid" && <>
                <div style={{fontSize:32,marginBottom:8}}>💳</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#FFFDF3",marginBottom:4}}>{w.price_label||"Available for Purchase"}</div>
                <div style={{fontSize:12,color:"#6B6866"}}>Pay at the front desk — staff will unlock this for you</div>
              </>}
              {w.access_type==="tier" && <>
                <div style={{fontSize:32,marginBottom:8}}>◆</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#FFFDF3",marginBottom:4}}>Requires {w.tier_required} Tier</div>
                <div style={{fontSize:12,color:"#6B6866"}}>Keep earning points to unlock this workout</div>
              </>}
            </div>
          )}

          {/* Video */}
          {accessible && w.video_url && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#6B6866",fontWeight:700,marginBottom:8}}>Video</div>
              <div style={{position:"relative",paddingBottom:"56.25%",background:"#000"}}>
                <iframe
                  src={w.video_url.replace("watch?v=","embed/").replace("youtu.be/","youtube.com/embed/")}
                  style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* PDF */}
          {accessible && w.pdf_url && (
            <div style={{marginBottom:16}}>
              <a href={w.pdf_url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:10,background:"#252627",border:"1px solid #333435",padding:14,color:"#FFFDF3",textDecoration:"none"}}>
                <span style={{fontSize:24}}>📄</span>
                <div><div style={{fontWeight:700,fontSize:13}}>Download Workout Plan</div><div style={{fontSize:11,color:"#6B6866",marginTop:2}}>PDF Guide</div></div>
                <span style={{marginLeft:"auto",color:"#F58020",fontSize:12,fontWeight:700}}>Open →</span>
              </a>
            </div>
          )}

          {/* Exercises */}
          {accessible && exercises.length > 0 && (
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#6B6866",fontWeight:700,marginBottom:10}}>Exercises</div>
              {exercises.map((ex, i) => (
                <div key={i} style={{background:"#252627",border:"1px solid #333435",padding:14,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#FFFDF3"}}>{ex.name}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#F58020"}}>{ex.sets}×{ex.reps}</div>
                  </div>
                  {ex.weight && <div style={{fontSize:11,color:"#6B6866"}}>Weight: {ex.weight}</div>}
                  {ex.rest && <div style={{fontSize:11,color:"#6B6866"}}>Rest: {ex.rest}</div>}
                  {ex.notes && <div style={{fontSize:11,color:"#A8A9AD",marginTop:4,fontStyle:"italic"}}>{ex.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 64px)"}}>
      {/* Header */}
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #333435",flexShrink:0}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:"#FFFDF3",marginBottom:10}}>Workout Library</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {cats.map(c=><button key={c} className={`pill${catFilter===c?" on":""}`} onClick={()=>setCatFilter(c)}>{c}</button>)}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {diffs.map(d=><button key={d} className={`pill${diffFilter===d?" on":""}`} onClick={()=>setDiffFilter(d)}>{d}</button>)}
        </div>
      </div>

      {/* Workout List */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 20px 20px"}}>
        {filtered.length === 0 && (
          <div style={{textAlign:"center",padding:"40px 0",color:"#6B6866",fontSize:13}}>
            {workouts.length === 0 ? "No workouts added yet. Check back soon!" : "No workouts match your filters."}
          </div>
        )}
        {filtered.map(w => {
          const accessible = canAccess(w);
          const cfg = ACCESS_CFG[w.access_type];
          return (
            <div key={w.id} onClick={()=>setSelected(w)} style={{background:"#252627",border:"1px solid #333435",marginBottom:10,cursor:"pointer",overflow:"hidden",transition:"border-color .2s"}}
              onTouchStart={e=>e.currentTarget.style.borderColor="rgba(245,128,32,.5)"}
              onTouchEnd={e=>e.currentTarget.style.borderColor="#333435"}>
              <div style={{display:"flex",gap:0}}>
                {/* Thumbnail */}
                <div style={{width:90,height:90,background:"#1F2020",flexShrink:0,overflow:"hidden",position:"relative"}}>
                  {w.thumbnail_url
                    ? <img src={w.thumbnail_url} alt={w.title} style={{width:"100%",height:"100%",objectFit:"cover",opacity:accessible?1:0.4}}/>
                    : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>💪</div>
                  }
                  {!accessible && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)",fontSize:20}}>🔒</div>}
                </div>
                {/* Info */}
                <div style={{flex:1,padding:"12px 14px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#FFFDF3",lineHeight:1.3,marginBottom:3}}>{w.title}</div>
                    <div style={{fontSize:11,color:"#6B6866"}}>{w.category} · {w.difficulty} · {w.duration_mins}m</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
                    <div style={{display:"flex",gap:6}}>
                      {w.video_url && <span style={{fontSize:10,color:"#6B6866"}}>📹</span>}
                      {w.pdf_url && <span style={{fontSize:10,color:"#6B6866"}}>📄</span>}
                      {Array.isArray(w.exercises)&&w.exercises.length>0 && <span style={{fontSize:10,color:"#6B6866"}}>🏋 {w.exercises.length} exercises</span>}
                    </div>
                    <div style={{background:`${cfg?.color}18`,border:`1px solid ${cfg?.color}44`,padding:"2px 8px",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:accessible?"#22C55E":cfg?.color}}>
                      {accessible?"Unlocked":w.access_type==="points"?`${w.points_cost} pts`:w.access_type==="tier"?w.tier_required:cfg?.label}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
    </div>
  );
}

// ── PROFILE TAB ───────────────────────────────────────────
function ProfileTab({ member, tiers, onLogout, onRefresh }) {
  const tier = getTier(member.points, tiers);
  const next = getNext(member.points, tiers);
  const tierPct = next ? Math.round(((member.points-tier.min)/(next.min-tier.min))*100) : 100;

  const copyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(member.referral_code||"");
    }
  };

  return (
    <div className="profile-wrap">
      <div className="profile-header">
        <div className="profile-av">{initials(member.name)}</div>
        <div>
          <div className="profile-name">{member.name}</div>
          <div className="profile-id">{member.id}</div>
          <div className="profile-tier" style={{color:tier.color}}>{tier.icon} {tier.name} Member</div>
        </div>
      </div>

      {/* Points & Tier */}
      <div className="profile-section">
        <div className="profile-section-title">Points & Tier</div>
        <div className="profile-row">
          <span className="profile-row-label">Current Balance</span>
          <span className="profile-row-value" style={{color:"#F58020",fontFamily:"'Bebas Neue',sans-serif",fontSize:22}}>{member.points.toLocaleString()} pts</span>
        </div>
        <div className="profile-row">
          <span className="profile-row-label">Current Tier</span>
          <span className="profile-row-value" style={{color:tier.color}}>{tier.icon} {tier.name}</span>
        </div>
        {next&&<div className="profile-row">
          <span className="profile-row-label">Next Tier</span>
          <span className="profile-row-value" style={{color:next.color}}>{(next.min-member.points).toLocaleString()} pts to {next.name}</span>
        </div>}
        {next&&<div style={{padding:"0 16px 14px"}}>
          <div style={{height:4,background:"#333435",marginTop:4}}>
            <div style={{height:"100%",width:`${tierPct}%`,background:`linear-gradient(90deg,#026F91,#F58020)`}}/>
          </div>
        </div>}
      </div>

      {/* Details */}
      <div className="profile-section">
        <div className="profile-section-title">My Details</div>
        <div className="profile-row"><span className="profile-row-label">Phone</span><span className="profile-row-value">{member.phone}</span></div>
        <div className="profile-row"><span className="profile-row-label">Member Since</span><span className="profile-row-value">{member.joinDate?new Date(member.joinDate).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—"}</span></div>
        <div className="profile-row"><span className="profile-row-label">Birthday</span><span className="profile-row-value">{member.birthday?new Date(member.birthday+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long"}):"Not set"}</span></div>
        <div className="profile-row"><span className="profile-row-label">Check-ins</span><span className="profile-row-value">{member.checkins}</span></div>
        <div className="profile-row"><span className="profile-row-label">Streak</span><span className="profile-row-value">🔥 {member.streak} days</span></div>
      </div>

      {/* Referral */}
      {member.referral_code && (
        <div className="ref-box">
          <div className="profile-section-title" style={{padding:0,border:"none",marginBottom:10}}>Your Referral Code</div>
          <div className="ref-code" onClick={copyCode} style={{cursor:"pointer"}}>{member.referral_code}</div>
          <div className="ref-hint">Share this code with friends. When they join URUZ and enter your code, you earn <strong style={{color:"#F58020"}}>500 points!</strong><br/>Tap the code to copy it.</div>
          <div style={{marginTop:12,fontSize:11,color:"#6B6866",textAlign:"center"}}>
            Or share this link:<br/>
            <span style={{color:"#F58020",fontWeight:700,fontSize:12}}>loyalty.uruzathletics.fit?ref={member.referral_code}</span>
          </div>
        </div>
      )}

      <button className="btn btn-ghost" onClick={onRefresh} style={{marginBottom:8}}>↻ Refresh Data</button>
      <button className="btn-signout" onClick={onLogout}>Sign Out</button>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────
const BOTTOM_TABS = [
  { id:"home",       icon:"🏠", label:"Home"       },
  { id:"workouts",   icon:"💪", label:"Workouts"   },
  { id:"challenges", icon:"⚔",  label:"Challenges" },
  { id:"loyalty",    icon:"⭐", label:"Loyalty"    },
  { id:"profile",    icon:"👤", label:"Profile"    },
];

export default function MemberCentral() {
  const [memberId,setMemberId]     = useState(null);
  const [member,setMember]         = useState(null);
  const [members,setMembers]       = useState([]);
  const [transactions,setTxns]     = useState([]);
  const [redemptions,setRdms]      = useState([]);
  const [rewards,setRewards]       = useState(DEF_REWARDS);
  const [tiers,setTiers]           = useState(DEF_TIERS);
  const [challenges,setChallenges] = useState(DEF_CHALLENGES);
  const [earnRules,setEarnRules]   = useState(HOW_TO_EARN);
  const [enrollments,setEnrollments] = useState([]);
  const [workouts,setWorkouts]         = useState([]);
  const [homeMessages,setHomeMessages] = useState(URUZ_QUOTES);
  const [tab,setTab]                 = useState("home");
  const [loaded,setLoaded]         = useState(false);
  const [toast,setToast]           = useState({msg:"",on:false});
  const [tierCelebration,setTierCelebration] = useState(null);

  const showToast = msg => { setToast({msg,on:true}); setTimeout(()=>setToast(t=>({...t,on:false})),2600); };

  const loadData = async (id) => {
    const mid = id||memberId;
    const [m,t,r,rw,ti,ds,er,wk] = await Promise.all([
      getMembers(), getTransactions(), getRedemptions(), getRewards(), getTiers(), getDisplaySettings(), getEarnRules(), getWorkouts()
    ]);
    if(wk?.length) setWorkouts(wk);
    const normalized = m.map(normalizeMember);
    setMembers(normalized); setTxns(t); setRdms(r);
    setRewards(rw.length?rw:DEF_REWARDS);
    setTiers(ti.length?ti:DEF_TIERS);
    if(er&&er.length>0) setEarnRules(er.filter(x=>x.active));
    if(ds){try{
      const cfg=JSON.parse(ds.config||"{}");
      if(cfg.challenges?.length) setChallenges(cfg.challenges.filter(c=>c.active!==false));
      if(cfg.homeMessages?.length) setHomeMessages(cfg.homeMessages);
    }catch{}}
    const found = normalized.find(x=>x.id===mid);
    setMember(found||null);
    setLoaded(true);

    // Tier upgrade check
    if(found){
      const tierKey=`uruz:tier:${found.id}`;
      const lastTier=localStorage.getItem(tierKey);
      const currentTier=[...(ti.length?ti:DEF_TIERS)].sort((a,b)=>b.min-a.min).find(t=>found.points>=t.min);
      if(currentTier&&lastTier&&lastTier!==currentTier.name) setTierCelebration(currentTier);
      if(currentTier) localStorage.setItem(tierKey,currentTier.name);
    }

    // Generate referral code if missing
    if(found&&!found.referral_code){
      const refCode="URUZ-"+found.id.slice(-5).toUpperCase();
      await upsertMember({...found,referral_code:refCode});
    }

    // Birthday bonus
    if(found&&found.birthday){
      const todayStr=new Date().toISOString().slice(5,10);
      const bday=found.birthday.slice(5,10);
      const bdayKey=`uruz:bday:${found.id}:${new Date().getFullYear()}`;
      if(todayStr===bday&&!localStorage.getItem(bdayKey)){
        const BDAY_PTS=300;
        const newPoints=found.points+BDAY_PTS;
        await upsertMember({...found,points:newPoints});
        await addTransaction({id:genId("TXN"),memberId:found.id,memberName:found.name,type:"bonus",pts:BDAY_PTS,note:"🎂 Birthday Bonus!",date:today()});
        localStorage.setItem(bdayKey,"1");
      }
    }

    // Load enrollments
    if(mid) getMemberEnrollments(mid).then(setEnrollments);
  };

  useEffect(()=>{
    const session=getSession();
    if(session?.memberId){setMemberId(session.memberId);loadData(session.memberId);}
  },[]);

  const handleLogin=(id)=>{setMemberId(id);loadData(id);};
  const handleLogout=()=>{clearSession();setMemberId(null);setMember(null);setLoaded(false);};
  const handleRequest=async(reward)=>{
    const rdm={id:genId("RDM"),memberId:member.id,memberName:member.name,reward:reward.name,pts:reward.pts,status:"pending",date:today()};
    await addRedemption(rdm);setRdms(prev=>[rdm,...prev]);
    showToast(`Requested: ${reward.name} — see the front desk`);
  };

  if(!memberId) return <LoginFlow onLogin={handleLogin}/>;
  if(!loaded||!member) return(<><style>{CSS}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1F2020"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:4,color:"#F58020"}}>LOADING…</div></div></>);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="content" key={tab}>
          {tab==="home"     && <HomeTab member={member} members={members} transactions={transactions} tiers={tiers} challenges={challenges} enrollments={enrollments} workouts={workouts} onTabChange={setTab} homeMessages={homeMessages}/>}
          {tab==="workouts"   && <WorkoutsTab member={member} tiers={tiers}/>}
          {tab==="challenges" && <ChallengesTab member={member} challenges={challenges}/>}
          {tab==="loyalty"  && <LoyaltyTab member={member} members={members} transactions={transactions} redemptions={redemptions} rewards={rewards} tiers={tiers} challenges={challenges} earnRules={earnRules} memberId={member.id} onRequest={handleRequest}/>}
          {tab==="profile"  && <ProfileTab member={member} tiers={tiers} onLogout={handleLogout} onRefresh={()=>loadData()}/>}
        </div>

        {/* Bottom Navigation */}
        <div className="bottom-nav">
          {BOTTOM_TABS.map(t=>(
            <button key={t.id} className={`nav-item${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
              <div className="nav-dot"/>
            </button>
          ))}
        </div>

        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
        {tierCelebration && <TierCelebration tier={tierCelebration} onDismiss={()=>setTierCelebration(null)}/>}
      </div>
    </>
  );
}
