import { useState, useEffect } from "react";
import { upsertMember, updateRedemptionStatus, addTransaction } from "./supabase";

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444", warning:"#F5A623",
  gold:"#D4AF37", silver:"#A8A9AD", bronze:"#CD7F32", iron:"#6B7280",
};

function today() { return new Date().toISOString().slice(0,10); }
function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function initials(n) { return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function getTierFn(pts, tiers) { return [...tiers].sort((a,b)=>b.min-a.min).find(t=>pts>=t.min)||tiers[0]; }

export function PinInput({ value, onChange }) {
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

export function Modal({title,onClose,children,footer}){
  return(<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-hdr"><div className="modal-title">{title}</div><button className="modal-close" onClick={onClose}>✕</button></div><div className="modal-body">{children}</div>{footer&&<div className="modal-footer">{footer}</div>}</div></div>);
}

export function AdminLogin({ onLogin, staffList }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [stage, setStage] = useState("name");
  const [selStaff, setSelStaff] = useState(null);

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-brand">URUZ</div>
        <div className="login-sub">Administrative System Gateway</div>
        <div className="login-divider"/>
        {stage==="name" ? (
          <div>
            <input className="login-inp" placeholder="Operator Staff Handle" value={name} onChange={e=>setName(e.target.value)}/>
            <button className="login-btn" onClick={()=>{
              const f = staffList.find(s=>s.name.toLowerCase()===name.trim().toLowerCase());
              if(f) { setSelStaff(f); setStage("pin"); }
            }}>Verify Handle</button>
          </div>
        ) : (
          <div>
            <PinInput value={pin} onChange={(v)=>{setPin(v); if(v.length===4 && v===selStaff.pin) onLogin(selStaff);}}/>
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard({members, transactions, redemptions}){
  return(
    <div>
      <div className="stat-grid">
        <div className="stat-card" style={{"--accent":C.orange}}><div className="stat-val">{members.filter(m=>m.status==="active").length}</div><div className="stat-lbl">Active Sync Devices</div></div>
        <div className="stat-card" style={{"--accent":C.cerulean}}><div className="stat-val">{redemptions.filter(r=>r.status==="pending").length}</div><div className="stat-lbl">Awaiting Releases</div></div>
      </div>
    </div>
  );
}

export function Members({members, setMembers, tiers, onAward}){
  return(
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>User Core Label</th><th>Tier Range</th><th>Metric Score</th><th>Parameters Modification</th></tr></thead>
        <tbody>
          {members.map(m=>{
            const t = getTierFn(m.points, tiers);
            return (
              <tr key={m.id}>
                <td style={{fontWeight:600}}>{m.name}</td>
                <td><span style={{color:t.color, fontWeight:700}}>{t.name}</span></td>
                <td style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.orange}}>{m.points.toLocaleString()}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>onAward(m)}>Modify Data Bounds</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AwardPoints({members, setMembers, setTransactions, preSelected, toast}){
  const [pts, setPts] = useState("");
  return (
    <div style={{maxWidth:400}}>
      <div className="form-row">
        <label className="form-label">Active Targeted Profile Object: {preSelected?.name}</label>
        <input className="form-input" type="number" value={pts} onChange={e=>setPts(e.target.value)} placeholder="Incremental Integer Modifier"/>
      </div>
      <button className="btn btn-primary" onClick={async()=>{
        if(!preSelected || !pts) return;
        const targetVal = Math.max(0, preSelected.points + Number(pts));
        await upsertMember({...preSelected, points: targetVal});
        setMembers(p=>p.map(x=>x.id===preSelected.id ? {...x, points:targetVal}:x));
        const txn={id:genId("TXN"), memberId:preSelected.id, memberName:preSelected.name, type:"manual", pts:Number(pts), note:"Front Desk Adjust", date:today()};
        await addTransaction(txn); setTransactions(p=>[txn,...p]);
        toast("State Variable Overwritten Successfully");
      }}>Execute Array Re-Indexing</button>
    </div>
  );
}

export function Redemptions({redemptions, setRedemptions, setMembers, setTransactions, toast}){
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Member Profile Node</th><th>Component Track Required</th><th>Operations Authorization</th></tr></thead>
        <tbody>
          {redemptions.filter(r=>r.status==="pending").map(r=>(
            <tr key={r.id}>
              <td style={{fontWeight:600}}>{r.memberName}</td>
              <td>{r.reward}</td>
              <td><button className="btn btn-success btn-sm" onClick={async()=>{
                await updateRedemptionStatus(r.id, "fulfilled");
                setRedemptions(p=>p.map(x=>x.id===r.id?{...x,status:"fulfilled"}:x));
                setMembers(m=>m.map(x=>x.id===r.memberId?{...x,points:Math.max(0, x.points-r.pts)}:x));
                const txn={id:genId("TXN"), memberId:r.memberId, memberName:r.memberName, type:"redeem", pts:-r.pts, note:`Released: ${r.reward}`, date:today()};
                await addTransaction(txn); setTransactions(p=>[txn,...p]);
                toast("Asset Authorized and Released");
              }}>Release Components</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RewardsCatalog({rewards}){
  return (
    <div className="reward-grid">
      {rewards.map(r=>(
        <div key={r.id} className="rwd-card">
          <div style={{fontWeight:700, color:C.white}}>{r.name}</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.orange, marginTop:6}}>{r.pts} <span style={{fontSize:12, color:C.muted}}>PTS</span></div>
        </div>
      ))}
    </div>
  );
}

export function StaffManagement({staffList}){
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Operator Core Name String</th><th>Security Access Clearance</th></tr></thead>
        <tbody>
          {staffList.map(s=>(<tr key={s.id}><td>{s.name}</td><td><span className="badge badge-active">{s.role.toUpperCase()}</span></td></tr>))}
        </tbody>
      </table>
    </div>
  );
}

export function BulkImport() {
  return <div style={{textAlign:"center", padding:40}}><div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.white}}>Automated Pipeline Integration Influx Terminal</div></div>;
}
