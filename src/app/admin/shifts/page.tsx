'use client'
import { useEffect, useState } from 'react'
export default function AdminShifts(){ return <Shifts/> }
function Shifts(){
  const [list,setList]=useState<any[]>([]); const [ramEnd,setRamEnd]=useState(new Date().toISOString().slice(0,10))
  const [name,setName]=useState('Day Shift'); const [code,setCode]=useState('DAY'); const [start_time,setStart]=useState('08:00'); const [end_time,setEnd]=useState('17:00'); const [break_minutes,setBreak]=useState(60)
  async function load(){ setList(await fetch('/api/admin/shifts').then(r=>r.json())) } useEffect(()=>{ load() },[])
  async function create(){ const r=await fetch('/api/admin/shifts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,code,start_time,end_time,break_minutes})}); if(r.ok) load() }
  return (<div style={{padding:24}}><h1>Shifts</h1>
    <div style={{display:'flex',gap:8,margin:'8px 0'}}>
      <button onClick={async()=>{ await fetch('/api/admin/ramadan/templates',{method:'POST'}); alert('Ramadan shifts ready'); load() }}>Add Ramadan Shifts</button>
      <a href='/admin/holidays-import' style={{textDecoration:'underline'}}>Bulk Import Holidays ▸</a>
      <span style={{marginInlineStart:12}}>Deactivate Ramadan on</span>
      <input type='date' value={ramEnd} onChange={e=>setRamEnd(e.target.value)} />
      <button onClick={async()=>{ await fetch('/api/admin/ramadan/deactivate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:ramEnd})}); alert('Ramadan shifts deactivated'); load() }}>Go</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(6, minmax(0, 1fr))',gap:8}}>
      <input placeholder='Name' value={name} onChange={e=>setName(e.target.value)}/>
      <input placeholder='Code' value={code} onChange={e=>setCode(e.target.value)}/>
      <input type='time' value={start_time} onChange={e=>setStart(e.target.value)}/>
      <input type='time' value={end_time} onChange={e=>setEnd(e.target.value)}/>
      <input type='number' value={break_minutes} onChange={e=>setBreak(Number(e.target.value))}/>
      <button onClick={create}>Create</button>
    </div>
    <table cellPadding={6} style={{marginTop:12}}><thead><tr><th>ID</th><th>Name</th><th>Code</th><th>Start</th><th>End</th><th>Break</th></tr></thead><tbody>{list.map((s:any)=>(<tr key={s.id}><td>{s.id}</td><td>{s.name}</td><td>{s.code}</td><td>{s.start_time}</td><td>{s.end_time}</td><td>{s.break_minutes}</td></tr>))}</tbody></table>
  </div>)
}
