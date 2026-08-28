import type {LedgerEventRow} from "./database.types";

export function reversedEventIds(events:LedgerEventRow[]):Set<string>{
  return new Set(events.filter(e=>e.event_type==="REVERSAL"&&e.reversal_of).map(e=>e.reversal_of as string));
}

export function effectiveLedgerEvents(events:LedgerEventRow[]):LedgerEventRow[]{
  const reversed=reversedEventIds(events);
  return events.filter(e=>e.event_type!=="REVERSAL"&&!reversed.has(e.id));
}

export function aggregatePaymentsByComposite(events:LedgerEventRow[],obligationByUuid:Map<string,string>):Record<string,number>{
  const out:Record<string,number>={};
  for(const event of effectiveLedgerEvents(events)){
    if(event.event_type!=="PAYMENT"||!event.obligation_id)continue;
    const composite=obligationByUuid.get(event.obligation_id);
    if(!composite)continue;
    out[composite]=(out[composite]??0)+event.amount;
  }
  return out;
}

export function generatedTotal(events:LedgerEventRow[],from?:string,to?:string):number{
  return effectiveLedgerEvents(events)
    .filter(e=>(e.event_type==="INCOME"||e.event_type==="ADJUSTMENT")&&(!from||e.event_date>=from)&&(!to||e.event_date<=to))
    .reduce((sum,e)=>sum+e.amount,0);
}

export function paymentTotal(events:LedgerEventRow[]):number{
  return effectiveLedgerEvents(events).filter(e=>e.event_type==="PAYMENT").reduce((sum,e)=>sum+e.amount,0);
}
