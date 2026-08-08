-- Bruges af "missing_recurring"-alarmer til at vise hvornår posten typisk
-- plejer at optræde (fx "omkring den 20."), i stedet for kun at sige den
-- mangler. Se src/lib/alerts/detectAnomalies.ts.
alter table budget.alerts
  add column typical_day smallint;
