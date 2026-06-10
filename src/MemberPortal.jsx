import { useState, useEffect, useRef } from "react";
import {
  getMembers, getMemberByPhone, getMemberById, upsertMember,
  updateMemberPin, getTransactions, addTransaction,
  getRedemptions, addRedemption, getRewards, getTiers,
  getMemberEnrollments, enrollInChallenge, getDisplaySettings,
  getEarnRules, addReferral, getMemberByReferralCode,
  getWorkouts, getMemberUnlocks, unlockWorkout,
  getWorkoutLogs, saveWorkoutLog, getPrograms,
  getMemberProgramsByMember
} from "./supabase";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@200;300;400;500;600;700;800&display=swap');`;

const C = {
  orange:"#F58020", white:"#FFFDF3", black:"#0A0A0A",
  s1:"#111111", s2:"#161616", s3:"#1C1C1C",
  border:"#222222", border2:"#1A1A1A",
  muted:"#4A4845", muted2:"#333130",
  text:"#C8C4BE", text2:"#6A6764",
  gold:"#C9A84C", silver:"#888888",
  success:"#2D9B5A", danger:"#8B3A3A",
};

const DEF_TIERS = [
  { id:"t1", name:"Iron",   min:0,     color:"#555",    icon:"◆" },
  { id:"t2", name:"Bronze", min:1000,  color:"#8B6534", icon:"◆" },
  { id:"t3", name:"Silver", min:2500,  color:"#888",    icon:"◆" },
  { id:"t4", name:"Gold",   min:5000,  color:"#C9A84C", icon:"◆" },
  { id:"t5", name:"Elite",  min:10000, color:"#F58020", icon:"◆" },
];
const DEF_REWARDS = [
  { id:"RWD-001", name:"Guest Day Pass",         pts:300,  cat:"Access",   stock:true  },
  { id:"RWD-002", name:"URUZ Shaker Bottle",     pts:500,  cat:"Merch",    stock:true  },
  { id:"RWD-003", name:"1-Month Locker Rental",  pts:750,  cat:"Access",   stock:true  },
  { id:"RWD-004", name:"URUZ Premium Tee",       pts:900,  cat:"Merch",    stock:true  },
  { id:"RWD-005", name:"Free Personal Training", pts:1500, cat:"Training", stock:true  },
  { id:"RWD-006", name:"1-Month Membership",     pts:3000, cat:"Access",   stock:true  },
  { id:"RWD-007", name:"URUZ Hoodie",            pts:1200, cat:"Merch",    stock:false },
  { id:"RWD-008", name:"Nutrition Consult",      pts:800,  cat:"Training", stock:true  },
];
const HOW_TO_EARN = [
  { icon:"CI", action:"Daily Check-in",            pts:50,   note:"Scan QR at entrance" },
  { icon:"CL", action:"Group Class Attendance",     pts:75,   note:"Per class" },
  { icon:"PT", action:"Personal Training Session",  pts:100,  note:"Per session" },
  { icon:"RF", action:"Refer a Friend",             pts:500,  note:"When they join" },
  { icon:"PU", action:"In-Gym Purchase",            pts:"3%", note:"Of spend" },
  { icon:"S7", action:"7-Day Streak Bonus",         pts:100,  note:"Auto-awarded" },
  { icon:"S30",action:"30-Day Streak Bonus",        pts:400,  note:"Auto-awarded" },
  { icon:"BD", action:"Birthday Bonus",             pts:300,  note:"Once a year" },
];
const DEF_CHALLENGES = [
  { id:1, name:"Weekly Warrior",  desc:"Check in 5× this week",          pts:150,  goal:5,  deadline:"3 days",  active:true },
  { id:2, name:"Early Bird",      desc:"Attend 3 AM classes this month", pts:200,  goal:3,  deadline:"12 days", active:true },
  { id:3, name:"Bring the Crew",  desc:"Refer 2 new members",            pts:1000, goal:2,  deadline:"24 days", active:true },
  { id:4, name:"Iron Will",       desc:"15-day consecutive streak",      pts:300,  goal:15, deadline:"4 days",  active:true },
];
const URUZ_QUOTES = [
  "Every rep is a deposit into your future self.",
  "Show up. Put in the work. The results follow.",
  "Strength isn't given — it's built, session by session.",
  "Your only competition is who you were yesterday.",
  "The gym doesn't care about your excuses. Neither should you.",
  "Built different. Trained harder.",
  "One more set. Always one more set.",
];

function getSession() { try { const v=localStorage.getItem("uruz:session"); return v?JSON.parse(v):null; } catch { return null; } }
function saveSession(d) { try { localStorage.setItem("uruz:session",JSON.stringify(d)); } catch {} }
function clearSession() { try { localStorage.removeItem("uruz:session"); } catch {} }
function normalizeMember(m) {
  return {
    id:m.id, name:m.name||"", phone:m.phone||"", email:m.email||"",
    joinDate:m.join_date||m.joinDate||new Date().toISOString().slice(0,10),
    points:m.points??0, checkins:m.checkins??0, streak:m.streak??0,
    status:m.status||"active", pin:m.pin||null,
    lastCheckin:m.last_checkin||m.lastCheckin||null,
    birthday:m.birthday||null, referral_code:m.referral_code||null,
  };
}
function getTier(pts,tiers){return [...tiers].sort((a,b)=>b.min-a.min).find(t=>pts>=t.min)||tiers[0];}
function getNext(pts,tiers){const s=[...tiers].sort((a,b)=>a.min-b.min);const cur=s.filter(t=>pts>=t.min).pop();const i=s.indexOf(cur);return i<s.length-1?s[i+1]:null;}
function genId(p){return `${p}-${Math.floor(10000+Math.random()*90000)}`;}
function today(){return new Date().toISOString().slice(0,10);}
function fmtDate(d){try{return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"});}catch{return d;}}
function initials(n){return(n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();}
const LOGO_URL="https://raw.githubusercontent.com/nidokalash-boop/uruz-loyalty/main/URUZ%20LOGO%2001-10%20(1).png";


// ── SHARED ICON SYSTEM ────────────────────────────────────
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
  const icon = ICON_MAP[id] || ICON_MAP.star;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {icon.paths && icon.paths.map((p,i) => <path key={i} d={p}/>)}
      {icon.circles && icon.circles.map((c,i) => <circle key={i} cx={c.cx} cy={c.cy} r={c.r}/>)}
      {icon.rects && icon.rects.map((r,i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.r||0}/>)}
      {icon.lines && icon.lines.map((l,i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={l.sw||strokeWidth}/>)}
      {icon.polygons && icon.polygons.map((p,i) => <polygon key={i} points={p}/>)}
    </svg>
  );
}


// ── ANIMATED COUNTER ─────────────────────────────────────
function AnimatedNumber({ value, duration=1200, className, style }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const to = value;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(from + (to - from) * ease));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <span className={className} style={style}>{display.toLocaleString()}</span>;
}

// ── SVG RING ─────────────────────────────────────────────
function Ring({ value, max, size=80, stroke=5, color="#F58020", label, sublabel, animate=true }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!animate) { setProgress(value/max); return; }
    const t = setTimeout(() => {
      let start = null;
      const dur = 1400;
      const step = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setProgress(ease * (value / max));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, 200);
    return () => clearTimeout(t);
  }, [value, max]);
  const dash = circ * Math.min(progress, 1);
  const gap = circ - dash;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1A1A1A" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round" style={{transition:"stroke-dasharray 0.1s"}}/>
        <foreignObject x={0} y={0} width={size} height={size} style={{transform:"rotate(90deg)",transformOrigin:`${size/2}px ${size/2}px`}}>
          <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:size*0.22,color:"#FFFDF3",lineHeight:1,letterSpacing:1}}>{label}</div>
            {sublabel&&<div style={{fontSize:size*0.09,letterSpacing:2,textTransform:"uppercase",color:"#4A4845",fontWeight:600,marginTop:2}}>{sublabel}</div>}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body,#root{background:#0A0A0A;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-weight:300;}

/* ── ANIMATIONS ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideRight{from{opacity:0;transform:translateX(-16px);}to{opacity:1;transform:translateX(0);}}
@keyframes pulseOrange{0%,100%{box-shadow:0 0 0 0 rgba(245,128,32,0);}50%{box-shadow:0 0 0 6px rgba(245,128,32,0.12);}}
@keyframes shimmer{from{background-position:-200% 0;}to{background-position:200% 0;}}
@keyframes confetti{from{transform:translateY(-20px) rotate(0deg);opacity:1;}to{transform:translateY(100vh) rotate(720deg);opacity:0;}}

/* ── APP SHELL ── */
.app{min-height:100vh;background:#0A0A0A;max-width:520px;margin:0 auto;padding-bottom:60px;}
.tab-content{animation:fadeUp .35s cubic-bezier(0.16,1,0.3,1) both;}

/* ── TOPBAR ── */
.topbar{height:48px;background:#0A0A0A;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #1A1A1A;position:sticky;top:0;z-index:100;}
.topbar-logo{height:24px;width:auto;}
.topbar-pts{display:flex;align-items:baseline;gap:4px;}
.topbar-pts-val{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#F58020;letter-spacing:1px;}
.topbar-pts-lbl{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#7A7774;font-weight:600;}

/* ── HOME HERO ── */
.hero{padding:24px 16px 20px;background:linear-gradient(160deg,#130B02 0%,#0A0A0A 55%);position:relative;overflow:hidden;}
.hero::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(245,128,32,.015) 60px,rgba(245,128,32,.015) 61px);pointer-events:none;}
.hero-greeting{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#7A7774;font-weight:500;margin-bottom:4px;animation:fadeIn .6s ease both;}
.hero-name{font-family:'Bebas Neue',sans-serif;font-size:44px;letter-spacing:3px;color:#FFFDF3;line-height:1;margin-bottom:0;animation:fadeUp .5s cubic-bezier(0.16,1,0.3,1) .1s both;}
.hero-meta{font-size:10px;color:#7A7774;margin-bottom:20px;font-weight:400;animation:fadeIn .6s ease .2s both;}

.rings-row{display:flex;justify-content:space-around;align-items:center;margin-bottom:20px;}

.tier-strip{display:flex;align-items:center;gap:8px;padding:10px 0;border-top:1px solid #1A1A1A;}
.tier-dot{width:5px;height:5px;flex-shrink:0;}
.tier-name{font-size:9px;letter-spacing:3px;text-transform:uppercase;font-weight:700;}
.tier-progress-track{flex:1;height:1px;background:#1A1A1A;position:relative;}
.tier-progress-fill{position:absolute;top:0;left:0;height:100%;background:#F58020;transition:width 1.4s cubic-bezier(0.16,1,0.3,1);}
.tier-next{font-size:9px;color:#7A7774;font-weight:400;white-space:nowrap;}

/* ── SECTION BLOCKS ── */
.block{background:#111111;border-bottom:1px solid #1A1A1A;}
.block-header{padding:12px 16px 8px;display:flex;align-items:center;justify-content:space-between;}
.block-title{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#7A7774;font-weight:700;}
.block-action{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#F58020;font-weight:700;cursor:pointer;}

/* ── QUICK ACTIONS ── */
.qa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#1A1A1A;}
.qa-item{background:#111;padding:16px 8px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:background .15s;}
.qa-item:active{background:#161616;}
.qa-item svg{width:18px;height:18px;stroke:#F58020;stroke-width:1.5;fill:none;}
.qa-lbl{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#8A8784;font-weight:700;}

/* ── MOTIVATION ── */
.motivation{padding:14px 16px;background:#111;border-left:1px solid #F58020;border-bottom:1px solid #1A1A1A;}
.motivation-eyebrow{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#F58020;font-weight:700;opacity:.6;margin-bottom:5px;}
.motivation-text{font-size:12px;color:#A8A49E;line-height:1.7;font-weight:500;font-style:italic;}

/* ── DATA ROWS ── */
.data-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid #1A1A1A;}
.data-row:first-child{border-top:none;}
.data-icon{width:30px;height:30px;background:#161616;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.data-icon svg{width:14px;height:14px;stroke:#333130;stroke-width:1.5;fill:none;}
.data-icon.hi svg{stroke:#F58020;}
.data-icon.pos svg{stroke:#2D9B5A;}
.data-lbl{flex:1;}
.data-main{font-size:13px;font-weight:600;color:#E8E4DE;letter-spacing:.2px;}
.data-sub{font-size:10px;color:#8A8784;margin-top:1px;font-weight:500;}
.data-val{font-family:'Bebas Neue',sans-serif;font-size:20px;}
.data-val.pos{color:#2D9B5A;}
.data-val.neg{color:#8B3A3A;}
.data-val.acc{color:#F58020;}

/* ── BOTTOM NAV ── */
.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:520px;background:#111;border-top:1px solid #1A1A1A;display:flex;z-index:200;height:56px;}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:none;border:none;cursor:pointer;transition:all .15s;}
.nav-btn svg{width:18px;height:18px;stroke:#333130;stroke-width:1.5;fill:none;transition:stroke .15s;}
.nav-btn.on svg{stroke:#F58020;}
.nav-lbl{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#333130;font-weight:800;transition:color .15s;}
.nav-btn.on .nav-lbl{color:#F58020;}

/* ── LOYALTY TABS ── */
.ltabs{display:flex;background:#111;border-bottom:1px solid #1A1A1A;}
.ltab{flex:1;padding:12px 4px;text-align:center;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#4A4845;font-weight:700;cursor:pointer;position:relative;background:none;border:none;transition:color .15s;font-family:'Montserrat',sans-serif;}
.ltab.on{color:#F58020;}
.ltab.on::after{content:'';position:absolute;bottom:0;left:25%;right:25%;height:1px;background:#F58020;}

/* ── BALANCE HERO ── */
.balance-hero{padding:20px 16px;background:#0A0A0A;border-bottom:1px solid #1A1A1A;}
.bal-lbl{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#4A4845;font-weight:700;margin-bottom:4px;}
.bal-val{font-family:'Bebas Neue',sans-serif;font-size:52px;color:#F58020;line-height:1;letter-spacing:-1px;}
.bal-sub{font-size:10px;color:#7A7774;margin-top:4px;font-weight:400;}

/* ── REWARDS ── */
.rwd-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid #1A1A1A;background:#111;animation:slideRight .3s cubic-bezier(0.16,1,0.3,1) both;}
.rwd-icon{width:38px;height:38px;background:#161616;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.rwd-icon svg{width:16px;height:16px;stroke:#F58020;stroke-width:1.5;fill:none;}
.rwd-info{flex:1;}
.rwd-name{font-size:13px;font-weight:600;color:#E8E4DE;}
.rwd-cat{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4A4845;margin-top:2px;font-weight:500;}
.rwd-pts{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#FFFDF3;margin-right:10px;}
.rwd-btn{padding:7px 14px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;white-space:nowrap;flex-shrink:0;}
.rwd-btn.locked{background:#161616;color:#4A4845;cursor:not-allowed;}
.rwd-btn.pending{background:#1A3A4A;color:#026F91;}

/* ── CHALLENGES ── */
.ch-item{background:#111;border-bottom:1px solid #1A1A1A;padding:16px 16px 14px;animation:fadeUp .3s cubic-bezier(0.16,1,0.3,1) both;}
.ch-row{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;}
.ch-icon{width:40px;height:40px;background:#161616;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ch-icon svg{width:16px;height:16px;stroke:#F58020;stroke-width:1.5;fill:none;}
.ch-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;color:#FFFDF3;line-height:1;margin-bottom:4px;}
.ch-desc{font-size:12px;color:#9A9690;font-weight:400;line-height:1.5;}
.ch-badge{padding:3px 10px;font-size:8px;letter-spacing:2px;text-transform:uppercase;font-weight:700;flex-shrink:0;}
.ch-badge.joined{background:rgba(245,128,32,.1);color:#F58020;border:1px solid rgba(245,128,32,.2);}
.ch-badge.done{background:rgba(45,155,90,.1);color:#2D9B5A;border:1px solid rgba(45,155,90,.2);}
.ch-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.ch-dl{font-size:10px;color:#8A8784;display:flex;align-items:center;gap:5px;font-weight:500;}
.ch-dl svg{width:11px;height:11px;stroke:currentColor;stroke-width:2;fill:none;}
.ch-pts{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#F58020;}
.ch-bar{height:2px;background:#1A1A1A;border-radius:1px;}
.ch-bar-fill{height:100%;background:#F58020;border-radius:1px;transition:width 1s cubic-bezier(0.16,1,0.3,1);}
.ch-bar-labels{display:flex;justify-content:space-between;margin-top:5px;font-size:9px;color:#4A4845;font-weight:400;}
.ch-join-btn{width:100%;margin-top:12px;padding:13px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;transition:background .15s;}
.ch-join-btn:hover{background:#E07318;}
.ch-join-btn:active{background:#CC6A10;}
.ch-join-btn:disabled{background:#1C1C1C;color:#4A4845;cursor:not-allowed;letter-spacing:2px;}

/* ── EARN ── */
.earn-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #1A1A1A;background:#111;}
.earn-icon{width:28px;height:28px;background:#161616;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;font-weight:700;color:#4A4845;letter-spacing:1px;}
.earn-action{font-size:13px;font-weight:600;color:#E8E4DE;}
.earn-note{font-size:10px;color:#8A8784;margin-top:1px;font-weight:400;}
.earn-pts{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#F58020;margin-left:auto;}

/* ── TIER LADDER ── */
.tier-ladder{display:flex;gap:1px;background:#1A1A1A;margin-bottom:1px;}
.tier-rung{flex:1;background:#111;padding:12px 6px;text-align:center;}
.tier-rung.cur{background:#161616;}
.tier-rung-name{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;}
.tier-rung-min{font-size:9px;color:#4A4845;margin-top:2px;font-weight:300;}

/* ── RANKINGS ── */
.lb-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #1A1A1A;background:#111;animation:slideRight .3s cubic-bezier(0.16,1,0.3,1) both;}
.lb-row.me{background:#131308;border-left:1px solid #F58020;}
.lb-rank{font-family:'Bebas Neue',sans-serif;font-size:22px;width:28px;text-align:center;flex-shrink:0;color:#333130;}
.lb-rank.top{color:#C9A84C;}
.lb-av{width:32px;height:32px;background:#161616;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;color:#4A4845;}
.lb-av.top{color:#C9A84C;background:rgba(201,168,76,.08);}
.lb-name{flex:1;font-size:13px;font-weight:600;color:#E8E4DE;}
.lb-you{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#F58020;background:rgba(245,128,32,.1);padding:1px 5px;margin-left:6px;font-weight:700;}
.lb-streak{font-size:10px;color:#7A7774;font-weight:400;}
.lb-pts{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#C8C4BE;}

/* ── PROFILE ── */
.profile-hdr{padding:20px 16px;background:#0A0A0A;display:flex;gap:14px;align-items:center;border-bottom:1px solid #1A1A1A;}
.profile-av{width:52px;height:52px;background:#161616;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:20px;color:#F58020;flex-shrink:0;animation:pulseOrange 3s ease infinite;}
.profile-name{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#FFFDF3;line-height:1;}
.profile-id{font-size:9px;letter-spacing:2px;color:#7A7774;margin-top:3px;font-weight:400;}
.profile-tier{font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-top:4px;}
.info-group-title{padding:10px 16px 6px;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#4A4845;font-weight:700;background:#0A0A0A;}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;background:#111;border-bottom:1px solid #1A1A1A;}
.info-lbl{font-size:11px;color:#8A8784;font-weight:400;}
.info-val{font-size:12px;color:#E8E4DE;font-weight:700;}
.info-val.acc{color:#F58020;font-family:'Bebas Neue',sans-serif;font-size:20px;}
.ref-box{margin-bottom:1px;background:#111;padding:14px 16px;}
.ref-lbl{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#4A4845;font-weight:700;margin-bottom:8px;}
.ref-code{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:#F58020;padding:10px 16px;background:#161616;text-align:center;margin-bottom:8px;cursor:pointer;transition:background .15s;}
.ref-code:active{background:#1C1C1C;}
.ref-hint{font-size:10px;color:#8A8784;text-align:center;line-height:1.7;font-weight:400;}
.signout-btn{width:calc(100% - 32px);margin:12px 16px;padding:12px;background:none;border:1px solid #1A1A1A;color:#4A4845;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.signout-btn:hover{border-color:#8B3A3A;color:#8B3A3A;}

/* ── WORKOUTS ── */
.wkt-header{padding:14px 16px 10px;background:#0A0A0A;border-bottom:1px solid #1A1A1A;}
.wkt-title{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px;color:#C8C4BE;}
.pills{display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px;background:#111;border-bottom:1px solid #1A1A1A;}
.pill{padding:4px 12px;border:1px solid #1A1A1A;background:none;color:#4A4845;font-family:'Montserrat',sans-serif;font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.pill.on,.pill:active{border-color:#F58020;color:#F58020;}
.wkt-card{display:flex;gap:0;background:#111;border-bottom:1px solid #1A1A1A;cursor:pointer;transition:background .15s;animation:fadeUp .3s cubic-bezier(0.16,1,0.3,1) both;}
.wkt-card:active{background:#161616;}
.wkt-thumb{width:88px;height:88px;background:#161616;flex-shrink:0;overflow:hidden;position:relative;}
.wkt-thumb img{width:100%;height:100%;object-fit:cover;}
.wkt-thumb-icon{width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
.wkt-thumb-icon svg{width:24px;height:24px;stroke:#333130;stroke-width:1.5;fill:none;}
.wkt-lock{position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;}
.wkt-lock svg{width:18px;height:18px;stroke:#4A4845;stroke-width:1.5;fill:none;}
.wkt-info{flex:1;padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;}
.wkt-name{font-size:13px;font-weight:700;color:#E8E4DE;line-height:1.3;margin-bottom:2px;}
.wkt-meta{font-size:10px;color:#8A8784;font-weight:400;}
.wkt-access{padding:2px 8px;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;}
.wkt-access.free{background:rgba(45,155,90,.1);color:#2D9B5A;}
.wkt-access.locked{background:#161616;color:#4A4845;}
.wkt-access.unlocked{background:rgba(245,128,32,.1);color:#F58020;}

/* ── LOGIN / AUTH ── */
.auth-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:#0A0A0A;}
.auth-box{width:100%;max-width:360px;}
.auth-logo{display:block;height:48px;width:auto;margin:0 auto 6px;}
.auth-brand{font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#4A4845;text-align:center;font-weight:700;margin-bottom:28px;}
.auth-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#FFFDF3;margin-bottom:4px;text-align:center;}
.auth-sub{font-size:11px;color:#4A4845;text-align:center;margin-bottom:20px;font-weight:300;line-height:1.6;}
.auth-inp{width:100%;padding:13px 14px;background:#111;border:1px solid #1A1A1A;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:300;outline:none;transition:border-color .15s;margin-bottom:12px;}
.auth-inp:focus{border-color:#F58020;}
.auth-inp::placeholder{color:#333130;}
.auth-btn{width:100%;padding:13px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer;transition:background .15s;margin-bottom:8px;}
.auth-btn:hover{background:#E07318;}
.auth-btn:disabled{background:#1A1A1A;color:#4A4845;cursor:not-allowed;}
.auth-btn-ghost{width:100%;padding:13px;background:none;border:1px solid #1A1A1A;color:#4A4845;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.auth-btn-ghost:hover{border-color:#F58020;color:#F58020;}
.auth-err{font-size:11px;color:#8B3A3A;text-align:center;margin-bottom:10px;font-weight:400;}
.auth-hint{font-size:10px;color:#4A4845;text-align:center;margin-top:10px;font-weight:300;line-height:1.6;}
.auth-link{color:#F58020;cursor:pointer;font-weight:600;}
.auth-chip{display:flex;align-items:center;gap:12px;background:#111;border:1px solid #1A1A1A;padding:12px 14px;margin-bottom:20px;}
.auth-chip-av{width:34px;height:34px;background:#161616;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#F58020;flex-shrink:0;}
.pin-row{display:flex;gap:10px;justify-content:center;margin-bottom:20px;}
.pin-digit{width:52px;height:60px;background:#111;border:1px solid #1A1A1A;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:28px;color:#F58020;transition:border-color .15s;}
.pin-digit.filled{border-color:#F58020;}
.pin-digit.active{border-color:#F58020;}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px;}
.pin-key{padding:15px;background:#111;border:1px solid #1A1A1A;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:17px;font-weight:400;cursor:pointer;text-align:center;transition:all .15s;user-select:none;}
.pin-key:active{background:#F58020;color:#fff;border-color:#F58020;}
.pin-key.del{color:#4A4845;font-size:13px;}
.pin-key.empty{background:transparent;border-color:transparent;pointer-events:none;}

/* ── TIER CELEBRATION ── */
.celebration{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;animation:fadeIn .4s ease;}
.celebration-icon{font-size:64px;line-height:1;margin-bottom:12px;}
.celebration-reached{font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#4A4845;margin-bottom:6px;font-weight:700;}
.celebration-tier{font-family:'Bebas Neue',sans-serif;font-size:64px;line-height:1;text-align:center;}
.celebration-msg{font-size:13px;color:#6A6764;text-align:center;margin:20px 0 28px;line-height:1.7;font-weight:300;max-width:280px;}
.celebration-btn{padding:14px 40px;background:#F58020;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer;}

/* ── INSTALL PROMPT ── */
.install-prompt{position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:520px;background:#111;border-bottom:1px solid #1A1A1A;padding:10px 14px;z-index:300;display:flex;align-items:center;gap:10px;animation:fadeUp .4s cubic-bezier(0.16,1,0.3,1);}
.install-close{background:none;border:none;color:#4A4845;font-size:16px;cursor:pointer;padding:0 4px;flex-shrink:0;margin-left:auto;}

/* ── TOAST ── */
.toast{position:fixed;bottom:68px;left:50%;transform:translateX(-50%) translateY(10px);background:#F58020;color:#fff;padding:10px 24px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;z-index:1000;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}

::-webkit-scrollbar{width:2px;}::-webkit-scrollbar-track{background:#0A0A0A;}::-webkit-scrollbar-thumb{background:#1A1A1A;}
`;

// ── INSTALL PROMPT ────────────────────────────────────────
function InstallPrompt() {
  const [show,setShow]         = useState(false);
  const [platform,setPlatform] = useState(null);
  const [dp,setDp]             = useState(null);
  useEffect(()=>{
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid=/android/i.test(navigator.userAgent);
    const isStandalone=window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches;
    const dismissed=localStorage.getItem("uruz:install-dismissed");
    if(isStandalone||dismissed) return;
    const handler=e=>{e.preventDefault();setDp(e);setPlatform("android");setTimeout(()=>setShow(true),2000);};
    window.addEventListener("beforeinstallprompt",handler);
    if(isIOS){setPlatform("ios");setTimeout(()=>setShow(true),2000);}
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);
  const dismiss=()=>{localStorage.setItem("uruz:install-dismissed","1");setShow(false);};
  const install=async()=>{if(!dp)return;dp.prompt();const{outcome}=await dp.userChoice;dismiss();};
  if(!show) return null;
  return(
    <div className="install-prompt">
      <img src={LOGO_URL} alt="URUZ" style={{height:24,width:"auto",flexShrink:0}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#F58020",fontWeight:700,marginBottom:3}}>Add to Home Screen</div>
        {platform==="ios"&&<div style={{fontSize:10,color:"#4A4845",fontWeight:300}}>Tap Share then "Add to Home Screen"</div>}
        {platform==="android"&&<button onClick={install} style={{background:"#F58020",border:"none",color:"#fff",padding:"4px 12px",fontFamily:"'Montserrat',sans-serif",fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Install</button>}
      </div>
      <button className="install-close" onClick={dismiss}>✕</button>
    </div>
  );
}

// ── TIER CELEBRATION ─────────────────────────────────────
function TierCelebration({tier,onDismiss}){
  return(
    <div className="celebration">
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {[...Array(24)].map((_,i)=>(
          <div key={i} style={{position:"absolute",width:`${5+Math.random()*7}px`,height:`${5+Math.random()*7}px`,left:`${Math.random()*100}%`,background:["#F58020","#C9A84C","#FFFDF3","#026F91"][i%4],animation:`confetti ${1.5+Math.random()*2}s linear ${Math.random()*1.5}s infinite`}}/>
        ))}
      </div>
      <div className="celebration-icon" style={{color:tier.color}}>{tier.icon}</div>
      <div className="celebration-reached">You've reached</div>
      <div className="celebration-tier" style={{color:tier.color}}>{tier.name}</div>
      <div style={{fontSize:9,letterSpacing:4,textTransform:"uppercase",color:"#333130",marginTop:4}}>Tier</div>
      <div className="celebration-msg">You've earned your way to a new level.<br/>Keep pushing — every rep counts.</div>
      <button className="celebration-btn" onClick={onDismiss}>Let's Go</button>
    </div>
  );
}

// ── PIN INPUT ─────────────────────────────────────────────
function PinInput({value,onChange}){
  const keys=["1","2","3","4","5","6","7","8","9","","0","⌫"];
  const handle=k=>{if(k==="⌫")onChange(value.slice(0,-1));else if(k==="")return;else if(value.length<4)onChange(value+k);};
  return(
    <div>
      <div className="pin-row">{[0,1,2,3].map(i=><div key={i} className={`pin-digit${value[i]?" filled":""}${value.length===i?" active":""}`}>{value[i]?"●":""}</div>)}</div>
      <div className="pin-pad">{keys.map((k,i)=><div key={i} className={`pin-key${k==="⌫"?" del":""}${k===""?" empty":""}`} onClick={()=>handle(k)}>{k}</div>)}</div>
    </div>
  );
}

// ── LOGIN FLOW ────────────────────────────────────────────
function LoginFlow({onLogin}){
  const [stage,setStage]=useState("phone");
  const [phone,setPhone]=useState("");
  const [member,setMember]=useState(null);
  const [pin,setPin]=useState("");
  const [pin2,setPin2]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [regName,setRegName]=useState("");
  const [regPhone,setRegPhone]=useState("");
  const [regBday,setRegBday]=useState("");
  const [regRef,setRegRef]=useState("");

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search).get("ref");
    if(p) setRegRef(p.toUpperCase());
  },[]);

  const handlePhone=async()=>{
    setError("");setLoading(true);
    const m=await getMemberByPhone(phone);
    setLoading(false);
    if(!m){setError("No active member found.");return;}
    setMember(normalizeMember(m));
    setStage(m.pin?"pin":"setpin");
  };

  const handlePin=async()=>{
    setError("");
    if(pin!==member.pin){setError("Incorrect PIN.");setPin("");return;}
    saveSession({memberId:member.id});onLogin(member.id);
  };
  useEffect(()=>{if(stage==="pin"&&pin.length===4)handlePin();},[pin,stage]);

  const handleSetPin=()=>{if(pin.length<4)return;setPin2("");setError("");setStage("confirmpin");};
  const handleConfirmPin=async()=>{
    if(pin2!==pin){setError("PINs don't match.");setPin2("");return;}
    await updateMemberPin(member.id,pin);
    saveSession({memberId:member.id});onLogin(member.id);
  };
  useEffect(()=>{if(stage==="confirmpin"&&pin2.length===4)handleConfirmPin();},[pin2,stage]);

  const handleRegister=async()=>{
    setError("");
    if(!regName.trim()||!regPhone.trim()){setError("Please fill in all fields.");return;}
    setLoading(true);
    const existing=await getMemberByPhone(regPhone);
    if(existing){setError("This number is already registered.");setLoading(false);return;}
    const newId=genId("URZ");
    const refCode="URUZ-"+newId.slice(-5).toUpperCase();
    const nm={id:newId,name:regName.trim(),phone:regPhone.trim(),email:"",joinDate:today(),points:0,checkins:0,streak:0,status:"active",pin:null,birthday:regBday||null,referral_code:refCode};
    await upsertMember(nm);
    if(regRef.trim()){
      const referrer=await getMemberByReferralCode(regRef.trim());
      if(referrer){
        const REF_PTS=500;
        await upsertMember({...referrer,points:(referrer.points||0)+REF_PTS});
        await addReferral({id:genId("REF"),referrerId:referrer.id,referrerName:referrer.name,referrerCode:regRef.trim(),newMemberId:nm.id,newMemberName:nm.name,pts:REF_PTS,date:today()});
        await addTransaction({id:genId("TXN"),memberId:referrer.id,memberName:referrer.name,type:"referral",pts:REF_PTS,note:`Referral — ${nm.name}`,date:today()});
      }
    }
    setLoading(false);setMember({...nm,referral_code:refCode});setPin("");setStage("setpin");
  };

  const Logo=()=>(
    <><img src={LOGO_URL} alt="URUZ" className="auth-logo"/><div className="auth-brand">Member Central</div></>
  );

  return(
    <><style>{CSS}</style>
    <InstallPrompt/>
    <div className="auth-screen">
      {stage==="phone"&&(<div className="auth-box"><Logo/><div className="auth-title">Welcome Back</div><div className="auth-sub">Enter your phone number to sign in</div><input className="auth-inp" placeholder="+961 XX XXX XXX" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handlePhone()}/>{error&&<div className="auth-err">{error}</div>}<button className="auth-btn" onClick={handlePhone} disabled={loading}>{loading?"Checking...":"Sign In"}</button><div className="auth-hint">Not a member? <span className="auth-link" onClick={()=>{setError("");setStage("register");}}>Register here</span></div></div>)}
      {stage==="pin"&&member&&(<div className="auth-box"><Logo/><div className="auth-chip"><div className="auth-chip-av">{initials(member.name)}</div><div><div style={{fontSize:14,fontWeight:500,color:"#FFFDF3"}}>{member.name}</div><div style={{fontSize:10,color:"#4A4845",fontWeight:300}}>{member.phone}</div></div></div><div className="auth-sub">Enter your 4-digit PIN</div><PinInput value={pin} onChange={v=>{setPin(v);setError("");}}/>{error&&<div className="auth-err">{error}</div>}<button className="auth-btn-ghost" onClick={()=>{setStage("phone");setPin("");setMember(null);}}>Back</button></div>)}
      {stage==="setpin"&&member&&(<div className="auth-box"><Logo/><div className="auth-title">Create Your PIN</div><div className="auth-sub">Choose a 4-digit PIN to secure your account</div><PinInput value={pin} onChange={v=>{setPin(v);setError("");}}/>{error&&<div className="auth-err">{error}</div>}<button className="auth-btn" onClick={handleSetPin} disabled={pin.length<4}>Continue</button></div>)}
      {stage==="confirmpin"&&(<div className="auth-box"><Logo/><div className="auth-title">Confirm PIN</div><div className="auth-sub">Enter your PIN again to confirm</div><PinInput value={pin2} onChange={v=>{setPin2(v);setError("");}}/>{error&&<div className="auth-err">{error}</div>}</div>)}
      {stage==="register"&&(<div className="auth-box"><Logo/><div className="auth-title">Join URUZ</div><div className="auth-sub">Start earning points from day one</div><input className="auth-inp" placeholder="Full Name" value={regName} onChange={e=>setRegName(e.target.value)}/><input className="auth-inp" placeholder="+961 XX XXX XXX" value={regPhone} onChange={e=>setRegPhone(e.target.value)}/><label style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#7A7774",fontWeight:700,display:"block",marginBottom:6}}>Birthday (optional)</label>
<input className="auth-inp" type="date" value={regBday} onChange={e=>setRegBday(e.target.value)} style={{marginBottom:12}}/><input className="auth-inp" placeholder="Referral Code (optional)" value={regRef} onChange={e=>setRegRef(e.target.value.toUpperCase())}/>{error&&<div className="auth-err">{error}</div>}<button className="auth-btn" onClick={handleRegister} disabled={loading}>{loading?"Creating...":"Create Account"}</button><button className="auth-btn-ghost" onClick={()=>{setStage("phone");setError("");}}>Back to Sign In</button></div>)}
    </div></>
  );
}

// ── HOME TAB ─────────────────────────────────────────────
function HomeTab({member,members,transactions,tiers,challenges,enrollments,workouts,programs,homeMessages,onTabChange,onShowRankings}){
  const tier=getTier(member.points,tiers);
  const next=getNext(member.points,tiers);
  const tierPct=next?Math.round(((member.points-tier.min)/(next.min-tier.min))*100):100;
  const rank=[...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).findIndex(m=>m.id===member.id)+1;
  const myTxns=transactions.filter(t=>t.memberId===member.id||t.member_id===member.id).slice(0,3);
  const myEnrollments=enrollments.filter(e=>(e.memberId===member.id||e.member_id===member.id)&&!e.completed);
  const msgs=homeMessages&&homeMessages.length>0?homeMessages:URUZ_QUOTES;
  const todayMMDD=new Date().toISOString().slice(5,10);
  const isBirthday=member.birthday&&member.birthday.slice(5,10)===todayMMDD;
  const quote=msgs[new Date().getDay()%msgs.length];
  const newWorkouts=workouts.filter(w=>w.active&&w.access_type==="free").slice(0,2);
  const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const todayDay=dayNames[new Date().getDay()];
  const todayWorkouts=programs.flatMap(p=>(p.schedule?.[todayDay]||[]).map(id=>workouts.find(w=>w.id===id)).filter(Boolean));

  const actIcon={
    checkin:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>,
    class:<svg viewBox="0 0 24 24"><path d="M6 4v16M18 4v16M6 12h12"/></svg>,
    referral:<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    bonus:<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    challenge:<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    redeem:<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="1"/><path d="M16 12H8"/></svg>,
    manual:<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    deduct:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  };

  return(
    <div className="tab-content">
      <div className="hero">
        <div className="hero-greeting">Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}</div>
        <div className="hero-name">{member.name.split(" ")[0].toUpperCase()}</div>
        <div className="hero-meta">{member.id} · since {new Date(member.joinDate).toLocaleDateString("en-GB",{month:"short",year:"numeric"})}</div>
        <div className="rings-row">
          <Ring value={Math.min(rank,10)} max={10} size={68} stroke={4} color="#666" label={`#${rank}`} sublabel="rank"/>
          <Ring value={member.points} max={next?next.min:member.points||1} size={92} stroke={5} color="#F58020" label={member.points.toLocaleString()} sublabel="points"/>
          <Ring value={Math.min(member.streak,30)} max={30} size={68} stroke={4} color="#C9A84C" label={member.streak} sublabel="streak"/>
        </div>
        {next&&(
          <div className="tier-strip">
            <div className="tier-dot" style={{background:tier.color}}/>
            <div className="tier-name" style={{color:tier.color}}>{tier.name}</div>
            <div className="tier-progress-track"><div className="tier-progress-fill" style={{width:`${tierPct}%`,background:tier.color}}/></div>
            <div className="tier-next">{(next.min-member.points).toLocaleString()} to {next.name}</div>
          </div>
        )}
      </div>

      <div className="qa-grid">
        <div className="qa-item" onClick={()=>window.open("/checkin","_blank")}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
          <span className="qa-lbl">Check In</span>
        </div>
        <div className="qa-item" onClick={()=>onTabChange("loyalty")}>
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="1"/><path d="M16 12H8M12 9v6"/></svg>
          <span className="qa-lbl">Redeem</span>
        </div>
        <div className="qa-item" onClick={onShowRankings}>
          <svg viewBox="0 0 24 24"><path d="M8 6l4-4 4 4M12 2v13M3 17l2 4h14l2-4"/></svg>
          <span className="qa-lbl">Rankings</span>
        </div>
      </div>

      {isBirthday?(
        <div style={{padding:"16px",background:"#111",borderLeft:"1px solid #C9A84C",borderBottom:"1px solid #1A1A1A"}}>
          <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#C9A84C",fontWeight:700,marginBottom:5}}>Happy Birthday</div>
          <div style={{fontSize:13,color:"#C8C4BE",fontWeight:400}}>Happy Birthday, {member.name.split(" ")[0]}! Your 300 bonus points have been added.</div>
        </div>
      ):(
        <div className="motivation">
          <div className="motivation-eyebrow">Today</div>
          <div className="motivation-text">"{quote}"</div>
        </div>
      )}

      {myEnrollments.length>0&&(
        <div className="block">
          <div className="block-header">
            <span className="block-title">Active Challenges</span>
            <span className="block-action" onClick={()=>onTabChange("challenges")}>See all</span>
          </div>
          {myEnrollments.slice(0,2).map((e,idx)=>{
            const c=challenges.find(x=>String(x.id)===e.challengeId)||{};
            const pct=Math.min(100,Math.round(((e.progress||0)/(e.goal||1))*100));
            return(
              <div key={e.id} className="data-row" style={{animationDelay:`${idx*0.06}s`,flexDirection:"column",alignItems:"flex-start",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10,width:"100%"}}>
                  <div style={{fontSize:12,fontWeight:500,color:"#C8C4BE",flex:1}}>{c.name||e.challengeName}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#F58020"}}>+{c.pts||0}</div>
                </div>
                <div style={{width:"100%",height:1,background:"#1A1A1A"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:"#F58020",transition:"width 1s cubic-bezier(0.16,1,0.3,1)"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",width:"100%",fontSize:9,color:"#4A4845"}}>
                  <span>{e.progress||0}/{e.goal||1}</span><span>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {todayWorkouts.length>0&&(
        <div className="block">
          <div className="block-header">
            <span className="block-title">Today's Program</span>
            <span className="block-action" onClick={()=>onTabChange("workouts")}>See all</span>
          </div>
          {todayWorkouts.map((w,idx)=>(
            <div key={w.id} className="data-row" style={{animationDelay:`${idx*0.06}s`,cursor:"pointer"}} onClick={()=>onTabChange("workouts")}>
              <div className="data-icon hi"><svg viewBox="0 0 24 24"><path d="M6.5 8.5v7M17.5 8.5v7"/><rect x="4" y="7" width="5" height="10" rx="1.5"/><rect x="15" y="7" width="5" height="10" rx="1.5"/><line x1="9" y1="12" x2="15" y2="12" strokeWidth="2.5"/></svg></div>
              <div className="data-lbl">
                <div className="data-main">{w.title}</div>
                <div className="data-sub">{w.category} · {w.duration_mins}m · {w.difficulty}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A7774" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          ))}
        </div>
      )}

      {newWorkouts.length>0&&todayWorkouts.length===0&&(
        <div className="block">
          <div className="block-header">
            <span className="block-title">New Workouts</span>
            <span className="block-action" onClick={()=>onTabChange("workouts")}>See all</span>
          </div>
          {newWorkouts.map((w,idx)=>(
            <div key={w.id} className="data-row" style={{animationDelay:`${idx*0.06}s`,cursor:"pointer"}} onClick={()=>onTabChange("workouts")}>
              <div className="data-icon hi"><svg viewBox="0 0 24 24"><path d="M6 4v16M18 4v16M6 12h12"/></svg></div>
              <div className="data-lbl"><div className="data-main">{w.title}</div><div className="data-sub">{w.category} · {w.duration_mins}m · Free</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333130" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          ))}
        </div>
      )}

      <div className="block">
        <div className="block-header">
          <span className="block-title">Recent Activity</span>
        </div>
        {myTxns.length===0?(
          <div style={{padding:"16px",fontSize:12,color:"#4A4845",fontWeight:300}}>No activity yet. Check in to start earning!</div>
        ):myTxns.map((a,idx)=>(
          <div key={a.id} className="data-row" style={{animationDelay:`${idx*0.08}s`}}>
            <div className={`data-icon${a.pts>0?" hi":""}`}>{actIcon[a.type]||actIcon.checkin}</div>
            <div className="data-lbl"><div className="data-main">{a.note}</div><div className="data-sub">{fmtDate(a.date)}</div></div>
            <div className={`data-val${a.pts>0?" pos":" neg"}`}>{a.pts>0?"+":""}{a.pts}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WORKOUT LOG MODAL ────────────────────────────────────
function WorkoutLogModal({ workout, member, onClose, onSaved }) {
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const [logs, setLogs] = useState(exercises.map(ex=>({
    name: ex.name, sets: ex.sets||"", reps: ex.reps||"",
    actualWeight:"", actualReps:"", notes:"",
  })));
  const [saving, setSaving] = useState(false);
  const [pastLogs, setPastLogs] = useState([]);

  useEffect(()=>{
    getWorkoutLogs(member.id).catch(()=>[]).then(all=>{
      setPastLogs((all||[]).filter(l=>l.workout_id===workout.id).slice(0,3));
    });
  },[]);

  const updateLog = (i, field, val) => {
    setLogs(prev => prev.map((l,idx)=>idx===i?{...l,[field]:val}:l));
  };

  const handleSave = async () => {
    setSaving(true);
    const log = {
      id: genId("LOG"),
      workoutId: workout.id,
      memberId: member.id,
      memberName: member.name,
      date: today(),
      exercises: logs,
      notes: "",
    };
    await saveWorkoutLog(log);
    setSaving(false);
    onSaved();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:400,display:"flex",flexDirection:"column",animation:"fadeIn .2s ease"}}>
      <div style={{background:"#111",flex:1,display:"flex",flexDirection:"column",maxHeight:"100vh"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid #1A1A1A",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:2,color:"#FFFDF3"}}>Log Workout</div>
            <div style={{fontSize:10,color:"#7A7774",fontWeight:400}}>{workout.title} · {today()}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#7A7774",fontSize:11,letterSpacing:2,textTransform:"uppercase",fontWeight:700,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>Cancel</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
          {pastLogs.length>0&&(
            <div style={{marginBottom:16,background:"#0A0A0A",border:"1px solid #1A1A1A",padding:12}}>
              <div style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#7A7774",fontWeight:700,marginBottom:8}}>Previous Sessions</div>
              {pastLogs.slice(0,1).map((l,i)=>(
                <div key={i}>
                  <div style={{fontSize:10,color:"#4A4845",marginBottom:6}}>{l.date}</div>
                  {(l.exercises||[]).map((ex,j)=>(
                    <div key={j} style={{fontSize:11,color:"#6A6764",marginBottom:2}}>
                      {ex.name}: {ex.actualWeight&&<span style={{color:"#F58020"}}>{ex.actualWeight}</span>} · {ex.actualReps||ex.reps} reps
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {exercises.length===0&&(
            <div style={{fontSize:12,color:"#7A7774",textAlign:"center",padding:"20px 0"}}>No exercises defined for this workout.</div>
          )}
          {logs.map((log,i)=>(
            <div key={i} style={{background:"#0A0A0A",border:"1px solid #1A1A1A",padding:14,marginBottom:10}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"#FFFDF3",marginBottom:4}}>{log.name}</div>
              <div style={{fontSize:10,color:"#4A4845",marginBottom:10}}>Target: {log.sets} sets × {log.reps} reps</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <label style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#7A7774",fontWeight:700,display:"block",marginBottom:4}}>Weight Used</label>
                  <input value={log.actualWeight} onChange={e=>updateLog(i,"actualWeight",e.target.value)}
                    placeholder="e.g. 60kg" style={{width:"100%",padding:"10px 12px",background:"#111",border:"1px solid #222",color:"#FFFDF3",fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:500,outline:"none"}}/>
                </div>
                <div>
                  <label style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#7A7774",fontWeight:700,display:"block",marginBottom:4}}>Reps Completed</label>
                  <input value={log.actualReps} onChange={e=>updateLog(i,"actualReps",e.target.value)}
                    placeholder={log.reps} style={{width:"100%",padding:"10px 12px",background:"#111",border:"1px solid #222",color:"#FFFDF3",fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:500,outline:"none"}}/>
                </div>
              </div>
              <input value={log.notes} onChange={e=>updateLog(i,"notes",e.target.value)}
                placeholder="Notes (optional)" style={{width:"100%",marginTop:8,padding:"8px 12px",background:"#111",border:"1px solid #1A1A1A",color:"#7A7774",fontFamily:"'Montserrat',sans-serif",fontSize:12,outline:"none"}}/>
            </div>
          ))}
        </div>

        <div style={{padding:"12px 16px",borderTop:"1px solid #1A1A1A",flexShrink:0}}>
          <button onClick={handleSave} disabled={saving} style={{
            width:"100%",padding:14,background:"#F58020",border:"none",color:"#fff",
            fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,
            letterSpacing:3,textTransform:"uppercase",cursor:"pointer",
          }}>{saving?"Saving...":"Save Workout Log"}</button>
        </div>
      </div>
    </div>
  );
}

// ── WORKOUTS TAB ─────────────────────────────────────────
function WorkoutsTab({member,tiers,workouts:propWorkouts,programs,assignedWorkoutIds=[]}){
  const [workouts,setWorkouts]=useState(propWorkouts||[]);
  const [unlocks,setUnlocks]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [selected,setSelected]=useState(null);
  const [catFilter,setCatFilter]=useState("All");
  const [dayFilter,setDayFilter]=useState("All");
  const [toast,setToast]=useState({msg:"",on:false});
  const [redeeming,setRedeeming]=useState(null);
  const [logging,setLogging]=useState(null);
  const [loggedToday,setLoggedToday]=useState([]);
  const showToast=msg=>{setToast({msg,on:true});setTimeout(()=>setToast(t=>({...t,on:false})),2600);};
  useEffect(()=>{
    getMemberUnlocks(member.id)
      .then(u=>setUnlocks(u||[]))
      .catch(()=>{})
      .finally(()=>setLoaded(true));
    getWorkoutLogs(member.id)
      .then(logs=>setLoggedToday((logs||[]).filter(l=>l.date===today()).map(l=>l.workout_id)))
      .catch(()=>{});
  },[member.id]);
  useEffect(()=>{ if(propWorkouts?.length) setWorkouts(propWorkouts); },[propWorkouts]);

  const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const todayDay=dayNames[new Date().getDay()];
  const programWorkoutIds=dayFilter==="All"
    ? null
    : (programs||[]).flatMap(p=>(p.schedule?.[dayFilter]||[]));
  const isUnlocked=wid=>unlocks.some(u=>u.workoutId===wid);
  const memberTier=getTier(member.points,tiers);
  const tierOrder=["Iron","Bronze","Silver","Gold","Elite"];
  const canAccess=w=>{
    if(w.access_type==="free") return true;
    if(w.access_type==="private") return assignedWorkoutIds.includes(w.id);
    if((w.access_type==="points"||w.access_type==="paid")&&isUnlocked(w.id)) return true;
    if(w.access_type==="tier"){const ri=tierOrder.indexOf(w.tier_required);const mi=tierOrder.indexOf(memberTier.name);return mi>=ri;}
    return false;
  };
  const handleRedeem=async w=>{
    if(member.points<w.points_cost){showToast("Not enough points");return;}
    setRedeeming(w.id);
    const unlock={id:genId("UNL"),workoutId:w.id,memberId:member.id,unlockedBy:"points",date:today()};
    await unlockWorkout(unlock);
    await upsertMember({...member,points:member.points-w.points_cost});
    await addTransaction({id:genId("TXN"),memberId:member.id,memberName:member.name,type:"redeem",pts:-w.points_cost,note:`Unlocked: ${w.title}`,date:today()});
    setUnlocks(prev=>[...prev,unlock]);
    setRedeeming(null);showToast(`Unlocked: ${w.title}!`);
  };
  const cats=["All",...new Set(workouts.map(w=>w.category))];
  const filtered=workouts.filter(w=>{
    if(catFilter!=="All"&&w.category!==catFilter) return false;
    if(programWorkoutIds!==null&&!programWorkoutIds.includes(w.id)) return false;
    // hide private workouts the member isn't assigned to
    if(w.access_type==="private"&&!assignedWorkoutIds.includes(w.id)) return false;
    return true;
  });
  if(!loaded) return <div style={{padding:20,fontSize:12,color:"#4A4845",fontWeight:300}}>Loading…</div>;
  if(selected){
    const w=selected;const accessible=canAccess(w);const exercises=Array.isArray(w.exercises)?w.exercises:[];
    return(
      <div className="tab-content">
        <div style={{padding:"14px 16px",background:"#0A0A0A",borderBottom:"1px solid #1A1A1A",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setSelected(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F58020" strokeWidth="1.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            <span style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#F58020",fontWeight:700}}>Back</span>
          </div>
          {canAccess(w)&&Array.isArray(w.exercises)&&w.exercises.length>0&&(
            <button onClick={()=>setLogging(w)} style={{
              padding:"7px 14px",background:loggedToday.includes(w.id)?"#1A1A1A":"#F58020",
              border:"none",color:loggedToday.includes(w.id)?"#2D9B5A":"#fff",
              fontFamily:"'Montserrat',sans-serif",fontSize:9,fontWeight:700,
              letterSpacing:2,textTransform:"uppercase",cursor:"pointer",
            }}>{loggedToday.includes(w.id)?"✓ Logged Today":"Log Workout"}</button>
          )}
        </div>
        {w.thumbnail_url&&<div style={{width:"100%",height:180,overflow:"hidden",background:"#111"}}><img src={w.thumbnail_url} alt={w.title} style={{width:"100%",height:"100%",objectFit:"cover",opacity:accessible?1:0.3}}/></div>}
        <div style={{padding:"16px"}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"#FFFDF3",marginBottom:4}}>{w.title}</div>
          <div style={{fontSize:10,color:"#4A4845",marginBottom:12,fontWeight:300}}>{w.category} · {w.difficulty} · {w.duration_mins} min</div>
          {w.description&&<div style={{fontSize:12,color:"#6A6764",lineHeight:1.7,marginBottom:16,fontWeight:300}}>{w.description}</div>}
          {!accessible&&(
            <div style={{background:"#111",border:"1px solid #1A1A1A",padding:16,marginBottom:16,textAlign:"center"}}>
              {w.access_type==="points"&&<><div style={{fontSize:13,color:"#C8C4BE",marginBottom:4,fontWeight:400}}>Unlock for {w.points_cost} points</div><div style={{fontSize:10,color:"#4A4845",marginBottom:12,fontWeight:300}}>You have {member.points.toLocaleString()} pts</div><button onClick={()=>handleRedeem(w)} disabled={member.points<w.points_cost||redeeming===w.id} style={{padding:"10px 24px",background:"#F58020",border:"none",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontSize:9,fontWeight:700,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",opacity:member.points<w.points_cost?.5:1}}>{redeeming===w.id?"Unlocking...":"Redeem Points"}</button></>}
              {w.access_type==="paid"&&<><div style={{fontSize:13,color:"#C8C4BE",marginBottom:4}}>{w.price_label||"Available for Purchase"}</div><div style={{fontSize:10,color:"#4A4845",fontWeight:300}}>Pay at the front desk — staff will unlock this for you</div></>}
              {w.access_type==="tier"&&<><div style={{fontSize:13,color:"#C8C4BE",marginBottom:4}}>Requires {w.tier_required} Tier</div><div style={{fontSize:10,color:"#4A4845",fontWeight:300}}>Keep earning points to unlock</div></>}
            </div>
          )}
          {accessible&&w.video_url&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#4A4845",fontWeight:700,marginBottom:8}}>Video</div>
              <div style={{position:"relative",paddingBottom:"56.25%",background:"#111"}}>
                <iframe src={w.video_url.replace("watch?v=","embed/").replace("youtu.be/","youtube.com/embed/")} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
              </div>
            </div>
          )}
          {accessible&&w.pdf_url&&(
            <a href={w.pdf_url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:12,background:"#111",border:"1px solid #1A1A1A",padding:14,color:"#FFFDF3",textDecoration:"none",marginBottom:16}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F58020" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:400,color:"#C8C4BE"}}>Download Workout Plan</div><div style={{fontSize:10,color:"#4A4845",fontWeight:300}}>PDF Guide</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F58020" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
            </a>
          )}
          {accessible&&exercises.length>0&&(
            <div>
              <div style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#4A4845",fontWeight:700,marginBottom:10}}>Exercises</div>
              {exercises.map((ex,i)=>(
                <div key={i} style={{background:"#111",border:"1px solid #1A1A1A",padding:12,marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#C8C4BE"}}>{ex.name}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#F58020"}}>{ex.sets}×{ex.reps}</div>
                  </div>
                  {ex.weight&&<div style={{fontSize:10,color:"#4A4845",fontWeight:300}}>Weight: {ex.weight}</div>}
                  {ex.rest&&<div style={{fontSize:10,color:"#4A4845",fontWeight:300}}>Rest: {ex.rest}</div>}
                  {ex.notes&&<div style={{fontSize:10,color:"#6A6764",marginTop:3,fontStyle:"italic",fontWeight:300}}>{ex.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
        {logging&&<WorkoutLogModal workout={logging} member={member} onClose={()=>setLogging(null)} onSaved={()=>{setLoggedToday(prev=>[...prev,logging.id]);setLogging(null);showToast("Workout logged! 💪");}}/>}
      </div>
    );
  }
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px)"}}>
      <div className="wkt-header"><div className="wkt-title">Workout Library</div></div>
      <div className="pills">
        {cats.map(c=><button key={c} className={`pill${catFilter===c?" on":""}`} onClick={()=>setCatFilter(c)}>{c}</button>)}
      </div>
      {(programs||[]).length>0&&(
        <div className="pills" style={{borderTop:"1px solid #1A1A1A"}}>
          <button className={`pill${dayFilter==="All"?" on":""}`} onClick={()=>setDayFilter("All")}>All Days</button>
          {["Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
            <button key={d} className={`pill${dayFilter===d?" on":""}${d===todayDay?" ":""}`} onClick={()=>setDayFilter(d)}
              style={d===todayDay?{borderColor:"rgba(245,128,32,.4)",color:"#F58020"}:{}}>
              {d}{d===todayDay?" ·":""}</button>
          ))}
        </div>
      )}
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0&&<div style={{padding:20,fontSize:12,color:"#4A4845",fontWeight:300}}>No workouts yet.</div>}
        {filtered.map((w,idx)=>{
          const accessible=canAccess(w);
          return(
            <div key={w.id} className="wkt-card" style={{animationDelay:`${idx*0.04}s`}} onClick={()=>setSelected(w)}>
              <div className="wkt-thumb">
                {w.thumbnail_url?<img src={w.thumbnail_url} alt={w.title} style={{width:"100%",height:"100%",objectFit:"cover",opacity:accessible?1:0.3}}/>:<div className="wkt-thumb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4v16M18 4v16M6 12h12"/></svg></div>}
                {!accessible&&<div className="wkt-lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="1"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>}
              </div>
              <div className="wkt-info">
                <div><div className="wkt-name">{w.title}</div><div className="wkt-meta">{w.category} · {w.difficulty} · {w.duration_mins}m</div></div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",gap:6,fontSize:9,color:"#4A4845"}}>
                    {w.video_url&&<span>Video</span>}{w.pdf_url&&<span>PDF</span>}{Array.isArray(w.exercises)&&w.exercises.length>0&&<span>{w.exercises.length} ex.</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {loggedToday.includes(w.id)&&<span style={{fontSize:8,letterSpacing:1.5,background:"rgba(45,155,90,.1)",color:"#2D9B5A",padding:"2px 6px",fontWeight:700,textTransform:"uppercase"}}>✓ Done</span>}
                    <span className={`wkt-access${accessible?w.access_type==="free"?" free":" unlocked":" locked"}`}>
                      {accessible?w.access_type==="free"?"Free":"Unlocked":w.access_type==="points"?`${w.points_cost} pts`:w.access_type==="tier"?w.tier_required:"Paid"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {logging&&<WorkoutLogModal workout={logging} member={member} onClose={()=>setLogging(null)} onSaved={()=>{setLoggedToday(prev=>[...prev,logging.id]);setLogging(null);showToast("Workout logged! 💪");}}/>}
      <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
    </div>
  );
}

// ── CHALLENGES TAB ───────────────────────────────────────
function ChallengesTab({member,challenges}){
  const [enrollments,setEnrollments]=useState([]);
  const [joining,setJoining]=useState(null);
  const [toast,setToast]=useState({msg:"",on:false});
  const showToast=msg=>{setToast({msg,on:true});setTimeout(()=>setToast(t=>({...t,on:false})),2600);};
  useEffect(()=>{if(member.id)getMemberEnrollments(member.id).then(setEnrollments);},[member.id]);
  const isEnrolled=cid=>enrollments.find(e=>e.challengeId===String(cid));
  const handleJoin=async c=>{
    if(joining)return;setJoining(c.id);
    const enrollment={id:genId("ENR"),challengeId:String(c.id),challengeName:c.name,memberId:member.id,memberName:member.name,progress:0,goal:c.goal||1,enrolledDate:today()};
    await enrollInChallenge(enrollment);
    setEnrollments(prev=>[...prev,{...enrollment,completed:false}]);
    setJoining(null);showToast(`Joined: ${c.name}`);
  };
  const active=challenges.filter(c=>{const e=isEnrolled(c.id);return e&&!e.completed;});
  const available=challenges.filter(c=>!isEnrolled(c.id));
  const completed=challenges.filter(c=>{const e=isEnrolled(c.id);return e&&e.completed;});

  const ChItem=({c,idx})=>{
    const enrolled=isEnrolled(c.id);
    const progress=enrolled?enrolled.progress:0;
    const goal=c.goal||1;
    const pct=Math.min(100,Math.round((progress/goal)*100));
    const done=enrolled?.completed;
    return(
      <div className="ch-item" style={{animationDelay:`${idx*0.06}s`}}>
        <div className="ch-row">
          <div className="ch-icon">
            <IconSVG id={c.id_icon||c.icon||"trophy"} size={16} color="#F58020"/>
          </div>
          <div style={{flex:1}}>
            <div className="ch-title">{c.name}</div>
            <div className="ch-desc">{c.desc}</div>
          </div>
          {done && <div className="ch-badge done">✓ Done</div>}
          {!done && enrolled && <div className="ch-badge joined">Joined</div>}
        </div>
        <div className="ch-meta">
          <div className="ch-dl">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            {c.deadline}
          </div>
          <div className="ch-pts">+{c.pts} PTS</div>
        </div>
        {enrolled && !done && (
          <>
            <div className="ch-bar"><div className="ch-bar-fill" style={{width:`${pct}%`}}/></div>
            <div className="ch-bar-labels"><span>{progress}/{goal}</span><span>{pct}%</span></div>
          </>
        )}
        {!enrolled && !done && (
          <button
            className="ch-join-btn"
            onClick={()=>handleJoin(c)}
            disabled={joining===c.id}
          >
            {joining===c.id ? "Joining…" : "Join Challenge"}
          </button>
        )}
      </div>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px)"}}>
      <div style={{padding:"14px 16px 10px",background:"#0A0A0A",borderBottom:"1px solid #1A1A1A",flexShrink:0}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#C8C4BE"}}>Challenges</div>
        <div style={{fontSize:9,color:"#4A4845",marginTop:2,fontWeight:300}}>{active.length} active · {available.length} available · {completed.length} done</div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {active.length>0&&<><div style={{padding:"10px 16px 4px",fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#4A4845",fontWeight:700}}>In Progress</div>{active.map((c,i)=><ChItem key={c.id} c={c} idx={i}/>)}</>}
        {available.length>0&&<><div style={{padding:"10px 16px 4px",fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#4A4845",fontWeight:700}}>Available</div>{available.map((c,i)=><ChItem key={c.id} c={c} idx={i}/>)}</>}
        {completed.length>0&&<><div style={{padding:"10px 16px 4px",fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#4A4845",fontWeight:700}}>Completed</div>{completed.map((c,i)=><ChItem key={c.id} c={c} idx={i}/>)}</>}
        {challenges.length===0&&<div style={{padding:20,fontSize:12,color:"#4A4845",fontWeight:300}}>No challenges right now. Check back soon!</div>}
      </div>
      <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
    </div>
  );
}

// ── LOYALTY TAB ─────────────────────────────────────────
function LoyaltyTab({member,members,transactions,redemptions,rewards,tiers,earnRules,memberId,onRequest}){
  const [sub,setSub]=useState("activity");
  const myTxns=transactions.filter(t=>t.memberId===memberId||t.member_id===memberId).slice(0,20);
  const myRdms=redemptions.filter(r=>r.memberId===memberId||r.member_id===memberId);
  const pendingNames=myRdms.filter(r=>r.status==="pending").map(r=>r.reward);
  const rules=earnRules&&earnRules.length>0?earnRules:HOW_TO_EARN;
  const cur=getTier(member.points,tiers);
  const sorted=[...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points);
  const [catFilter,setCatFilter]=useState("All");
  const cats=["All","Access","Merch","Training"];
  const rList=catFilter==="All"?rewards:rewards.filter(r=>r.cat===catFilter);

  const actIcon={
    checkin:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>,
    class:<svg viewBox="0 0 24 24"><path d="M6 4v16M18 4v16M6 12h12"/></svg>,
    referral:<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
    bonus:<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    challenge:<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    redeem:<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="1"/><path d="M16 12H8"/></svg>,
    manual:<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>,
    deduct:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px)"}}>
      <div className="balance-hero">
        <div className="bal-lbl">Your Balance</div>
        <AnimatedNumber value={member.points} className="bal-val"/>
        <div className="bal-sub">points available to redeem</div>
      </div>
      <div className="ltabs">
        {["activity","rewards","earn","rankings"].map(s=>(
          <button key={s} id={`ltab-${s}`} className={`ltab${sub===s?" on":""}`} onClick={()=>setSub(s)}>{s}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto"}} key={sub}>
        {sub==="activity"&&(
          <div className="tab-content">
            {myTxns.length===0?<div style={{padding:20,fontSize:12,color:"#4A4845",fontWeight:300}}>No activity yet.</div>:myTxns.map((a,idx)=>(
              <div key={a.id} className="data-row" style={{animationDelay:`${idx*0.05}s`}}>
                <div className={`data-icon${a.pts>0?" hi":""}`}>{actIcon[a.type]||actIcon.checkin}</div>
                <div className="data-lbl"><div className="data-main">{a.note}</div><div className="data-sub">{fmtDate(a.date)}</div></div>
                <div className={`data-val${a.pts>0?" pos":" neg"}`}>{a.pts>0?"+":""}{a.pts}</div>
              </div>
            ))}
          </div>
        )}
        {sub==="rewards"&&(
          <div className="tab-content">
            {myRdms.filter(r=>r.status==="pending").length>0&&(
              <div style={{padding:"10px 16px",background:"#111",borderBottom:"1px solid #1A1A1A",fontSize:10,color:"#4A4845",fontWeight:300}}>
                {myRdms.filter(r=>r.status==="pending").length} redemption{myRdms.filter(r=>r.status==="pending").length>1?"s":""} pending — see the front desk
              </div>
            )}
            <div className="pills" style={{background:"#0A0A0A"}}>{cats.map(c=><button key={c} className={`pill${catFilter===c?" on":""}`} onClick={()=>setCatFilter(c)}>{c}</button>)}</div>
            {rList.map((r,idx)=>{
              const ip=pendingNames.includes(r.name);
              return(
                <div key={r.id} className="rwd-row" style={{animationDelay:`${idx*0.04}s`,opacity:r.stock?1:0.4}}>
                  <div className="rwd-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12v10H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg></div>
                  <div className="rwd-info"><div className="rwd-name">{r.name}</div><div className="rwd-cat">{r.cat}</div></div>
                  <div className="rwd-pts">{r.pts.toLocaleString()}</div>
                  <button className={`rwd-btn${ip?" pending":!r.stock||member.points<r.pts?" locked":""}`} disabled={(!ip&&member.points<r.pts)||!r.stock} onClick={()=>!ip&&onRequest(r)}>{ip?"Pending":member.points<r.pts?"Need more":"Get"}</button>
                </div>
              );
            })}
          </div>
        )}
        {sub==="earn"&&(
          <div className="tab-content">
            <div style={{padding:"10px 16px 4px",fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#4A4845",fontWeight:700}}>Tier Path</div>
            <div className="tier-ladder">
              {[...tiers].sort((a,b)=>a.min-b.min).map(t=>(
                <div key={t.id} className={`tier-rung${t.name===cur.name?" cur":""}`}>
                  <div className="tier-rung-name" style={{color:t.name===cur.name?t.color:"#333130"}}>{t.name}</div>
                  <div className="tier-rung-min">{t.min.toLocaleString()}+</div>
                </div>
              ))}
            </div>
            <div style={{padding:"10px 16px 4px",fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#4A4845",fontWeight:700}}>Ways to Earn</div>
            {rules.map((r,idx)=>(
              <div key={r.id||idx} className="earn-row" style={{animationDelay:`${idx*0.04}s`}}>
                <div className="earn-icon">{r.icon||r.action?.slice(0,2)||"—"}</div>
                <div style={{flex:1}}><div className="earn-action">{r.action}</div><div className="earn-note">{r.note}</div></div>
                <div className="earn-pts">{typeof r.pts==="number"?`+${r.pts}`:r.pts}</div>
              </div>
            ))}
          </div>
        )}
        {sub==="rankings"&&(
          <div className="tab-content">
            {sorted.slice(0,10).map((m,i)=>{
              const r=i+1;
              return(
                <div key={m.id} className={`lb-row${m.id===memberId?" me":""}`} style={{animationDelay:`${i*0.05}s`}}>
                  <div className={`lb-rank${r<=3?" top":""}`}>{r}</div>
                  <div className={`lb-av${r===1?" top":""}`} style={r===2?{color:"#888",background:"rgba(136,136,136,.08)"}:r===3?{color:"#8B6534",background:"rgba(139,101,52,.08)"}:{}}>{initials(m.name)}</div>
                  <div style={{flex:1}}><div className="lb-name">{m.name}{m.id===memberId&&<span className="lb-you">You</span>}</div><div className="lb-streak">{m.streak}d streak</div></div>
                  <div className="lb-pts">{m.points.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PROFILE TAB ─────────────────────────────────────────
function ProfileTab({member,tiers,onLogout,onRefresh}){
  const tier=getTier(member.points,tiers);
  const next=getNext(member.points,tiers);
  const tierPct=next?Math.round(((member.points-tier.min)/(next.min-tier.min))*100):100;
  const copy=()=>{try{navigator.clipboard.writeText(member.referral_code||"");}catch{}};
  return(
    <div className="tab-content" style={{paddingBottom:80}}>
      <div className="profile-hdr">
        <div className="profile-av">{initials(member.name)}</div>
        <div>
          <div className="profile-name">{member.name}</div>
          <div className="profile-id">{member.id}</div>
          <div className="profile-tier" style={{color:tier.color}}>{tier.icon} {tier.name} Tier</div>
        </div>
      </div>
      <div className="info-group-title">Points & Tier</div>
      <div className="info-row"><span className="info-lbl">Balance</span><AnimatedNumber value={member.points} className="info-val acc"/></div>
      <div className="info-row"><span className="info-lbl">Tier</span><span className="info-val" style={{color:tier.color}}>{tier.name}</span></div>
      {next&&<div className="info-row"><span className="info-lbl">Next Tier</span><span className="info-val" style={{fontSize:11,color:"#4A4845",fontWeight:300}}>{(next.min-member.points).toLocaleString()} pts to {next.name}</span></div>}
      {next&&<div style={{padding:"8px 16px",background:"#111",borderBottom:"1px solid #1A1A1A"}}><div style={{height:1,background:"#1A1A1A"}}><div style={{height:"100%",width:`${tierPct}%`,background:tier.color,transition:"width 1.4s cubic-bezier(0.16,1,0.3,1)"}}/></div></div>}
      <div className="info-group-title">My Details</div>
      <div className="info-row"><span className="info-lbl">Phone</span><span className="info-val">{member.phone}</span></div>
      <div className="info-row"><span className="info-lbl">Member Since</span><span className="info-val">{member.joinDate?new Date(member.joinDate).toLocaleDateString("en-GB",{month:"short",year:"numeric"}):"—"}</span></div>
      <div className="info-row"><span className="info-lbl">Birthday</span><span className="info-val">{member.birthday?new Date(member.birthday+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long"}):"Not set"}</span></div>
      <div className="info-row"><span className="info-lbl">Check-ins</span><span className="info-val">{member.checkins}</span></div>
      <div className="info-row"><span className="info-lbl">Streak</span><span className="info-val">{member.streak} days</span></div>
      {member.referral_code&&(
        <div className="ref-box" style={{marginTop:1}}>
          <div className="ref-lbl">Your Referral Code</div>
          <div className="ref-code" onClick={copy}>{member.referral_code}</div>
          <div className="ref-hint">Tap to copy · Share with friends · Earn 500 pts when they join</div>
          <div style={{marginTop:10,fontSize:9,color:"#333130",textAlign:"center"}}>loyalty.uruzathletics.fit?ref={member.referral_code}</div>
        </div>
      )}
      <div style={{padding:"12px 16px",display:"flex",gap:8}}>
        <button onClick={onRefresh} style={{flex:1,padding:10,background:"none",border:"1px solid #1A1A1A",color:"#4A4845",fontFamily:"'Montserrat',sans-serif",fontSize:8,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Refresh</button>
        <button className="signout-btn" style={{flex:2,margin:0}} onClick={onLogout}>Sign Out</button>
      </div>
    </div>
  );
}

// ── RANKINGS OVERLAY ─────────────────────────────────────
function RankingsOverlay({ members, memberId, tiers, onClose }) {
  const sorted = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points);
  return (
    <div style={{
      position:"fixed",inset:0,background:"#0A0A0A",zIndex:300,
      display:"flex",flexDirection:"column",
      animation:"fadeUp .3s cubic-bezier(0.16,1,0.3,1) both",
    }}>
      <div style={{
        height:48,background:"#0A0A0A",borderBottom:"1px solid #1A1A1A",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 16px",flexShrink:0,
      }}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#C8C4BE"}}>Rankings</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#7A7774",fontSize:11,letterSpacing:2,textTransform:"uppercase",fontWeight:700,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>Close</button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {sorted.map((m,i)=>{
          const rank=i+1;
          const isMe=m.id===memberId;
          const rankColor=rank===1?"#C9A84C":rank===2?"#888":rank===3?"#8B6534":"#555";
          return(
            <div key={m.id} style={{
              display:"flex",alignItems:"center",gap:12,
              padding:"12px 16px",
              borderBottom:"1px solid #1A1A1A",
              background:isMe?"#131308":"#111",
              borderLeft:isMe?"1px solid #F58020":"none",
              animation:`slideRight .3s cubic-bezier(0.16,1,0.3,1) ${i*0.04}s both`,
            }}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,width:32,textAlign:"center",color:rankColor,flexShrink:0}}>{rank}</div>
              <div style={{
                width:36,height:36,background:"#1C1C1C",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:700,color:rank<=3?rankColor:"#555",flexShrink:0,
              }}>{initials(m.name)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:isMe?"#FFFDF3":"#E8E4DE",display:"flex",alignItems:"center",gap:6}}>
                  {m.name}
                  {isMe&&<span style={{fontSize:8,letterSpacing:1.5,textTransform:"uppercase",color:"#F58020",background:"rgba(245,128,32,.1)",padding:"1px 5px",fontWeight:700}}>You</span>}
                </div>
                <div style={{fontSize:10,color:"#7A7774",marginTop:1,fontWeight:400}}>{m.streak||0}d streak · {m.checkins||0} check-ins</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:rank===1?"#F58020":"#C8C4BE"}}>{m.points.toLocaleString()}</div>
            </div>
          );
        })}
        {sorted.length===0&&<div style={{padding:24,fontSize:12,color:"#4A4845",textAlign:"center"}}>No members yet.</div>}
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────
const TABS=[
  {id:"home",     label:"Home",       icon:<svg viewBox="0 0 24 24"><path d="M3 12L12 3l9 9"/><path d="M5 10v9h5v-5h4v5h5v-9"/></svg>},
  {id:"workouts", label:"Workouts",   icon:<svg viewBox="0 0 24 24"><path d="M6.5 8.5v7M17.5 8.5v7"/><rect x="4" y="7" width="5" height="10" rx="1.5"/><rect x="15" y="7" width="5" height="10" rx="1.5"/><line x1="9" y1="12" x2="15" y2="12" strokeWidth="2.5"/></svg>},
  {id:"challenges",label:"Challenges",icon:<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M17 5h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4"/><path d="M7 5H5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4"/><path d="M12 17a6 6 0 0 0 6-6V3H6v8a6 6 0 0 0 6 6z"/></svg>},
  {id:"loyalty",  label:"Loyalty",    icon:<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>},
  {id:"profile",  label:"Profile",    icon:<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>},
];

export default function MemberCentral(){
  const [memberId,setMemberId]       = useState(null);
  const [member,setMember]           = useState(null);
  const [members,setMembers]         = useState([]);
  const [transactions,setTxns]       = useState([]);
  const [redemptions,setRdms]        = useState([]);
  const [rewards,setRewards]         = useState(DEF_REWARDS);
  const [tiers,setTiers]             = useState(DEF_TIERS);
  const [challenges,setChallenges]   = useState(DEF_CHALLENGES);
  const [earnRules,setEarnRules]     = useState(HOW_TO_EARN);
  const [enrollments,setEnrollments] = useState([]);
  const [workouts,setWorkouts]       = useState([]);
  const [programs,setPrograms]       = useState([]);
  const [assignedWorkoutIds,setAssignedWorkoutIds] = useState([]);
  const [homeMessages,setHomeMsgs]   = useState(URUZ_QUOTES);
  const [tab,setTab]                 = useState("home");
  const [showRankings,setShowRankings] = useState(false);
  const [loaded,setLoaded]           = useState(false);
  const [toast,setToast]             = useState({msg:"",on:false});
  const [tierCelebration,setTierCelebration] = useState(null);
  const showToast=msg=>{setToast({msg,on:true});setTimeout(()=>setToast(t=>({...t,on:false})),2600);};

  const loadData=async id=>{
    const mid=id||memberId;
    const [m,t,r,rw,ti,ds,er,wk]=await Promise.all([
      getMembers(),getTransactions(),getRedemptions(),getRewards(),getTiers(),getDisplaySettings(),getEarnRules(),getWorkouts()
    ]);
    const normalized=m.map(normalizeMember);
    setMembers(normalized);setTxns(t);setRdms(r);
    setRewards(rw.length?rw:DEF_REWARDS);
    setTiers(ti.length?ti:DEF_TIERS);
    if(er&&er.length>0) setEarnRules(er.filter(x=>x.active));
    if(wk?.length) setWorkouts(wk);
    try { const pg=await getPrograms(); if(pg?.length) setPrograms(pg); } catch{}
    // load member's assigned programs to determine private workout access
    try {
      const memberAssignments = await getMemberProgramsByMember(mid);
      const pg = await getPrograms();
      if(pg?.length) setPrograms(pg);
      const wkIds = memberAssignments.flatMap(a => {
        const prog = pg.find(p => p.id === a.programId);
        if(!prog) return [];
        return Object.values(prog.schedule || {}).flat();
      });
      setAssignedWorkoutIds([...new Set(wkIds)]);
    } catch { setAssignedWorkoutIds([]); }
    if(ds){try{const cfg=JSON.parse(ds.config||"{}");if(cfg.challenges?.length)setChallenges(cfg.challenges.filter(c=>c.active!==false));if(cfg.homeMessages?.length)setHomeMsgs(cfg.homeMessages);}catch{}}
    const found=normalized.find(x=>x.id===mid);
    setMember(found||null);setLoaded(true);
    if(found){
      const tierKey=`uruz:tier:${found.id}`;
      const lastTier=localStorage.getItem(tierKey);
      const currentTier=[...(ti.length?ti:DEF_TIERS)].sort((a,b)=>b.min-a.min).find(t=>found.points>=t.min);
      if(currentTier&&lastTier&&lastTier!==currentTier.name) setTierCelebration(currentTier);
      if(currentTier) localStorage.setItem(tierKey,currentTier.name);
      if(!found.referral_code){const rc="URUZ-"+found.id.slice(-5).toUpperCase();await upsertMember({...found,referral_code:rc});}
      if(found.birthday){
        const todayStr=new Date().toISOString().slice(5,10);
        const bday=found.birthday.slice(5,10);
        const bdayKey=`uruz:bday:${found.id}:${new Date().getFullYear()}`;
        if(todayStr===bday&&!localStorage.getItem(bdayKey)){
          const BDAY_PTS=300;
          await upsertMember({...found,points:found.points+BDAY_PTS});
          await addTransaction({id:genId("TXN"),memberId:found.id,memberName:found.name,type:"bonus",pts:BDAY_PTS,note:"Birthday Bonus",date:today()});
          localStorage.setItem(bdayKey,"1");
        }
      }
      if(mid) getMemberEnrollments(mid).then(setEnrollments);
    }
  };

  useEffect(()=>{
    const session=getSession();
    if(session?.memberId){setMemberId(session.memberId);loadData(session.memberId);}
  },[]);

  useEffect(()=>{
    const handlePop=()=>{setTab(prev=>{if(prev==="home"){window.history.pushState(null,"",window.location.href);return prev;}return "home";});};
    window.history.pushState(null,"",window.location.href);
    window.addEventListener("popstate",handlePop);
    return()=>window.removeEventListener("popstate",handlePop);
  },[memberId]);
  useEffect(()=>{if(memberId)window.history.pushState({tab},"",window.location.href);},[tab]);

  const handleLogin=id=>{setMemberId(id);loadData(id);};
  const handleLogout=()=>{clearSession();setMemberId(null);setMember(null);setLoaded(false);};
  const handleRequest=async reward=>{
    const rdm={id:genId("RDM"),memberId:member.id,memberName:member.name,reward:reward.name,pts:reward.pts,status:"pending",date:today()};
    await addRedemption(rdm);setRdms(prev=>[rdm,...prev]);
    showToast(`Requested: ${reward.name} — see the front desk`);
  };

  if(!memberId) return <LoginFlow onLogin={handleLogin}/>;
  if(!loaded||!member) return(<><style>{CSS}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0A0A0A"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:6,color:"#F58020"}}>LOADING</div></div></>);

  return(
    <>
      <style>{CSS}</style>
      <InstallPrompt/>
      <div className="app">
        <div className="topbar">
          <img src={LOGO_URL} alt="URUZ" className="topbar-logo"/>
          <div style={{fontSize:8,letterSpacing:2.5,textTransform:"uppercase",color:"#4A4845",fontWeight:600,textAlign:"right",lineHeight:1.5}}>
            Built for the neighborhood<br/>
            <span style={{color:"#F58020"}}>Powered by you</span>
          </div>
        </div>
        <div key={tab}>
          {tab==="home"       &&<HomeTab member={member} members={members} transactions={transactions} tiers={tiers} challenges={challenges} enrollments={enrollments} workouts={workouts} programs={programs} homeMessages={homeMessages} onTabChange={setTab} onShowRankings={()=>setShowRankings(true)}/>}
          {tab==="workouts"   &&<WorkoutsTab member={member} tiers={tiers} workouts={workouts} programs={programs} assignedWorkoutIds={assignedWorkoutIds}/>}
          {tab==="challenges" &&<ChallengesTab member={member} challenges={challenges}/>}
          {tab==="loyalty"    &&<LoyaltyTab member={member} members={members} transactions={transactions} redemptions={redemptions} rewards={rewards} tiers={tiers} earnRules={earnRules} memberId={member.id} onRequest={handleRequest}/>}
          {tab==="profile"    &&<ProfileTab member={member} tiers={tiers} onLogout={handleLogout} onRefresh={()=>loadData()}/>}
        </div>
        <div className="bottom-nav">
          {TABS.map(t=>(
            <button key={t.id} className={`nav-btn${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)}>
              {t.icon}<span className="nav-lbl">{t.label}</span>
            </button>
          ))}
        </div>
        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
        {showRankings&&<RankingsOverlay members={members} memberId={member.id} tiers={tiers} onClose={()=>setShowRankings(false)}/>}
        {tierCelebration&&<TierCelebration tier={tierCelebration} onDismiss={()=>setTierCelebration(null)}/>}
      </div>
    </>
  );
}
