-- Budget-appens skema. Bor i sit eget schema ("budget"), da Supabase-projektet
-- "projekter" huser flere uafhængige apps over tid. Ingen tabeller i public.
create schema if not exists budget;

-- ---------------------------------------------------------------------------
-- Adgangskontrol: husstanden er de to whitelistede e-mails. Denne liste skal
-- holdes i sync med ALLOWED_EMAILS i .env.local (app-lagets whitelist-tjek).
-- Funktionen bruges af RLS-policies nedenfor som forsvar i dybden, selvom
-- app-laget allerede afviser andre e-mails før der sendes magic link.
-- ---------------------------------------------------------------------------
create or replace function budget.is_household_member()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'stig@lv59.dk',
    'charlotte@lv59.dk'
  );
$$;

-- ---------------------------------------------------------------------------
-- Kategorier
-- ---------------------------------------------------------------------------
create table budget.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  sort_order int not null default 0
);

alter table budget.categories enable row level security;

create policy "husstanden har fuld adgang til categories"
  on budget.categories
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());

-- ---------------------------------------------------------------------------
-- Mapping-regler: hjertet i appen. Matcher rå posteringstekster til en fast
-- kommentar + kategori på tværs af måneder, selvom bankens tekster varierer.
-- ---------------------------------------------------------------------------
create table budget.text_mappings (
  id uuid primary key default gen_random_uuid(),
  match_pattern text not null,
  match_type text not null default 'prefix'
    check (match_type in ('prefix', 'contains', 'exact')),
  comment text,
  category_id uuid references budget.categories(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table budget.text_mappings enable row level security;

create policy "husstanden har fuld adgang til text_mappings"
  on budget.text_mappings
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());

-- ---------------------------------------------------------------------------
-- Posteringer
-- ---------------------------------------------------------------------------
create table budget.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  raw_text text not null,
  amount numeric(12, 2) not null,
  balance numeric(12, 2),
  status text,
  reconciled text,
  row_hash text not null unique,
  comment text,
  category_id uuid references budget.categories(id) on delete set null,
  is_extraordinary boolean not null default false,
  mapping_id uuid references budget.text_mappings(id) on delete set null,
  created_at timestamptz not null default now()
);

create index transactions_date_idx on budget.transactions (date);
create index transactions_category_id_idx on budget.transactions (category_id);
create index transactions_mapping_id_idx on budget.transactions (mapping_id);

alter table budget.transactions enable row level security;

create policy "husstanden har fuld adgang til transactions"
  on budget.transactions
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());

-- ---------------------------------------------------------------------------
-- Upload-log
-- ---------------------------------------------------------------------------
create table budget.uploads (
  id uuid primary key default gen_random_uuid(),
  filename text,
  uploaded_at timestamptz not null default now(),
  rows_imported int not null default 0,
  rows_skipped int not null default 0
);

alter table budget.uploads enable row level security;

create policy "husstanden har fuld adgang til uploads"
  on budget.uploads
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());

-- ---------------------------------------------------------------------------
-- Seed: standard-kategorier
-- ---------------------------------------------------------------------------
insert into budget.categories (name, color, sort_order) values
  ('Bolig', '#2563eb', 10),
  ('Forsikring', '#7c3aed', 20),
  ('Transport', '#0891b2', 30),
  ('Abonnementer/Streaming', '#db2777', 40),
  ('Mobil/Internet', '#ea580c', 50),
  ('Mad', '#16a34a', 60),
  ('Sundhed', '#dc2626', 70),
  ('Pension/Opsparing', '#4f46e5', 80),
  ('Indtægt', '#059669', 90),
  ('Overførsler', '#64748b', 100),
  ('Andet', '#78716c', 110);

-- ---------------------------------------------------------------------------
-- Seed: mapping-regler for interne overførselstekster, så de ikke optræder
-- som "ukategoriserede" og forstyrrer oprydningsarbejdet efter upload.
-- ---------------------------------------------------------------------------
insert into budget.text_mappings (match_pattern, match_type, comment, category_id)
select 'FRA:', 'prefix', 'Overførsel fra egen konto', id
from budget.categories where name = 'Indtægt';

insert into budget.text_mappings (match_pattern, match_type, comment, category_id)
select 'Overført til:', 'prefix', 'Overførsel til egen konto', id
from budget.categories where name = 'Overførsler';

insert into budget.text_mappings (match_pattern, match_type, comment, category_id)
select 'Til Madkonto', 'contains', 'Overførsel til madkonto', id
from budget.categories where name = 'Overførsler';

insert into budget.text_mappings (match_pattern, match_type, comment, category_id)
select 'Opsparing', 'contains', 'Overførsel til opsparing', id
from budget.categories where name = 'Overførsler';
