import type { ParsedObligation, OptimizationResult } from "./types";
import type { LedgerEventRow, ObligationRow } from "./database.types";
import { getSupabase } from "./supabase";

function mustClient() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

const EVENT_TYPES = new Set(["INCOME", "PAYMENT", "ADJUSTMENT", "REVERSAL"] as const);

export async function listObligations(): Promise<ObligationRow[]> {
  const client = mustClient();
  const { data, error } = await client.from("obligations").select("*").eq("active", true);
  if (error) throw error;
  return (data ?? []).sort((a, b) => Number(a.composite_id.slice(1)) - Number(b.composite_id.slice(1)));
}

export async function saveParsedObligations(userId: string, obligations: ParsedObligation[]): Promise<ObligationRow[]> {
  const client = mustClient();
  const rows = obligations.map(o => ({
    user_id: userId,
    composite_id: o.id,
    raw_code: o.raw_code,
    entity: o.entity,
    unit_amount: o.unit,
    policy: o.policy,
    mt: o.mt,
    start_month: o.start_month,
    native_end_month: o.native_end_month,
    active: true,
  }));
  if (!rows.length) return [];
  const { data, error } = await client.from("obligations").upsert(rows, { onConflict: "user_id,composite_id" }).select("*");
  if (error) throw error;
  return (data ?? []).sort((a, b) => Number(a.composite_id.slice(1)) - Number(b.composite_id.slice(1)));
}

export async function deactivateObligation(compositeId: string): Promise<void> {
  const client = mustClient();
  const { error } = await client.from("obligations").update({ active: false }).eq("composite_id", compositeId);
  if (error) throw error;
}

export async function listLedgerEvents(): Promise<LedgerEventRow[]> {
  const client = mustClient();
  const { data, error } = await client.from("ledger_events").select("*").order("event_date", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter(e => EVENT_TYPES.has(e.event_type as never)).map(e => ({ ...e, event_type: e.event_type as LedgerEventRow["event_type"] }));
}

export async function addLedgerEvent(input: {
  userId: string;
  eventType: LedgerEventRow["event_type"];
  eventDate: string;
  amount: number;
  note?: string;
  obligationId?: string | null;
}): Promise<LedgerEventRow> {
  const client = mustClient();
  const { data, error } = await client.from("ledger_events").insert({
    user_id: input.userId,
    event_type: input.eventType,
    event_date: input.eventDate,
    amount: input.amount,
    note: input.note || null,
    obligation_id: input.obligationId ?? null,
  }).select("*").single();
  if (error) throw error;
  if (!EVENT_TYPES.has(data.event_type as never)) throw new Error(`Unexpected ledger event type: ${data.event_type}`);
  return { ...data, event_type: data.event_type as LedgerEventRow["event_type"] };
}

export async function deleteLedgerEvent(id: string): Promise<void> {
  const client = mustClient();
  const { error } = await client.from("ledger_events").delete().eq("id", id);
  if (error) throw error;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function saveOptimizationRun(input: {
  userId: string;
  codes: string[];
  result: OptimizationResult;
  obligations: ObligationRow[];
  paidById?: Record<string, number>;
  optimizationStart?: string;
}): Promise<string> {
  if (!input.result.valid || !input.result.metrics) throw new Error("Cannot persist an invalid optimization result");
  const client = mustClient();
  const paidById = input.paidById ?? {};
  const optimizationStart = input.optimizationStart ?? "2026-09-01";
  const checksumPayload = JSON.stringify({ codes: input.codes, paidById, optimizationStart });
  const checksum = await sha256(checksumPayload);
  const { data: run, error: runError } = await client.from("optimization_runs").insert({
    user_id: input.userId,
    input_checksum: checksum,
    solver: input.result.solver,
    status: "VALID",
    config: {
      optimization_start: optimizationStart,
      zero_day: "2027-01-31",
      frontload_b: true,
      frontload_one_off: true,
      descending_load: true,
      paid_by_id: paidById,
    },
    metrics: input.result.metrics,
  }).select("id").single();
  if (runError) throw runError;

  const ids = new Map(input.obligations.map(o => [o.composite_id, o.id]));
  const allocations = input.result.plans.flatMap(plan => plan.allocations.map(a => ({
    run_id: run.id,
    obligation_id: ids.get(plan.id) ?? null,
    composite_id: plan.id,
    month: `${a.month}-01`,
    amount: a.amount,
    regular_units: a.regular_units,
    irregular_amount: a.irregular_amount,
    fixed_amount: a.fixed_amount,
  })));
  if (allocations.length) {
    const { error } = await client.from("optimization_allocations").insert(allocations);
    if (error) throw error;
  }
  return run.id;
}
