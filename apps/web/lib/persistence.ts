import type { ParsedObligation } from "./types";
import type { LedgerEventRow, ObligationRow } from "./database.types";
import { getSupabase } from "./supabase";

function mustClient() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

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
  return data ?? [];
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
  return data;
}

export async function deleteLedgerEvent(id: string): Promise<void> {
  const client = mustClient();
  const { error } = await client.from("ledger_events").delete().eq("id", id);
  if (error) throw error;
}
