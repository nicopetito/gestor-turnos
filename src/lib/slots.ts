import type { CourtClosure, FixedBooking, FixedBookingSuspension, SlotInfo } from '@/types';

const OPEN_HOUR  = 8;   // 08:00 inclusive
const CLOSE_HOUR = 23;  // 23:00 — last valid slot is 22:00 (mín. 60 min)
const BLOCK_MINUTES = 30;

/** Returns every 30-min slot label from 08:00 to 22:00 (last slot that fits a 60-min booking). */
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  const lastStartMin = CLOSE_HOUR * 60 - 60; // 22:00
  for (let min = OPEN_HOUR * 60; min <= lastStartMin; min += BLOCK_MINUTES) {
    slots.push(minutesToTime(min));
  }
  return slots;
}

/** "HH:MM" or "HH:MM:SS" → total minutes since midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Total minutes since midnight → "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return pad(h) + ':' + pad(m);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Returns the FixedBooking that occupies a given time slot on a weekday,
 * or null if none.
 */
export function findFixedBooking(
  time: string,
  weekday: number,
  fixedBookings: FixedBooking[],
): FixedBooking | null {
  const slotMin = timeToMinutes(time);
  for (const fb of fixedBookings) {
    if (fb.weekday !== weekday) continue;
    const fbStart = timeToMinutes(fb.start_time);
    const fbEnd   = fbStart + fb.duration_minutes;
    if (slotMin >= fbStart && slotMin < fbEnd) return fb;
  }
  return null;
}

/**
 * Returns true if the 30-min slot starting at `time` is occupied by a
 * confirmed booking on the given court + date.
 */
export function isSlotBooked(
  time: string,
  courtId: number,
  date: string,
  bookings: Array<{
    court_id: number;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
  }>,
): boolean {
  const slotMin = timeToMinutes(time);
  return bookings.some((b) => {
    if (b.court_id !== courtId || b.date !== date || b.status !== 'confirmed') return false;
    const bStart = timeToMinutes(b.start_time);
    const bEnd   = timeToMinutes(b.end_time);
    return slotMin >= bStart && slotMin < bEnd;
  });
}

/**
 * Returns true if a fixed booking is suspended for the given date.
 */
export function isFixedBookingSuspended(
  fixedBookingId: number,
  date: string,
  suspensions: FixedBookingSuspension[],
): boolean {
  return suspensions.some(
    (s) =>
      s.fixed_booking_id === fixedBookingId &&
      date >= s.suspended_from &&
      date <= s.suspended_until,
  );
}

/**
 * Returns true if the 30-min slot starting at `time` falls within a court closure.
 */
export function isSlotUnderMaintenance(
  time: string,
  courtId: string | number,
  date: string,
  closures: CourtClosure[],
): boolean {
  const slotMin = timeToMinutes(time);
  return closures.some((c) => {
    if (String(c.court_id) !== String(courtId) || date < c.date_from || date > c.date_to) return false;
    const cStart = timeToMinutes(c.start_time);
    const cEnd   = timeToMinutes(c.end_time);
    return slotMin >= cStart && slotMin < cEnd;
  });
}

/**
 * Builds the full SlotInfo array for one court on one date.
 */
export function buildCourtSlots(
  date: string,
  courtId: number,
  weekday: number,
  fixedBookings: FixedBooking[],
  bookings: Array<{
    court_id: number;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
  }>,
  suspensions: FixedBookingSuspension[] = [],
  closures: CourtClosure[] = [],
): SlotInfo[] {
  const courtFixed = fixedBookings.filter((fb) => fb.court_id === courtId);
  return generateTimeSlots().map((time) => {
    if (isSlotUnderMaintenance(time, courtId, date, closures)) {
      return { time, courtId, date, status: 'maintenance' };
    }
    const fixed = findFixedBooking(time, weekday, courtFixed);
    if (fixed && !isFixedBookingSuspended(fixed.id, date, suspensions)) {
      return { time, courtId, date, status: 'fixed', label: fixed.label };
    }
    if (isSlotBooked(time, courtId, date, bookings)) {
      return { time, courtId, date, status: 'booked' };
    }
    return { time, courtId, date, status: 'available' };
  });
}

/**
 * Given a desired booking (court, start, duration), checks whether all
 * required 30-min blocks are available in the provided slot list.
 * Returns true if the booking fits.
 */
export function isDurationAvailable(
  startTime: string,
  durationMinutes: number,
  courtSlots: SlotInfo[],
): boolean {
  const startMin = timeToMinutes(startTime);
  const endMin   = startMin + durationMinutes;
  if (endMin > CLOSE_HOUR * 60) return false;

  for (let m = startMin; m < endMin; m += BLOCK_MINUTES) {
    const t = minutesToTime(m);
    const slot = courtSlots.find((s) => s.time === t);
    if (!slot || slot.status !== 'available') return false;
  }
  return true;
}
