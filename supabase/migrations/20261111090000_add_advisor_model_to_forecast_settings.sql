-- Gør det muligt at vælge sprogmodel til AI-rådgiveren direkte i appen i
-- stedet for via miljøvariablen ANTHROPIC_MODEL, der kræver et nyt deploy.
-- null betyder "brug standarden" (ANTHROPIC_MODEL, ellers kodens default).
alter table budget.forecast_settings
  add column advisor_model text;
