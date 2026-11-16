-- Selvlagte årsbudgetter. Ét budget pr. år; tidligere års budgetter bliver
-- liggende, så de stadig kan åbnes. Posterne er en kopi (fra prognosen,
-- fra et andet års budget eller tomme), som husstanden selv retter i - de
-- regnes ikke forfra, når der uploades nye posteringer.
create table budget.budgets (
  id uuid primary key default gen_random_uuid(),
  year int not null unique check (year between 2000 and 2100),
  -- Saldo ved årets start. Bruges til den løbende saldo i budgettabellen.
  -- null = ukendt (saldo-rækken starter så fra 0).
  start_balance numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table budget.budgets enable row level security;

create policy "husstanden har fuld adgang til budgets"
  on budget.budgets
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());

-- En linje i budgettet: én indtægt eller udgift med et beløb pr. måned.
-- Beløbene gemmes uden fortegn - "kind" afgør om det er ind eller ud.
create table budget.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budget.budgets(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  category_id uuid references budget.categories(id) on delete set null,
  -- Den mapping-regel posten stammer fra, når den er kopieret fra prognosen.
  -- Bruges senere til "budget mod faktisk forbrug".
  mapping_id uuid references budget.text_mappings(id) on delete set null,
  amounts numeric(12, 2)[] not null
    default array_fill(0::numeric, array[12])
    check (array_length(amounts, 1) = 12),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_lines_budget_id_idx on budget.budget_lines (budget_id);

alter table budget.budget_lines enable row level security;

create policy "husstanden har fuld adgang til budget_lines"
  on budget.budget_lines
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());
