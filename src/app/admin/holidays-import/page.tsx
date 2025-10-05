'use client'
import { useState } from 'react'
export default function HolidaysImport(){
  const [text,setText]=useState(`[
  { "date": "2025-09-23", "name": "Saudi National Day" },
  { "date": "2026-09-23", "name": "Saudi National Day" },
  { "date": "2027-09-23", "name": "Saudi National Day" }
  // Add Eid Al-Fitr / Eid Al-Adha after official circulars
]`)
  async function send(){ const r=await fetch('/api/admin/holidays/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:text}); alert(await r.text()) }
  return (<div style={{padding:24}}><h1>Bulk Import Holidays</h1><textarea value={text} onChange={e=>setText(e.target.value)} style={{width:'100%',height:220}}/><div><button onClick={send}>Import</button></div></div>)
}
