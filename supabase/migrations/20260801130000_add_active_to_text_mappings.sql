-- En regel kan markeres som afsluttet ("active = false") når den udgift/indtægt
-- den beskriver aldrig vender tilbage (fx faste udgifter der stopper efter et
-- hussalg). En afsluttet regel bruges stadig til at kategorisere posteringer
-- hvis den mod forventning skulle dukke op igen, men ignoreres af
-- prognosen og "mangler tilbagevendende postering"-alarmer.
alter table budget.text_mappings
  add column active boolean not null default true;
