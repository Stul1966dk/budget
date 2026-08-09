-- Gemmer samtalen med AI-rådgiveren (spørgsmål/svar), delt mellem hele
-- husstanden, så samtalen ikke forsvinder ved genindlæsning. Se
-- src/lib/advisor/chatWithAdvisor.ts.
create table budget.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index advisor_messages_created_at_idx on budget.advisor_messages (created_at);

alter table budget.advisor_messages enable row level security;

create policy "husstanden har fuld adgang til advisor_messages"
  on budget.advisor_messages
  for all
  using (budget.is_household_member())
  with check (budget.is_household_member());
