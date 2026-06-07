import { useState, useEffect } from "react";
import { getMemberByPhone, getMemberById, upsertMember, updateMemberPin, addTransaction } from "./supabase";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@300;400;500;600;700;800&display=swap');`;
const C = { orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020", surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866", success:"#22C55E", danger:"#EF4444" };

function getSession() { try { const v=localStorage.getItem("uruz:session"); return v?JSON.parse(v):null; } catch { return null; } }
function saveSession(d) { try { localStorage.setItem("uruz:session",JSON.stringify(d)); } catch {} }
function clearSession()  { try { localStorage.removeItem("uruz:session"); } catch {} }
function today() { return new Date().toISOString().slice(0,10); }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }

function normalizeMember(m) {
  return {
    id:          m.id,
    name:        m.name        || "",
    phone:       m.phone       || "",
    points:      m.points      ?? 0,
    checkins:    m.checkins    ?? 0,
    streak:      m.streak      ?? 0,
    status:      m.status      || "active",
    pin:         m.pin         || null,
    lastCheckin: m.last_checkin|| m.lastCheckin || null,
    joinDate:    m.join_date   || m.joinDate || "",
  };
}

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body,#root{background:#1F2020;color:#FFFDF3;font-family:'Montserrat',sans-serif;min-height:100vh;}
.screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:#1F2020;position:relative;overflow:hidden;}
.screen::before{content:'URUZ';position:fixed;right:-30px;bottom:-20px;font-family:'Bebas Neue',sans-serif;font-size:200px;letter-spacing:8px;color:rgba(245,128,32,0.04);pointer-events:none;user-select:none;line-height:1;}
.box{width:100%;max-width:380px;background:#252627;border:1px solid #333435;padding:36px 28px;}
.brand{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:5px;color:#F58020;text-align:center;line-height:1;}
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
.ci-icon{font-size:64px;margin-bottom:16px;display:block;text-align:center;animation:pop .4s cubic-bezier(0.16,1,0.3,1);}
@keyframes pop{from{transform:scale(0.5);opacity:0;}to{transform:scale(1);opacity:1;}}
`;

function PinInput({ value, onChange, label }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  const handle = k => { if(k==="⌫") onChange(value.slice(0,-1)); else if(k==="") return; else if(value.length<4) onChange(value+k); };
  return (<div>{label&&<div className="step-sub">{label}</div>}<div className="pin-row">{[0,1,2,3].map(i=><div key={i} className={`pin-digit${value[i]?" filled":""}${value.length===i?" active":""}`}>{value[i]?"●":""}</div>)}</div><div className="pin-pad">{keys.map((k,i)=><div key={i} className={`pin-key${k==="⌫"?" del":""}${k===""?" empty":""}`} onClick={()=>handle(k)}>{k}</div>)}</div></div>);
}

export default function CheckIn() {
  const [stage,setStage]   = useState("loading");
  const [member,setMember] = useState(null);
  const [phone,setPhone]   = useState("");
  const [pin,setPin]       = useState("");
  const [error,setError]   = useState("");
  const [loading,setLoading] = useState(false);
  const [result,setResult] = useState(null);

  useEffect(()=>{
    (async()=>{
      const session=getSession();
      if(session?.memberId){
        const m=await getMemberById(session.memberId);
        if(m&&m.status==="active"){setMember(normalizeMember(m));setStage("confirm");return;}
      }
      setStage("phone");
    })();
  },[]);

  const handlePhone=async()=>{
    setError("");setLoading(true);
    const m=await getMemberByPhone(phone);
    setLoading(false);
    if(!m){setError("No active member found with this number.");return;}
    setMember(normalizeMember(m));
    setStage("pin");
  };

  const handlePin=async()=>{
    setError("");
    if(pin!==member.pin){setError("Incorrect PIN. Try again.");setPin("");return;}
    saveSession({memberId:member.id});
    setStage("confirm");
  };

  useEffect(()=>{if(stage==="pin"&&pin.length===4)handlePin();},[pin,stage]);

  const handleCheckin=async()=>{
    setLoading(true);
    const fresh=await getMemberById(member.id);
    const m=normalizeMember(fresh);
    if(m.lastCheckin===today()){setResult({type:"already"});setStage("result");setLoading(false);return;}
    const CHECKIN_PTS=50;
    const updated={...m,points:m.points+CHECKIN_PTS,checkins:m.checkins+1,lastCheckin:today()};
    await upsertMember(updated);
    await addTransaction({id:genId("TXN"),memberId:m.id,memberName:m.name,type:"checkin",pts:CHECKIN_PTS,note:"QR Check-in",date:today()});
    setMember(updated);
    setResult({type:"success",pts:CHECKIN_PTS,total:updated.points});
    setStage("result");setLoading(false);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="screen">
        {stage==="loading"&&<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:4,color:C.orange}}>LOADING…</div>}

        {stage==="phone"&&(
          <div className="box">
            <div className="brand">URUZ</div><div className="brand-sub">Check In</div><div className="divider"/>
            <div className="step-title">Scan & Check In</div>
            <div className="step-sub">Enter your phone number to check in and earn points</div>
            <label className="lbl">Phone Number</label>
            <input className="inp" placeholder="+961 XX XXX XXX" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handlePhone()}/>
            {error&&<div className="err">{error}</div>}
            <button className="btn btn-primary" onClick={handlePhone} disabled={loading}>{loading?"Checking...":"Continue"}</button>
          </div>
        )}

        {stage==="pin"&&member&&(
          <div className="box">
            <div className="brand">URUZ</div><div className="brand-sub">Check In</div><div className="divider"/>
            <div className="member-chip"><div className="chip-av">{initials(member.name)}</div><div><div style={{fontSize:14,fontWeight:700,color:"#FFFDF3"}}>{member.name}</div><div style={{fontSize:11,color:"#6B6866"}}>{member.phone}</div></div></div>
            <PinInput value={pin} onChange={v=>{setPin(v);setError("");}} label="Enter your PIN to check in"/>
            {error&&<div className="err">{error}</div>}
            <button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>{setStage("phone");setPin("");setMember(null);}}>Back</button>
          </div>
        )}

        {stage==="confirm"&&member&&(
          <div className="box">
            <div className="brand">URUZ</div><div className="brand-sub">Check In</div><div className="divider"/>
            <div className="member-chip"><div className="chip-av">{initials(member.name)}</div><div><div style={{fontSize:14,fontWeight:700,color:"#FFFDF3"}}>{member.name}</div><div style={{fontSize:11,color:"#6B6866"}}>{member.points.toLocaleString()} pts</div></div></div>
            <div className="step-sub">Tap below to check in and earn 50 points</div>
            <button className="btn btn-primary" onClick={handleCheckin} disabled={loading}>{loading?"Checking in...":"✓ Check In — +50 PTS"}</button>
            <button className="btn btn-ghost" onClick={()=>{clearSession();setStage("phone");setMember(null);}}>Not you?</button>
          </div>
        )}

        {stage==="result"&&result&&(
          <div className="box" style={{textAlign:"center"}}>
            {result.type==="success"?(
              <>
                <span className="ci-icon">✅</span>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:3,color:C.muted,marginBottom:8}}>POINTS EARNED</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:72,color:C.orange,lineHeight:1,letterSpacing:-1}}>+{result.pts}</div>
                <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:C.muted,fontWeight:700,marginTop:4}}>Points Awarded</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"#FFFDF3",margin:"16px 0 4px"}}>{member.name}</div>
                <div style={{fontSize:13,color:C.muted,fontWeight:500}}>Total balance: <span style={{color:"#FFFDF3",fontWeight:700}}>{result.total.toLocaleString()} pts</span></div>
                <div style={{marginTop:24,fontSize:12,color:C.muted,fontWeight:500}}>See you tomorrow! 💪</div>
              </>
            ):(
              <>
                <span className="ci-icon">⏰</span>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,marginBottom:8}}>Already Checked In</div>
                <div style={{fontSize:13,color:C.muted,fontWeight:500,lineHeight:1.6}}>You already checked in today.<br/>Come back tomorrow for more points!</div>
                <div style={{marginTop:20,fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:C.orange}}>{member.points.toLocaleString()}</div>
                <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700}}>Current Points</div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
