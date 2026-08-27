export type Policy = "ACC" | "FIX";
export type ValidationIssue = { code:string; severity:"ERROR"|"WARNING"; error:string; detail:string };
export type Allocation = { id:string; entity:string; month:string; amount:number; regular_units:number; irregular_amount:number; fixed_amount:number };
export type ObligationPlan = { id:string; entity:string; mt:number; unit:number; policy:Policy; allocations:Allocation[] };
export type Metrics = { global_mt:number; peak_monthly:number; minimum_monthly:number; final_month:number; average_per_day:number; days_in_window:number; monthly_totals:Record<string,number> };
export type OptimizationResult = { valid:boolean; solver:string; issues:ValidationIssue[]; plans:ObligationPlan[]; metrics:Metrics|null };
export type SimulationResult = { valid:boolean; issues?:ValidationIssue[]; before?:OptimizationResult; after?:OptimizationResult };
