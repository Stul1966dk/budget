-- Fast search_path på funktionen, som alle RLS-policies bruger. Uden den
-- slår Postgres navne op efter den kaldendes search_path, og Supabase's
-- Security Advisor markerer den som "Function Search Path Mutable".
-- Indholdet er uændret; auth.jwt() er allerede fuldt kvalificeret.
alter function budget.is_household_member() set search_path = '';
