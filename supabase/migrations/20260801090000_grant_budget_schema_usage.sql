-- Et selvoprettet schema ("budget") har ikke automatisk USAGE for anon/authenticated,
-- sådan som "public" har som standard. Uden dette stopper Postgres forespørgslen med
-- "permission denied for schema budget", før RLS-policies overhovedet når at blive tjekket.
grant usage on schema budget to anon, authenticated, service_role;

grant all on all tables in schema budget to anon, authenticated, service_role;
grant all on all sequences in schema budget to anon, authenticated, service_role;

-- Så fremtidige tabeller/sekvenser i schemaet arver de samme rettigheder automatisk.
alter default privileges in schema budget
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema budget
  grant all on sequences to anon, authenticated, service_role;
