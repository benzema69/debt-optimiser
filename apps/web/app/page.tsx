"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {ActualsPanel} from "../components/ActualsPanel";
import {AuthPanel} from "../components/AuthPanel";
import {CodeDatabase} from "../components/CodeDatabase";
import {LoadProfile} from "../components/LoadProfile";
import {MetricCard} from "../components/MetricCard";
import {MonthlyMatrix} from "../components/MonthlyMatrix";
import {ReconciliationPanel} from "../components/ReconciliationPanel";
import {Sandbox} from "../components/Sandbox";
import {StatusBadge} from "../components/StatusBadge";
import {getSeed,optimizeCodes,parseCode,reoptimizeCodes,validateCodes} from "../lib/api";
import type {LedgerEventRow,ObligationRow} from "../lib/database.types";
import {deactivateObligation,listObligations,saveOptimizationRun,saveParsedObligations} from "../lib/persistence";
import {getSupabase} from "../lib/supabase";
import type {OptimizationResult,ReoptimizationResult} from "../lib/types";

const CLEANUP_START="2026-09-01";
const ZERO_DAY="2027-01-31";
const money=(n:number)=>new Intl.NumberFormat("fr-CH",{maximumFractionDigits:0}).format(n);

function planningStartFor(events:LedgerEventRow[]){
  const today=new Date().toISOString().slice(0,10);
  const latestEvent=events.reduce((max,e)=>e.event_date>max?e.event_date:max,CLEANUP_START);
  const raw=[CLEANUP_START,today,latestEvent].sort().at(-1)??CLEANUP_START;
  const capped=raw>ZERO_DAY?ZERO_DAY:raw;
  return `${capped.slice(0,7)}-01`;
}

export default function Home(){
  const[codes,setCodes]=useState<string[]>([]);
  const[result,setResult]=useState<OptimizationResult|null>(null);
  const[reopt,setReopt]=useState<ReoptimizationResult|null>(null);
  const[ledgerEvents,setLedgerEvents]=useState<LedgerEventRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[reoptimizing,setReoptimizing]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[session,setSession]=useState<Session|null>(null);
  const[rows,setRows]=useState<ObligationRow[]>([]);
  const[workspaceEmpty,setWorkspaceEmpty]=useState(false);
  const[savingSnapshot,setSavingSnapshot]=useState(false);
  const[savedRun,setSavedRun]=useState<string|null>(null);

  const solve=useCallback(async(next:string[])=>{setLoading(true);setError(null);try{const solved=await optimizeCodes(next);setResult(solved);return solved}catch(e){setError(String(e));return null}finally{setLoading(false)}},[]);

  const loadDemo=useCallback(async()=>{const seed=await getSeed();setCodes(seed.codes);setRows([]);setLedgerEvents([]);setReopt(null);setWorkspaceEmpty(false);await solve(seed.codes)},[solve]);

  const loadWorkspace=useCallback(async(_current:Session)=>{
    try{
      const stored=await listObligations();
      setRows(stored);
      if(stored.length){const next=stored.map(x=>x.raw_code);setCodes(next);setWorkspaceEmpty(false);await solve(next);return;}
      const seed=await getSeed();setCodes(seed.codes);setWorkspaceEmpty(true);await solve(seed.codes);
    }catch(e){setError(String(e));await loadDemo()}
  },[loadDemo,solve]);

  useEffect(()=>{
    const client=getSupabase();
    let mounted=true;
    (async()=>{
      if(!client){await loadDemo();return;}
      const {data}=await client.auth.getSession();
      if(!mounted)return;
      setSession(data.session);
      if(data.session)await loadWorkspace(data.session);else await loadDemo();
    })();
    if(!client)return()=>{mounted=false};
    const {data:sub}=client.auth.onAuthStateChange((_event,next)=>{
      if(!mounted)return;
      setSession(next);
      queueMicrotask(()=>{if(next)void loadWorkspace(next);else void loadDemo()});
    });
    return()=>{mounted=false;sub.subscription.unsubscribe()};
  },[loadDemo,loadWorkspace]);

  async function handleSession(next:Session|null){setSession(next);if(next)await loadWorkspace(next);else await loadDemo()}

  const obligationByUuid=useMemo(()=>new Map(rows.map(r=>[r.id,r.composite_id])),[rows]);
  const paidById=useMemo(()=>{
    const out:Record<string,number>={};
    for(const event of ledgerEvents){
      if(event.event_type!=="PAYMENT"||!event.obligation_id)continue;
      const composite=obligationByUuid.get(event.obligation_id);
      if(!composite)continue;
      out[composite]=(out[composite]??0)+event.amount;
    }
    return out;
  },[ledgerEvents,obligationByUuid]);
  const paidTotal=useMemo(()=>Object.values(paidById).reduce((a,b)=>a+b,0),[paidById]);
  const planningStart=useMemo(()=>planningStartFor(ledgerEvents),[ledgerEvents]);
  const hasPayments=paidTotal>0;

  useEffect(()=>{
    if(!session||!hasPayments||!rows.length){setReopt(null);return;}
    let cancelled=false;
    setReoptimizing(true);
    setSavedRun(null);
    reoptimizeCodes(codes,paidById,planningStart).then(next=>{if(!cancelled)setReopt(next)}).catch(e=>{if(!cancelled){setReopt(null);setError(`Re-optimization failed: ${String(e)}`)}}).finally(()=>{if(!cancelled)setReoptimizing(false)});
    return()=>{cancelled=true};
  },[session,hasPayments,rows.length,codes,paidById,planningStart]);

  async function persistCurrent(){
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const validation=await validateCodes(codes);
      if(!validation.valid)throw new Error(validation.issues.map(i=>`${i.error}: ${i.detail}`).join(" | "));
      const saved=await saveParsedObligations(session.user.id,validation.obligations);
      setRows(saved);setWorkspaceEmpty(false);
      if(result?.valid){const run=await saveOptimizationRun({userId:session.user.id,codes,result,obligations:saved});setSavedRun(run)}
    }catch(e){setError(String(e))}finally{setLoading(false)}
  }

  async function applyCode(code:string){
    const next=[...codes,code];
    setCodes(next);setSavedRun(null);
    await solve(next);
    if(session){
      try{const parsed=await parseCode(code);if(!parsed.valid||!parsed.obligation)throw new Error(parsed.issues.map(i=>i.detail).join(" | "));await saveParsedObligations(session.user.id,[parsed.obligation]);setRows(await listObligations());setWorkspaceEmpty(false)}catch(e){setError(`Optimized locally, but persistence failed: ${String(e)}`)}
    }
  }

  async function remove(index:number){
    const removed=codes[index];
    const next=codes.filter((_,i)=>i!==index);
    setCodes(next);setSavedRun(null);
    await solve(next);
    if(session){
      const composite=removed.split("-")[0];
      try{await deactivateObligation(composite);setRows(await listObligations())}catch(e){setError(`Removed locally, but persistence failed: ${String(e)}`)}
    }
  }

  const handleEventsChange=useCallback((events:LedgerEventRow[])=>{setLedgerEvents(events);setSavedRun(null)},[]);
  const displayResult=hasPayments?(reopt?.result??null):result;
  const metrics=displayResult?.metrics??null;
  const originalMt=result?.metrics?.global_mt??0;
  const remainingMt=hasPayments?(reopt?.remaining_mt??Math.max(0,originalMt-paidTotal)):originalMt;
  const january=metrics?.monthly_totals["2027-01"]??0;
  const weekly=metrics?metrics.average_per_day*7:0;
  const issues=useMemo(()=>result?.issues??[],[result]);
  const liveIssues=useMemo(()=>reopt?.issues??[],[reopt]);
  const engineValid=hasPayments?Boolean(reopt?.valid):Boolean(result?.valid);

  async function saveSnapshot(){
    if(!session||!displayResult||!displayResult.valid)return;
    setSavingSnapshot(true);setError(null);
    try{const run=await saveOptimizationRun({userId:session.user.id,codes,result:displayResult,obligations:rows,paidById,optimizationStart:planningStart});setSavedRun(run)}catch(e){setError(`Snapshot failed: ${String(e)}`)}finally{setSavingSnapshot(false)}
  }

  return <main>
    <header className="topbar"><div className="brand"><div className="brand-mark">DO</div><div><b>Debt Optimiser</b><span>Discrete Capital Cleanup Engine</span></div></div><div className="top-actions"><span className="count">{session?"CLOUD WORKSPACE":"LOCAL DEMO"}</span><StatusBadge ok={engineValid} label={loading||reoptimizing?"SOLVING":engineValid?"ENGINE VALID":"ENGINE ERROR"}/></div></header>
    <section className="hero"><div><span className="eyebrow">GLOBAL CLEANUP PROTOCOL</span><h1>Zero liability.<br/><em>Before February.</em></h1><p>Immutable source codes in. Integer-unit optimization out. Actual payments reconcile back into whole units and regenerate the remaining path to zero.</p></div><div className="zero-card"><span>FEBRUARY LIABILITY</span><strong>{engineValid?"CHF 0.00":"INVALID"}</strong><small>Required state on 01 Feb 2027</small></div></section>

    <AuthPanel session={session} onSession={handleSession}/>
    {session&&workspaceEmpty?<section className="panel import-banner"><div><span className="eyebrow">EMPTY PRIVATE DATABASE</span><h2>Canonical 13-object plan is loaded in preview mode.</h2><p className="muted">Persist the validated source codes to make this account your durable source of truth.</p></div><button onClick={persistCurrent} disabled={loading}>Persist canonical database</button></section>:null}

    {error?<div className="error-box"><b>System notice</b><p>{error}</p></div>:null}
    {issues.length?<div className="error-box">{issues.map(i=><p key={`${i.code}-${i.error}`}><b>{i.error}</b> {i.detail}</p>)}</div>:null}
    {liveIssues.length?<div className="error-box"><b>Actual-payment reconciliation rejected</b>{liveIssues.map(i=><p key={`${i.code}-${i.error}`}><b>{i.error}</b> {i.detail}</p>)}</div>:null}

    <section className="metrics-grid live-metrics"><MetricCard label="ORIGINAL MT" value={`CHF ${money(originalMt)}`} hint="immutable source total" accent="violet"/><MetricCard label="PAID" value={`CHF ${money(paidTotal)}`} hint="ledger payment events" accent={paidTotal?"good":undefined}/><MetricCard label="REMAINING" value={`CHF ${money(remainingMt)}`} hint="after reconciliation" accent={remainingMt===0?"good":undefined}/><MetricCard label="REQUIRED / DAY" value={`CHF ${(metrics?.average_per_day??0).toFixed(2)}`} hint={metrics?`${metrics.days_in_window} days in live window`:"awaiting valid live plan"}/><MetricCard label="PEAK MONTH" value={`CHF ${money(metrics?.peak_monthly??0)}`} hint="optimized live maximum"/><MetricCard label="JANUARY" value={`CHF ${money(january)}`} hint="landing month" accent="good"/><MetricCard label="REQUIRED / WEEK" value={`CHF ${weekly.toFixed(2)}`} hint="live average"/></section>

    {hasPayments&&reopt?.valid?<ReconciliationPanel state={reopt} planningStart={planningStart} onSave={session&&displayResult?saveSnapshot:undefined} saving={savingSnapshot} savedRun={savedRun}/>:null}
    {hasPayments&&reopt?.valid&&reopt.remaining_mt===0?<section className="panel all-clear"><span className="eyebrow">TERMINAL STATE</span><h2>All encoded liabilities extinguished.</h2><strong>CHF 0.00 REMAINING</strong><p>No optimizer allocation is required after the final reconciled payment.</p></section>:null}

    {displayResult?.valid?<MonthlyMatrix result={displayResult}/>:null}
    {metrics?<LoadProfile metrics={metrics}/>:null}
    <div className="two-col"><CodeDatabase codes={codes} onRemove={remove}/><Sandbox codes={codes} onApply={applyCode}/></div>
    {originalMt?<ActualsPanel planned={originalMt} userId={session?.user.id} obligations={rows} onEventsChange={handleEventsChange}/>:null}
    <footer><span>Source → Parse → Validate → Reconcile → Optimize → Persist → Render</span><span>{displayResult?.solver??(remainingMt===0?"terminal-zero":"no solver")}</span></footer>
  </main>;
}
