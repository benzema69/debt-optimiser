-- Auth ownership and production RLS hardening.
-- Safe to apply before inserting hosted personal data.

alter table public.obligations
  alter column user_id set not null;
alter table public.ledger_events
  alter column user_id set not null;
alter table public.optimization_runs
  alter column user_id set not null;

alter table public.obligations
  add constraint obligations_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.ledger_events
  add constraint ledger_events_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.optimization_runs
  add constraint optimization_runs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists obligations_user_idx on public.obligations(user_id);
create index if not exists optimization_runs_user_idx on public.optimization_runs(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists obligations_set_updated_at on public.obligations;
create trigger obligations_set_updated_at
before update on public.obligations
for each row execute function public.set_updated_at();

create policy obligations_select_own on public.obligations
for select to authenticated
using ((select auth.uid()) = user_id);
create policy obligations_insert_own on public.obligations
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy obligations_update_own on public.obligations
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy obligations_delete_own on public.obligations
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy ledger_select_own on public.ledger_events
for select to authenticated
using ((select auth.uid()) = user_id);
create policy ledger_insert_own on public.ledger_events
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    obligation_id is null
    or exists (
      select 1 from public.obligations o
      where o.id = obligation_id and o.user_id = (select auth.uid())
    )
  )
);
create policy ledger_update_own on public.ledger_events
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    obligation_id is null
    or exists (
      select 1 from public.obligations o
      where o.id = obligation_id and o.user_id = (select auth.uid())
    )
  )
);
create policy ledger_delete_own on public.ledger_events
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy runs_select_own on public.optimization_runs
for select to authenticated
using ((select auth.uid()) = user_id);
create policy runs_insert_own on public.optimization_runs
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy runs_update_own on public.optimization_runs
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy runs_delete_own on public.optimization_runs
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy allocations_select_own on public.optimization_allocations
for select to authenticated
using (
  exists (
    select 1 from public.optimization_runs r
    where r.id = run_id and r.user_id = (select auth.uid())
  )
);
create policy allocations_insert_own on public.optimization_allocations
for insert to authenticated
with check (
  exists (
    select 1 from public.optimization_runs r
    where r.id = run_id and r.user_id = (select auth.uid())
  )
  and (
    obligation_id is null
    or exists (
      select 1 from public.obligations o
      where o.id = obligation_id and o.user_id = (select auth.uid())
    )
  )
);
create policy allocations_update_own on public.optimization_allocations
for update to authenticated
using (
  exists (
    select 1 from public.optimization_runs r
    where r.id = run_id and r.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.optimization_runs r
    where r.id = run_id and r.user_id = (select auth.uid())
  )
  and (
    obligation_id is null
    or exists (
      select 1 from public.obligations o
      where o.id = obligation_id and o.user_id = (select auth.uid())
    )
  )
);
create policy allocations_delete_own on public.optimization_allocations
for delete to authenticated
using (
  exists (
    select 1 from public.optimization_runs r
    where r.id = run_id and r.user_id = (select auth.uid())
  )
);
