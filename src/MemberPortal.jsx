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

// Premium Brand Palette
const C = {
  orange: "#F58020", cerulean: "#026F91", white: "#FFFDF3", black: "#1F2020",
  surface: "#141516", card: "#1A1B1C", border: "#2E3033", muted: "#8E8A88",
  success: "#22C55E", danger: "#EF4444",
  gold: "#D4AF37", silver: "#A8A9AD", bronze: "#CD7F32",
};

// Vector SVG Asset Engine
const ICONS = {
  home: (color = "currentColor", size = 22) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  train: (color = "currentColor", size = 22) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18.5 5.5 3 3"/><path d="m2.5 15.5 3 3"/><path d="M14 5s0-2-3-2-3 2-3 2"/><path d="M10 19s0 2 3 2 3-2 3-2"/></svg>
  ),
  compete: (color = "currentColor", size = 22) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
  ),
  rewards: (color = "currentColor", size = 22) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
  ),
  profile: (color = "currentColor", size = 22) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  streak: (color = "currentColor", size = 20) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
  ),
  checkin: (color = "currentColor", size = 20) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a6 6 0 0 1 12 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  ),
  lock: (color = "currentColor", size = 18) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  ),
  arrowRight: (color = "currentColor", size = 14) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  )
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

// Utility Helpers
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

// Modernized CSS Engine
const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body,#root{background:#141516;color:#FFFDF3;font-family:'Montserrat',sans-serif;letter-spacing:-0.1px;}

.app{
  min-height:100vh;
  background:#141516;
  color:#FFFDF3;
  max-width:520px;
  margin:0 auto;
  padding-bottom:96px;
  position:relative;
  box-shadow: 0 0 40px rgba(0,0,0,0.6);
}

.topbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 24px;
  background:rgba(20,21,22,0.85);
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  position:sticky;top:0;z-index:100;
  border-bottom:1px solid #2E3033;
}
.topbar-logo{height:30px;width:auto;}

/* Floating Premium Glass Menu Bar */
.bottom-nav{
  position:fixed;bottom:16px;left:50%;
  transform:translateX(-50%);
  width:calc(100% - 24px);max-width:496px;
  background:rgba(26,27,28,0.92);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,0.06);
  border-radius:16px;
  display:flex;z-index:200;
  height:68px;
  box-shadow:0 12px 32px rgba(0,0,0,0.5);
}
.nav-item{
  flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  gap:2px;background:none;border:none;
  cursor:pointer;transition:all .2s cubic-bezier(0.4, 0, 0.2, 1);
  color:#7E7A77;font-family:'Montserrat',sans-serif;
}
.nav-item.active{color:#F58020;transform:translateY(-2px);}
.nav-icon{font-size:22px;line-height:1;transition: transform .2s;}
.nav-item.active .nav-icon {transform: scale(1.05);}
.nav-label{font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-top:2px;}

.content{padding:0;animation:up .4s cubic-bezier(0.16, 1, 0.3, 1) both;}
@keyframes up{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}

/* Dashboard Architecture */
.home-hero{
  background: radial-gradient(circle at top right, rgba(245,128,32,0.12) 0%, rgba(20,21,22,1) 80%);
  padding:32px 24px 24px;
  position:relative;overflow:hidden;
  border-bottom:1px solid #2E3033;
}
.hero-name{
  font-family:'Bebas Neue',sans-serif;
  font-size:38px;letter-spacing:1px;
  line-height:0.9;color:#FFFDF3;
  margin-bottom:6px;
}
.hero-sub{font-size:12px;color:#8E8A88;font-weight:500;}
.hero-pts{
  font-family:'Bebas Neue',sans-serif;
  font-size:64px;line-height:0.9;
  color:#F58020;letter-spacing:-1px;
  margin:20px 0 2px;
}
.hero-pts-lbl{
  font-size:10px;letter-spacing:4px;
  text-transform:uppercase;color:#8E8A88;
  font-weight:700;margin-bottom:16px;
}
.tier-badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:6px 14px;border-radius:4px;
  font-family:'Montserrat',sans-serif;
  font-size:11px;font-weight:800;
  letter-spacing:2px;text-transform:uppercase;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}
.prog-bar-wrap{margin-top:20px;}
.prog-labels{display:flex;justify-content:space-between;font-size:11px;color:#8E8A88;margin-bottom:8px;font-weight:600;}
.prog-track{height:4px;background:#2E3033;border-radius:2px;overflow:hidden;}
.prog-fill{height:100%;border-radius:2px;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);}

.stats-row{
  display:grid;grid-template-columns:repeat(3,1fr);
  background:#1A1B1C;
  border-bottom:1px solid #2E3033;
}
.stat-cell{padding:16px 8px;text-align:center;border-right:1px solid #2E3033;}
.stat-cell:last-child{border-right:none;}
.stat-num{font-family:'Bebas Neue',sans-serif;font-size:28px;line-height:1;color:#FFFDF3;}
.stat-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8E8A88;margin-top:4px;font-weight:700;}

.home-section{padding:24px 24px 0;}
.sec-label{
  font-size:10px;font-weight:800;letter-spacing:3px;
  text-transform:uppercase;color:#8E8A88;
  margin-bottom:14px;display:flex;align-items:center;gap:12px;
}
.sec-label::after{content:'';flex:1;height:1px;background:#2E3033;}

.interactive-card{
  background:#1A1B1C;border:1px solid #2E3033;
  border-radius:12px;padding:18px;margin-bottom:12px;
  transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.interactive-card:active{transform:scale(0.98);background:#202123;}

.act-row{display:flex;align-items:center;padding:14px 0;border-bottom:1px solid #2E3033;gap:14px;}
.act-row:last-child{border-bottom:none;}
.act-icon{width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.act-label{font-size:13px;font-weight:600;color:#FFFDF3;}
.act-date{font-size:11px;color:#8E8A88;margin-top:2px;}
.act-pts{font-family:'Bebas Neue',sans-serif;font-size:20px;margin-left:auto;}

.loyalty-tabs{
  display:flex;border-bottom:1px solid #2E3033;
  background:#141516;overflow-x:auto;scrollbar-width:none;
}
.loyalty-tabs::-webkit-scrollbar{display:none;}
.ltab{
  flex:1;min-width:90px;padding:16px 4px;background:none;border:none;
  color:#8E8A88;font-family:'Montserrat',sans-serif;
  font-size:10px;font-weight:800;letter-spacing:1.5px;
  text-transform:uppercase;cursor:pointer;
  position:relative;text-align:center;transition:color .2s;
}
.ltab.on{color:#F58020;}
.ltab.on::after{content:'';position:absolute;bottom:0;left:16px;right:16px;height:3px;background:#F58020;border-radius:3px 3px 0 0;}

/* E-Commerce Rewards Grid */
.rewards-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding-bottom:24px;}
.rwd-card{background:#1A1B1C;border:1px solid #2E3033;border-radius:12px;padding:16px;position:relative;display:flex;flex-direction:column;justify-content:between;}
.rwd-card.oos{opacity:.35;}
.rwd-icon-wrap{font-size:24px;margin-bottom:12px;color:#F58020;}
.rwd-cat{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8E8A88;margin-bottom:4px;font-weight:700;}
.rwd-name{font-size:13px;font-weight:700;color:#FFFDF3;line-height:1.4;margin-bottom:14px;min-height:36px;}
.rwd-footer{display:flex;align-items:center;justify-content:space-between;margin-top:auto;}
.rwd-cost{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#F58020;}
.rdm-btn{padding:8px 14px;border-radius:6px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:all 0.15s;}
.rdm-btn:disabled{background:#2E3033;color:#8E8A88;cursor:not-allowed;}
.rdm-btn.pending-btn{background:#026F91;}
.oos-tag{position:absolute;top:12px;right:12px;font-size:8px;letter-spacing:1px;text-transform:uppercase;background:#2E3033;color:#8E8A88;padding:2px 6px;font-weight:700;border-radius:4px;}

/* Challenges Interface */
.ch-card{background:#1A1B1C;border:1px solid #2E3033;border-radius:12px;padding:18px;margin-bottom:12px;}
.ch-top{display:flex;align-items:center;gap:14px;margin-bottom:14px;}
.ch-icon-w{width:42px;height:42px;border-radius:10px;background:rgba(245,128,32,.08);border:1px solid rgba(245,128,32,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ch-name{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#FFFDF3;line-height:1;letter-spacing:0.5px;}
.ch-desc{font-size:12px;color:#8E8A88;margin-top:2px;}
.ch-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.ch-dl{font-size:11px;color:#8E8A88;font-weight:600;display:flex;align-items:center;gap:4px;}
.ch-rew{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#F58020;}

/* Leaderboards */
.lb-row{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #2E3033;gap:14px;background:#1A1B1C;}
.lb-row.me{background:rgba(245,128,32,.05);border-left:3px solid #F58020;}
.lb-rank{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#8E8A88;width:24px;text-align:center;}
.lb-rank.top{color:#D4AF37;}
.lb-av{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:#2E3033;color:#FFFDF3;}

.pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;}
.pill{padding:6px 14px;border-radius:20px;border:1px solid #2E3033;background:none;color:#8E8A88;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.pill.on{border-color:#F58020;color:#F58020;background:rgba(245,128,32,.06);}

/* Verification Framework */
.screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:#141516;}
.box{width:100%;max-width:400px;background:#1A1B1C;border:1px solid #2E3033;border-radius:16px;padding:40px 32px;box-shadow:0 20px 40px rgba(0,0,0,0.4);}
.inp{width:100%;padding:14px 16px;background:#141516;border:1px solid #2E3033;border-radius:8px;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:15px;outline:none;transition:all .15s;margin-bottom:16px;}
.inp:focus{border-color:#F58020;box-shadow:0 0 0 1px #F58020;}

.btn{width:100%;padding:16px;border-radius:8px;border:none;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.btn-primary{background:#F58020;color:#fff;}
.btn-primary:active{transform:scale(0.99);background:#E0731B;}
.btn-ghost{background:none;border:1px solid #2E3033;color:#8E8A88;}

.toast{position:fixed;bottom:96px;left:50%;transform:translateX(-50%) translateY(12px);background:#F58020;color:#fff;padding:12px 28px;border-radius:30px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;z-index:1000;opacity:0;transition:all .3s cubic-bezier(0.16, 1, 0.3, 1);pointer-events:none;box-shadow:0 8px 24px rgba(245,128,32,0.4);}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}
`;

// ── CELEBRATION SHIELD ───────────────────────────────────
function TierCelebration({ tier, onDismiss }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,11,12,0.96)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",padding:32,animation:"fadein .4s ease"}}>
      <style>{`@keyframes fadein{from{opacity:0;}to{opacity:1;}}`}</style>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:96,color:tier.color,lineHeight:1,textAlign:"center",marginBottom:8}}>{tier.icon}</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:6,color:C.muted,textAlign:"center",marginBottom:4,textTransform:"uppercase"}}>Level Unlocked</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:64,letterSpacing:2,color:tier.color,lineHeight:1,textAlign:"center"}}>{tier.name}</div>
      <div style={{fontSize:14,color:C.white,textAlign:"center",margin:"24px 0",fontWeight:500,lineHeight:1.6,maxWidth:290}}>Your dedication paid off. Keep raising the bar — every singular rep counts.</div>
      <button onClick={onDismiss} className="btn btn-primary" style={{width:"auto",padding:"14px 48px",borderRadius:30}}>Collect Reward 💪</button>
    </div>
  );
}

// ── SECURITY SYSTEM FIELD ────────────────────────────────
function PinInput({ value, onChange, label }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  const handle = k => { if(k==="⌫") onChange(value.slice(0,-1)); else if(k==="") return; else if(value.length<4) onChange(value+k); };
  return (
    <div>
      {label && <div className="step-sub" style={{color:C.muted,fontSize:12,textAlign:"center",marginBottom:24}}>{label}</div>}
      <div className="pin-row" style={{display:"flex",gap:14,justifyContent:"center",marginBottom:32}}>
        {[0,1,2,3].map(i=><div key={i} className={`pin-digit${value[i]?" filled":""}${value.length===i?" active":""}`} style={{width:56,height:68,background:C.black,border:`1px solid ${value.length===i?C.orange:C.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:C.orange}}>{value[i]?"●":""}</div>)}
      </div>
      <div className="pin-pad" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,maxWidth:320,margin:"0 auto"}}>
        {keys.map((k,i)=><div key={i} className={`pin-key${k==="⌫"?" del":""}${k===""?" empty":""}`} style={{padding:18,background:k?C.black:"transparent",border:k?`1px solid ${C.border}`:"transparent",borderRadius:8,color:C.white,fontSize:20,fontWeight:700,cursor:k?"pointer":"default",textAlign:"center",userSelect:"none"}} onClick={()=>handle(k)}>{k}</div>)}
      </div>
    </div>
  );
}

// ── PWA CONTEXT DISPATCHER ───────────────────────────────
function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [deferredPrompt, setDP] = useState(null);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone || localStorage.getItem("uruz:install-dismissed")) return;

    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault(); setDP(e); setPlatform("android"); setTimeout(()=>setShow(true), 2000);
    });
    if (isIOS) { setPlatform("ios"); setTimeout(()=>setShow(true), 2000); }
  }, []);

  const dismiss = () => { localStorage.setItem("uruz:install-dismissed","1"); setShow(false); };

  if (!show) return null;

  return (
    <div style={{position:"fixed",top:16,left:12,right:12,background:"rgba(26,27,28,0.95)",backdropFilter:"blur(12px)",border:`1px solid ${C.border}`,borderRadius:12,padding:16,zIndex:1000,display:"flex",alignItems:"center",gap:14,boxShadow:"0 16px 32px rgba(0,0,0,0.5)"}}>
      <img src={LOGO_URL} alt="URUZ" style={{height:32,width:"auto"}}/>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:C.orange}}>Add to Home Screen</div>
        <div style={{fontSize:11,color:C.muted,lineHeight:1.4,marginTop:2}}>
          {platform==="ios" ? 'Tap Share ⎙ then "Add to Home Screen"' : "Install Member Central for quick access."}
        </div>
      </div>
      {platform==="android" && <button onClick={async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;dismiss();}} className="rdm-btn" style={{padding:"6px 12px"}}>Install</button>}
      <button onClick={dismiss} style={{background:"none",border:"none",color:C.muted,fontSize:16,cursor:"pointer"}}>✕</button>
    </div>
  );
}

// ── LOGICAL SYSTEM ENTRANCE FLOW ─────────────────────────
function LoginFlow({ onLogin }) {
  const [stage,setStage] = useState("phone");
  const [phone,setPhone] = useState("");
  const [member,setMember] = useState(null);
  const [pin,setPin] = useState("");
  const [pin2,setPin2] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [regName,setRegName] = useState("");
  const [regPhone,setRegPhone] = useState("");
  const [regBirthday,setRegBirthday] = useState("");
  const [regRefCode,setRegRefCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setRegRefCode(ref.toUpperCase());
  }, []);

  const handlePhone = async () => {
    if(!phone.trim()) return;
    setError(""); setLoading(true);
    const m = await getMemberByPhone(phone);
    setLoading(false);
    if (!m) { setError("No active member found. Register below or visit the front desk."); return; }
    setMember(normalizeMember(m));
    setStage(m.pin ? "pin" : "setpin");
  };

  const handlePin = async () => {
    if (pin !== member.pin) { setError("Incorrect security PIN verification."); setPin(""); return; }
    saveSession({ memberId: member.id });
    onLogin(member.id);
  };

  useEffect(() => { if(stage==="pin" && pin.length===4) handlePin(); }, [pin]);

  const handleSetPin = () => { if(pin.length<4){setError("PIN must be 4 digits.");return;} setError("");setStage("confirmpin"); };

  const handleConfirmPin = async () => {
    if(pin2!==pin){setError("PIN choices matching error."); setPin2(""); return;}
    await updateMemberPin(member.id, pin);
    saveSession({ memberId: member.id });
    onLogin(member.id);
  };

  useEffect(() => { if(stage==="confirmpin" && pin2.length===4) handleConfirmPin(); }, [pin2]);

  return (
    <>
      <style>{CSS}</style>
      <InstallPrompt/>
      <div className="screen">
        <div className="box">
          <div style={{textAlign:"center",marginBottom:32}}>
            <img src={LOGO_URL} alt="URUZ" style={{height:48,width:"auto",display:"block",margin:"0 auto 8px"}}/>
            <div className="brand-sub" style={{fontSize:10,letterSpacing:3,color:C.muted,fontWeight:700}}>Member Central</div>
          </div>
          
          {stage==="phone"&&(
            <div>
              <div className="step-title" style={{fontSize:24,textAlign:"center",marginBottom:20}}>Welcome Back</div>
              <input className="inp" placeholder="Phone Number" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handlePhone()}/>
              {error&&<div className="err" style={{color:C.danger,fontSize:12,textAlign:"center",marginBottom:12}}>{error}</div>}
              <button className="btn btn-primary" onClick={handlePhone} disabled={loading}>{loading?"Loading...":"Sign In"}</button>
              <div className="hint" style={{textAlign:"center",fontSize:12,color:C.muted,marginTop:16}}>Not registered? <span className="link" style={{color:C.orange,fontWeight:700,cursor:"pointer"}} onClick={()=>setStage("register")}>Create Account</span></div>
            </div>
          )}
          
          {stage==="pin" && <PinInput value={pin} onChange={setPin} label={`Verification for ${member?.name}`}/>}
          {stage==="setpin" && <div><PinInput value={pin} onChange={setPin} label="Establish a secure 4-digit mobile PIN"/><button className="btn btn-primary" style={{marginTop:16}} onClick={handleSetPin}>Confirm Code</button></div>}
          {stage==="confirmpin" && <PinInput value={pin2} onChange={setPin2} label="Re-enter PIN for device verification"/>}
          
          {stage==="register"&&(
            <div>
              <div className="step-title" style={{fontSize:22,textAlign:"center",marginBottom:16}}>Join URUZ Athletics</div>
              <input className="inp" placeholder="Full Name" value={regName} onChange={e=>setRegName(e.target.value)}/>
              <input className="inp" placeholder="Phone Number" value={regPhone} onChange={e=>setRegPhone(e.target.value)}/>
              <input className="inp" type="date" value={regBirthday} onChange={e=>setRegBirthday(e.target.value)}/>
              <input className="inp" placeholder="Referral Code (Optional)" value={regRefCode} onChange={e=>setRegRefCode(e.target.value.toUpperCase())}/>
              <button className="btn btn-primary" onClick={async()=>{
                if(!regName.trim()||!regPhone.trim()){setError("Required parameters missing.");return;}
                const ext = await getMemberByPhone(regPhone);
                if(ext){setError("Device number already synchronized.");return;}
                const newId = genId("URZ"); const ref = "URUZ-"+newId.slice(-5).toUpperCase();
                const nm = { id:newId, name:regName.trim(), phone:regPhone.trim(), email:"", joinDate:today(), points:0, checkins:0, streak:0, status:"active", pin:null, birthday:regBirthday||null, referral_code:ref };
                await upsertMember(nm); setMember(nm); setStage("setpin");
              }}>Register</button>
              <button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>setStage("phone")}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── CORE DASHBOARD MODULE ────────────────────────────────
function HomeTab({ member, members, transactions, tiers, challenges, enrollments, onTabChange }) {
  const tier = getTier(member.points, tiers);
  const next = getNext(member.points, tiers);
  const tierPct = next ? Math.round(((member.points-tier.min)/(next.min-tier.min))*100) : 100;
  const rank = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===member.id)+1;
  const activeEnr = enrollments.filter(e=>e.memberId===member.id && !e.completed);
  
  return (
    <div>
      <div className="home-hero">
        <div className="hero-name">Welcome Back, {member.name.split(" ")[0]}</div>
        <div className="hero-sub">{tier.icon} {tier.name} Division Profile</div>
        <div className="hero-pts">{member.points.toLocaleString()}</div>
        <div className="hero-pts-lbl">Current Metric Score</div>
        <span className="tier-badge" style={{color:tier.color, background:`${tier.color}15`, border:`1px solid ${tier.color}`}}>{tier.icon} {tier.name} Status</span>
        
        {next && (
          <div className="prog-bar-wrap">
            <div className="prog-labels">
              <span>{tier.name}</span>
              <span>{(next.min-member.points).toLocaleString()} PTS to {next.name}</span>
            </div>
            <div className="prog-track">
              <div className="prog-fill" style={{width:`${tierPct}%`, background:`linear-gradient(90deg, ${C.cerulean}, ${C.orange})`}}/>
            </div>
          </div>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-cell"><div className="stat-num" style={{color:C.orange}}>{rank}</div><div className="stat-lbl">Club Rank</div></div>
        <div className="stat-cell">
          <div className="stat-num" style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {ICONS.streak(C.orange)} {member.streak}d
          </div>
          <div className="stat-lbl">Attendance Streak</div>
        </div>
        <div className="stat-cell"><div className="stat-num">{member.checkins}</div><div className="stat-lbl">Workouts Logged</div></div>
      </div>

      <div className="home-section">
        <div className="sec-label">Performance Core Links</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10}}>
          {[
            {icon: ICONS.checkin(C.cerulean, 24), label:"Check In", action:()=>window.open("/checkin","_blank"), color: C.cerulean},
            {icon: ICONS.rewards(C.orange, 24), label:"Redeem", action:()=>onTabChange("loyalty"), color: C.orange},
            {icon: ICONS.compete(C.gold, 24), label:"Rankings", action:()=>onTabChange("challenges"), color: C.gold},
          ].map((a,i)=>(
            <button key={i} onClick={a.action} style={{
              background:`${a.color}10`, border:`1px solid ${a.color}33`,
              borderRadius: "8px", padding:"14px 8px", display:"flex", flexDirection:"column",
              alignItems:"center", gap:8, cursor:"pointer", transition:"all .15s",
              fontFamily:"'Montserrat',sans-serif",
            }}>
              {a.icon}
              <span style={{fontSize:10, fontWeight:800, letterSpacing:0.5, textTransform:"uppercase", color: a.color}}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeEnr.length > 0 && (
        <div className="home-section">
          <div className="sec-label">Synchronized Objectives</div>
          {activeEnr.slice(0,1).map(e => {
            const ch = challenges.find(c=>String(c.id)===e.challengeId) || {};
            return (
              <div key={e.id} className="interactive-card" onClick={()=>onTabChange("challenges")} style={{cursor:"pointer", borderLeft:`3px solid ${C.orange}`, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{ch.name}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ch.desc}</div>
                </div>
                {ICONS.arrowRight(C.orange)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── REWARDS MARKETPLACE MODULE ───────────────────────────
function LoyaltyTab({ member, redemptions, rewards, onRequest }) {
  const [filter, setFilter] = useState("All");
  const cats = ["All", "Access", "Merch", "Training"];
  const rewardList = filter==="All" ? rewards : rewards.filter(r=>r.cat===filter);
  const pending = redemptions.filter(r=>r.memberId===member.id && r.status==="pending");

  return (
    <div style={{padding:"24px"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:2,color:C.muted}}>Spendable Volume</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,color:C.orange}}>{member.points.toLocaleString()} <span style={{fontSize:16,color:C.white}}>Points</span></div>
      </div>

      {pending.length > 0 && (
        <div style={{background:`rgba(2,111,145,0.06)`, border:`1px solid ${C.cerulean}44`, borderRadius:12, padding:16, marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",color:C.cerulean,marginBottom:6, display:"flex", alignItems:"center", gap:6}}>
            {ICONS.lock(C.cerulean, 14)} Pending Counter Verification
          </div>
          {pending.map(p=><div key={p.id} style={{fontSize:12,color:C.white,marginTop:4}}>• {p.reward} (Present to staff)</div>)}
        </div>
      )}

      <div className="pills">{cats.map(c=><button key={c} className={`pill${filter===c?" on":""}`} onClick={()=>setFilter(c)}>{c}</button>)}</div>
      
      <div className="rewards-grid">
        {rewardList.map(r => {
          const isPending = pending.some(p=>p.reward===r.name);
          return (
            <div key={r.id} className={`rwd-card${!r.stock?" oos":""}`}>
              {!r.stock && <span className="oos-tag">Out of stock</span>}
              <div className="rwd-icon-wrap">{ICONS.rewards(C.orange, 24)}</div>
              <div className="rwd-cat">{r.cat}</div>
              <div className="rwd-name">{r.name}</div>
              <div className="rwd-footer">
                <div className="rwd-cost">{r.pts}</div>
                <button className="rdm-btn" disabled={member.points < r.pts || isPending || !r.stock} onClick={()=>onRequest(r)}>
                  {isPending ? "Pending" : "Claim"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TRAINING SUITE MODULE ────────────────────────────────
function WorkoutsTab({ member, tiers }) {
  const [workouts, setWorkouts] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => { getWorkouts().then(setWorkouts); }, []);

  if (selected) {
    return (
      <div style={{padding:24}}>
        <button onClick={()=>setSelected(null)} className="btn btn-ghost" style={{width:"auto",padding:"8px 16px",marginBottom:20}}>← Library</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:C.white}}>{selected.title}</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{selected.category} · {selected.difficulty}</div>
        {selected.description && <p style={{fontSize:13,color:C.white,lineHeight:1.6}}>{selected.description}</p>}
        {selected.video_url && (
          <div style={{marginTop:20, position:"relative", paddingBottom:"56.25%", height:0, overflow:"hidden", borderRadius:8, background:"#000"}}>
            <iframe src={selected.video_url.replace("watch?v=","embed/")} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}} allowFullScreen/>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{padding:24}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:1,marginBottom:16}}>Athletics Library</div>
      {workouts.map(w => (
        <div key={w.id} className="interactive-card" style={{cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between"}} onClick={()=>setSelected(w)}>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>{w.title}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{w.category} · {w.difficulty} · {w.duration_mins} min</div>
          </div>
          {ICONS.arrowRight(C.muted)}
        </div>
      ))}
    </div>
  );
}

// ── COMPETITION & RANKINGS CORE ──────────────────────────
function ChallengesTab({ member, challenges, members }) {
  const sorted = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,5);

  return (
    <div style={{padding:24}}>
      <div className="sec-label">Active Matrix Events</div>
      {challenges.slice(0,3).map(c => (
        <div key={c.id} className="ch-card">
          <div className="ch-top">
            <div className="ch-icon-w" style={{color:C.orange}}>{ICONS.compete(C.orange, 18)}</div>
            <div>
              <div className="ch-name">{c.name}</div>
              <div className="ch-desc">{c.desc}</div>
            </div>
          </div>
          <div className="ch-meta">
            <span className="ch-dl">{ICONS.lock(C.muted, 12)} {c.deadline}</span>
            <span className="ch-rew">+{c.pts} PTS</span>
          </div>
        </div>
      ))}

      <div className="sec-label" style={{marginTop:32}}>Top Ranked Competitors</div>
      {sorted.map((m, i) => (
        <div key={m.id} className={`lb-row${m.id===member.id?" me":""}`} style={{borderRadius:8,marginBottom:6}}>
          <div className="lb-rank">{i+1}</div>
          <div className="lb-av">{initials(m.name)}</div>
          <div style={{flex:1,fontSize:13,fontWeight:600}}>{m.name}</div>
          <div className="lb-pts" style={{fontSize:16,color:C.orange}}>{m.points.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

// ── PROFILE SUITE MODULE ─────────────────────────────────
function ProfileTab({ member, tiers, onLogout }) {
  return (
    <div style={{padding:24}}>
      <div className="interactive-card" style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
        <div style={{width:48,height:48,borderRadius:8,background:`${C.orange}15`,border:`1px solid ${C.orange}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.orange}}>{initials(member.name)}</div>
        <div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:C.white}}>{member.name}</div>
          <div style={{fontSize:11,color:C.muted}}>{member.phone}</div>
        </div>
      </div>

      {member.referral_code && (
        <div className="interactive-card" style={{border:`1px dashed ${C.orange}66`,textAlign:"center"}}>
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>Your Ambassador Asset Link</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.orange,letterSpacing:2,margin:"8px 0"}}>{member.referral_code}</div>
          <div style={{fontSize:11,color:C.muted}}>Earn 500 Points per validated member onboarding event.</div>
        </div>
      )}

      <button className="btn btn-ghost" style={{borderColor:C.danger,color:C.danger,marginTop:24}} onClick={onLogout}>Disconnect Session</button>
    </div>
  );
}

// ── PRIMARY RUNTIME WRAPPER ──────────────────────────────
const BOTTOM_TABS = [
  { id: "home",       icon: (active) => ICONS.home(active ? C.orange : "#7E7A77"),       label: "Home" },
  { id: "workouts",   icon: (active) => ICONS.train(active ? C.orange : "#7E7A77"),      label: "Train" },
  { id: "challenges", icon: (active) => ICONS.compete(active ? C.orange : "#7E7A77"),    label: "Compete" },
  { id: "loyalty",    icon: (active) => ICONS.rewards(active ? C.orange : "#7E7A77"),    label: "Rewards" },
  { id: "profile",    icon: (active) => ICONS.profile(active ? C.orange : "#7E7A77"),    label: "Profile" },
];

export default function MemberCentral() {
  const [memberId, setMemberId] = useState(null);
  const [member, setMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [transactions, setTxns] = useState([]);
  const [redemptions, setRdms] = useState([]);
  const [rewards, setRewards] = useState(DEF_REWARDS);
  const [tiers, setTiers] = useState(DEF_TIERS);
  const [challenges, setChallenges] = useState(DEF_CHALLENGES);
  const [enrollments, setEnrollments] = useState([]);
  const [tab, setTab] = useState("home");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState({msg:"",on:false});
  const [tierCelebration, setTierCelebration] = useState(null);

  const showToast = msg => { setToast({msg,on:true}); setTimeout(()=>setToast({msg:"",on:false}),2600); };

  const loadData = async (id) => {
    const mid = id || memberId;
    const [m, t, r, rw, ti, ds] = await Promise.all([
      getMembers(), getTransactions(), getRedemptions(), getRewards(), getTiers(), getDisplaySettings()
    ]);
    const normalized = m.map(normalizeMember);
    setMembers(normalized); setTxns(t); setRdms(r);
    setRewards(rw.length ? rw : DEF_REWARDS);
    setTiers(ti.length ? ti : DEF_TIERS);
    
    if(ds){
      try {
        const cfg = JSON.parse(ds.config || "{}");
        if(cfg.challenges?.length) setChallenges(cfg.challenges.filter(c=>c.active!==false));
      } catch {}
    }
    const found = normalized.find(x => x.id === mid);
    setMember(found || null);
    setLoaded(true);

    if (mid) getMemberEnrollments(mid).then(setEnrollments);
  };

  useEffect(() => {
    const session = getSession();
    if (session?.memberId) { setMemberId(session.memberId); loadData(session.memberId); }
  }, []);

  const handleLogin = (id) => { setMemberId(id); loadData(id); };
  const handleLogout = () => { clearSession(); setMemberId(null); setMember(null); setLoaded(false); };
  
  const handleRequest = async (reward) => {
    const rdm = { id: genId("RDM"), memberId: member.id, memberName: member.name, reward: reward.name, pts: reward.pts, status: "pending", date: today() };
    await addRedemption(rdm); setRdms(prev => [rdm, ...prev]);
    showToast("Verification Token Generated");
  };

  if (!memberId) return <LoginFlow onLogin={handleLogin}/>;
  if (!loaded || !member) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#141516"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:4,color:C.orange}}>INITIALIZING NODE…</div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="topbar">
          <img src={LOGO_URL} alt="URUZ" className="topbar-logo"/>
          <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:C.orange}}>{member.points.toLocaleString()} PTS</div>
        </div>

        <div className="content" key={tab}>
          {tab==="home" && <HomeTab member={member} members={members} transactions={transactions} tiers={tiers} challenges={challenges} enrollments={enrollments} onTabChange={setTab}/>}
          {tab==="workouts" && <WorkoutsTab member={member} tiers={tiers}/>}
          {tab==="challenges" && <ChallengesTab member={member} challenges={challenges} members={members}/>}
          {tab==="loyalty" && <LoyaltyTab member={member} redemptions={redemptions} rewards={rewards} onRequest={handleRequest}/>}
          {tab==="profile" && <ProfileTab member={member} tiers={tiers} onLogout={handleLogout}/>}
        </div>

        <div className="bottom-nav">
          {BOTTOM_TABS.map(t => {
            const isActive = tab === t.id;
            return (
              <button key={t.id} className={`nav-item${isActive ? " active" : ""}`} onClick={() => setTab(t.id)}>
                <span className="nav-icon">{t.icon(isActive)}</span>
                <span className="nav-label">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className={`toast${toast.on ? " on" : ""}`}>✓ {toast.msg}</div>
        {tierCelebration && <TierCelebration tier={tierCelebration} onDismiss={() => setTierCelebration(null)}/>}
        <InstallPrompt/>
      </div>
    </>
  );
}
