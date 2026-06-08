import { useState, useEffect } from "react";
import {
  upsertMember, addTransaction,
  getAllWorkouts, upsertWorkout, deleteWorkout,
  getAllUnlocks, unlockWorkout
} from "./supabase";

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444", warning:"#F5A623",
  gold:"#D4AF37", silver:"#A8A9AD", bronze:"#CD7F32", iron:"#6B7280",
};

function genId(p) { return `${p}-${Math.floor(10000+Math.random()*90000)}`; }
function today() { return new Date().toISOString().slice(0,10); }

// ── WORKOUTS PANEL ────────────────────────────────────────
function WorkoutsPanel({ members, toast }) {
  const [workouts, setWorkouts]   = useState([]);
  const [unlocks, setUnlocks]     = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [view, setView]           = useState("list"); // list | edit | unlock
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [exercises, setExercises] = useState([]);
  const [unlockForm, setUnlockForm] = useState({ workoutId:"", memberId:"" });

  const BLANK = { id:"", title:"", description:"", category:"Strength", difficulty:"Beginner", duration_mins:30, thumbnail_url:"", video_url:"", pdf_url:"", access_type:"free", points_cost:0, price_label:"", tier_required:"Gold", active:true, created_at:"" };
  const CATS = ["Strength","Cardio","HIIT","Mobility","Yoga","Boxing","CrossFit","Other"];
  const DIFFS = ["Beginner","Intermediate","Advanced"];
  const TIERS = ["Iron","Bronze","Silver","Gold","Elite"];
  const ACCESS = [
    { v:"free",   l:"Free — available to all" },
    { v:"points", l:"Points — member redeems points" },
    { v:"paid",   l:"Paid — staff unlocks after payment" },
    { v:"tier",   l:"Tier — auto-unlocks by tier" },
  ];

  useEffect(() => {
    Promise.all([getAllWorkouts(), getAllUnlocks()]).then(([w,u]) => {
      setWorkouts(w); setUnlocks(u); setLoaded(true);
    });
  }, []);

  const startNew = () => { setEditing({...BLANK, id:genId("WRK"), created_at:today()}); setExercises([]); setView("edit"); };
  const startEdit = (w) => { setEditing({...w}); setExercises(Array.isArray(w.exercises)?w.exercises:[]); setView("edit"); };

  const handleSave = async () => {
    if (!editing.title.trim()) { toast("Title is required"); return; }
    setSaving(true);
    const workout = { ...editing, exercises };
    await upsertWorkout(workout);
    setWorkouts(prev => {
      const exists = prev.find(w=>w.id===workout.id);
      return exists ? prev.map(w=>w.id===workout.id?workout:w) : [workout,...prev];
    });
    setSaving(false);
    toast(`${editing.title} saved`);
    setView("list");
  };

  const handleDelete = async (id, title) => {
    await deleteWorkout(id);
    setWorkouts(prev=>prev.filter(w=>w.id!==id));
    toast(`${title} deleted`);
  };

  const toggleActive = async (w) => {
    const updated = {...w, active:!w.active};
    await upsertWorkout(updated);
    setWorkouts(prev=>prev.map(x=>x.id===w.id?updated:x));
    toast(updated.active?"Workout published":"Workout hidden");
  };

  const handleUnlock = async () => {
    if (!unlockForm.workoutId || !unlockForm.memberId) return;
    const already = unlocks.find(u=>u.workoutId===unlockForm.workoutId&&u.memberId===unlockForm.memberId);
    if (already) { toast("Already unlocked for this member"); return; }
    const unlock = { id:genId("UNL"), workoutId:unlockForm.workoutId, memberId:unlockForm.memberId, unlockedBy:"staff", date:today() };
    await unlockWorkout(unlock);
    setUnlocks(prev=>[...prev,unlock]);
    const w = workouts.find(x=>x.id===unlockForm.workoutId);
    const m = members.find(x=>x.id===unlockForm.memberId);
    toast(`Unlocked "${w?.title}" for ${m?.name}`);
    setUnlockForm({workoutId:"",memberId:""});
  };

  const addExercise = () => setExercises(prev=>[...prev,{name:"",sets:"3",reps:"10",weight:"",rest:"60s",notes:""}]);
  const updateExercise = (i,f,v) => setExercises(prev=>prev.map((e,j)=>j===i?{...e,[f]:v}:e));
  const removeExercise = (i) => setExercises(prev=>prev.filter((_,j)=>j!==i));

  const ACCESS_CFG = { free:{color:"#22C55E"}, points:{color:"#F58020"}, paid:{color:"#026F91"}, tier:{color:"#D4AF37"} };

  if (!loaded) return <div style={{color:C.muted,padding:20}}>Loading…</div>;

  // ── EDIT VIEW ──
  if (view === "edit" && editing) return (
    <div>
      <div className="sec-hdr">
        <button className="btn btn-ghost" onClick={()=>setView("list")}>← Back</button>
        <div className="sec-title">{editing.id&&workouts.find(w=>w.id===editing.id)?"Edit Workout":"New Workout"}</div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?"Saving...":"Save Workout"}</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Title *</label><input className="form-input" placeholder="e.g. Full Body Burn" value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></div>
        <div className="form-row"><label className="form-label">Category</label><select className="form-select" value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="form-row"><label className="form-label">Difficulty</label><select className="form-select" value={editing.difficulty} onChange={e=>setEditing({...editing,difficulty:e.target.value})}>{DIFFS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div className="form-row"><label className="form-label">Duration (mins)</label><input className="form-input" type="number" min="1" value={editing.duration_mins} onChange={e=>setEditing({...editing,duration_mins:Number(e.target.value)})}/></div>
        <div className="form-row"><label className="form-label">Access Type</label><select className="form-select" value={editing.access_type} onChange={e=>setEditing({...editing,access_type:e.target.value})}>{ACCESS.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}</select></div>
        {editing.access_type==="points"&&<div className="form-row"><label className="form-label">Points Cost</label><input className="form-input" type="number" min="0" value={editing.points_cost} onChange={e=>setEditing({...editing,points_cost:Number(e.target.value)})}/></div>}
        {editing.access_type==="paid"&&<div className="form-row"><label className="form-label">Price Label</label><input className="form-input" placeholder="e.g. $9.99" value={editing.price_label} onChange={e=>setEditing({...editing,price_label:e.target.value})}/></div>}
        {editing.access_type==="tier"&&<div className="form-row"><label className="form-label">Required Tier</label><select className="form-select" value={editing.tier_required} onChange={e=>setEditing({...editing,tier_required:e.target.value})}>{TIERS.map(t=><option key={t}>{t}</option>)}</select></div>}
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Description</label><textarea className="form-input" rows={3} placeholder="What will members get out of this workout?" value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})} style={{resize:"vertical"}}/></div>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Thumbnail URL</label><input className="form-input" placeholder="https://..." value={editing.thumbnail_url} onChange={e=>setEditing({...editing,thumbnail_url:e.target.value})}/><div className="form-hint">Link to a cover image (JPG/PNG/WebP)</div></div>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">Video URL (YouTube)</label><input className="form-input" placeholder="https://youtube.com/watch?v=..." value={editing.video_url} onChange={e=>setEditing({...editing,video_url:e.target.value})}/></div>
        <div className="form-row" style={{gridColumn:"1/-1"}}><label className="form-label">PDF URL</label><input className="form-input" placeholder="https://..." value={editing.pdf_url} onChange={e=>setEditing({...editing,pdf_url:e.target.value})}/><div className="form-hint">Link to a PDF workout plan (Google Drive, Dropbox, etc.)</div></div>
      </div>

      {/* Exercises */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:16,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white}}>Exercises ({exercises.length})</div>
          <button className="btn btn-primary btn-sm" onClick={addExercise}>+ Add Exercise</button>
        </div>
        {exercises.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No exercises added. Add some or leave blank if using video/PDF only.</div>}
        {exercises.map((ex,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,padding:12,marginBottom:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto auto",gap:8,marginBottom:8}}>
              <input className="form-input" placeholder="Exercise name" value={ex.name} onChange={e=>updateExercise(i,"name",e.target.value)}/>
              <input className="form-input" placeholder="Sets" value={ex.sets} onChange={e=>updateExercise(i,"sets",e.target.value)} style={{width:60}}/>
              <input className="form-input" placeholder="Reps" value={ex.reps} onChange={e=>updateExercise(i,"reps",e.target.value)} style={{width:60}}/>
              <input className="form-input" placeholder="Rest" value={ex.rest} onChange={e=>updateExercise(i,"rest",e.target.value)} style={{width:70}}/>
              <button className="btn btn-danger btn-sm" onClick={()=>removeExercise(i)}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <input className="form-input" placeholder="Weight (e.g. 60kg)" value={ex.weight} onChange={e=>updateExercise(i,"weight",e.target.value)}/>
              <input className="form-input" placeholder="Notes" value={ex.notes} onChange={e=>updateExercise(i,"notes",e.target.value)}/>
            </div>
          </div>
        ))}
      </div>

      <div className="form-row">
        <label className="form-label">Published</label>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className={`toggle${editing.active?" on":""}`} onClick={()=>setEditing({...editing,active:!editing.active})}/>
          <span style={{fontSize:13,color:editing.active?C.success:C.muted}}>{editing.active?"Visible to members":"Hidden"}</span>
        </div>
      </div>
    </div>
  );

  // ── LIST VIEW ──
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Workouts ({workouts.length})</div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={()=>setView("unlock")}>🔓 Unlock for Member</button>
          <button className="btn btn-primary" onClick={startNew}>+ New Workout</button>
        </div>
      </div>

      {view==="unlock"&&(
        <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white,marginBottom:14}}>Unlock Workout for Member</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"flex-end"}}>
            <div><label className="form-label">Workout</label><select className="form-select" value={unlockForm.workoutId} onChange={e=>setUnlockForm({...unlockForm,workoutId:e.target.value})}><option value="">— select workout —</option>{workouts.filter(w=>w.access_type==="paid"||w.access_type==="points").map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></div>
            <div><label className="form-label">Member</label><select className="form-select" value={unlockForm.memberId} onChange={e=>setUnlockForm({...unlockForm,memberId:e.target.value})}><option value="">— select member —</option>{[...members].sort((a,b)=>a.name.localeCompare(b.name)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <button className="btn btn-success" onClick={handleUnlock} disabled={!unlockForm.workoutId||!unlockForm.memberId}>Unlock</button>
          </div>
          <div style={{marginTop:12,fontSize:11,color:C.muted}}>Use this to unlock paid workouts after a member pays at the front desk. Points-based unlocks happen automatically when members redeem in the portal.</div>
        </div>
      )}

      {workouts.length===0&&<div className="empty">No workouts yet. Create your first one!</div>}

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Workout</th><th>Category</th><th>Access</th><th>Unlocks</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {workouts.map(w=>{
              const wUnlocks=unlocks.filter(u=>u.workoutId===w.id).length;
              const cfg=ACCESS_CFG[w.access_type];
              return(
                <tr key={w.id}>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      {w.thumbnail_url?<img src={w.thumbnail_url} style={{width:36,height:36,objectFit:"cover",borderRadius:2}} alt=""/>:<div style={{width:36,height:36,background:C.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💪</div>}
                      <div><div style={{fontWeight:700,fontSize:13}}>{w.title}</div><div style={{fontSize:11,color:C.muted}}>{w.difficulty} · {w.duration_mins}m</div></div>
                    </div>
                  </td>
                  <td style={{color:C.muted,fontSize:12}}>{w.category}</td>
                  <td><span className="badge" style={{background:`${cfg?.color}18`,color:cfg?.color}}>{w.access_type==="points"?`${w.points_cost} pts`:w.access_type==="tier"?w.tier_required:w.access_type}</span></td>
                  <td style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:wUnlocks>0?C.success:C.muted}}>{wUnlocks}</td>
                  <td><span className={`badge badge-${w.active?"active":"inactive"}`}>{w.active?"Published":"Hidden"}</span></td>
                  <td>
                    <div style={{display:"flex",gap:6}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>startEdit(w)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>toggleActive(w)}>{w.active?"Hide":"Show"}</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(w.id,w.title)}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export { WorkoutsPanel };
