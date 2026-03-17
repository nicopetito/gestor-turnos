-- ============================================================
-- FIXED BOOKING SUSPENSIONS
-- Allows temporarily suspending a fixed booking for N weeks.
-- During the suspension, the slot is free for regular bookings.
-- After suspended_until, the fixed booking resumes automatically.
-- ============================================================
CREATE TABLE fixed_booking_suspensions (
  id                SERIAL   PRIMARY KEY,
  fixed_booking_id  INTEGER  NOT NULL REFERENCES fixed_bookings(id) ON DELETE CASCADE,
  suspended_from    DATE     NOT NULL,
  suspended_until   DATE     NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CHECK (suspended_until >= suspended_from)
);

CREATE INDEX idx_fbs_fixed_booking ON fixed_booking_suspensions(fixed_booking_id);
CREATE INDEX idx_fbs_dates ON fixed_booking_suspensions(suspended_from, suspended_until);
