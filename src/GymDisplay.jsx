import { useState, useEffect, useRef } from "react";
import { getMembers, getTransactions, getTiers } from "./supabase";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');`;

const DEF_TIERS = [
  { id:"t1", name:"Iron",   min:0,     color:"#6B7280", icon:"⚙" },
  { id:"t2", name:"Bronze", min:1000,  color:"#CD7F32", icon:"🔶" },
  { id:"t3", name:"Silver", min:2500,  color:"#A8A9AD", icon:"⬡" },
  { id:"t4", name:"Gold",   min:5000,  color:"#D4AF37", icon:"◆" },
  { id:"t5", name:"Elite",  min:10000, color:"#026F91", icon:"★" },
];

const DEF_MEMBERS = [
  { id:"URZ-01203", name:"Marcus T.",   points:12800, streak:44, status:"active" },
  { id:"URZ-00891", name:"Serena K.",   points:10540, streak:31, status:"active" },
  { id:"URZ-02145", name:"Dre Molina",  points:9870,  streak:27, status:"active" },
  { id:"URZ-03302", name:"Priya V.",    points:8200,  streak:19, status:"active" },
  { id:"URZ-05511", name:"Jake C.",     points:7100,  streak:15, status:"active" },
  { id:"URZ-06720", name:"Amara F.",    points:6340,  streak:22, status:"active" },
  { id:"URZ-07834", name:"Leo S.",      points:5800,  streak:8,  status:"active" },
  { id:"URZ-08901", name:"Nina Park",   points:5100,  streak:11, status:"active" },
  { id:"URZ-09012", name:"Cam R.",      points:4600,  streak:6,  status:"active" },
  { id:"URZ-04821", name:"Alex Rivera", points:3740,  streak:11, status:"active" },
];

const DEF_TRANSACTIONS = [
  { id:"TXN-001", memberName:"Marcus T.",   type:"checkin",  pts:50,  note:"Morning Session",       date:"2025-06-07" },
  { id:"TXN-002", memberName:"Serena K.",   type:"challenge",pts:300, note:"Completed Iron Will",   date:"2025-06-07" },
  { id:"TXN-003", memberName:"Cam R.",      type:"referral", pts:500, note:"Referred a friend",     date:"2025-06-07" },
  { id:"TXN-004", memberName:"Amara F.",    type:"class",    pts:75,  note:"HIIT Class",            date:"2025-06-07" },
  { id:"TXN-005", memberName:"Priya V.",    type:"checkin",  pts:50,  note:"Check-in",              date:"2025-06-07" },
  { id:"TXN-006", memberName:"Alex Rivera", type:"bonus",    pts:200, note:"30-Day Streak Bonus",   date:"2025-06-06" },
  { id:"TXN-007", memberName:"Jake C.",     type:"checkin",  pts:50,  note:"Evening Session",       date:"2025-06-06" },
  { id:"TXN-008", memberName:"Leo S.",      type:"class",    pts:100, note:"Personal Training",     date:"2025-06-06" },
];

const DEF_CHALLENGES = [
  { id:1, name:"Weekly Warrior",  desc:"Check in 5× this week",         pts:150,  progress:3,  goal:5,  deadline:"3 days",  icon:"⚔",  leader:"Marcus T."  },
  { id:2, name:"Iron Will",       desc:"15-day consecutive streak",     pts:300,  progress:11, goal:15, deadline:"4 days",  icon:"🔥",  leader:"Marcus T."  },
  { id:3, name:"Bring the Crew",  desc:"Refer 2 new members",           pts:1000, progress:1,  goal:2,  deadline:"24 days", icon:"👥",  leader:"Cam R."     },
  { id:4, name:"Early Bird",      desc:"Attend 3 AM classes this month",pts:200,  progress:2,  goal:3,  deadline:"12 days", icon:"🌅",  leader:"Serena K."  },
];

const SLIDES = ["leaderboard","challenges","activity","spotlight"];
const SLIDE_DURATION = 12000;



function getTier(pts, tiers) {
  const s=[...tiers].sort((a,b)=>b.min-a.min);
  return s.find(t=>pts>=t.min)||tiers[0];
}
function initials(n){ return n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function useClock(){ const [t,setT]=useState(new Date()); useEffect(()=>{const i=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(i);},[]);return t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
function timeAgo(dateStr){
  const diff=(new Date()-new Date(dateStr))/60000;
  if(diff<2) return "just now";
  if(diff<60) return `${Math.floor(diff)}m ago`;
  if(diff<1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{width:100%;height:100%;background:#080808;overflow:hidden;}
:root{--bg:#080808;--s1:#111;--s2:#181818;--border:#252525;--accent:#F58020;--accentL:#F59340;--accentD:#B05520;--gold:#D4AF37;--silver:#A8A9AD;--bronze:#CD7F32;--cerulean:#026F91;--text:#FFFDF3;--muted:#666058;--success:#22C55E;--danger:#EF4444;}

.display{width:100vw;height:100vh;background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;overflow:hidden;position:relative;}
.display::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");pointer-events:none;z-index:999;opacity:.7;}

.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 36px;height:64px;border-bottom:1px solid var(--border);background:var(--s1);flex-shrink:0;position:relative;z-index:10;}
.topbar-brand{display:flex;align-items:center;gap:14px;}
.brand-logo{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:4px;color:var(--accent);line-height:1;}
.brand-sep{width:1px;height:28px;background:var(--border);}
.brand-sub{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--muted);}
.topbar-time{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;color:var(--text);opacity:.6;}
.slide-dots{display:flex;gap:8px;align-items:center;}
.dot{width:24px;height:3px;background:var(--border);transition:background .3s,width .3s;cursor:pointer;}
.dot.active{background:var(--accent);width:40px;}

.slide-wrap{flex:1;position:relative;overflow:hidden;}
.slide{position:absolute;inset:0;padding:32px 36px;display:flex;flex-direction:column;animation:slideIn .6s cubic-bezier(0.16,1,0.3,1) both;}
@keyframes slideIn{from{opacity:0;transform:translateX(40px);}to{opacity:1;transform:translateX(0);}}

.slide-title{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:5px;text-transform:uppercase;color:var(--accent);margin-bottom:20px;display:flex;align-items:center;gap:12px;}
.slide-title::after{content:'';flex:1;height:1px;background:var(--border);}

/* LEADERBOARD */
.lb-podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:12px;margin-bottom:8px;align-items:flex-end;}
.podium-card{border:1px solid var(--border);padding:16px 12px 12px;text-align:center;animation:riseUp .7s cubic-bezier(0.16,1,0.3,1) both;}
@keyframes riseUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
.podium-rank{font-family:'Bebas Neue',sans-serif;font-size:48px;line-height:1;margin-bottom:6px;}
.podium-av{width:52px;height:52px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;margin:0 auto 8px;}
.podium-name{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;color:var(--text);}
.podium-pts{font-family:'Bebas Neue',sans-serif;font-size:22px;margin-top:4px;}
.podium-streak{font-size:11px;color:var(--muted);margin-top:2px;}
.lb-list-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);}
.lb-list-row:last-child{border-bottom:none;}
.lb-list-rank{font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--muted);width:24px;text-align:center;flex-shrink:0;}
.lb-list-av{width:34px;height:34px;border-radius:2px;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;flex-shrink:0;}
.lb-list-name{flex:1;font-size:15px;font-weight:500;}
.lb-list-streak{font-size:12px;color:var(--muted);}
.lb-list-pts{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;}
.change-tag{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;width:28px;text-align:center;}

/* CHALLENGES */
.ch-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:1;}
.ch-card{background:var(--s1);border:1px solid var(--border);padding:20px;display:flex;flex-direction:column;gap:12px;animation:fadeUp .5s ease both;}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.ch-header{display:flex;align-items:center;gap:12px;}
.ch-icon{width:44px;height:44px;background:rgba(245,128,32,.12);border:1px solid rgba(245,128,32,.25);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.ch-name{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;letter-spacing:.5px;line-height:1;color:var(--text);}
.ch-desc{font-size:12px;color:var(--muted);margin-top:3px;}
.ch-bar-row{display:flex;align-items:center;gap:10px;}
.ch-bar-bg{flex:1;height:6px;background:var(--border);}
.ch-bar-fill{height:100%;background:linear-gradient(90deg,var(--cerulean),var(--accentL));transition:width 1.2s cubic-bezier(0.16,1,0.3,1);}
.ch-bar-pct{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:var(--accent);min-width:36px;text-align:right;}
.ch-footer{display:flex;justify-content:space-between;align-items:center;}
.ch-reward{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);letter-spacing:1px;}
.ch-deadline{font-size:11px;color:var(--muted);}
.ch-leader{font-size:11px;color:var(--muted);}
.ch-leader span{color:var(--text);}

/* ACTIVITY */
.activity-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;flex:1;}
.act-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);}
.act-row:last-child{border-bottom:none;}
.act-icon-wrap{width:42px;height:42px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:var(--s2);border:1px solid var(--border);}
.act-who{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;color:var(--text);line-height:1;}
.act-what{font-size:13px;color:var(--muted);margin-top:2px;}
.act-pts{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.5px;}
.act-time{font-size:11px;color:var(--muted);margin-top:2px;}

/* SPOTLIGHT */
.spotlight-wrap{flex:1;display:grid;grid-template-columns:1.2fr 1fr;gap:28px;align-items:center;}
.spotlight-av{width:96px;height:96px;border-radius:2px;background:rgba(245,128,32,.15);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:38px;color:var(--accent);flex-shrink:0;}
.spotlight-name{font-family:'Bebas Neue',sans-serif;font-size:56px;line-height:.95;letter-spacing:2px;color:var(--text);}
.spotlight-tier{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-top:6px;}
.spotlight-quote{font-size:19px;font-weight:300;color:var(--muted);line-height:1.5;font-style:italic;border-left:2px solid var(--accent);padding-left:16px;}
.sn-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--border);}
.sn-cell{background:var(--s1);padding:20px 16px;text-align:center;animation:fadeUp .5s ease both;}
.sn-val{font-family:'Bebas Neue',sans-serif;font-size:48px;line-height:1;color:var(--accent);}
.sn-lbl{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-top:4px;}

/* TICKER */
.bottombar{height:44px;background:var(--s1);border-top:1px solid var(--border);display:flex;align-items:center;overflow:hidden;flex-shrink:0;}
.ticker-track{display:flex;gap:0;white-space:nowrap;animation:ticker 80s linear infinite;}
@keyframes ticker{from{transform:translateX(0);}to{transform:translateX(-50%);}}
.ticker-item{display:inline-flex;align-items:center;gap:8px;padding:0 48px;font-family:'Barlow Condensed',sans-serif;font-size:18px;
.ticker-item .hi{color:var(--text);}
.ticker-item .acc{color:var(--accent);}
.ticker-dot{width:5px;height:5px;background:var(--accent);border-radius:50%;opacity:.6;flex-shrink:0;}

/* REFRESH */
.live-badge{display:flex;align-items:center;gap:6px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--success);animation:pulse 2s ease infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
`;

// ── SLIDES ────────────────────────────────────────────────
function LeaderboardSlide({ members, tiers }) {
  const sorted = [...members]
    .filter(m => m.status === "active")
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const rankColors = ["#D4AF37", "#A8A9AD", "#CD7F32"];

  return (
    <div className="slide">
      <div className="slide-title">◆ Monthly Leaderboard</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 40px", flex:1 }}>
        {[sorted.slice(0,5), sorted.slice(5,10)].map((col, ci) => (
          <div key={ci}>
            {col.map((m, i) => {
              const rank = ci * 5 + i + 1;
              const color = rankColors[rank-1] || "#FFFDF3";
              return (
                <div key={m.id} style={{
                  display:"flex", alignItems:"center", gap:14,
                  padding:"12px 0", borderBottom:"1px solid #252525"
                }}>
                  <div style={{
                    fontFamily:"'Bebas Neue',sans-serif",
                    fontSize:28, color, width:36,
                    textAlign:"center", flexShrink:0
                  }}>#{rank}</div>
                  <div style={{
                    width:40, height:40, borderRadius:2,
                    background:`${color}22`, border:`1px solid ${color}55`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"'Barlow Condensed',sans-serif",
                    fontSize:16, fontWeight:800, color, flexShrink:0
                  }}>{initials(m.name)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, color:"#FFFDF3", lineHeight:1 }}>{m.name}</div>
                    <div style={{ fontSize:12, color:"#666058", marginTop:2 }}>🔥 {m.streak}d streak</div>
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color, textAlign:"right" }}>
                    {m.points.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChallengesSlide() {
  return (
    <div className="slide">
      <div className="slide-title">⚔ Active Challenges</div>
      <div className="ch-grid">
        {DEF_CHALLENGES.map((c,i)=>{
          const pct=Math.round((c.progress/c.goal)*100);
          return (
            <div key={c.id} className="ch-card" style={{animationDelay:`${i*0.07}s`}}>
              <div className="ch-header">
                <div className="ch-icon">{c.icon}</div>
                <div><div className="ch-name">{c.name}</div><div className="ch-desc">{c.desc}</div></div>
              </div>
              <div className="ch-bar-row">
                <div className="ch-bar-bg"><div className="ch-bar-fill" style={{width:`${pct}%`}}/></div>
                <div className="ch-bar-pct">{pct}%</div>
              </div>
              <div className="ch-footer">
                <div><div className="ch-reward">+{c.pts} PTS</div><div className="ch-deadline">⏱ {c.deadline} left</div></div>
                <div className="ch-leader">Leading: <span>{c.leader}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivitySlide({ transactions }) {
  const recent = [...transactions].slice(0, 8);
  const ACT_ICONS = {checkin:"📍",class:"💪",referral:"👥",bonus:"⭐",challenge:"🏆",manual:"✏",redeem:"🎟",deduct:"➖"};
  const half = Math.ceil(recent.length/2);
  const Row = ({a,i}) => (
   <div className="act-row">
      <div className="act-icon-wrap">{ACT_ICONS[a.type]||"📍"}</div>
      <div style={{flex:1}}>
        <div className="act-who">{a.memberName}</div>
        <div className="act-what">{a.note}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div className="act-pts" style={{color:a.pts>0?"#22C55E":"#EF4444"}}>{a.pts>0?"+":""}{a.pts}</div>
        <div className="act-time">{timeAgo(a.date)}</div>
      </div>
    </div>
  );
  return (
    <div className="slide">
      <div className="slide-title">📍 Live Activity</div>
      <div className="activity-cols">
        <div>{recent.slice(0,half).map((a,i)=><Row key={a.id} a={a} i={i}/>)}</div>
        <div>{recent.slice(half).map((a,i)=><Row key={a.id} a={a} i={i+half}/>)}</div>
      </div>
    </div>
  );
}

function SpotlightSlide({ members }) {
  const top = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points)[0];
  if(!top) return null;
  return (
    <div className="slide">
      <div className="slide-title">★ Member Spotlight</div>
      <div className="spotlight-wrap">
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <div className="spotlight-av">{initials(top.name)}</div>
            <div>
              <div className="spotlight-name">{top.name}</div>
              <div className="spotlight-tier" style={{color:"#026F91"}}>★ Elite Member</div>
            </div>
          </div>
          <div className="spotlight-quote">"Every rep, every step — you build it."</div>
          <div>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#666058",marginBottom:4,fontWeight:700}}>Achievement</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"#F58020",letterSpacing:1}}>Top earner this month — #{1} in the club</div>
          </div>
        </div>
        <div className="sn-grid">
          {[
            {v:top.points.toLocaleString(),l:"Total Points"},
            {v:"#1",                        l:"Club Rank"},
            {v:`${top.streak}d`,            l:"Streak"},
            {v:"★ Elite",                   l:"Tier"},
          ].map((s,i)=>(
            <div key={i} className="sn-cell" style={{animationDelay:`${0.1+i*0.07}s`}}>
              <div className="sn-val">{s.v}</div>
              <div className="sn-lbl">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────
export default function GymDisplay() {
  const [slideIdx, setSlideIdx]   = useState(0);
  const [members,  setMembers]    = useState(DEF_MEMBERS);
  const [transactions, setTxns]  = useState(DEF_TRANSACTIONS);
  const [tiers, setTiers]         = useState(DEF_TIERS);
  const clock = useClock();

  // Load live data from shared storage
 const loadData = async () => {
    const [m,t,ti] = await Promise.all([
      getMembers(),
      getTransactions(),
      getTiers(),
    ]);
    if(m?.length) setMembers(m.map(x=>({...x, points:x.points??0, streak:x.streak??0, status:x.status||"active"})));
    if(t?.length) setTxns(t);
    if(ti?.length) setTiers(ti.map(x=>({...x, min:x.min_pts??x.min??0})));
  };

  useEffect(()=>{ loadData(); },[]);

  // Refresh data every 60s
  useEffect(()=>{
    const i = setInterval(loadData, 60000);
    return ()=>clearInterval(i);
  },[]);

  // Advance slides
  useEffect(()=>{
    const t = setTimeout(()=>setSlideIdx(i=>(i+1)%SLIDES.length), SLIDE_DURATION);
    return ()=>clearTimeout(t);
  },[slideIdx]);

  const TICKERS = [
    <><div className="ticker-dot"/><span>🔥 <span className="hi">Top this month:</span> <span className="acc">{[...members].sort((a,b)=>b.points-a.points)[0]?.name}</span></span></>,
    <><div className="ticker-dot"/><span>Train your strength — <span className="acc">every visit earns points</span></span></>,
    <><div className="ticker-dot"/><span>Refer a friend and earn <span className="acc">500 pts</span> — ask the front desk for your code</span></>,
    <><div className="ticker-dot"/><span><span className="hi">Weekly Warrior challenge</span> — check in 5× this week for <span className="acc">150 pts</span></span></>,
    <><div className="ticker-dot"/><span>Join the movement — <span className="acc">every body belongs here</span></span></>,
    <><div className="ticker-dot"/><span>Personal Training sessions earn <span className="acc">100 pts</span> — book with your coach today</span></>,
    <><div className="ticker-dot"/><span>Built for the neighborhood — <span className="acc">powered by you</span></span></>,
  ];
  const doubled=[...TICKERS,...TICKERS];
  const current = SLIDES[slideIdx];

  return (
    <>
      <style>{CSS}</style>
      <div className="display">
        <div className="topbar">
          <div className="topbar-brand">
            <div className="brand-logo">URUZ</div>
            <div className="brand-sep"/>
            <div className="brand-sub">Loyalty Program</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <div className="live-badge"><div className="live-dot"/>Live</div>
            <div className="slide-dots">
              {SLIDES.map((s,i)=>(
                <div key={s} className={`dot${i===slideIdx?" active":""}`} onClick={()=>setSlideIdx(i)}/>
              ))}
            </div>
          </div>
          <div className="topbar-time">{clock}</div>
        </div>

        <div className="slide-wrap">
          {current==="leaderboard" && <LeaderboardSlide key={`lb-${slideIdx}`} members={members} tiers={tiers}/>}
          {current==="challenges"  && <ChallengesSlide  key={`ch-${slideIdx}`}/>}
          {current==="activity"    && <ActivitySlide    key={`ac-${slideIdx}`} transactions={transactions}/>}
          {current==="spotlight"   && <SpotlightSlide   key={`sp-${slideIdx}`} members={members}/>}
        </div>

        <div className="bottombar">
          <div className="ticker-track">
            {doubled.map((t,i)=><div key={i} className="ticker-item">{t}</div>)}
          </div>
        </div>
      </div>
    </>
  );
}
