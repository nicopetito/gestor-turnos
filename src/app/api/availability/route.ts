import { NextRequest, NextResponse } from 'next/server';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildCourtSlots } from '@/lib/slots';
import type { CourtAvailability } from '@/types';

const MAX_DAYS_AHEAD = 7;

/**
 * GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns slot availability for every court in the requested date range.
 * Dates are clamped to [today, today + 7 days].
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam   = searchParams.get('to');

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: 'Los parámetros from y to son requeridos (YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  const today   = startOfDay(new Date());
  const maxDate = addDays(today, MAX_DAYS_AHEAD);

  // Parse and clamp range
  let from = startOfDay(parseISO(fromParam));
  let to   = startOfDay(parseISO(toParam));

  if (from < today)   from = today;
  if (to   > maxDate) to   = maxDate;
  if (from > to) {
    return NextResponse.json({ availability: [] });
  }

  const fromStr = format(from, 'yyyy-MM-dd');
  const toStr   = format(to,   'yyyy-MM-dd');

  const supabase = await createServerSupabase();

  const [
    { data: courts,       error: courtsErr       },
    { data: fixedBookings,error: fixedErr        },
    { data: bookings,     error: bookingsErr     },
    { data: suspensions,  error: suspensionsErr  },
    { data: closures,     error: closuresErr     },
  ] = await Promise.all([
    supabase.from('courts').select('id, name').order('id'),
    supabase.from('fixed_bookings').select('*'),
    supabase
      .from('bookings')
      .select('court_id, date, start_time, end_time, status')
      .gte('date', fromStr)
      .lte('date', toStr)
      .eq('status', 'confirmed'),
    supabase
      .from('fixed_booking_suspensions')
      .select('*')
      .lte('suspended_from', toStr)
      .gte('suspended_until', fromStr),
    supabase
      .from('court_closures')
      .select('id, court_id, date_from, date_to, start_time, end_time, reason')
      .lte('date_from', toStr)
      .gte('date_to', fromStr),
  ]);

  if (courtsErr || fixedErr || bookingsErr || suspensionsErr || closuresErr) {
    console.error({ courtsErr, fixedErr, bookingsErr, suspensionsErr, closuresErr });
    return NextResponse.json({ error: 'Error al consultar la base de datos' }, { status: 500 });
  }

  const availability: CourtAvailability[] = [];
  let current = from;

  while (current <= to) {
    const dateStr = format(current, 'yyyy-MM-dd');
    const weekday = current.getDay(); // 0 = Sunday

    for (const court of courts!) {
      const slots = buildCourtSlots(
        dateStr,
        court.id,
        weekday,
        fixedBookings!,
        bookings!,
        suspensions!,
        closures!,
      );
      availability.push({ date: dateStr, courtId: court.id, courtName: court.name, slots });
    }

    current = addDays(current, 1);
  }

  return NextResponse.json({ availability });
}
