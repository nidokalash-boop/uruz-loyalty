import { useState, useEffect } from "react";
import { getAllWorkouts, upsertWorkout, deleteWorkout, getPrograms, upsertProgram, deleteProgram } from "./supabase";

const C = {
  orange:"#F58020", cerulean:"#026F91", white:"#FFFDF3", black:"#1F2020",
  surface:"#252627", card:"#2A2B2C", border:"#333435", muted:"#6B6866",
  success:"#22C55E", danger:"#EF4444",
};
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYS_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function genId(p){return `${p}-${Math.floor(10000+Math.random()*90000)}`;}
function today(){return new Date().toISOString().slice(0,10);}

export function WorkoutsPanel({ toast }) {
  const [view, setView]       = useState("workouts"); // workouts | programs
  const [workouts, setWorkouts] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null); // workout being edited
  const [editingProg, setEditingProg] = useState(null); // program being edited
  const [showForm, setShowForm] = useState(false);
  const [showProgForm, setShowProgForm] = useState(false);

  useEffect(() => {
    Promise.all([getAllWorkouts(), getPrograms()]).then(([w, p]) => {
      setWorkouts(w); setPrograms(p); setLoading(false);
    });
  }, []);

  // ── WORKOUT FORM ─────────────────────────────────────────
  const DEF_WORKOUT = {
    id:"", title:"", description:"", category:"Strength", difficulty:"Beginner",
    duration_mins:45, thumbnail_url:"", video_url:"", pdf_url:"",
    access_type:"free", points_cost:0, price_label:"", tier_required:"",
    exercises:[], active:true,
  };
  const [wForm, setWForm] = useState(DEF_WORKOUT);
  const [newEx, setNewEx] = useState({name:"",sets:"",reps:"",weight:"",rest:"",notes:""});

  const openWorkoutForm = (w=null) => {
    setWForm(w ? {
      ...w,
      exercises: Array.isArray(w.exercises) ? w.exercises : [],
    } : {...DEF_WORKOUT, id:genId("WRK")});
    setEditing(w?.id||null);
    setShowForm(true);
  };

  const saveWorkout = async () => {
    if(!wForm.title.trim()) { toast("Title is required"); return; }
    await upsertWorkout({...wForm, created_at: wForm.created_at||today()});
    const updated = await getAllWorkouts();
    setWorkouts(updated);
    setShowForm(false);
    toast(editing ? "Workout updated" : "Workout created");
  };

  const removeWorkout = async id => {
    if(!window.confirm("Delete this workout?")) return;
    await deleteWorkout(id);
    setWorkouts(prev => prev.filter(w=>w.id!==id));
    toast("Workout deleted");
  };

  const addExercise = () => {
    if(!newEx.name.trim()) return;
    setWForm(f => ({...f, exercises:[...f.exercises, {...newEx, id:genId("EX")}]}));
    setNewEx({name:"",sets:"",reps:"",weight:"",rest:"",notes:""});
  };

  const removeExercise = idx => setWForm(f=>({...f, exercises:f.exercises.filter((_,i)=>i!==idx)}));

  // ── PROGRAM FORM ─────────────────────────────────────────
  const DEF_PROGRAM = {
    id:"", name:"", description:"", active:true,
    schedule:{ Mon:[], Tue:[], Wed:[], Thu:[], Fri:[], Sat:[] },
  };
  const [pForm, setPForm] = useState(DEF_PROGRAM);

  const openProgramForm = (p=null) => {
    setPForm(p ? {
      ...p,
      schedule: p.schedule || { Mon:[], Tue:[], Wed:[], Thu:[], Fri:[], Sat:[] },
    } : {...DEF_PROGRAM, id:genId("PRG")});
    setEditingProg(p?.id||null);
    setShowProgForm(true);
  };

  const saveProgram = async () => {
    if(!pForm.name.trim()) { toast("Program name is required"); return; }
    await upsertProgram({...pForm, created_at: pForm.created_at||today()});
    const updated = await getPrograms();
    setPrograms(updated);
    setShowProgForm(false);
    toast(editingProg ? "Program updated" : "Program created");
  };

  const removeProgram = async id => {
    if(!window.confirm("Delete this program?")) return;
    await deleteProgram(id);
    setPrograms(prev => prev.filter(p=>p.id!==id));
    toast("Program deleted");
  };

  const toggleDayWorkout = (day, workoutId) => {
    setPForm(f => {
      const dayList = f.schedule[day] || [];
      const exists = dayList.includes(workoutId);
      return {
        ...f,
        schedule: {
          ...f.schedule,
          [day]: exists ? dayList.filter(id=>id!==workoutId) : [...dayList, workoutId],
        }
      };
    });
  };

  if(loading) return <div style={{padding:20,color:C.muted,fontSize:13}}>Loading...</div>;

  // ── WORKOUT FORM VIEW ────────────────────────────────────
  if(showForm) return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">{editing?"Edit Workout":"New Workout"}</div>
        <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>← Back</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div style={{gridColumn:"1/-1"}}>
          <label className="form-label">Title *</label>
          <input className="form-input" value={wForm.title} onChange={e=>setWForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Full Body Strength"/>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={wForm.description} onChange={e=>setWForm(f=>({...f,description:e.target.value}))} placeholder="Brief description of the workout"/>
        </div>
        <div>
          <label className="form-label">Category</label>
          <select className="form-select" value={wForm.category} onChange={e=>setWForm(f=>({...f,category:e.target.value}))}>
            {["Strength","Cardio","HIIT","Mobility","Yoga","Boxing","CrossFit","Custom"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Difficulty</label>
          <select className="form-select" value={wForm.difficulty} onChange={e=>setWForm(f=>({...f,difficulty:e.target.value}))}>
            {["Beginner","Intermediate","Advanced"].map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Duration (mins)</label>
          <input className="form-input" type="number" value={wForm.duration_mins} onChange={e=>setWForm(f=>({...f,duration_mins:Number(e.target.value)}))}/>
        </div>
        <div>
          <label className="form-label">Access Type</label>
          <select className="form-select" value={wForm.access_type} onChange={e=>setWForm(f=>({...f,access_type:e.target.value}))}>
            <option value="free">Free</option>
            <option value="points">Points Unlock</option>
            <option value="paid">Paid</option>
            <option value="tier">Tier Required</option>
          </select>
        </div>
        {wForm.access_type==="points"&&<div>
          <label className="form-label">Points Cost</label>
          <input className="form-input" type="number" value={wForm.points_cost} onChange={e=>setWForm(f=>({...f,points_cost:Number(e.target.value)}))}/>
        </div>}
        {wForm.access_type==="paid"&&<div>
          <label className="form-label">Price Label</label>
          <input className="form-input" value={wForm.price_label} onChange={e=>setWForm(f=>({...f,price_label:e.target.value}))} placeholder="e.g. $9.99"/>
        </div>}
        {wForm.access_type==="tier"&&<div>
          <label className="form-label">Tier Required</label>
          <select className="form-select" value={wForm.tier_required} onChange={e=>setWForm(f=>({...f,tier_required:e.target.value}))}>
            {["Iron","Bronze","Silver","Gold","Elite"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>}
        <div style={{gridColumn:"1/-1"}}>
          <label className="form-label">Thumbnail URL</label>
          <input className="form-input" value={wForm.thumbnail_url} onChange={e=>setWForm(f=>({...f,thumbnail_url:e.target.value}))} placeholder="https://..."/>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label className="form-label">Video URL (YouTube)</label>
          <input className="form-input" value={wForm.video_url} onChange={e=>setWForm(f=>({...f,video_url:e.target.value}))} placeholder="https://youtube.com/watch?v=..."/>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label className="form-label">PDF Guide URL</label>
          <input className="form-input" value={wForm.pdf_url} onChange={e=>setWForm(f=>({...f,pdf_url:e.target.value}))} placeholder="https://..."/>
        </div>
      </div>

      {/* Exercises */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:16,marginBottom:12}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white,marginBottom:12}}>Exercises</div>
        {wForm.exercises.map((ex,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.white}}>{ex.name}</div>
              <div style={{fontSize:11,color:C.muted}}>{ex.sets} sets × {ex.reps} reps {ex.weight&&`· ${ex.weight}`} {ex.rest&&`· rest ${ex.rest}`}</div>
              {ex.notes&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>{ex.notes}</div>}
            </div>
            <button className="btn btn-danger btn-sm" onClick={()=>removeExercise(i)}>✕</button>
          </div>
        ))}
        <div style={{marginTop:12,display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:6}}>
          <input className="form-input" placeholder="Exercise name" value={newEx.name} onChange={e=>setNewEx(x=>({...x,name:e.target.value}))}/>
          <input className="form-input" placeholder="Sets" value={newEx.sets} onChange={e=>setNewEx(x=>({...x,sets:e.target.value}))}/>
          <input className="form-input" placeholder="Reps" value={newEx.reps} onChange={e=>setNewEx(x=>({...x,reps:e.target.value}))}/>
          <input className="form-input" placeholder="Weight" value={newEx.weight} onChange={e=>setNewEx(x=>({...x,weight:e.target.value}))}/>
          <input className="form-input" placeholder="Rest" value={newEx.rest} onChange={e=>setNewEx(x=>({...x,rest:e.target.value}))}/>
        </div>
        <div style={{marginTop:6}}>
          <input className="form-input" placeholder="Coaching notes (optional)" value={newEx.notes} onChange={e=>setNewEx(x=>({...x,notes:e.target.value}))} style={{marginBottom:8}}/>
          <button className="btn btn-ghost btn-sm" onClick={addExercise}>+ Add Exercise</button>
        </div>
      </div>

      <div style={{display:"flex",gap:10}}>
        <button className="btn btn-primary" onClick={saveWorkout}>Save Workout</button>
        <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
      </div>
    </div>
  );

  // ── PROGRAM FORM VIEW ─────────────────────────────────────
  if(showProgForm) return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">{editingProg?"Edit Program":"New Program"}</div>
        <button className="btn btn-ghost" onClick={()=>setShowProgForm(false)}>← Back</button>
      </div>
      <div style={{marginBottom:12}}>
        <label className="form-label">Program Name *</label>
        <input className="form-input" value={pForm.name} onChange={e=>setPForm(f=>({...f,name:e.target.value}))} placeholder="e.g. 4-Week Strength Builder"/>
        <label className="form-label" style={{marginTop:10}}>Description</label>
        <textarea className="form-input" rows={2} value={pForm.description} onChange={e=>setPForm(f=>({...f,description:e.target.value}))} placeholder="Brief program description"/>
      </div>

      {/* Weekly Schedule */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,padding:16,marginBottom:12}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:C.white,marginBottom:4}}>Weekly Schedule</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Assign workouts to each day. Members will see today's workout on their home screen.</div>
        {DAYS.map((day,di)=>(
          <div key={day} style={{marginBottom:14}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:C.orange,fontWeight:700,marginBottom:8}}>{DAYS_FULL[di]}</div>
            {workouts.length===0&&<div style={{fontSize:12,color:C.muted}}>No workouts available</div>}
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {workouts.filter(w=>w.active).map(w=>{
                const selected = (pForm.schedule[day]||[]).includes(w.id);
                return(
                  <div key={w.id} onClick={()=>toggleDayWorkout(day,w.id)} style={{
                    padding:"5px 12px",border:`1px solid ${selected?C.orange:C.border}`,
                    background:selected?"rgba(245,128,32,.12)":"transparent",
                    cursor:"pointer",fontSize:11,fontWeight:600,
                    color:selected?C.orange:C.muted,transition:"all .15s",
                  }}>{w.title}</div>
                );
              })}
              {(pForm.schedule[day]||[]).length > 0 && (
                <div style={{fontSize:11,color:C.muted,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{color:C.success}}>✓</span> {(pForm.schedule[day]||[]).length} workout{(pForm.schedule[day]||[]).length>1?"s":""} assigned
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10}}>
        <button className="btn btn-primary" onClick={saveProgram}>Save Program</button>
        <button className="btn btn-ghost" onClick={()=>setShowProgForm(false)}>Cancel</button>
      </div>
    </div>
  );

  // ── MAIN VIEW ─────────────────────────────────────────────
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Workouts</div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setView(v=>v==="workouts"?"programs":"workouts")}>
            {view==="workouts"?"📅 Programs":"💪 Workouts"}
          </button>
          <button className="btn btn-primary" onClick={()=>view==="workouts"?openWorkoutForm():openProgramForm()}>
            + {view==="workouts"?"New Workout":"New Program"}
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:1,marginBottom:16,background:C.border}}>
        {["workouts","programs"].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{
            flex:1,padding:"10px",background:view===v?C.surface:"#1F2020",
            border:"none",color:view===v?C.white:C.muted,fontFamily:"'Montserrat',sans-serif",
            fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",
          }}>{v}</button>
        ))}
      </div>

      {/* WORKOUTS LIST */}
      {view==="workouts"&&(
        workouts.length===0
          ? <div style={{padding:20,color:C.muted,fontSize:13}}>No workouts yet. Create your first one!</div>
          : workouts.map(w=>(
            <div key={w.id} style={{background:C.surface,border:`1px solid ${C.border}`,padding:14,marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:52,height:52,background:C.card,flexShrink:0,overflow:"hidden"}}>
                {w.thumbnail_url?<img src={w.thumbnail_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>💪</div>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:w.active?C.white:C.muted}}>{w.title}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{w.category} · {w.difficulty} · {w.duration_mins}m · {w.access_type}</div>
                {Array.isArray(w.exercises)&&w.exercises.length>0&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{w.exercises.length} exercise{w.exercises.length>1?"s":""}</div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>openWorkoutForm(w)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={()=>removeWorkout(w.id)}>Delete</button>
              </div>
            </div>
          ))
      )}

      {/* PROGRAMS LIST */}
      {view==="programs"&&(
        programs.length===0
          ? <div style={{padding:20,color:C.muted,fontSize:13}}>No programs yet. Create your first weekly program!</div>
          : programs.map(p=>{
            const schedule = p.schedule||{};
            const totalAssigned = Object.values(schedule).flat().length;
            return(
              <div key={p.id} style={{background:C.surface,border:`1px solid ${C.border}`,padding:14,marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.white}}>{p.name}</div>
                    {p.description&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{p.description}</div>}
                    <div style={{fontSize:10,color:C.muted,marginTop:4}}>{totalAssigned} workout{totalAssigned!==1?"s":""} assigned</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openProgramForm(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>removeProgram(p.id)}>Delete</button>
                  </div>
                </div>
                {/* Schedule preview */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4}}>
                  {DAYS.map(day=>{
                    const assigned = (schedule[day]||[]);
                    const dayWorkouts = assigned.map(id=>workouts.find(w=>w.id===id)).filter(Boolean);
                    return(
                      <div key={day} style={{background:C.card,padding:"6px 4px",textAlign:"center",border:`1px solid ${assigned.length>0?C.orange:C.border}`}}>
                        <div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:assigned.length>0?C.orange:C.muted,fontWeight:700,marginBottom:3}}>{day}</div>
                        {dayWorkouts.slice(0,1).map(w=><div key={w.id} style={{fontSize:9,color:C.white,fontWeight:600,lineHeight:1.3}}>{w.title.slice(0,12)}{w.title.length>12?"…":""}</div>)}
                        {assigned.length===0&&<div style={{fontSize:9,color:C.muted}}>Rest</div>}
                        {assigned.length>1&&<div style={{fontSize:9,color:C.muted}}>+{assigned.length-1} more</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}
