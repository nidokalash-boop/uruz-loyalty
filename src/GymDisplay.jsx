import { useState, useEffect, useRef } from "react";
import { getMembers, getTransactions, getTiers, getDisplaySettings } from "./supabase";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@200;300;400;500;600;700&display=swap');`;
const LOGO_URL = "https://raw.githubusercontent.com/nidokalash-boop/uruz-loyalty/main/URUZ%20LOGO%2001-10%20(1).png";


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


const DEF_TIERS = [
  { id:"t1", name:"Iron",   min:0,     color:"#555" },
  { id:"t2", name:"Bronze", min:1000,  color:"#8B6534" },
  { id:"t3", name:"Silver", min:2500,  color:"#888" },
  { id:"t4", name:"Gold",   min:5000,  color:"#C9A84C" },
  { id:"t5", name:"Elite",  min:10000, color:"#F58020" },
];
const DEF_CHALLENGES = [
  { id:1, name:"Weekly Warrior",  desc:"Check in 5× this week",         pts:150,  deadline:"3 days",  active:true, goal:5  },
  { id:2, name:"Iron Will",       desc:"15-day consecutive streak",     pts:300,  deadline:"4 days",  active:true, goal:15 },
  { id:3, name:"Bring the Crew",  desc:"Refer 2 new members",           pts:1000, deadline:"24 days", active:true, goal:2  },
  { id:4, name:"Early Bird",      desc:"Attend 3 AM classes this month",pts:200,  deadline:"12 days", active:true, goal:3  },
];
const DEF_TICKERS = [
  "Train your strength — every visit earns points",
  "Refer a friend and earn 500 pts",
  "Join the movement — every body belongs here",
  "Personal Training earns 100 pts — book today",
  "Built for the neighborhood — powered by you",
];

function getTier(pts, tiers) { return [...tiers].sort((a,b)=>b.min-a.min).find(t=>pts>=t.min)||tiers[0]; }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function useClock() {
  const [t,setT]=useState(new Date());
  useEffect(()=>{const i=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(i);},[]);
  return t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}
function timeAgo(d) {
  const diff=(Date.now()-new Date(d))/60000;
  if(diff<2) return "just now";
  if(diff<60) return `${Math.floor(diff)}m ago`;
  if(diff<1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}

// Animated counter hook
function useCounter(target, duration=1200, trigger) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now()-start)/duration, 1);
      const ease = 1 - Math.pow(1-p, 3);
      setVal(Math.floor(ease * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, trigger]);
  return val;
}

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{width:100%;height:100%;background:#050505;overflow:hidden;margin:0;padding:0;}

@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideLeft{from{opacity:0;transform:translateX(40px);}to{opacity:1;transform:translateX(0);}}
@keyframes slideRight{from{opacity:0;transform:translateX(-40px);}to{opacity:1;transform:translateX(0);}}
@keyframes ticker{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(245,128,32,0);}50%{box-shadow:0 0 20px 4px rgba(245,128,32,.15);}}
@keyframes barFill{from{width:0;}to{width:var(--target-width);}}
@keyframes countUp{from{opacity:0;}to{opacity:1;}}

.display{width:100vw;height:100vh;background:#050505;color:#FFFDF3;font-family:'Montserrat',sans-serif;display:flex;flex-direction:column;overflow:hidden;position:relative;box-sizing:border-box;}

/* Subtle noise texture overlay */
/* noise texture removed for display compatibility */

/* TOPBAR */
.topbar{
  height:54px;min-height:54px;max-height:54px;flex-shrink:0;
  background:#050505;
  border-bottom:1px solid #111;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 32px;
  position:relative;z-index:10;
}
.brand{display:flex;align-items:center;gap:14px;}
.brand-sep{width:1px;height:20px;background:#151515;}
.brand-sub{font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#333;font-weight:700;font-family:'Montserrat',sans-serif;}
.topbar-center{display:flex;align-items:center;gap:20px;}
.live-badge{display:flex;align-items:center;gap:7px;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#444;font-weight:700;}
.live-dot{width:6px;height:6px;border-radius:50%;background:#2D9B5A;animation:pulse 2s ease infinite;}
.slide-dots{display:flex;gap:6px;align-items:center;}
.dot{height:1px;background:#151515;transition:all .4s ease;}
.dot.on{background:#F58020;width:28px;}
.dot:not(.on){width:16px;}
.clock{font-family:'Bebas Neue',sans-serif;font-size:clamp(22px,2vw,34px);letter-spacing:4px;color:#666;}

/* SLIDE WRAPPER */
.slide-wrap{flex:1;position:relative;overflow:hidden;min-height:0;height:calc(100vh - 94px);max-height:calc(100vh - 94px);}
.slide{position:absolute;inset:0;padding:clamp(16px,2vw,32px) clamp(20px,2.5vw,40px);display:flex;flex-direction:column;}

/* SLIDE HEADER */
.slide-eyebrow{
  font-size:9px;letter-spacing:6px;text-transform:uppercase;
  color:#F58020;font-weight:700;opacity:.6;
  margin-bottom:20px;
  display:flex;align-items:center;gap:14px;
}
.slide-eyebrow::after{content:'';flex:1;height:1px;background:#111;}

/* LEADERBOARD */
.lb-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 48px;flex:1;}
.lb-entry{
  display:flex;align-items:center;gap:14px;
  padding:11px 0;border-bottom:1px solid #0E0E0E;
  animation:slideRight .5s cubic-bezier(0.16,1,0.3,1) both;
}
.lb-entry:last-child{border-bottom:none;}
.lb-rank{font-family:'Bebas Neue',sans-serif;font-size:clamp(22px,2.2vw,36px);width:clamp(30px,3vw,48px);text-align:center;flex-shrink:0;color:#888;letter-spacing:1px;}
.lb-rank.g{color:#C9A84C;}
.lb-rank.s{color:#555;}
.lb-rank.b{color:#6B4A1E;}
.lb-av{
  width:38px;height:38px;
  background:#0E0E0E;
  display:flex;align-items:center;justify-content:center;
  font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;
  flex-shrink:0;color:#222;
}
.lb-av.g{color:#C9A84C;background:rgba(201,168,76,.06);}
.lb-av.s{color:#555;background:rgba(85,85,85,.06);}
.lb-av.b{color:#6B4A1E;background:rgba(107,74,30,.06);}
.lb-info{flex:1;}
.lb-name{font-size:clamp(14px,1.4vw,22px);font-weight:600;color:#FFFDF3;letter-spacing:.3px;transition:color .3s;}
.lb-name.g{color:#FFFDF3;}
.lb-name.s{color:#FFFDF3;}
.lb-streak{font-size:10px;color:#7A7774;margin-top:2px;font-weight:400;}
.lb-streak.g{color:#9A9690;}
.lb-pts{font-family:'Bebas Neue',sans-serif;font-size:clamp(20px,2vw,32px);color:#FFFDF3;letter-spacing:1px;transition:color .3s;}
.lb-pts.g{color:#F58020;}
.lb-pts.s{color:#FFFDF3;}
.lb-pts.b{color:#FFFDF3;}

/* CHALLENGES SLIDE */
.ch-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;}
.ch-card{
  background:#0D0D0D;border:1px solid #111;
  padding:18px;display:flex;flex-direction:column;gap:10px;
  animation:fadeUp .5s cubic-bezier(0.16,1,0.3,1) both;
}
.ch-header{display:flex;align-items:center;gap:12px;}
.ch-icon-box{
  width:40px;height:40px;
  background:#111;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.ch-icon-box svg{width:17px;height:17px;stroke:#F58020;stroke-width:1.5;fill:none;}
.ch-name{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;color:#FFFDF3;line-height:1;}
.ch-desc{font-size:11px;color:#9A9690;margin-top:3px;font-weight:400;}
.ch-bar-row{display:flex;align-items:center;gap:10px;}
.ch-bar-bg{flex:1;height:2px;background:#151515;}
.ch-bar-fill{height:100%;background:#F58020;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);}
.ch-bar-pct{font-family:'Bebas Neue',sans-serif;font-size:14px;color:#F58020;min-width:32px;text-align:right;}
.ch-footer{display:flex;justify-content:space-between;align-items:center;}
.ch-reward{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#F58020;}
.ch-deadline{font-size:10px;color:#555;display:flex;align-items:center;gap:5px;font-weight:400;}
.ch-deadline svg{width:10px;height:10px;stroke:currentColor;stroke-width:2;fill:none;}
.ch-leaders{border-top:1px solid #111;padding-top:8px;}
.ch-leaders-lbl{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#7A7774;font-weight:700;margin-bottom:6px;}
.ch-leader{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.ch-leader-rank{font-family:'Bebas Neue',sans-serif;font-size:14px;color:#555;width:18px;}
.ch-leader-rank.top{color:#C9A84C;}
.ch-leader-av{width:22px;height:22px;background:#161616;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#666;flex-shrink:0;}
.ch-leader-name{font-size:12px;font-weight:600;color:#C8C4BE;flex:1;}
.ch-leader-pts{font-family:'Bebas Neue',sans-serif;font-size:14px;color:#C8C4BE;}

/* ACTIVITY SLIDE */
.act-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 40px;flex:1;}
.act-entry{
  display:flex;align-items:center;gap:14px;
  padding:12px 0;border-bottom:1px solid #0E0E0E;
  
}
.act-entry:last-child{border-bottom:none;}
.act-icon{
  width:40px;height:40px;background:#0D0D0D;border:1px solid #111;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.act-icon svg{width:16px;height:16px;stroke:#444;stroke-width:1.5;fill:none;}
.act-icon.pos svg{stroke:#2D9B5A;}
.act-info{flex:1;}
.act-who{font-size:16px;font-weight:700;color:#E8E4DE;letter-spacing:.3px;}
.act-what{font-size:11px;color:#8A8784;margin-top:2px;font-weight:400;}
.act-right{text-align:right;}
.act-pts{font-family:'Bebas Neue',sans-serif;font-size:22px;}
.act-pts.pos{color:#2D9B5A;}
.act-pts.neg{color:#3A1A1A;}
.act-time{font-size:10px;color:#444;margin-top:2px;font-weight:400;}

/* SPOTLIGHT SLIDE */
.spot-wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#111;flex:1;}
.spot-card{
  background:#050505;padding:24px 20px;
  text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;
  animation:fadeUp .6s cubic-bezier(0.16,1,0.3,1) both;
}
.spot-card.first{animation:fadeUp .4s cubic-bezier(0.16,1,0.3,1) both;}
.spot-rank{font-family:'Bebas Neue',sans-serif;font-size:clamp(40px,5vw,80px);line-height:1;letter-spacing:2px;}
.spot-av{
  width:68px;height:68px;
  display:flex;align-items:center;justify-content:center;
  font-family:'Bebas Neue',sans-serif;font-size:26px;
  letter-spacing:2px;
}
.spot-name{font-family:'Bebas Neue',sans-serif;font-size:clamp(22px,2.5vw,42px);letter-spacing:3px;}
.spot-label{font-size:8px;letter-spacing:4px;text-transform:uppercase;font-weight:700;margin-top:-6px;}
.spot-stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;width:100%;background:#111;margin-top:6px;}
.spot-stat{background:#050505;padding:9px 6px;text-align:center;}
.spot-stat-val{font-family:'Bebas Neue',sans-serif;font-size:20px;line-height:1;}
.spot-stat-lbl{font-size:7px;letter-spacing:2.5px;text-transform:uppercase;color:#7A7774;margin-top:2px;font-weight:600;}

/* TICKER */
.ticker-bar{
  height:40px;min-height:40px;max-height:40px;flex-shrink:0;
  background:#050505;border-top:1px solid #1A1A1A;
  display:flex;align-items:center;overflow:hidden;
  position:relative;z-index:10;
  width:100%;
}
.ticker-track{display:flex;white-space:nowrap;animation:ticker 240s linear infinite;}
.tick-item{
  display:inline-flex;align-items:center;gap:10px;
  padding:0 40px;
  font-family:'Montserrat',sans-serif;font-size:11px;
  font-weight:400;letter-spacing:2.5px;text-transform:uppercase;
  color:#1A1A1A;border-right:1px solid #0D0D0D;
}
.tick-dot{width:3px;height:3px;background:#F58020;flex-shrink:0;opacity:.4;}
`;

function LeaderboardSlide({members, tiers, slideIdx}) {
  const sorted = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,10);
  const half = Math.ceil(sorted.length/2);
  const rankClass = i => i===0?"g":i===1?"s":i===2?"b":"";
  return (
    <div className="slide" style={{animation:`fadeIn .5s ease both`}}>
      <div className="slide-eyebrow">Monthly Leaderboard</div>
      <div className="lb-cols">
        {[sorted.slice(0,half), sorted.slice(half)].map((col,ci)=>(
          <div key={ci}>
            {col.map((m,i)=>{
              const rank = ci*half+i;
              const rc = rankClass(rank);
              return(
                <div key={m.id} className="lb-entry" style={{animationDelay:`${rank*0.06}s`}}>
                  <div className={`lb-rank${rc?" "+rc:""}`}>#{rank+1}</div>
                  <div className={`lb-av${rc?" "+rc:""}`}>{initials(m.name)}</div>
                  <div className="lb-info">
                    <div className={`lb-name${rc?" "+rc:""}`}>{m.name}</div>
                    <div className={`lb-streak${rc?" "+rc:""}`}>{m.streak||0} day streak</div>
                  </div>
                  <CountUp target={m.points} className={`lb-pts${rc?" "+rc:""}`} trigger={slideIdx}/>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CountUp({target, className, trigger}) {
  const val = useCounter(target, 1400, trigger);
  return <div className={className}>{val.toLocaleString()}</div>;
}

function ChallengesSlide({members, challenges, slideIdx}) {
  const top5 = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,5);
  return (
    <div className="slide" style={{animation:`fadeIn .5s ease both`}}>
      <div className="slide-eyebrow">Active Challenges</div>
      <div className="ch-grid">
        {challenges.slice(0,4).map((c,i)=>{
          const pct = Math.round(((c.progress||0)/(c.goal||1))*100);
          return(
            <div key={c.id} className="ch-card" style={{animationDelay:`${i*0.08}s`}}>
              <div className="ch-header">
                <div className="ch-icon-box">
                  <IconSVG id={c.id_icon||c.icon||"trophy"} size={17} color="#F58020"/>
                </div>
                <div>
                  <div className="ch-name">{c.name}</div>
                  <div className="ch-desc">{c.desc}</div>
                </div>
              </div>
              <div className="ch-bar-row">
                <div className="ch-bar-bg"><div className="ch-bar-fill" style={{width:`${pct}%`}}/></div>
                <div className="ch-bar-pct">{pct}%</div>
              </div>
              <div className="ch-footer">
                <div className="ch-reward">+{c.pts} PTS</div>
                <div className="ch-deadline">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  {c.deadline}
                </div>
              </div>
              <div className="ch-leaders">
                <div className="ch-leaders-lbl">Top Members</div>
                {top5.map((m,j)=>(
                  <div key={m.id} className="ch-leader">
                    <div className={`ch-leader-rank${j===0?" top":""}`}>#{j+1}</div>
                    <div className="ch-leader-av">{initials(m.name)}</div>
                    <div className="ch-leader-name">{m.name}</div>
                    <div className="ch-leader-pts">{m.points.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivitySlide({transactions, slideIdx}) {
  const ACT_ICONS = {
    checkin:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>,
    class:<svg viewBox="0 0 24 24"><path d="M6 4v16M18 4v16M6 12h12"/></svg>,
    referral:<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
    bonus:<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    challenge:<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    redeem:<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="1"/><path d="M16 12H8"/></svg>,
    manual:<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>,
  };
  const recent = [...transactions].slice(0,8);
  const half = Math.ceil(recent.length/2);
  const Entry = ({a, idx}) => (
    <div className="act-entry">
      <div className={`act-icon${a.pts>0?" pos":""}`}>{ACT_ICONS[a.type]||ACT_ICONS.checkin}</div>
      <div className="act-info">
        <div className="act-who">{a.memberName||a.member_name}</div>
        <div className="act-what">{a.note}</div>
      </div>
      <div className="act-right">
        <div className={`act-pts${a.pts>0?" pos":" neg"}`}>{a.pts>0?"+":""}{a.pts}</div>
        <div className="act-time">{timeAgo(a.date)}</div>
      </div>
    </div>
  );
  return (
    <div className="slide" style={{animation:`fadeIn .5s ease both`}}>
      <div className="slide-eyebrow">Live Activity</div>
      <div className="act-cols">
        <div>{recent.slice(0,half).map((a,i)=><Entry key={a.id} a={a} idx={i}/>)}</div>
        <div>{recent.slice(half).map((a,i)=><Entry key={a.id} a={a} idx={i+half}/>)}</div>
      </div>
    </div>
  );
}

function SpotlightSlide({members, slideIdx}) {
  const top3 = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,3);
  const medals = [
    {rank:"#1", color:"#C9A84C", label:"Top Member", delay:"0s"},
    {rank:"#2", color:"#555",    label:"Runner Up",   delay:".1s"},
    {rank:"#3", color:"#6B4A1E", label:"Third Place", delay:".2s"},
  ];
  return (
    <div className="slide" style={{padding:"28px 0 0",animation:`fadeIn .5s ease both`}}>
      <div className="slide-eyebrow" style={{padding:"0 32px"}}>Member Spotlight</div>
      <div className="spot-wrap">
        {top3.map((m,i)=>(
          <div key={m.id} className={`spot-card${i===0?" first":""}`} style={{animationDelay:medals[i].delay,borderTop:`1px solid ${medals[i].color}22`}}>
            <div className="spot-rank" style={{color:medals[i].color}}>{medals[i].rank}</div>
            <div className="spot-av" style={{background:`${medals[i].color}08`,color:medals[i].color,border:`1px solid ${medals[i].color}22`}}>
              {i===0?<div style={{animation:"glow 3s ease infinite"}}>{initials(m.name)}</div>:initials(m.name)}
            </div>
            <div className="spot-name" style={{color:"#FFFDF3"}}>{m.name}</div>
            <div className="spot-label" style={{color:medals[i].color}}>{medals[i].label}</div>
            <div className="spot-stats">
              <div className="spot-stat">
                <CountUp target={m.points} className="spot-stat-val" trigger={`${slideIdx}-pts-${i}`} style={{color:medals[i].color}}/>
                <div className="spot-stat-lbl">Points</div>
              </div>
              <div className="spot-stat">
                <div className="spot-stat-val" style={{color:medals[i].color}}>{m.streak||0}</div>
                <div className="spot-stat-lbl">Streak</div>
              </div>
              <div className="spot-stat">
                <div className="spot-stat-val" style={{color:medals[i].color}}>{m.checkins||0}</div>
                <div className="spot-stat-lbl">Check-ins</div>
              </div>
              <div className="spot-stat">
                <div className="spot-stat-val" style={{color:medals[i].color}}>#{i+1}</div>
                <div className="spot-stat-lbl">Rank</div>
              </div>
            </div>
          </div>
        ))}
        {top3.length < 3 && [...Array(3-top3.length)].map((_,i)=>(
          <div key={i} className="spot-card" style={{opacity:.06}}>
            <div className="spot-rank" style={{color:"#1A1A1A"}}>#{top3.length+i+1}</div>
            <div className="spot-av" style={{background:"#0D0D0D",color:"#1A1A1A"}}>—</div>
            <div className="spot-name" style={{color:"#1A1A1A"}}>—</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GymDisplay() {
  const [slideIdx,setSlideIdx]     = useState(0);
  const [members,setMembers]       = useState([]);
  const [transactions,setTxns]     = useState([]);
  const [tiers,setTiers]           = useState(DEF_TIERS);
  const [challenges,setChallenges] = useState(DEF_CHALLENGES);
  const [tickers,setTickers]       = useState(DEF_TICKERS);
  const [slides,setSlides]         = useState({leaderboard:true,challenges:true,activity:true,spotlight:true});
  const [duration,setDuration]     = useState(12000);
  const clock = useClock();

  const loadData = async () => {
    const [m,t,ti,ds] = await Promise.all([
      getMembers(), getTransactions(), getTiers(), getDisplaySettings()
    ]);
    if(m?.length) setMembers(m.map(x=>({...x,points:x.points??0,streak:x.streak??0,checkins:x.checkins??0,status:x.status||"active"})));
    if(t?.length) setTxns(t);
    if(ti?.length) setTiers(ti.map(x=>({...x,min:x.min_pts??x.min??0})));
    if(ds){try{
      const cfg=JSON.parse(ds.config||"{}");
      if(cfg.challenges?.length) setChallenges(cfg.challenges.filter(c=>c.active!==false));
      if(cfg.ticker?.length) setTickers(cfg.ticker);
      if(cfg.slides) setSlides(cfg.slides);
      if(cfg.slideDuration) setDuration(cfg.slideDuration*1000);
    }catch{}}
  };

  useEffect(()=>{loadData();},[]);
  useEffect(()=>{const i=setInterval(loadData,20000);return()=>clearInterval(i);},[]);

  const SLIDES = ["leaderboard","challenges","activity","spotlight"].filter(s=>slides[s]);
  useEffect(()=>{
    if(!SLIDES.length) return;
    const t=setTimeout(()=>setSlideIdx(i=>(i+1)%SLIDES.length),duration);
    return()=>clearTimeout(t);
  },[slideIdx,SLIDES.length,duration]);

  const current = SLIDES[slideIdx%SLIDES.length]||"leaderboard";
  const doubled = [...tickers,...tickers];

  return(
    <>
      <style>{CSS}</style>
      <div className="display">
        <div className="topbar">
          <div className="brand">
            <img src={LOGO_URL} alt="URUZ" style={{height:28,width:"auto",opacity:.85}}/>
            <div className="brand-sep"/>
            <div className="brand-sub">Member Central</div>
          </div>
          <div className="topbar-center">
            <div className="live-badge"><div className="live-dot"/>Live</div>
            <div className="slide-dots">
              {SLIDES.map((s,i)=><div key={s} className={`dot${i===slideIdx%SLIDES.length?" on":""}`} onClick={()=>setSlideIdx(i)}/>)}
            </div>
          </div>
          <div className="clock">{clock}</div>
        </div>

        <div className="slide-wrap">
          {current==="leaderboard" &&<LeaderboardSlide key={`lb-${slideIdx}`} members={members} tiers={tiers} slideIdx={slideIdx}/>}
          {current==="challenges"  &&<ChallengesSlide  key={`ch-${slideIdx}`} members={members} challenges={challenges} slideIdx={slideIdx}/>}
          {current==="activity"    &&<ActivitySlide    key={`ac-${slideIdx}`} transactions={transactions} slideIdx={slideIdx}/>}
          {current==="spotlight"   &&<SpotlightSlide   key={`sp-${slideIdx}`} members={members} slideIdx={slideIdx}/>}
        </div>

        <div className="ticker-bar">
          <div className="ticker-track">
            {doubled.map((t,i)=>(
              <div key={i} className="tick-item">
                <div className="tick-dot"/>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
