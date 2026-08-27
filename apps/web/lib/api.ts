import type { OptimizationResult, SimulationResult } from "./types";
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
async function json<T>(path:string, init?:RequestInit):Promise<T>{ const r=await fetch(`${API}${path}`,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})},cache:"no-store"}); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() as Promise<T>; }
export const getSeed=()=>json<{codes:string[];mt:number}>("/v1/seed");
export const optimizeCodes=(codes:string[])=>json<OptimizationResult>("/v1/optimize",{method:"POST",body:JSON.stringify({codes})});
export const simulateCode=(codes:string[],candidate_code:string)=>json<SimulationResult>("/v1/simulate",{method:"POST",body:JSON.stringify({codes,candidate_code})});
