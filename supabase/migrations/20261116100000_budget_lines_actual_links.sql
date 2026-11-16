-- Budget mod faktisk forbrug: en budgetpost kan nu kobles til flere
-- mapping-regler (fx "Mad" = flere supermarkeder), og evt. til resten af
-- sin kategori. Den gamle enkelt-kobling (mapping_id) flyttes over i listen.
alter table budget.budget_lines
  add column mapping_ids uuid[] not null default '{}';

update budget.budget_lines
  set mapping_ids = array[mapping_id]
  where mapping_id is not null;

alter table budget.budget_lines
  drop column mapping_id;

-- Når true, tæller også posteringer i postens kategori med, som ikke allerede
-- er fanget af en regel på en anden budgetpost.
alter table budget.budget_lines
  add column include_category boolean not null default false;
