import type { ReoptimizationResult } from "../lib/types";

const money=(n:number)=>new Intl.NumberFormat("fr-CH",{maximumFractionDigits:0}).format(n);

export function ReconciliationPanel({state,planningStart,onSave,saving,savedRun}:{state:ReoptimizationResult;planningStart:string;onSave?:()=>void;saving?:boolean;savedRun?:string|null}){
  const original=state.original_mt??0;
  const paid=state.paid_to_date??0;
  const remaining=state.remaining_mt??Math.max(0,original-paid);
  const pct=original?Math.min(100,paid/original*100):100;
  return <section className="panel reconciliation-panel">
    <div className="panel-head"><div><span className="eyebrow">LIVE RECONCILIATION</span><h2>Actual payments → remaining integer plan</h2></div><div className="snapshot-actions"><span className="count">FROM {planningStart}</span>{onSave&&state.result?<button className="secondary" onClick={onSave} disabled={saving}>{saving?"Saving…":"Save snapshot"}</button>:null}</div></div>
    <div className="reconcile-kpis"><div><span>Original MT</span><b>CHF {money(original)}</b></div><div><span>Paid</span><b className="good">CHF {money(paid)}</b></div><div><span>Remaining</span><b className={remaining===0?"good":""}>CHF {money(remaining)}</b></div><div><span>Extinguished</span><b>{pct.toFixed(1)}%</b></div></div>
    <div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`}}/></div>
    {savedRun?<p className="save-confirm good">Snapshot persisted · {savedRun.slice(0,8)}</p>:null}
    {state.reconciliation.length?<div className="reconcile-grid">{state.reconciliation.map(item=><div key={item.id} className={item.remaining===0?"reconcile-item paid-off":"reconcile-item"}><div><b>{item.id}</b><span>{item.remaining===0?"PAID OFF":"ACTIVE"}</span></div><strong>CHF {money(item.remaining)}</strong><small>paid CHF {money(item.paid)}{item.regular_units_paid!==undefined?` · ${item.regular_units_paid}U`:""}{item.irregular_paid?` · B ${money(item.irregular_paid)}`:""}</small></div>)}</div>:null}
  </section>;
}
