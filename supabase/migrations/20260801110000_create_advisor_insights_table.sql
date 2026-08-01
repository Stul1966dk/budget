-- Gemmer Claudes budgetanbefalinger, genereret ud fra opsparingsrate,
-- udgiftsprognose og kategori-trends. Se src/lib/advisor/refreshAdvisorInsight.ts.
create table budget.advisor_insights (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index advisor_insights_created_at_idx on budget.advisor_insights (created_at desc);

alter table budget.advisor_insights enable row level security;

create policy "husstanden har fuld adgang til advisor_insights"
  on budget.advisor_insights
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());
