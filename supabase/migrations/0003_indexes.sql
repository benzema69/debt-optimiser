-- Cover foreign keys used by ownership checks, joins, reversals and run persistence.
create index if not exists ledger_events_obligation_idx on public.ledger_events(obligation_id);
create index if not exists ledger_events_reversal_idx on public.ledger_events(reversal_of);
create index if not exists allocations_obligation_idx on public.optimization_allocations(obligation_id);
