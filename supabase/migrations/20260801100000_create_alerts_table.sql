-- Alerts: opdages automatisk ved hver CSV-upload (prisstigninger på faste
-- posteringer, udeblevne faste posteringer, og usædvanligt store enkeltposter).
-- Se src/lib/alerts/detectAnomalies.ts for selve logikken.
create table budget.alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('price_increase', 'missing_recurring', 'unusual_amount')),
  label text not null,
  transaction_id uuid references budget.transactions(id) on delete cascade,
  mapping_id uuid references budget.text_mappings(id) on delete cascade,
  previous_amount numeric(12, 2),
  new_amount numeric(12, 2),
  month_key text not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index alerts_acknowledged_idx on budget.alerts (acknowledged);
create index alerts_dedup_idx on budget.alerts (type, mapping_id, month_key);

alter table budget.alerts enable row level security;

create policy "husstanden har fuld adgang til alerts"
  on budget.alerts
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());
