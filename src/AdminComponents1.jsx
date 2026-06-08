import { useState, useEffect } from "react";
import { upsertMember, updateMemberStatus, resetMemberPin, updateRedemptionStatus, addTransaction } from "./supabase";

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444", warning:"#F5A623",
  gold:"#D4AF37", silver:"#A8A9AD", bronze:"#CD7F32", iron:"#6B7280",
};

function today() { return new Date().toISOString().slice(0,10); }
function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

function PinInput({ value, onChange }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div>
      <div className="pin-row">{[0,1,2,3].map(i=><div key={i} className={`pin-digit${value[i]?" filled":""}${value.length===i?" active":""}`}>{value[i]?"●":""}</div>)}</div>
      <div className="pin-pad">{keys.map((k,i)=><div key={i} className="pin-key" onClick={()=>{
        if(k==="⌫") onChange(value.slice(0,-1));
        else if(k && value.length<4) onChange(value+k);
      }}>{k}</div>)}</div>
    </div>
  );
}

function Modal({title,onClose,children,footer}){
  return(<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-hdr"><div className="modal-title">{title}</div><button className="modal-close" onClick={onClose}>✕</button></div><div className="modal-body">{children}</div>{footer&&<div className="modal-footer">{footer}</div>}</div></div>);
}

function AdminLogin({ onLogin, staffList }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [stage, setStage] = useState("name");
  const [selStaff, setSelStaff] = useState(null);

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-brand">URUZ</div>
        <div className="login-sub">Administrative Node Interface</div>
        <div className="login-divider"/>
        {stage==="name" ? (
          <div>
            <input className="login-inp" placeholder="Operator Identity String" value={name} onChange={e=>setName(e.target.value)}/>
            <button className="login-btn" onClick={()=>{
              const f = staffList.find(s=>s.name.toLowerCase()===name.trim().toLowerCase());
              if(f) { setSelStaff(f); setStage("pin"); }
            }}>Query Identity</button>
          </div>
        ) : (
          <div>
            <PinInput value={pin} onChange={async(v)=>{
              setPin(v); if(v.length===4 && v===selStaff.pin) onLogin(selStaff);
            }}/>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({members,transactions,redemptions}){
  return(
    <div style={{padding:10}}>
      <div className="stat-grid">
        <div className="stat-card" style={{"--accent":C.orange}}><div className="stat-val">{members.filter(m=>m.status==="active").length}</div><div className="stat-lbl">Active Node Members</div></div>
        <div className="stat-card" style={{"--accent":C.cerulean}}><div className="stat-val">{redemptions.filter(r=>r.status==="pending").length}</div><div className="stat-lbl">Pending System Claims</div></div>
      </div>
    </div>
  );
}

function Members({members,setMembers,onAward,toast}){
  return(
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Target Name Block</th><th>Points Status Metric</th><th>Actions Matrix Control</th></tr></thead>
        <tbody>
          {members.map(m=>(
            <tr key={m.id}>
              <td>{m.name}</td>
              <td style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.orange}}>{m.points}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={()=>onAward(m)}>Modify Metric Parameter</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AwardPoints({members,setMembers,setTransactions,preSelected,toast}){
  const [pts,setPts] = useState("");
  return (
    <div style={{maxWidth:400}}>
      <div className="form-row">
        <label className="form-label">Active Node Value Target: {preSelected?.name}</label>
        <input className="form-input" type="number" value={pts} onChange={e=>setPts(e.target.value)} placeholder="Integer Scale Value"/>
      </div>
      <button className="btn btn-primary" onClick={async()=>{
        if(!preSelected || !pts) return;
        const targetPts = Math.max(0, preSelected.points + Number(pts));
        await upsertMember({...preSelected, points: targetPts});
        setMembers(prev=>prev.map(x=>x.id===preSelected.id ? {...x, points:targetPts}:x));
        toast("Matrix Parameter Modulated Successfully");
      }}>Commit Parameter Update</button>
    </div>
  );
}

function Redemptions({redemptions,setRedemptions,setMembers,setTransactions,toast}){
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>User Block Identity</th><th>Reward Component Required</th><th>Actions Processing</th></tr></thead>
        <tbody>
          {redemptions.filter(r=>r.status==="pending").map(r=>(
            <tr key={r.id}>
              <td>{r.memberName}</td>
              <td>{r.reward}</td>
              <td><button className="btn btn-success btn-sm" onClick={async()=>{
                await updateRedemptionStatus(r.id, "fulfilled");
                setRedemptions(p=>p.map(x=>x.id===r.id?{...x,status:"fulfilled"}:x));
                toast("Asset Authorized and Released");
              }}>Release Components</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RewardsCatalog({rewards}){
  return (
    <div className="reward-grid">
      {rewards.map(r=>(
        <div key={r.id} className="rwd-card">
          <div className="rwd-name">{r.name}</div>
          <div className="rwd-pts">{r.pts} <span style={{fontSize:12,color:C.muted}}>PTS</span></div>
        </div>
      ))}
    </div>
  );
}

function StaffManagement({staffList}){
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Operator Node Name</th><th>System Authority State</th></tr></thead>
        <tbody>
          {staffList.map(s=>(<tr key={s.id}><td>{s.name}</td><td><span className="badge badge-active">{s.role.toUpperCase()}</span></td></tr>))}
        </tbody>
      </table>
    </div>
  );
}

function BulkImport() {
  return (
    <div style={{textAlign:"center", padding:40}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.white}}>Data Influx Registry Portal Node</div>
    </div>
  );
}

export { PinInput, Modal, AdminLogin, Dashboard, Members, AwardPoints, Redemptions, RewardsCatalog, StaffManagement, BulkImport };
