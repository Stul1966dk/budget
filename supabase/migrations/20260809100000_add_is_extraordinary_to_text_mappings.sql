-- Gør det muligt selv at markere en regel som ekstraordinær under Regler, så
-- fremtidige posteringer der matcher den automatisk holdes udenfor budgettet
-- (opsparingsrate, prognose, kategori-trends og AI-rådgiver) - uden at det
-- kræver kodeændringer. Bruges til engangsposter der kan tænkes at gentage
-- sig under samme banktekst (fx udlæg, depositum, større engangsoverførsler).
alter table budget.text_mappings
  add column is_extraordinary boolean not null default false;
