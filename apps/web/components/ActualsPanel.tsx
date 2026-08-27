"use client";

import {useEffect,useMemo,useState} from "react";
import type {LedgerEventRow,ObligationRow} from "../lib/database.types";
import {addLedgerEvent,deleteLedgerEvent,listLedgerEvents} from "../lib/persistence";

type EventType=LedgerEventRow["event_type"];
const today=()=>new Date().toISOString().slice(0,10);

export function ActualsPanel({planned,userId,obligations,onEventsChange}:{planned:number;userId?:string|null;obligations?:ObligationRow[];onEventsChange?:(events:LedgerEventRow[])=>void}){
  const[events,setEvents]=useState<LedgerEventRow[]>([]);
  const[amount,setAmount]=useState("");
  const[note,setNote]=useState("");
  const[type,setType]=useState<EventType>("INCOME");
  const[eventDate,setEventDate]=useState(today());
  const[obligationId,setObligationId]=useState("");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null);

  useEffect(()=>{if(!userId){setEvents([]);onEventsChange?.([]);return;}let live=true;(async()=>{try{const data=await listLedgerEvents();if(live){setEvents(data);onEventsChange?.(data)}}catch(e){if(live)setError(String(e))}})();return()=>{live=false}},[userId,onEventsChange]);

  const generated=useMemo(()=>events.reduce((s,e)=>s+(e.event_type==="INCOME"||e.event_type==="ADJUSTMENT"?e.amount:0),0),[events]);
  const paid=useMemo(()=>events.reduce((s,e)=>s+(e.event_type==="PAYMENT"?e.amount:0),0),[events]);
  const delta=generated-planned;

  async function add(){
    const n=Number(amount);
    if(!userId){setError("Sign in to persist ledger events.");return;}
    if(!Number.isFinite(n)||n<=0)return;
    if(type==="PAYMENT"&&!obligationId){setError("Choose an obligation for a PAYMENT event.");return;}
    setBusy(true);setError(null);
    try{
      const created=await addLedgerEvent({userId,eventType:type,eventDate,amount:Math.round(n),note,obligationId:type==="PAYMENT"?obligationId:null});
      const next=[...events,created].sort((a,b)=>a.event_date.localeCompare(b.event_date)||a.created_at.localeCompare(b.created_at));
      setEvents(next);onEventsChange?.(next);setAmount("");setNote("");
    }catch(e){setError(String(e))}finally{setBusy(false)}
  }

  async function remove(id:string){
    if(!userId)return;
    setBusy(true);setError(null);
    try{await deleteLedgerEvent(id);const next=events.filter(e=>e.id!==id);setEvents(next);onEventsChange?.(next)}catch(e){setError(String(e))}finally{setBusy(false)}
  }

  return <section className="panel"><div className="panel-head"><div><span className="eyebrow">ACTUALS</span><h2>Generation & payment ledger</h2></div><span className="count">{userId?"PERSISTED":"LOCAL LOCKED"}</span></div>
    <div className="actual-kpis"><div><span>Generated</span><b>CHF {generated.toLocaleString("fr-CH")}</b></div><div><span>Payments logged</span><b>CHF {paid.toLocaleString("fr-CH")}</b></div><div><span>Delta vs global target</span><b className={delta>=0?"good":"warn"}>CHF {delta.toLocaleString("fr-CH")}</b></div></div>
    <div className="ledger-form"><select value={type} onChange={e=>setType(e.target.value as EventType)}><option>INCOME</option><option>PAYMENT</option><option>ADJUSTMENT</option><option>REVERSAL</option></select><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)}/><input inputMode="decimal" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)}/>{type==="PAYMENT"?<select value={obligationId} onChange={e=>setObligationId(e.target.value)}><option value="">Choose obligation…</option>{(obligations??[]).map(o=><option key={o.id} value={o.id}>{o.composite_id} · {o.entity}</option>)}</select>:<input placeholder="Note" value={note} onChange={e=>setNote(e.target.value)}/>} {type==="PAYMENT"?<input placeholder="Note" value={note} onChange={e=>setNote(e.target.value)}/>:null}<button onClick={add} disabled={busy||!userId}>Add event</button></div>
    {error?<div className="error-box">{error}</div>:null}
    <div className="event-list">{events.slice().reverse().map(e=><div key={e.id}><span><b className="event-type">{e.event_type}</b> {e.event_date} · {e.note||"No note"}</span><span><b className={e.event_type==="PAYMENT"?"warn":"good"}>{e.event_type==="PAYMENT"?"−":"+"} CHF {e.amount.toLocaleString("fr-CH")}</b><button className="ghost danger" onClick={()=>remove(e.id)} disabled={busy}>×</button></span></div>)}</div>
    <small className="muted">Ledger rows are protected by Supabase row-level security when authenticated.</small>
  </section>;
}
