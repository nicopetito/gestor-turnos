-- 004_court_closures_date_range.sql
-- Reemplaza el campo date por date_from / date_to para soportar rangos de fechas

ALTER TABLE court_closures RENAME COLUMN date TO date_from;
ALTER TABLE court_closures ADD COLUMN date_to DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE court_closures ALTER COLUMN date_to DROP DEFAULT;

DROP INDEX IF EXISTS idx_court_closures_date;
CREATE INDEX idx_court_closures_date_from ON court_closures(date_from);
CREATE INDEX idx_court_closures_date_to   ON court_closures(date_to);
