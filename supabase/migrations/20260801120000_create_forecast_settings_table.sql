-- Enkelt indstillingstabel med manuelle overstyringer til prognosen. Lige nu
-- kun den forventede månedlige indbetaling, som husstanden selv kan justere
-- når lønnen ændrer sig hurtigere end den automatiske genkendelse kan følge
-- med (den kræver mindst 2 måneders historik). Se
-- src/lib/forecast/applyIncomeOverride.ts.
create table budget.forecast_settings (
  id uuid primary key default gen_random_uuid(),
  monthly_income_override numeric(12, 2),
  updated_at timestamptz not null default now()
);

alter table budget.forecast_settings enable row level security;

create policy "husstanden har fuld adgang til forecast_settings"
  on budget.forecast_settings
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());
