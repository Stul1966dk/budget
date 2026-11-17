-- De måneder der findes posteringer i, nyeste først (fx '2026-11').
-- Bruges til månedsvælgeren på Posteringer, som før hentede datoen på
-- samtlige posteringer i bidder af 1000 bare for at finde de unikke måneder.
--
-- security invoker: funktionen kører med den kaldende brugers rettigheder,
-- så RLS på budget.transactions gælder præcis som ved en almindelig
-- forespørgsel - kun husstanden får måneder tilbage.
create or replace function budget.transaction_months()
returns table (month text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct to_char(t.date, 'YYYY-MM') as month
  from budget.transactions t
  order by month desc;
$$;

revoke execute on function budget.transaction_months() from public, anon;
grant execute on function budget.transaction_months() to authenticated, service_role;
