import { useState, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@300;400;500;600;700;800&display=swap');`;
const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444",
};

async function sload(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
async function ssave(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function getSession() {
  try { const v = localStorage.getItem("uruz:session"); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function saveSession(data) {
  try { localStorage.setItem("uruz:session", JSON.stringify(data)); } catch {}
}
function clearSession() {
  try { localStorage.removeItem("uruz:session"); } catch {}
}
function today() { return new Date().toISOString().slice(0,10); }

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

.lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-bottom:8px;display:block;}
.inp{width:100%;padding:12px 14px;background:#2A2B2C;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:500;outline:none;transition:border-color .15s;margin-bottom:14px;}
.inp:focus{border-color:#F58020;}
.inp::placeholder{color:#6B6866;}

.pin-row{display:flex;gap:10px;justify-content:center;margin-bottom:20px;}
.pin-digit{width:52px;height:64px;background:#2A2B2C;border:1px solid #333435;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:32px;color:#F58020;transition:border-color .15s;cursor:text;}
.pin-digit.filled{border-color:#F58020;}
.pin-digit.active{border-color:#F58020;box-shadow:0 0 0 1px #F58020;}

.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}
.pin-key{padding:16px;background:#2A2B2C;border:1px solid #333435;color:#FFFDF3;font-family:'Montserrat',sans-serif;font-size:18px;font-weight:700;cursor:pointer;text-align:center;transition:all .15s;user-select:none;}
.pin-key:hover{background:#333435;border-color:#F58020;}
.pin-key:active{background:#F58020;color:#fff;}
.pin-key.del{color:#6B6866;font-size:14px;}
.pin-key.empty{background:transparent;border-color:transparent;pointer-events:none;}

.btn{width:100%;padding:14px;border:none;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .15s;margin-bottom:10px;}
.btn-primary{background:#F58020;color:#fff;}
.btn-primary:hover{background:#F59340;}
.btn-primary:disabled{background:#333435;color:#6B6866;cursor:not-allowed;}
.btn-ghost{background:none;border:1px solid #333435;color:#6B6866;}
.btn-ghost:hover{border-color:#F58020;color:#F58020;}

.err{font-size:12px;color:#EF4444;text-align:center;margin-bottom:12px;font-weight:500;}
.hint{font-size:11px;color:#6B6866;text-align:center;line-height:1.6;margin-top:8px;}
.link{color:#F58020;cursor:pointer;font-weight:700;text-decoration:none;}
.link:hover{text-decoration:underline;}

.step-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#FFFDF3;margin-bottom:6px;text-align:center;}
.step-sub{font-size:12px;color:#6B6866;text-align:center;margin-bottom:24px;font-weight:500;line-height:1.5;}

.member-chip{display:flex;align-items:center;gap:12px;background:#2A2B2C;border:1px solid #333435;padding:12px 14px;margin-bottom:20px;}
.chip-av{width:36px;height:36px;background:rgba(245,128,32,.15);border:1px solid rgba(245,128,32,.3);display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;color:#F58020;flex-shrink:0;}
.chip-name{font-size:14px;font-weight:700;color:#FFFDF3;}
.chip-phone{font-size:11px;color:#6B6866;}
`;

function initials(n) { return n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

function PinInput({ value, onChange, label, hint }) {
  const digits = (value+"").padEnd(4,"").split("").slice(0,4);
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  const handleKey = (k) => {
    if (k === "⌫") { onChange(value.slice(0,-1)); }
    else if (k === "") { return; }
    else if (value.length < 4) { onChange(value + k); }
  };

  return (
    <div>
      {label && <div className="step-sub">{label}</div>}
      <div className="pin-row">
        {[0,1,2,3].map(i => (
          <div key={i} className={`pin-digit${digits[i].trim()?" filled":""}${value.length===i?" active":""}`}>
            {digits[i].trim() ? "●" : ""}
          </div>
        ))}
      </div>
      <div className="pin-pad">
        {keys.map((k,i) => (
          <div key={i} className={`pin-key${k==="⌫"?" del":""}${k===""?" empty":""}`} onClick={()=>handleKey(k)}>
            {k}
          </div>
        ))}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export default function CheckIn() {
  const [stage, setStage]     = useState("loading");
  const [member, setMember]   = useState(null);
  const [phone, setPhone]     = useState("");
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState("");
  const [result, setResult]   = useState(null);

  useEffect(() => {
    (async () => {
      const session = getSession();
      if (session?.memberId) {
        const members = await sload("uruz:members", []);
        const m = members.find(x => x.id === session.memberId);
        if (m && m.status === "active") {
          setMember(m);
          setStage("confirm");
          return;
        }
      }
      setStage("phone");
    })();
  }, []);

  const handlePhone = async () => {
    setError("");
    const members = await sload("uruz:members", []);
    const clean = s => s.replace(/\s+/g,"");
    const m = members.find(x => clean(x.phone) === clean(phone) && x.status === "active");
    if (!m) { setError("No active member found with this number."); return; }
    setMember(m);
    setStage("pin");
  };

  const handlePin = async () => {
    setError("");
    if (pin !== member.pin) { setError("Incorrect PIN. Try again."); setPin(""); return; }
    saveSession({ memberId: member.id });
    setStage("confirm");
  };

  useEffect(() => {
    if (stage === "pin" && pin.length === 4) handlePin();
  }, [pin, stage]);

  const handleCheckin = async () => {
    const members = await sload("uruz:members", []);
    const m = members.find(x => x.id === member.id);
    
    if (m.lastCheckin === today()) {
      setResult({ type: "already", pts: 0 });
      setStage("result");
      return;
    }

    const CHECKIN_PTS = 50;
    const updated = members.map(x =>
      x.id === member.id
        ? { ...x, points: x.points + CHECKIN_PTS, checkins: x.checkins + 1, lastCheckin: today() }
        : x
    );
    await ssave("uruz:members", updated);

    const txn = {
      id: `TXN-${Math.floor(10000+Math.random()*90000)}`,
      memberId: m.id, memberName: m.name,
      type: "checkin", pts: CHECKIN_PTS,
      note: "QR Check-in", date: today()
    };
    const txns = await sload("uruz:transactions", []);
    await ssave("uruz:transactions", [txn, ...txns]);

    const updatedMember = updated.find(x => x.id === member.id);
    setMember(updatedMember);
    setResult({ type: "success", pts: CHECKIN_PTS, total: updatedMember.points });
    setStage("result");
  };

  const CSS_CI = `
    ${CSS}
    .ci-success{text-align:center;padding:8px 0;}
    .ci-icon{font-size:64px;margin-bottom:16px;display:block;animation:pop .4s cubic-bezier(0.16,1,0.3,1);}
    @keyframes pop{from{transform:scale(0.5);opacity:0;}to{transform:scale(1);opacity:1;}}
    .ci-pts{font-family:'Bebas Neue',sans-serif;font-size:72px;color:#F58020;line-height:1;letter-spacing:-1px;}
    .ci-pts-lbl{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6B6866;font-weight:700;margin-top:4px;}
    .ci-name{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#FFFDF3;margin:16px 0 4px;}
    .ci-total{font-size:13px;color:#6B6866;font-weight:500;}
    .ci-total span{color:#FFFDF3;font-weight:700;}
    .ci-already{text-align:center;}
    .ci-already-icon{font-size:48px;margin-bottom:12px;display:block;}
  `;

  return (
    <>
      <style>{CSS_CI}</style>
      <div className="screen">
        {stage === "loading" && (
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:4,color:C.orange}}>LOADING…</div>
        )}

        {stage === "phone" && (
          <div className="box">
            <div className="brand">URUZ</div>
            <div className="brand-sub">Check In</div>
            <div className="divider"/>
            <div className="step-title">Scan & Check In</div>
            <div className="step-sub">Enter your phone number to check in and earn points</div>
            <label className="lbl">Phone Number</label>
            <input className="inp" placeholder="+961 XX XXX XXX" value={phone}
              onChange={e=>setPhone(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handlePhone()}
            />
            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary" onClick={handlePhone}>Continue</button>
          </div>
        )}

        {stage === "pin" && member && (
          <div className="box">
            <div className="brand">URUZ</div>
            <div className="brand-sub">Check In</div>
            <div className="divider"/>
            <div className="member-chip">
              <div className="chip-av">{initials(member.name)}</div>
              <div>
                <div className="chip-name">{member.name}</div>
                <div className="chip-phone">{member.phone}</div>
              </div>
            </div>
            <PinInput value={pin} onChange={v=>{setPin(v);setError("");}} label="Enter your PIN to check in"/>
            {error && <div className="err">{error}</div>}
            <button className="btn btn-ghost" onClick={()=>{setStage("phone");setPin("");setMember(null);}}>Back</button>
          </div>
        )}

        {stage === "confirm" && member && (
          <div className="box">
            <div className="brand">URUZ</div>
            <div className="brand-sub">Check In</div>
            <div className="divider"/>
            <div className="member-chip">
              <div className="chip-av">{initials(member.name)}</div>
              <div>
                <div className="chip-name">{member.name}</div>
                <div className="chip-phone">{member.points.toLocaleString()} pts</div>
              </div>
            </div>
            <div className="step-sub">Tap below to check in and earn 50 points</div>
            <button className="btn btn-primary" onClick={handleCheckin}>✓ Check In — +50 PTS</button>
            <button className="btn btn-ghost" onClick={()=>{clearSession();setStage("phone");setMember(null);}}>Not you?</button>
          </div>
        )}

        {stage === "result" && result && (
          <div className="box">
            {result.type === "success" ? (
              <div className="ci-success">
                <span className="ci-icon">✅</span>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:3,color:C.muted,marginBottom:8}}>POINTS EARNED</div>
                <div className="ci-pts">+{result.pts}</div>
                <div className="ci-pts-lbl">Points Awarded</div>
                <div className="ci-name">{member.name}</div>
                <div className="ci-total">Total balance: <span>{result.total.toLocaleString()} pts</span></div>
                <div style={{marginTop:24,fontSize:12,color:C.muted,fontWeight:500}}>See you tomorrow! 💪</div>
              </div>
            ) : (
              <div className="ci-already">
                <span className="ci-already-icon">⏰</span>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,marginBottom:8}}>Already Checked In</div>
                <div style={{fontSize:13,color:C.muted,fontWeight:500,lineHeight:1.6}}>
                  You already checked in today.<br/>Come back tomorrow for more points!
                </div>
                <div style={{marginTop:20,fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:C.orange}}>
                  {member.points.toLocaleString()}
                </div>
                <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.muted,fontWeight:700}}>Current Points</div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
