import { useState, useEffect } from "react";
import { getMembers, getTransactions, getTiers, getDisplaySettings } from "./supabase";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');`;

const LOGO_URL = "https://raw.githubusercontent.com/nidokalash-boop/uruz-loyalty/main/URUZ%20LOGO%2001-10%20(1).png";

const DEF_TIERS = [
  { id:"t1", name:"Iron",   min:0,     color:"#6B7280", icon:"⚙" },
  { id:"t2", name:"Bronze", min:1000,  color:"#CD7F32", icon:"🔶" },
  { id:"t3", name:"Silver", min:2500,  color:"#A8A9AD", icon:"⬡" },
  { id:"t4", name:"Gold",   min:5000,  color:"#D4AF37", icon:"◆" },
  { id:"t5", name:"Elite",  min:10000, color:"#026F91", icon:"★" },
];

const DEF_CHALLENGES = [
  { id:1, name:"Weekly Warrior",  desc:"Check in 5× this week",         pts:150,  deadline:"3 days",  icon:"⚔",  active:true, goal:5  },
  { id:2, name:"Iron Will",       desc:"15-day consecutive streak",     pts:300,  deadline:"4 days",  icon:"🔥", active:true, goal:15 },
  { id:3, name:"Bring the Crew",  desc:"Refer 2 new members",           pts:1000, deadline:"24 days", icon:"👥", active:true, goal:2  },
  { id:4, name:"Early Bird",      desc:"Attend 3 AM classes this month",pts:200,  deadline:"12 days", icon:"🌅", active:true, goal:3  },
];

const DEF_TICKERS = [
  "Train your strength — every visit earns points",
  "Refer a friend and earn 500 pts — ask the front desk",
  "Join the movement — every body belongs here",
  "Personal Training sessions earn 100 pts — book today",
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
  const diff=(new Date()-new Date(d))/60000;
  if(diff<2) return "just now";
  if(diff<60) return `${Math.floor(diff)}m ago`;
  if(diff<1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{width:100%;height:100%;background:#080808;overflow:hidden;}
:root{
  --bg:#080808;--s1:#111;--s2:#181818;--border:#252525;
  --accent:#F58020;--accentL:#F59340;--accentD:#B05520;
  --gold:#D4AF37;--silver:#A8A9AD;--bronze:#CD7F32;--cerulean:#026F91;
  --text:#FFFDF3;--muted:#666058;--success:#22C55E;--danger:#EF4444;
}
.display{width:100vw;height:100vh;background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;overflow:hidden;}
.display::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");pointer-events:none;z-index:999;opacity:.7;}

.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 36px;height:64px;border-bottom:1px solid var(--border);background:var(--s1);flex-shrink:0;position:relative;z-index:10;}
.topbar-brand{display:flex;align-items:center;gap:14px;}
.brand-sep{width:1px;height:28px;background:var(--border);}
.brand-sub{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--muted);}
.topbar-time{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;color:var(--text);opacity:.6;}
.slide-dots{display:flex;gap:8px;align-items:center;}
.dot{width:24px;height:3px;background:var(--border);transition:background .3s,width .3s;cursor:pointer;}
.dot.active{background:var(--accent);width:40px;}
.live-badge{display:flex;align-items:center;gap:6px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--success);animation:pulse 2s ease infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}

.slide-wrap{flex:1;position:relative;overflow:hidden;}
.slide{position:absolute;inset:0;padding:32px 36px;display:flex;flex-direction:column;animation:slideIn .6s cubic-bezier(0.16,1,0.3,1) both;}
@keyframes slideIn{from{opacity:0;transform:translateX(40px);}to{opacity:1;transform:translateX(0);}}
.slide-title{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:5px;text-transform:uppercase;color:var(--accent);margin-bottom:20px;display:flex;align-items:center;gap:12px;}
.slide-title::after{content:'';flex:1;height:1px;background:var(--border);}

/* LEADERBOARD */
.lb-row{display:flex;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid var(--border);}
.lb-row:last-child{border-bottom:none;}
.lb-rank{font-family:'Bebas Neue',sans-serif;font-size:26px;width:36px;text-align:center;flex-shrink:0;}
.lb-av{width:40px;height:40px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;flex-shrink:0;}
.lb-name{flex:1;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:var(--text);}
.lb-streak{font-size:13px;color:var(--muted);}
.lb-pts{font-family:'Bebas Neue',sans-serif;font-size:26px;text-align:right;}

/* CHALLENGES */
.ch-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:1;}
.ch-card{background:var(--s1);border:1px solid var(--border);padding:20px;display:flex;flex-direction:column;gap:10px;}
.ch-header{display:flex;align-items:center;gap:12px;}
.ch-icon{width:44px;height:44px;background:rgba(245,128,32,.12);border:1px solid rgba(245,128,32,.25);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.ch-name{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;letter-spacing:.5px;line-height:1;color:var(--text);}
.ch-desc{font-size:12px;color:var(--muted);margin-top:3px;}
.ch-bar-row{display:flex;align-items:center;gap:10px;}
.ch-bar-bg{flex:1;height:6px;background:var(--border);}
.ch-bar-fill{height:100%;background:linear-gradient(90deg,var(--cerulean),var(--accentL));}
.ch-bar-pct{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:var(--accent);min-width:36px;text-align:right;}
.ch-footer{display:flex;justify-content:space-between;align-items:center;}
.ch-reward{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);}
.ch-deadline{font-size:11px;color:var(--muted);}
.ch-leaders-list{display:flex;flex-direction:column;gap:5px;margin-top:4px;}
.ch-leader-row{display:flex;align-items:center;gap:8px;}

/* ACTIVITY */
.activity-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;flex:1;}
.act-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border);}
.act-row:last-child{border-bottom:none;}
.act-icon-wrap{width:42px;height:42px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:var(--s2);border:1px solid var(--border);}
.act-who{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;color:var(--text);line-height:1;}
.act-what{font-size:13px;color:var(--muted);margin-top:2px;}
.act-pts{font-family:'Bebas Neue',sans-serif;font-size:24px;}
.act-time{font-size:11px;color:var(--muted);margin-top:2px;}

/* SPOTLIGHT */
.spotlight-wrap{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:center;}
.spotlight-card{border:1px solid;padding:28px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;height:100%;}
.spotlight-av{width:72px;height:72px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:28px;}
.spotlight-name{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:2px;color:var(--text);line-height:1;}
.sn-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;width:100%;}
.sn-cell{background:#1A1A1A;padding:10px 8px;text-align:center;}
.sn-val{font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1;}
.sn-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-top:2px;}

/* TICKER */
.bottombar{height:44px;background:var(--s1);border-top:1px solid var(--border);display:flex;align-items:center;overflow:hidden;flex-shrink:0;}
.ticker-track{display:flex;gap:0;white-space:nowrap;animation:ticker 80s linear infinite;}
@keyframes ticker{from{transform:translateX(0);}to{transform:translateX(-50%);}}
.ticker-item{display:inline-flex;align-items:center;gap:8px;padding:0 48px;font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:600;letter-spacing:1px;color:var(--muted);border-right:1px solid var(--border);}
.ticker-item .hi{color:var(--text);}
.ticker-item .acc{color:var(--accent);}
.ticker-dot{width:5px;height:5px;background:var(--accent);border-radius:50%;opacity:.6;flex-shrink:0;}
`;

// ── SLIDES ────────────────────────────────────────────────
function LeaderboardSlide({ members, tiers }) {
  const sorted = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,10);
  const rankColors = ["#D4AF37","#A8A9AD","#CD7F32"];

  return (
    <div className="slide">
      <div className="slide-title">◆ Monthly Leaderboard</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 40px",flex:1}}>
        {[sorted.slice(0,5),sorted.slice(5,10)].map((col,ci)=>(
          <div key={ci}>
            {col.map((m,i)=>{
              const rank=ci*5+i+1;
              const color=rankColors[rank-1]||"#FFFDF3";
              return (
                <div key={m.id} className="lb-row">
                  <div className="lb-rank" style={{color}}>{rank}</div>
                  <div className="lb-av" style={{background:`${color}22`,border:`1px solid ${color}55`,color}}>{initials(m.name)}</div>
                  <div className="lb-name">{m.name}</div>
                  <div className="lb-streak">🔥 {m.streak||0}d</div>
                  <div className="lb-pts" style={{color}}>{m.points.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChallengesSlide({ members, challenges }) {
  const top5 = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,5);
  const rankColors = ["#D4AF37","#A8A9AD","#CD7F32","#666058","#666058"];

  return (
    <div className="slide">
      <div className="slide-title">⚔ Active Challenges</div>
      <div className="ch-grid">
        {challenges.slice(0,4).map((c,i)=>{
          const pct = Math.round(((c.progress||0)/(c.goal||1))*100);
          return (
            <div key={c.id} className="ch-card">
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
              </div>
              <div>
                <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#666058",fontWeight:700,marginBottom:6}}>Top Members</div>
                <div className="ch-leaders-list">
                  {top5.map((m,j)=>(
                    <div key={m.id} className="ch-leader-row">
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:rankColors[j],width:20,flexShrink:0}}>#{j+1}</div>
                      <div style={{width:26,height:26,borderRadius:2,background:"rgba(245,128,32,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,color:"#F58020",flexShrink:0}}>{initials(m.name)}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"#FFFDF3",flex:1}}>{m.name}</div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#F58020"}}>{m.points.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivitySlide({ transactions }) {
  const ACT_ICONS={checkin:"📍",class:"💪",referral:"👥",bonus:"⭐",challenge:"🏆",manual:"✏",redeem:"🎟",deduct:"➖"};
  const recent = [...transactions].slice(0,8);
  const half = Math.ceil(recent.length/2);

  const Row = ({a}) => (
    <div className="act-row">
      <div className="act-icon-wrap">{ACT_ICONS[a.type]||"📍"}</div>
      <div style={{flex:1}}>
        <div className="act-who">{a.memberName||a.member_name}</div>
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
        <div>{recent.slice(0,half).map(a=><Row key={a.id} a={a}/>)}</div>
        <div>{recent.slice(half).map(a=><Row key={a.id} a={a}/>)}</div>
      </div>
    </div>
  );
}

function SpotlightSlide({ members }) {
  const top3 = [...members].filter(m=>m.status==="active").sort((a,b)=>b.points-a.points).slice(0,3);
  const medals = [
    {rank:"#1",color:"#D4AF37",label:"Top Member"},
    {rank:"#2",color:"#A8A9AD",label:"Runner Up"},
    {rank:"#3",color:"#CD7F32",label:"Third Place"},
  ];
  return (
    <div className="slide">
      <div className="slide-title">★ Member Spotlight</div>
      <div className="spotlight-wrap">
        {top3.map((m,i)=>(
          <div key={m.id} className="spotlight-card" style={{borderColor:`${medals[i].color}44`,background:"#111"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:48,color:medals[i].color,lineHeight:1}}>{medals[i].rank}</div>
            <div className="spotlight-av" style={{background:`${medals[i].color}22`,border:`2px solid ${medals[i].color}`,color:medals[i].color}}>{initials(m.name)}</div>
            <div>
              <div className="spotlight-name">{m.name}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:medals[i].color,marginTop:4}}>{medals[i].label}</div>
            </div>
            <div className="sn-grid">
              {[{v:m.points.toLocaleString(),l:"Points"},{v:`🔥${m.streak||0}d`,l:"Streak"},{v:m.checkins||0,l:"Check-ins"},{v:`${i+1}`,l:"Rank"}].map((s,j)=>(
                <div key={j} className="sn-cell">
                  <div className="sn-val" style={{color:medals[i].color}}>{s.v}</div>
                  <div className="sn-lbl">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────
export default function GymDisplay() {
  const [slideIdx,setSlideIdx]   = useState(0);
  const [members,setMembers]     = useState([]);
  const [transactions,setTxns]  = useState([]);
  const [tiers,setTiers]         = useState(DEF_TIERS);
  const [challenges,setChallenges] = useState(DEF_CHALLENGES);
  const [tickers,setTickers]     = useState(DEF_TICKERS);
  const [slides,setSlides]       = useState({leaderboard:true,challenges:true,activity:true,spotlight:true});
  const [duration,setDuration]   = useState(12000);
  const clock = useClock();

  const loadData = async () => {
    const [m,t,ti,ds] = await Promise.all([getMembers(),getTransactions(),getTiers(),getDisplaySettings()]);
    if(m?.length) setMembers(m.map(x=>({...x,points:x.points??0,streak:x.streak??0,checkins:x.checkins??0,status:x.status||"active"})));
    if(t?.length) setTxns(t);
    if(ti?.length) setTiers(ti.map(x=>({...x,min:x.min_pts??x.min??0})));
    if(ds){
      try {
        const cfg = JSON.parse(ds.config||"{}");
        if(cfg.challenges?.length) setChallenges(cfg.challenges.filter(c=>c.active!==false));
        if(cfg.ticker?.length) setTickers(cfg.ticker);
        if(cfg.slides) setSlides(cfg.slides);
        if(cfg.slideDuration) setDuration(cfg.slideDuration*1000);
      } catch {}
    }
  };

  useEffect(()=>{ loadData(); },[]);
  useEffect(()=>{ const i=setInterval(loadData,60000); return()=>clearInterval(i); },[]);

  const SLIDES = ["leaderboard","challenges","activity","spotlight"].filter(s=>slides[s]);

  useEffect(()=>{
    if(SLIDES.length===0) return;
    const t=setTimeout(()=>setSlideIdx(i=>(i+1)%SLIDES.length),duration);
    return()=>clearTimeout(t);
  },[slideIdx,SLIDES.length,duration]);

  const current = SLIDES[slideIdx % SLIDES.length] || "leaderboard";
  const doubled = [...tickers,...tickers];

  return (
    <>
      <style>{CSS}</style>
      <div className="display">
        <div className="topbar">
          <div className="topbar-brand">
            <img src={LOGO_URL} alt="URUZ" style={{height:36,width:"auto"}}/>
            <div className="brand-sep"/>
            <div className="brand-sub">Loyalty Program</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <div className="live-badge"><div className="live-dot"/>Live</div>
            <div className="slide-dots">
              {SLIDES.map((s,i)=>(
                <div key={s} className={`dot${i===slideIdx%SLIDES.length?" active":""}`} onClick={()=>setSlideIdx(i)}/>
              ))}
            </div>
          </div>
          <div className="topbar-time">{clock}</div>
        </div>

        <div className="slide-wrap">
          {current==="leaderboard" && <LeaderboardSlide key={`lb-${slideIdx}`} members={members} tiers={tiers}/>}
          {current==="challenges"  && <ChallengesSlide  key={`ch-${slideIdx}`} members={members} challenges={challenges}/>}
          {current==="activity"    && <ActivitySlide    key={`ac-${slideIdx}`} transactions={transactions}/>}
          {current==="spotlight"   && <SpotlightSlide   key={`sp-${slideIdx}`} members={members}/>}
        </div>

        <div className="bottombar">
          <div className="ticker-track">
            {doubled.map((t,i)=>(
              <div key={i} className="ticker-item">
                <div className="ticker-dot"/>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
