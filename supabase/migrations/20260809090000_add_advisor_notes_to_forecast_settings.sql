-- Gør det muligt selv at tilføje fast kontekst/instrukser til AI-rådgiveren
-- (fx "Hold øje med Transport pga. stigende benzinpriser"), uden at det
-- kræver kodeændringer. Teksten sendes med som ekstra kontekst i prompten
-- ved siden af de faste instrukser og husstandens tal.
alter table budget.forecast_settings
  add column advisor_notes text;
