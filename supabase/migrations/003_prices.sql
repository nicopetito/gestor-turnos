-- ── Prices table ────────────────────────────────────────────────────────────
CREATE TABLE prices (
  id               SERIAL PRIMARY KEY,
  duration_minutes INTEGER  NOT NULL,
  is_member        BOOLEAN  NOT NULL,
  con_luz          BOOLEAN  NOT NULL,
  amount           INTEGER  NOT NULL,  -- in ARS pesos
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (duration_minutes, is_member, con_luz)
);

INSERT INTO prices (duration_minutes, is_member, con_luz, amount) VALUES
  -- Socios sin luz
  (60,  true,  false, 16000),
  (90,  true,  false, 22000),
  (120, true,  false, 28000),
  -- Socios con luz
  (60,  true,  true,  20000),
  (90,  true,  true,  26000),
  (120, true,  true,  32000),
  -- No socios sin luz
  (60,  false, false, 20000),
  (90,  false, false, 30000),
  (120, false, false, 40000),
  -- No socios con luz
  (60,  false, true,  22000),
  (90,  false, true,  32000),
  (120, false, true,  42000);

-- ── Settings table ───────────────────────────────────────────────────────────
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- After this time (HH:MM) the "con luz" price applies
INSERT INTO settings (key, value) VALUES ('luz_start_time', '19:00');
