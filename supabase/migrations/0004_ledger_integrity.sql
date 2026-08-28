-- Enforce tenant ownership at the relational layer for ledger links.
-- This complements RLS and prevents a user-owned event from pointing at another user's rows.

alter table public.obligations
  add constraint obligations_id_user_key unique (id, user_id);

alter table public.ledger_events
  add constraint ledger_events_id_user_key unique (id, user_id);

alter table public.ledger_events
  drop constraint if exists ledger_events_obligation_id_fkey;
alter table public.ledger_events
  add constraint ledger_events_obligation_user_fkey
  foreign key (obligation_id, user_id)
  references public.obligations(id, user_id)
  on delete set null (obligation_id);

alter table public.ledger_events
  drop constraint if exists ledger_events_reversal_of_fkey;
alter table public.ledger_events
  add constraint ledger_events_reversal_user_fkey
  foreign key (reversal_of, user_id)
  references public.ledger_events(id, user_id);
