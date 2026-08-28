"use client";

import {useEffect,useMemo,useState} from "react";
import type {LedgerEventRow,ObligationRow} from "../lib/database.types";
import {effectiveLedgerEvents,generatedTotal,paymentTotal,reversedEventIds} from "../lib/ledger";
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
  const[reversalTargetId,setReversalTargetId]=useState("");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null);

  useEffect(()=>{if(!userId){setEvents([]);onEventsChange?.([]);return;}let live=true;(async()=>{try{const data=await listLedgerEvents();if(live){setEvents(data);onEventsChange?.(data)}}catch(e){if(live)setError(String(e))}})();return()=>{live=false}},[userId,onEventsChange]);

  const effective=useMemo(()=>effectiveLedgerEvents(events),[events]);
  const reversed=useMemo(()=>reversedEventIds(events),[events]);
  const reversible=useMemo(()=>effective.filter(e=>e.event_type!=="REVERSAL"),[effective]);
  const generated=useMemo(()=>generatedTotal(events),[events]);
  const paid=useMemo(()=>paymentTotal(events),[events]);
  const delta=generated-planned;

  async function add(){
    if(!userId){setError("Sign in to persist ledger events.");return;}
    setBusy(true);setError(null);
    try{
      let created:LedgerEventRow;
      if(type==="REVERSAL"){
        const target=events.find(e=>e.id===reversalTargetId);
        if(!target||target.event_type==="REVERSAL"||reversed.has(target.id))throw new Error("Choose an active event to reverse.");
        created=await addLedgerEvent({userId,eventType:"REVERSAL",eventDate,amount:target.amount,note:note||`Reversal of ${target.event_type}`,obligationId:target.obligation_id,reversalOf:target.id});
        setReversalTargetId("");
      }else{
        const n=Number(amount);
        if(!Number.isFinite(n)||n<=0)throw new Error("Amount must be positive.");
        if(type==="PAYMENT"&&!obligationId)throw new Error("Choose an obligation for a PAYMENT event.");
        created=await addLedgerEvent({userId,eventType:type,eventDate,amount:Math.round(n),note,obligationId:type==="PAYMENT"?obligationId:null});
        setAmount("");
      }
      const next=[...events,created].sort((a,b)=>a.event_date.localeCompare(b.event_date)||a.created_at.localeCompare(b.created_at));
      setEvents(next);onEventsChange?.(next);setNote("");
    }catch(e){setError(String(e))}finally{setBusy(false)}
  }

  async function remove(id:string){
    if(!userId)return;
    if(reversed.has(id)){setError("Delete the reversal event first if you want to remove its original event.");return;}
    setBusy(true);setError(null);
    try{await deleteLedgerEvent(id);const next=events.filter(e=>e.id!==id);setEvents(next);onEventsChange?.(next)}catch(e){setError(String(e))}finally{setBusy(false)}
  }

  return <section className="panel"><div className="panel-head"><div><span className="eyebrow">ACTUALS</span><h2>Generation & payment ledger</h2></div><span className="count">{userId?"PERSISTED":"LOCAL LOCKED"}</span></div>
    <div className="actual-kpis"><div><span>Generated</span><b>CHF {generated.toLocaleString("fr-CH")}</b></div><div><span>Effective payments</span><b>CHF {paid.toLocaleString("fr-CH")}</b></div><div><span>Delta vs global target</span><b className={delta>=0?"good":"warn"}>{delta>=0?"+":""} CHF {delta.toLocaleString("fr-CH")}</b></div></div>
    <div className="ledger-form">
      <select value={type} onChange={e=>{setType(e.target.value as EventType);setError(null)}}><option>INCOME</option><option>PAYMENT</option><option>ADJUSTMENT</option><option>REVERSAL</option></select>
      <input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)}/>
      {type==="REVERSAL"?<select value={reversalTargetId} onChange={e=>setReversalTargetId(e.target.value)}><option value="">Event to reverse…</option>{reversible.map(e=><option key={e.id} value={e.id}>{e.event_date} · {e.event_type} · CHF {e.amount}</option>)}</select>:<input inputMode="decimal" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)}/>} 
      {type==="PAYMENT"?<select value={obligationId} onChange={e=>setObligationId(e.target.value)}><option value="">Choose obligation…</option>{(obligations??[]).map(o=><option key={o.id} value={o.id}>{o.composite_id} · {o.entity}</option>)}</select>:null}
      <input placeholder="Note" value={note} onChange={e=>setNote(e.target.value)}/>
      <button onClick={add} disabled={busy||!userId||(type==="REVERSAL"&&!reversalTargetId)}>Add event</button>
    </div>
    {error?<div className="error-box">{error}</div>:null}
    <div className="event-list">{events.slice().reverse().map(e=>{const isReversed=reversed.has(e.id);return <div key={e.id} className={isReversed?"event-reversed":""}><span><b className="event-type">{e.event_type}</b> {e.event_date} · {e.note||"No note"}{isReversed?<em className="reversed-pill">REVERSED</em>:null}</span><span><b className={e.event_type==="PAYMENT"?"warn":e.event_type==="REVERSAL"?"muted":"good"}>{e.event_type==="PAYMENT"?"−":e.event_type==="REVERSAL"?"↺":"+"} CHF {e.amount.toLocaleString("fr-CH")}</b><button className="ghost danger" onClick={()=>remove(e.id)} disabled={busy||isReversed} title={isReversed?"Delete its reversal first":"Delete event"}>×</button></span></div>})}</div>
    <small className="muted">Ledger rows are append-auditable: a REVERSAL neutralizes an event without rewriting its historical record. Same-user relationships are enforced by database constraints and RLS.</small>
  </section>;
}
