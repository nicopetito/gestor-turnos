-- 003_court_closures.sql
-- Tabla para cierres/mantenimiento temporales de canchas

CREATE TABLE court_closures (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id   INTEGER NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_court_closures_date ON court_closures(date);
