export type BookingStatus = 'confirmed' | 'cancelled' | 'late_cancelled';
export type Duration = 60 | 90 | 120;
export type SlotStatus = 'available' | 'booked' | 'fixed' | 'unavailable';

// ---- DB row shapes ----

export interface Court {
  id: number;
  name: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  blocked_until: string | null; // ISO date "YYYY-MM-DD" or null
  created_at: string;
}

export interface FixedBooking {
  id: number;
  court_id: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
  start_time: string; // "HH:MM:SS"
  duration_minutes: Duration;
  label: string;
  created_at: string;
}

export interface Booking {
  id: string;
  court_id: number;
  user_id: string;
  date: string;          // "YYYY-MM-DD"
  start_time: string;    // "HH:MM:SS"
  end_time: string;      // "HH:MM:SS"
  duration_minutes: Duration;
  status: BookingStatus;
  created_at: string;
  cancelled_at: string | null;
  // joined relations (optional)
  users?: Pick<AppUser, 'name' | 'phone'>;
  courts?: Pick<Court, 'name'>;
}

// ---- API shapes ----

export interface SlotInfo {
  time: string;       // "HH:MM"
  courtId: number;
  date: string;       // "YYYY-MM-DD"
  status: SlotStatus;
  bookingId?: string;
  label?: string;     // for fixed slots
}

export interface CourtAvailability {
  date: string;
  courtId: number;
  courtName: string;
  slots: SlotInfo[];
}

export interface CreateBookingBody {
  court_id: number;
  date: string;
  start_time: string;
  duration_minutes: Duration;
  name: string;
  phone: string;
  email?: string; // optional — used for email notifications
}

export interface CancelBookingBody {
  phone: string;
}

export interface BlockUserBody {
  adminKey: string;
  phone: string;
  blocked_until: string; // "YYYY-MM-DD"
}

export interface CreateFixedBookingBody {
  adminKey: string;
  court_id: number;
  weekday: number;
  start_time: string;
  duration_minutes: Duration;
  label?: string;
}
