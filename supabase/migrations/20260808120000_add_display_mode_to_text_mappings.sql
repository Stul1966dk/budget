-- Gør det muligt selv at bestemme, under Regler, om en regels matchede
-- posteringer skal vises som én samlet post eller hver for sig - uden at det
-- kræver kodeændringer. "grouped" (default) bevarer den hidtidige adfærd:
-- alle matches deler reglens kommentar og vises som én linje. "individual"
-- bruges til poster der reelt er forskellige ting, men ikke kan skelnes
-- automatisk (fx Oister/TV2/Spotify-abonnementer med et tilfældigt suffiks
-- pr. postering) - her sætter reglen ikke en fælles kommentar, så hver
-- postering vises for sig (via sin rå tekst) indtil man evt. selv navngiver
-- den enkelte postering.
alter table budget.text_mappings
  add column display_mode text not null default 'grouped'
    check (display_mode in ('grouped', 'individual'));

-- Ensretter allerede-importerede posteringer med den nye default: for enhver
-- regel i "grouped"-tilstand (dvs. alle eksisterende regler indtil man selv
-- ændrer det) skal alle dens matchede posteringer dele reglens kommentar, så
-- de vises som én samlet post - præcis som før beløbsinterval/visning fandtes.
update budget.transactions t
set comment = tm.comment
from budget.text_mappings tm
where t.mapping_id = tm.id
  and tm.display_mode = 'grouped'
  and tm.comment is not null
  and t.comment is distinct from tm.comment;
