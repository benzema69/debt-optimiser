import type {LedgerEventRow} from "../lib/database.types";
import {generatedTotal} from "../lib/ledger";
import type {Metrics} from "../lib/types";

const ZERO_DAY="2027-01-31";
const money=(n:number)=>new Intl.NumberFormat("fr-CH",{maximumFractionDigits:2}).format(n);
const dayMs=86_400_000;

function daysInMonth(key:string){const[y,m]=key.split("-").map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate()}
function clampDate(value:string,min:string,max:string){return value<min?min:value>max?max:value}
function inclusiveDays(a:string,b:string){return Math.floor((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/dayMs)+1}

function targetThrough(metrics:Metrics,start:string,end:string){
  let target=0;
  for(const [month,total] of Object.entries(metrics.monthly_totals)){
    const monthStart=`${month}-01`;
    const monthEnd=`${month}-${String(daysInMonth(month)).padStart(2,"0")}`;
    const from=start>monthStart?start:monthStart;
    const to=end<monthEnd?end:monthEnd;
    if(from>to)continue;
    target+=total/daysInMonth(month)*inclusiveDays(from,to);
  }
  return target;
}

export function PacePanel({metrics,events,planningStart}:{metrics:Metrics;events:LedgerEventRow[];planningStart:string}){
  const wallToday=new Date().toISOString().slice(0,10);
  const beforeWindow=wallToday<planningStart;
  const today=clampDate(wallToday,planningStart,ZERO_DAY);
  const target=beforeWindow?0:targetThrough(metrics,planningStart,today);
  const generated=generatedTotal(events,planningStart,beforeWindow?ZERO_DAY:today);
  const delta=generated-target;
  const daysElapsed=beforeWindow?0:Math.max(0,inclusiveDays(planningStart,today));
  const daysTotal=inclusiveDays(planningStart,ZERO_DAY);
  const daysRemaining=beforeWindow?daysTotal:Math.max(1,inclusiveDays(today,ZERO_DAY));
  const currentMonth=(beforeWindow?planningStart:today).slice(0,7);
  const todayTarget=(metrics.monthly_totals[currentMonth]??0)/daysInMonth(currentMonth);
  const stillToGenerate=Math.max(0,metrics.global_mt-generated);
  const catchupRate=stillToGenerate/daysRemaining;
  const timePct=Math.min(100,daysElapsed/daysTotal*100);
  const fundedPct=metrics.global_mt?Math.min(100,generated/metrics.global_mt*100):100;
  return <section className="panel pace-panel"><div className="panel-head"><div><span className="eyebrow">DAILY GENERATION ENGINE</span><h2>Live pace to Zero Day</h2></div><span className="count">{planningStart} → {ZERO_DAY}</span></div>
    <div className="pace-kpis"><div><span>{beforeWindow?"Opening-day target":"Today target"}</span><b>CHF {money(todayTarget)}</b></div><div><span>Cumulative target</span><b>CHF {money(target)}</b></div><div><span>Generated in live window</span><b>CHF {money(generated)}</b></div><div><span>Advance / delay</span><b className={delta>=0?"good":"warn"}>{delta>=0?"+":""} CHF {money(delta)}</b></div><div><span>Required average from now</span><b>CHF {money(catchupRate)}/day</b></div><div><span>Days remaining</span><b>{daysRemaining}</b></div></div>
    <div className="dual-progress"><div><div><span>Time elapsed</span><b>{timePct.toFixed(1)}%</b></div><div className="progress-track"><div className="progress-fill time-fill" style={{width:`${timePct}%`}}/></div></div><div><div><span>Funding generated</span><b>{fundedPct.toFixed(1)}%</b></div><div className="progress-track"><div className="progress-fill" style={{width:`${fundedPct}%`}}/></div></div></div>
    <p className="muted pace-note">Daily pacing is a funding trajectory derived from the optimized monthly totals. Contractual payment validity remains governed by the obligation model and ledger reconciliation, not by this visualization.</p>
  </section>;
}
