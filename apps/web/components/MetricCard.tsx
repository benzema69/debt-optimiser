type Props={label:string;value:string;hint?:string;accent?:"default"|"good"|"warn"|"violet"};
export function MetricCard({label,value,hint,accent="default"}:Props){return <article className={`metric metric-${accent}`}><span className="metric-label">{label}</span><strong>{value}</strong>{hint?<small>{hint}</small>:null}</article>}
