import type { OptimizationResult, ParseResult, ParsedObligation, ReoptimizationResult, SimulationResult, ValidationIssue } from "./types";
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
async function json<T>(path:string, init?:RequestInit):Promise<T>{ const r=await fetch(`${API}${path}`,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})},cache:"no-store"}); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() as Promise<T>; }
export const getSeed=()=>json<{codes:string[];mt:number}>("/v1/seed");
export const parseCode=(code:string)=>json<ParseResult>("/v1/parse",{method:"POST",body:JSON.stringify({code})});
export const validateCodes=(codes:string[])=>json<{valid:boolean;issues:ValidationIssue[];obligations:ParsedObligation[]}>("/v1/validate",{method:"POST",body:JSON.stringify({codes})});
export const optimizeCodes=(codes:string[])=>json<OptimizationResult>("/v1/optimize",{method:"POST",body:JSON.stringify({codes})});
export const reoptimizeCodes=(codes:string[],paid_by_id:Record<string,number>,optimization_start="2026-09-01")=>json<ReoptimizationResult>("/v1/reoptimize",{method:"POST",body:JSON.stringify({codes,paid_by_id,config:{optimization_start,zero_day:"2027-01-31",frontload_b:true,frontload_one_off:true,descending_load:true}})});
export const simulateCode=(codes:string[],candidate_code:string)=>json<SimulationResult>("/v1/simulate",{method:"POST",body:JSON.stringify({codes,candidate_code})});
