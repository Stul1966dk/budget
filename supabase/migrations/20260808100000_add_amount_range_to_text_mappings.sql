-- Gør det muligt for en mapping-regel at kræve at posteringens beløb (som
-- absolut værdi, uden fortegn) ligger i et interval, ud over tekst-mønsteret.
-- Bruges til at skelne flere forskellige poster der deler helt identisk
-- banktekst (fx flere IF-forsikringer faktureret under samme tekst), hvor
-- kun beløbet adskiller dem. Begge felter er valgfrie og kan bruges hver for
-- sig (fx kun min_amount for et åbent "over X kr."-interval).
alter table budget.text_mappings
  add column min_amount numeric(12, 2),
  add column max_amount numeric(12, 2);
