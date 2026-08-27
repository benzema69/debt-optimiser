export function StatusBadge({ok,label}:{ok:boolean;label:string}){return <span className={`badge ${ok?"badge-ok":"badge-error"}`}>{label}</span>}
