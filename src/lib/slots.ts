import type { FixedBooking, SlotInfo, CourtAvailability } from '@/types';

const OPEN_HOUR  = 8;   // 08:00 inclusive
const CLOSE_HOUR = 23;  // 23:00 exclusive (last slot starts 22:30)
const BLOCK_MINUTES = 30;

/** Returns every 30-min slot label from 08:00 to 22:30. */
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    slots.push(pad(h) + ':00');
    slots.push(pad(h) + ':30');
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
): SlotInfo[] {
  const courtFixed = fixedBookings.filter((fb) => fb.court_id === courtId);
  return generateTimeSlots().map((time) => {
    const fixed = findFixedBooking(time, weekday, courtFixed);
    if (fixed) {
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
