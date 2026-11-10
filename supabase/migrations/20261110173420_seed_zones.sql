-- The 6 NH-44 corridor zones, Jammu to Srinagar (from our dossier).
-- NOTE: base_risk values (0.1, 0.3, 0.6, 0.8, 0.6, 0.1) are our own starting
-- values for the model, not sourced figures. Tune them once incidents are loaded.

insert into public.zones (id, name, from_place, to_place, length_km, danger_km, risk_level, base_risk, notes)
values
  (1, 'Jammu → Udhampur (Jakhani)',  'Jammu',    'Udhampur (Jakhani)', 65, 0.5, 'low',     0.1, null),
  (2, 'Udhampur → Chenani–Nashri',   'Udhampur', 'Chenani–Nashri',     42, 3.5, 'medium',  0.3, null),
  (3, 'Nashri → Ramban',             'Nashri',   'Ramban',             28, 6.5, 'high',    0.6, null),
  (4, 'Ramban → Ramsoo',             'Ramban',   'Ramsoo',             22, 9.5, 'extreme', 0.8, null),
  (5, 'Ramsoo → Banihal → Qazigund', 'Ramsoo',   'Qazigund',           32, 6.0, 'high',    0.6, 'Via Banihal'),
  (6, 'Qazigund → Srinagar',         'Qazigund', 'Srinagar',           62, 0.0, 'low',     0.1, null);

comment on column public.zones.base_risk is
  'Starting prior risk (0–1). Our own initial values, not sourced figures.';
