"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {ActualsPanel} from "../components/ActualsPanel";
import {AuthPanel} from "../components/AuthPanel";
import {CodeDatabase} from "../components/CodeDatabase";
import {LoadProfile} from "../components/LoadProfile";
import {MetricCard} from "../components/MetricCard";
import {MonthlyMatrix} from "../components/MonthlyMatrix";
import {Sandbox} from "../components/Sandbox";
import {StatusBadge} from "../components/StatusBadge";
import {getSeed,optimizeCodes,parseCode,validateCodes} from "../lib/api";
import type {ObligationRow} from "../lib/database.types";
import {deactivateObligation,listObligations,saveParsedObligations} from "../lib/persistence";
import {getSupabase} from "../lib/supabase";
import type {OptimizationResult} from "../lib/types";

const money=(n:number)=>new Intl.NumberFormat("fr-CH",{maximumFractionDigits:0}).format(n);

export default function Home(){
  const[codes,setCodes]=useState<string[]>([]);
  const[result,setResult]=useState<OptimizationResult|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[session,setSession]=useState<Session|null>(null);
  const[rows,setRows]=useState<ObligationRow[]>([]);
  const[workspaceEmpty,setWorkspaceEmpty]=useState(false);

  const solve=useCallback(async(next:string[])=>{setLoading(true);setError(null);try{setResult(await optimizeCodes(next))}catch(e){setError(String(e))}finally{setLoading(false)}},[]);

  const loadDemo=useCallback(async()=>{const seed=await getSeed();setCodes(seed.codes);setRows([]);setWorkspaceEmpty(false);await solve(seed.codes)},[solve]);

  const loadWorkspace=useCallback(async(current:Session)=>{
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

  async function persistCurrent(){
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const validation=await validateCodes(codes);
      if(!validation.valid)throw new Error(validation.issues.map(i=>`${i.error}: ${i.detail}`).join(" | "));
      const saved=await saveParsedObligations(session.user.id,validation.obligations);
      setRows(saved);setWorkspaceEmpty(false);
    }catch(e){setError(String(e))}finally{setLoading(false)}
  }

  async function applyCode(code:string){
    const next=[...codes,code];
    setCodes(next);
    await solve(next);
    if(session){
      try{const parsed=await parseCode(code);if(!parsed.valid||!parsed.obligation)throw new Error(parsed.issues.map(i=>i.detail).join(" | "));await saveParsedObligations(session.user.id,[parsed.obligation]);setRows(await listObligations());setWorkspaceEmpty(false)}catch(e){setError(`Optimized locally, but persistence failed: ${String(e)}`)}
    }
  }

  async function remove(index:number){
    const removed=codes[index];
    const next=codes.filter((_,i)=>i!==index);
    setCodes(next);
    await solve(next);
    if(session){
      const composite=removed.split("-")[0];
      try{await deactivateObligation(composite);setRows(await listObligations())}catch(e){setError(`Removed locally, but persistence failed: ${String(e)}`)}
    }
  }

  const metrics=result?.metrics;
  const january=metrics?.monthly_totals["2027-01"]??0;
  const weekly=metrics?metrics.global_mt/metrics.days_in_window*7:0;
  const issues=useMemo(()=>result?.issues??[],[result]);

  return <main>
    <header className="topbar"><div className="brand"><div className="brand-mark">DO</div><div><b>Debt Optimiser</b><span>Discrete Capital Cleanup Engine</span></div></div><div className="top-actions"><span className="count">{session?"CLOUD WORKSPACE":"LOCAL DEMO"}</span><StatusBadge ok={Boolean(result?.valid)} label={loading?"SOLVING":result?.valid?"ENGINE VALID":"ENGINE ERROR"}/></div></header>
    <section className="hero"><div><span className="eyebrow">GLOBAL CLEANUP PROTOCOL</span><h1>Zero liability.<br/><em>Before February.</em></h1><p>Immutable source codes in. Integer-unit optimization out. No fractional units, no hidden spreadsheet logic.</p></div><div className="zero-card"><span>FEBRUARY LIABILITY</span><strong>{result?.valid?"CHF 0.00":"INVALID"}</strong><small>Required state on 01 Feb 2027</small></div></section>

    <AuthPanel session={session} onSession={handleSession}/>
    {session&&workspaceEmpty?<section className="panel import-banner"><div><span className="eyebrow">EMPTY PRIVATE DATABASE</span><h2>Canonical 13-object plan is loaded in preview mode.</h2><p className="muted">Persist the validated source codes to make this account your durable source of truth.</p></div><button onClick={persistCurrent} disabled={loading}>Persist canonical database</button></section>:null}

    {error?<div className="error-box"><b>System notice</b><p>{error}</p></div>:null}
    {issues.length?<div className="error-box">{issues.map(i=><p key={`${i.code}-${i.error}`}><b>{i.error}</b> {i.detail}</p>)}</div>:null}

    {metrics?<section className="metrics-grid"><MetricCard label="GLOBAL MT" value={`CHF ${money(metrics.global_mt)}`} hint="live checksum" accent="violet"/><MetricCard label="PEAK MONTH" value={`CHF ${money(metrics.peak_monthly)}`} hint="solved maximum"/><MetricCard label="AVERAGE / DAY" value={`CHF ${metrics.average_per_day.toFixed(2)}`} hint={`${metrics.days_in_window} calendar days`}/><MetricCard label="AVERAGE / WEEK" value={`CHF ${weekly.toFixed(2)}`} hint="global average"/><MetricCard label="JANUARY" value={`CHF ${money(january)}`} hint="landing month" accent="good"/></section>:null}
    {result?.valid?<MonthlyMatrix result={result}/>:null}
    {metrics?<LoadProfile metrics={metrics}/>:null}
    <div className="two-col"><CodeDatabase codes={codes} onRemove={remove}/><Sandbox codes={codes} onApply={applyCode}/></div>
    {metrics?<ActualsPanel planned={metrics.global_mt} userId={session?.user.id} obligations={rows}/>:null}
    <footer><span>Source → Parse → Validate → Optimize → Persist → Render</span><span>{result?.solver??"no solver"}</span></footer>
  </main>;
}
