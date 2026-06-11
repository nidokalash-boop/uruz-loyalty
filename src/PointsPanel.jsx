import { useState, useEffect } from "react";
import { getPointsLog, batchAwardPoints, awardPoints, getMembers } from "./supabase";

function genId() { return `PL-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }); }
  catch { return d || ""; }
}
function fmtTime(d) {
  try { return new Date(d).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" }); }
  catch { return ""; }
}

const CATEGORY_LABELS = {
  check_in:  "Check-In",
  workout:   "Workout",
  challenge: "Challenge",
  birthday:  "Birthday",
  referral:  "Referral",
  campaign:  "Campaign",
  manual:    "Manual",
};

const CATEGORY_COLORS = {
  check_in:  "#026F91",
  workout:   "#22C55E",
  challenge: "#F58020",
  birthday:  "#D4AF37",
  referral:  "#A855F7",
  campaign:  "#EF4444",
  manual:    "#6B7280",
};

const PRESET_CAMPAIGNS = [
  { label: "Launch Bonus",       pts: 500,  reason: "🚀 Member Central Launch — welcome bonus!" },
  { label: "Ramadan Special",    pts: 300,  reason: "🌙 Ramadan Mubarak bonus from URUZ" },
  { label: "Summer Challenge",   pts: 200,  reason: "☀️ Summer Challenge bonus" },
  { label: "Loyalty Milestone",  pts: 1000, reason: "⭐ 1-Year loyalty milestone reward" },
  { label: "Custom",             pts: 0,    reason: "" },
];

export function PointsPanel({ members: propMembers, toast }) {
  const [tab, setTab]             = useState("campaign");
  const [members, setMembers]     = useState(propMembers || []);
  const [log, setLog]             = useState([]);
  const [loadingLog, setLoadingLog] = useState(false);

  // Campaign state
  const [preset, setPreset]         = useState(0);
  const [pts, setPts]               = useState(500);
  const [reason, setReason]         = useState(PRESET_CAMPAIGNS[0].reason);
  const [target, setTarget]         = useState("all"); // 'all' | 'active' | 'select'
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch]         = useState("");
  const [running, setRunning]       = useState(false);
  const [preview, setPreview]       = useState(false);

  // Single award state
  const [singleMember, setSingleMember] = useState("");
  const [singlePts, setSinglePts]       = useState(100);
  const [singleReason, setSingleReason] = useState("");
  const [singleCat, setSingleCat]       = useState("manual");
  const [awarding, setAwarding]         = useState(false);

  // Log filter
  const [logSearch, setLogSearch]   = useState("");
  const [logCat, setLogCat]         = useState("all");

  useEffect(() => {
    if (propMembers?.length) setMembers(propMembers);
    else getMembers().then(m => setMembers(m));
  }, [propMembers]);

  useEffect(() => {
    if (tab === "log") loadLog();
  }, [tab]);

  async function loadLog() {
    setLoadingLog(true);
    const data = await getPointsLog({ limit: 200 });
    setLog(data);
    setLoadingLog(false);
  }

  // ── Campaign helpers ──
  function applyPreset(idx) {
    setPreset(idx);
    const p = PRESET_CAMPAIGNS[idx];
    if (p.pts) setPts(p.pts);
    if (p.reason) setReason(p.reason);
  }

  const activeMembers = members.filter(m => m.status === "active");
  const filteredForSelect = members.filter(m =>
    m.status === "active" &&
    (m.name?.toLowerCase().includes(search.toLowerCase()) ||
     m.phone?.includes(search))
  );

  function targetMembers() {
    if (target === "all")    return members.filter(m => m.status === "active");
    if (target === "active") return members.filter(m => m.status === "active");
    return members.filter(m => selectedIds.includes(m.id));
  }

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function selectAll() { setSelectedIds(filteredForSelect.map(m => m.id)); }
  function clearAll()  { setSelectedIds([]); }

  async function runCampaign() {
    const targets = targetMembers();
    if (!targets.length) { toast("No members selected"); return; }
    if (!pts || pts <= 0) { toast("Enter a valid points amount"); return; }
    if (!reason.trim())  { toast("Enter a campaign reason"); return; }
    setRunning(true);
    try {
      const memberMap = {};
      targets.forEach(m => { memberMap[m.id] = m.name; });
      await batchAwardPoints({
        memberIds: targets.map(m => m.id),
        memberMap,
        points: Number(pts),
        reason: reason.trim(),
        category: "campaign",
        createdBy: "admin",
      });
      toast(`✓ ${pts} pts awarded to ${targets.length} member${targets.length > 1 ? "s" : ""}!`);
      setPreview(false);
    } catch(e) {
      toast("Error — check console");
      console.error(e);
    }
    setRunning(false);
  }

  async function runSingleAward() {
    if (!singleMember) { toast("Select a member"); return; }
    if (!singlePts || singlePts <= 0) { toast("Enter valid points"); return; }
    if (!singleReason.trim()) { toast("Enter a reason"); return; }
    setAwarding(true);
    try {
      const m = members.find(x => x.id === singleMember);
      await awardPoints({
        memberId:   m.id,
        memberName: m.name,
        points:     Number(singlePts),
        reason:     singleReason.trim(),
        category:   singleCat,
        createdBy:  "admin",
      });
      toast(`✓ ${singlePts} pts awarded to ${m.name}!`);
      setSingleReason("");
      setSingleMember("");
      setSinglePts(100);
    } catch(e) {
      toast("Error — check console");
      console.error(e);
    }
    setAwarding(false);
  }

  // ── Log filter ──
  const filteredLog = log.filter(r => {
    const matchSearch = !logSearch ||
      r.memberName?.toLowerCase().includes(logSearch.toLowerCase()) ||
      r.reason?.toLowerCase().includes(logSearch.toLowerCase());
    const matchCat = logCat === "all" || r.category === logCat;
    return matchSearch && matchCat;
  });

  const totalAwarded = filteredLog.reduce((s, r) => s + (r.points || 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 3, color:"#FFFDF3", marginBottom: 4 }}>
          Points Engine
        </div>
        <div style={{ fontSize: 12, color:"#6B6866", fontWeight: 500 }}>
          Award points to members individually or in bulk campaigns
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id:"campaign", label:"Batch Campaign" },
          { id:"single",   label:"Single Award" },
          { id:"log",      label:"Points Log" },
        ].map(t => (
          <button key={t.id} className={`tab-btn${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BATCH CAMPAIGN TAB ── */}
      {tab === "campaign" && (
        <div>
          {/* Stats bar */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { val: members.filter(m => m.status === "active").length, lbl:"Active Members", accent:"#F58020" },
              { val: `${pts || 0} pts`, lbl:"Points Per Member", accent:"#22C55E" },
              { val: `${(pts || 0) * targetMembers().length}`, lbl:"Total Points to Distribute", accent:"#026F91" },
            ].map((s, i) => (
              <div key={i} style={{ background:"#252627", border:"1px solid #333435", padding:"14px 16px", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top: 0, left: 0, right: 0, height: 2, background: s.accent }} />
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 28, color:"#FFFDF3", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform:"uppercase", color:"#6B6866", marginTop: 4, fontWeight: 700 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Preset chips */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform:"uppercase", color:"#6B6866", fontWeight: 700, marginBottom: 8 }}>
              Campaign Preset
            </div>
            <div style={{ display:"flex", gap: 8, flexWrap:"wrap" }}>
              {PRESET_CAMPAIGNS.map((p, i) => (
                <button key={i} onClick={() => applyPreset(i)}
                  style={{
                    padding:"6px 14px", border:`1px solid ${preset === i ? "#F58020" : "#333435"}`,
                    background: preset === i ? "rgba(245,128,32,.1)" : "none",
                    color: preset === i ? "#F58020" : "#6B6866",
                    fontFamily:"'Montserrat',sans-serif", fontSize: 11, fontWeight: 700,
                    letterSpacing: 1.5, textTransform:"uppercase", cursor:"pointer",
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Points + Reason */}
          <div style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap: 12, marginBottom: 16 }}>
            <div className="form-row" style={{ margin: 0 }}>
              <label className="form-label">Points Amount</label>
              <input className="form-input" type="number" min="1" value={pts}
                onChange={e => setPts(Number(e.target.value))}
                style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 24, color:"#F58020", textAlign:"center" }}
              />
            </div>
            <div className="form-row" style={{ margin: 0 }}>
              <label className="form-label">Campaign Reason (shown in member history)</label>
              <input className="form-input" type="text" value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. 🚀 Launch bonus — thank you for being a member!"
              />
            </div>
          </div>

          {/* Target selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform:"uppercase", color:"#6B6866", fontWeight: 700, marginBottom: 8 }}>
              Who Gets These Points
            </div>
            <div style={{ display:"flex", gap: 10, marginBottom: 12 }}>
              {[
                { id:"all",    label:`All Active (${activeMembers.length})` },
                { id:"select", label:"Select Specific Members" },
              ].map(opt => (
                <button key={opt.id} onClick={() => setTarget(opt.id)}
                  style={{
                    padding:"8px 16px", border:`1px solid ${target === opt.id ? "#F58020" : "#333435"}`,
                    background: target === opt.id ? "rgba(245,128,32,.1)" : "#252627",
                    color: target === opt.id ? "#F58020" : "#6B6866",
                    fontFamily:"'Montserrat',sans-serif", fontSize: 11, fontWeight: 700,
                    letterSpacing: 1.5, textTransform:"uppercase", cursor:"pointer",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Select specific members */}
            {target === "select" && (
              <div style={{ background:"#252627", border:"1px solid #333435", padding: 14 }}>
                <div style={{ display:"flex", gap: 8, marginBottom: 10, alignItems:"center", flexWrap:"wrap" }}>
                  <input className="search-input" style={{ flex: 1, minWidth: 160 }}
                    placeholder="Search members…" value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select All</button>
                  <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear</button>
                  <span style={{ fontSize: 12, color:"#F58020", fontWeight: 700 }}>
                    {selectedIds.length} selected
                  </span>
                </div>
                <div style={{ maxHeight: 260, overflowY:"auto", display:"flex", flexDirection:"column", gap: 6 }}>
                  {filteredForSelect.map(m => {
                    const sel = selectedIds.includes(m.id);
                    return (
                      <div key={m.id} onClick={() => toggleSelect(m.id)}
                        style={{
                          display:"flex", alignItems:"center", gap: 10, padding:"10px 12px",
                          background: sel ? "rgba(245,128,32,.08)" : "#2A2B2C",
                          border:`1px solid ${sel ? "#F58020" : "#333435"}`,
                          cursor:"pointer",
                        }}>
                        <div style={{
                          width: 18, height: 18, border:`2px solid ${sel ? "#F58020" : "#6B6866"}`,
                          background: sel ? "#F58020" : "none", flexShrink: 0,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          {sel && <span style={{ color:"#fff", fontSize: 11, fontWeight: 800 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color:"#FFFDF3" }}>{m.name}</div>
                          <div style={{ fontSize: 11, color:"#6B6866" }}>{m.phone}</div>
                        </div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 20, color:"#6B6866" }}>
                          {m.points} pts
                        </div>
                      </div>
                    );
                  })}
                  {filteredForSelect.length === 0 && (
                    <div style={{ padding: 20, textAlign:"center", color:"#6B6866", fontSize: 13 }}>
                      No members found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Launch button */}
          <div style={{ display:"flex", gap: 12, alignItems:"center", flexWrap:"wrap" }}>
            <button className="btn btn-primary"
              style={{ fontSize: 13, padding:"12px 28px" }}
              onClick={() => setPreview(true)}
              disabled={running || (target === "select" && selectedIds.length === 0)}>
              Preview Campaign
            </button>
            {target === "select" && selectedIds.length === 0 && (
              <span style={{ fontSize: 11, color:"#6B6866" }}>Select at least one member</span>
            )}
          </div>

          {/* Preview modal */}
          {preview && (
            <div className="modal-bg">
              <div className="modal">
                <div className="modal-hdr">
                  <div className="modal-title">Confirm Campaign</div>
                  <button className="modal-close" onClick={() => setPreview(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <div style={{ background:"rgba(245,128,32,.08)", border:"1px solid rgba(245,128,32,.3)", padding:"14px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color:"#F58020", fontWeight: 700, marginBottom: 4 }}>You are about to:</div>
                    <div style={{ fontSize: 22, fontFamily:"'Bebas Neue',sans-serif", color:"#FFFDF3", lineHeight: 1.3 }}>
                      Award {pts} points<br />
                      to {targetMembers().length} member{targetMembers().length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: 12, color:"#6B6866", marginTop: 8 }}>
                      Total distributed: <strong style={{ color:"#FFFDF3" }}>{pts * targetMembers().length} pts</strong>
                    </div>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Reason</label>
                    <div style={{ padding:"10px 12px", background:"#2A2B2C", border:"1px solid #333435", fontSize: 13, color:"#FFFDF3" }}>
                      {reason}
                    </div>
                  </div>
                  {target === "select" && (
                    <div style={{ fontSize: 12, color:"#6B6866", marginTop: 8 }}>
                      Recipients: {targetMembers().map(m => m.name).join(", ")}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setPreview(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={runCampaign} disabled={running}>
                    {running ? "Running…" : "Launch Campaign"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SINGLE AWARD TAB ── */}
      {tab === "single" && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background:"#252627", border:"1px solid #333435", padding: 20 }}>
            <div className="form-row">
              <label className="form-label">Member</label>
              <select className="form-select" value={singleMember} onChange={e => setSingleMember(e.target.value)}>
                <option value="">— Select member —</option>
                {members.filter(m => m.status === "active").map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.points} pts)</option>
                ))}
              </select>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12 }}>
              <div className="form-row">
                <label className="form-label">Points</label>
                <input className="form-input" type="number" min="1" value={singlePts}
                  onChange={e => setSinglePts(Number(e.target.value))}
                  style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 22, color:"#F58020", textAlign:"center" }}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Category</label>
                <select className="form-select" value={singleCat} onChange={e => setSingleCat(e.target.value)}>
                  {Object.entries(CATEGORY_LABELS).map(([k,v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Reason</label>
              <input className="form-input" type="text" value={singleReason}
                onChange={e => setSingleReason(e.target.value)}
                placeholder="e.g. Perfect attendance this month"
              />
            </div>

            <button className="btn btn-primary" style={{ width:"100%", padding: 12 }}
              onClick={runSingleAward} disabled={awarding}>
              {awarding ? "Awarding…" : `Award ${singlePts} Points`}
            </button>
          </div>
        </div>
      )}

      {/* ── POINTS LOG TAB ── */}
      {tab === "log" && (
        <div>
          {/* Summary bar */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { val: filteredLog.length, lbl:"Transactions", accent:"#F58020" },
              { val: totalAwarded.toLocaleString(), lbl:"Total Points Awarded", accent:"#22C55E" },
              { val: new Set(filteredLog.map(r => r.member_id)).size, lbl:"Members Involved", accent:"#026F91" },
            ].map((s, i) => (
              <div key={i} style={{ background:"#252627", border:"1px solid #333435", padding:"12px 14px", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top: 0, left: 0, right: 0, height: 2, background: s.accent }} />
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 26, color:"#FFFDF3", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform:"uppercase", color:"#6B6866", marginTop: 3, fontWeight: 700 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display:"flex", gap: 10, marginBottom: 14, flexWrap:"wrap", alignItems:"center" }}>
            <input className="search-input" style={{ flex: 1, minWidth: 160 }}
              placeholder="Search member or reason…" value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
            />
            <select className="form-select" style={{ width:"auto", minWidth: 140 }}
              value={logCat} onChange={e => setLogCat(e.target.value)}>
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k,v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={loadLog}>↻ Refresh</button>
          </div>

          {loadingLog ? (
            <div style={{ padding: 40, textAlign:"center", color:"#6B6866" }}>Loading…</div>
          ) : filteredLog.length === 0 ? (
            <div className="empty">No points log entries yet</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Points</th>
                      <th>Category</th>
                      <th>Reason</th>
                      <th>Awarded By</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLog.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.memberName || r.member_name}</td>
                        <td>
                          <span style={{
                            fontFamily:"'Bebas Neue',sans-serif", fontSize: 20,
                            color: r.points > 0 ? "#22C55E" : "#EF4444"
                          }}>
                            +{r.points}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding:"2px 8px", fontSize: 10, fontWeight: 700,
                            letterSpacing: 1, textTransform:"uppercase",
                            background: `${CATEGORY_COLORS[r.category]}22`,
                            color: CATEGORY_COLORS[r.category] || "#6B6866",
                          }}>
                            {CATEGORY_LABELS[r.category] || r.category}
                          </span>
                        </td>
                        <td style={{ color:"#6B6866", fontSize: 12 }}>{r.reason}</td>
                        <td style={{ color:"#6B6866", fontSize: 12 }}>{r.createdBy || r.created_by}</td>
                        <td className="mono" style={{ color:"#6B6866", fontSize: 11 }}>
                          {fmtDate(r.createdAt || r.created_at)}<br/>
                          <span style={{ fontSize: 10 }}>{fmtTime(r.createdAt || r.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="member-list-mobile">
                {filteredLog.map(r => (
                  <div key={r.id} style={{
                    background:"#252627", border:"1px solid #333435",
                    padding:"12px 14px", marginBottom: 8,
                    display:"flex", alignItems:"center", gap: 12,
                  }}>
                    <div style={{
                      width: 44, height: 44, flexShrink: 0,
                      background: `${CATEGORY_COLORS[r.category] || "#6B7280"}22`,
                      border: `1px solid ${CATEGORY_COLORS[r.category] || "#6B7280"}44`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <span style={{
                        fontFamily:"'Bebas Neue',sans-serif", fontSize: 16,
                        color: CATEGORY_COLORS[r.category] || "#6B6866",
                      }}>
                        +{r.points}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color:"#FFFDF3" }}>
                        {r.memberName || r.member_name}
                      </div>
                      <div style={{ fontSize: 11, color:"#6B6866", marginTop: 2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {r.reason}
                      </div>
                      <div style={{ fontSize: 10, color:"#6B6866", marginTop: 2 }}>
                        {fmtDate(r.createdAt || r.created_at)}
                      </div>
                    </div>
                    <span style={{
                      padding:"2px 8px", fontSize: 9, fontWeight: 700,
                      letterSpacing: 1, textTransform:"uppercase",
                      background: `${CATEGORY_COLORS[r.category]}22`,
                      color: CATEGORY_COLORS[r.category] || "#6B6866",
                      flexShrink: 0,
                    }}>
                      {CATEGORY_LABELS[r.category] || r.category}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

