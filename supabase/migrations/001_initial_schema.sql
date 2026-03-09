-- Enable the btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- COURTS
-- ============================================================
CREATE TABLE courts (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO courts (name) VALUES ('Cancha 1'), ('Cancha 2'), ('Cancha 3');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  phone        TEXT    NOT NULL UNIQUE,
  blocked_until DATE,                  -- NULL = not blocked
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users (phone);

-- ============================================================
-- FIXED BOOKINGS (recurring classes loaded by admin)
-- weekday: 0 = Sunday … 6 = Saturday (matches JS getDay())
-- ============================================================
CREATE TABLE fixed_bookings (
  id               SERIAL   PRIMARY KEY,
  court_id         INTEGER  NOT NULL REFERENCES courts (id) ON DELETE CASCADE,
  weekday          SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time       TIME     NOT NULL,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes IN (60, 90, 120)),
  label            TEXT     NOT NULL DEFAULT 'Clase',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (court_id, weekday, start_time)
);

CREATE INDEX idx_fixed_bookings_court_weekday ON fixed_bookings (court_id, weekday);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE bookings (
  id               UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id         INTEGER  NOT NULL REFERENCES courts (id),
  user_id          UUID     NOT NULL REFERENCES users (id),
  date             DATE     NOT NULL,
  start_time       TIME     NOT NULL,
  end_time         TIME     NOT NULL,          -- stored for easy overlap queries
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes IN (60, 90, 120)),
  status           TEXT     NOT NULL DEFAULT 'confirmed'
                            CHECK (status IN ('confirmed', 'cancelled', 'late_cancelled')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at     TIMESTAMPTZ,

  -- Prevent exact duplicate (court + date + start_time)
  CONSTRAINT uq_booking_start UNIQUE (court_id, date, start_time),

  -- Prevent overlapping confirmed bookings on the same court + date
  -- Uses tsrange overlap with GiST index
  EXCLUDE USING gist (
    court_id WITH =,
    daterange(date, date, '[]') WITH &&,
    tsrange(
      (date + start_time)::TIMESTAMP,
      (date + end_time)::TIMESTAMP,
      '[)'
    ) WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX idx_bookings_date       ON bookings (date);
CREATE INDEX idx_bookings_court_date ON bookings (court_id, date);
CREATE INDEX idx_bookings_user_date  ON bookings (user_id, date);
CREATE INDEX idx_bookings_status     ON bookings (status);

-- ============================================================
-- HELPER FUNCTION: one booking per user per day
-- Enforced at application level; this view helps audit it.
-- ============================================================
-- (The constraint is enforced in the API route, not via DB trigger,
--  to return friendly messages. Add a partial unique index as safety net.)
CREATE UNIQUE INDEX idx_bookings_one_per_user_day
  ON bookings (user_id, date)
  WHERE status = 'confirmed';
