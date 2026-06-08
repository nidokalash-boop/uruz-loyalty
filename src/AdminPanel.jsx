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

const NAV_ICONS = {
  dashboard: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  members: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  award: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  redemptions: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="14" x2="6" y2="14"/><line x1="18" y1="14" x2="18" y2="14"/></svg>,
  rewards: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
  staff: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  display: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  workouts: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18.5 5.5 3 3"/><path d="m2.5 15.5 3 3"/><path d="M14 5s0-2-3-2-3 2-3 2"/><path d="M10 19s0 2 3 2 3-2 3-2"/></svg>,
  challenges: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>,
  earn: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  referrals: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  export: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  import: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  settings: (c) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
};

const DEF_TIERS = [
  { id:"t1", name:"Iron",   min:0,     color:C.iron, icon:"⚙" },
  { id:"t2", name:"Bronze", min:1000,  color:C.bronze, icon:"🔶" },
  { id:"t3", name:"Silver", min:2500,  color:C.silver, icon:"⬡" },
  { id:"t4", name:"Gold",   min:5000,  color:C.gold, icon:"◆" },
  { id:"t5", name:"Elite",  min:10000, color:C.cerulean, icon:"★" },
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

const ROLES = {
  owner:      { label:"Owner",      color:"#F58020", level:4 },
  manager:    { label:"Manager",    color:"#D4AF37", level:3 },
  front_desk: { label:"Front Desk", color:"#026F91", level:2 },
  trainer:    { label:"Trainer",    color:"#22C55E", level:1 },
};

const PERMISSIONS = {
  owner:      ["dashboard","members","award","redemptions","rewards","staff","display","workouts","challenges","earn","referrals","export","import","settings"],
  manager:    ["dashboard","members","award","redemptions","rewards","display","workouts","challenges","earn","referrals","export","import"],
  front_desk: ["dashboard","members","award","redemptions"],
  trainer:    ["dashboard","members","award"],
};

function canAccess(role, page) { return (PERMISSIONS[role] || []).includes(page); }
function getStaffSession() { try { const v=localStorage.getItem("uruz:staff"); return v?JSON.parse(v):null; } catch { return null; } }
function clearStaffSession() { try { localStorage.removeItem("uruz:staff"); } catch {} }

function normalizeMember(m) {
  return {
    id:            m.id,
    name:          m.name          || "",
    phone:         m.phone         || "",
    email:         m.email         || "",
    joinDate:      m.join_date     || m.joinDate || "",
    points:        m.points        ?? 0,
    checkins:      m.checkins      ?? 0,
    streak:        m.streak        ?? 0,
    status:        m.status        || "active",
    pin:           m.pin           || null,
    lastCheckin:   m.last_checkin  || m.lastCheckin  || null,
    birthday:      m.birthday      || null,
    referral_code: m.referral_code || null,
  };
}

const ALL_NAV=[
  {id:"dashboard",  icon: "dashboard",   label:"Dashboard"},
  {id:"members",    icon: "members",     label:"Members"},
  {id:"award",      icon: "award",       label:"Award Points"},
  {id:"redemptions",icon: "redemptions",  label:"Redemptions"},
  {id:"rewards",    icon: "rewards",     label:"Rewards"},
  {id:"staff",      icon: "staff",       label:"Staff"},
  {id:"display",    icon: "display",     label:"TV Display"},
  {id:"workouts",   icon: "workouts",    label:"Workouts"},
  {id:"challenges", icon: "challenges",  label:"Challenges"},
  {id:"earn",       icon: "earn",        label:"Earn Rules"},
  {id:"referrals",  icon: "referrals",   label:"Referrals"},
  {id:"export",     icon: "export",      label:"Export Data"},
  {id:"import",     icon: "import",      label:"Bulk Import"},
  {id:"settings",   icon: "settings",    label:"Settings"},
];

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
  const [toast,setToast]               = useState({msg:"",on:false});
  const [displaySettings, setDisplaySettings] = useState(null);

  const showToast = (msg) => { setToast({msg,on:true}); setTimeout(()=>setToast({msg:"",on:false}),2500); };

  useEffect(()=>{
    (async()=>{
      const sl=await getStaff(); setStaffList(sl);
      const session=getStaffSession();
      if(session){
        const valid=sl.find(s=>s.id===session.id&&s.pin===session.pin);
        if(valid) setStaffSession(session);
        else clearStaffSession();
      }
      const [m,t,r,rw,ti,ds]=await Promise.all([getMembers(),getTransactions(),getRedemptions(),getRewards(),getTiers(),getDisplaySettings()]);
      setMembers(m.map(normalizeMember));setTxns(t);setRdms(r);
      setRewards(rw.length?rw:DEF_REWARDS); setTiers(ti.length?ti:DEF_TIERS);
      if(ds){try{setDisplaySettings({...JSON.parse(ds.config||"{}")});}catch{}}
      setLoaded(true);
    })();
  },[]);

  if(!loaded) return(<><style>{CSS}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1F2020"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:4,color:"#F58020"}}>LOADING…</div></div></>);
  if(!staffSession) return <AdminLogin onLogin={(s)=>{setStaffSession(s); getStaff().then(setStaffList);}} staffList={staffList}/>;

  const role=staffSession.role;
  const roleInfo=ROLES[role];
  const visibleNav=ALL_NAV.filter(n=>canAccess(role,n.id));
  const pending=redemptions.filter(r=>r.status==="pending").length;

  return(
    <>
      <style>{CSS}</style>
      <div className="admin">
        <div className="sidebar">
          <div className="sb-brand"><div className="sb-logo">URUZ</div><div className="sb-sub">Member Central</div></div>
          <div className="sb-nav">
            <div className="sb-section">Navigation</div>
            {visibleNav.map(n=>{
              const isActive = page===n.id;
              return (
                <button key={n.id} className={`sb-btn${isActive?" on":""}`} onClick={()=>setPage(n.id)}>
                  <span className="sb-icon">{NAV_ICONS[n.icon](isActive ? C.orange : "#6B6866")}</span>
                  {n.label}
                  {n.id==="redemptions"&&pending>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:10,fontWeight:800,padding:"1px 6px"}}>{pending}</span>}
                </button>
              );
            })}
          </div>
          <div className="sb-footer">
            <div className="sb-staff-name">{staffSession.name}</div>
            <div className="sb-staff-role" style={{color:roleInfo?.color || C.white, display:"flex", alignItems:"center", gap:"6px"}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {roleInfo?.label}
            </div>
            <button className="sb-logout" onClick={()=>{clearStaffSession(); setStaffSession(null);}}>Sign Out</button>
          </div>
        </div>
        <div className="main">
          <div className="topbar">
            <div className="topbar-title">{ALL_NAV.find(n=>n.id===page)?.label}</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.success}}/>
              <div className="topbar-date">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</div>
            </div>
          </div>
          <div className="content" key={page}>
            {page==="dashboard"  &&<Dashboard members={members} transactions={transactions} redemptions={redemptions}/>}
            {page==="members"    &&<Members members={members} setMembers={setMembers} transactions={transactions} tiers={tiers} onAward={(m)=>{setAwardTarget(m); setPage("award");}} toast={showToast} role={role}/>}
            {page==="award"      &&<AwardPoints members={members} setMembers={setMembers} setTransactions={setTxns} preSelected={awardTarget} toast={showToast}/>}
            {page==="redemptions"&&<Redemptions redemptions={redemptions} setRedemptions={setRdms} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="rewards"    &&<RewardsCatalog rewards={rewards} setRewards={setRewards} toast={showToast}/>}
            {page==="staff"      &&<StaffManagement staffList={staffList} setStaffList={setStaffList} toast={showToast}/>}
            {page==="display"    &&<DisplaySettings toast={showToast}/>}
            {page==="workouts"   &&<WorkoutsPanel members={members} toast={showToast}/>}
            {page==="challenges" &&<ChallengesPanel members={members} setMembers={setMembers} setTransactions={setTxns} toast={showToast} displaySettings={displaySettings}/>}
            {page==="earn"       &&<EarnRules toast={showToast}/>}
            {page==="referrals"  &&<ReferralsPanel members={members} setMembers={setMembers} setTransactions={setTxns} toast={showToast}/>}
            {page==="export"     &&<ExportData members={members} transactions={transactions} redemptions={redemptions} tiers={tiers} toast={showToast}/>}
            {page==="import"     &&<BulkImport members={members} setMembers={setMembers} toast={showToast}/>}
            {page==="settings"   &&<Settings tiers={tiers} setTiers={setTiers} toast={showToast}/>}
          </div>
        </div>
        <div className={`toast${toast.on?" on":""}`}>✓ {toast.msg}</div>
      </div>
    </>
  );
}
