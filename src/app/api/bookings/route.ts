import { NextRequest, NextResponse } from 'next/server';
import { addDays, parseISO, startOfDay } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import { timeToMinutes, minutesToTime } from '@/lib/slots';
import { notifyBookingConfirmed } from '@/lib/notifications';
import type { CreateBookingBody, Duration } from '@/types';

const VALID_DURATIONS: Duration[] = [60, 90, 120];
const OPEN_MINUTES  = 8  * 60; // 08:00
const CLOSE_MINUTES = 23 * 60; // 23:00

/**
 * GET /api/bookings?phone=PHONE
 * Returns all bookings for a user identified by phone.
 */
export async function GET(request: NextRequest) {
  const phone = new URL(request.url).searchParams.get('phone');

  if (!phone) {
    return NextResponse.json({ error: 'El parámetro phone es requerido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone.trim())
    .single();

  if (!user) {
    return NextResponse.json({ bookings: [] });
  }

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, courts(name)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 });
  }

  return NextResponse.json({ bookings });
}

/**
 * POST /api/bookings
 * Creates a new booking with full validation.
 */
export async function POST(request: NextRequest) {
  let body: CreateBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { court_id, date, start_time, duration_minutes, name, phone, email } = body;

  // --- Required fields ---
  if (!court_id || !date || !start_time || !duration_minutes || !name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
  }

  // --- Duration ---
  if (!VALID_DURATIONS.includes(duration_minutes)) {
    return NextResponse.json(
      { error: 'Duración inválida. Permitidas: 60, 90 o 120 minutos' },
      { status: 400 },
    );
  }

  // --- Date range: today … today + 7 days ---
  const today   = startOfDay(new Date());
  const maxDate = addDays(today, 7);
  const bookingDate = startOfDay(parseISO(date));

  if (bookingDate < today || bookingDate > maxDate) {
    return NextResponse.json(
      { error: 'Solo se pueden reservar turnos dentro de los próximos 7 días' },
      { status: 400 },
    );
  }

  // --- Time range: 08:00–23:00, 30-min boundary ---
  const startMin = timeToMinutes(start_time);
  const endMin   = startMin + duration_minutes;

  if (startMin % 30 !== 0) {
    return NextResponse.json(
      { error: 'El horario de inicio debe coincidir con un bloque de 30 minutos' },
      { status: 400 },
    );
  }
  if (startMin < OPEN_MINUTES || endMin > CLOSE_MINUTES) {
    return NextResponse.json(
      { error: 'El turno debe estar dentro del horario 08:00–23:00' },
      { status: 400 },
    );
  }

  const end_time = minutesToTime(endMin);
  const supabase = await createServerSupabase();

  // --- Get or create user ---
  let { data: user, error: userFetchErr } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone.trim())
    .single();

  if (userFetchErr && userFetchErr.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Error al buscar el usuario' }, { status: 500 });
  }

  if (!user) {
    const { data: newUser, error: createErr } = await supabase
      .from('users')
      .insert({ name: name.trim(), phone: phone.trim(), email: email?.trim() || null })
      .select()
      .single();

    if (createErr) {
      return NextResponse.json({ error: 'Error al registrar el usuario' }, { status: 500 });
    }
    user = newUser;
  } else if (email?.trim() && !user.email) {
    // Update email if user exists but didn't have one yet
    await supabase.from('users').update({ email: email.trim() }).eq('id', user.id);
    user = { ...user, email: email.trim() };
  }

  // --- Blocked user ---
  if (user.blocked_until) {
    const blockedUntil = startOfDay(parseISO(user.blocked_until));
    if (bookingDate <= blockedUntil) {
      return NextResponse.json(
        { error: `Tu cuenta está bloqueada hasta el ${user.blocked_until}` },
        { status: 403 },
      );
    }
  }

  // --- One booking per user per day ---
  const { data: existingForDay } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .eq('status', 'confirmed')
    .maybeSingle();

  if (existingForDay) {
    return NextResponse.json(
      { error: 'Ya tenés una reserva confirmada para ese día' },
      { status: 409 },
    );
  }

  // --- Fixed booking conflict ---
  const weekday = bookingDate.getDay();
  const { data: fixedBookings } = await supabase
    .from('fixed_bookings')
    .select('*')
    .eq('court_id', court_id)
    .eq('weekday', weekday);

  for (const fb of fixedBookings ?? []) {
    const fbStart = timeToMinutes(fb.start_time);
    const fbEnd   = fbStart + fb.duration_minutes;
    if (startMin < fbEnd && endMin > fbStart) {
      return NextResponse.json(
        { error: `Ese horario está ocupado por una clase fija: "${fb.label}"` },
        { status: 409 },
      );
    }
  }

  // --- Overlapping confirmed bookings ---
  const { data: overlapping } = await supabase
    .from('bookings')
    .select('id')
    .eq('court_id', court_id)
    .eq('date', date)
    .eq('status', 'confirmed')
    .lt('start_time', end_time + ':00')    // start_time < new end
    .gt('end_time',   start_time + ':00'); // end_time   > new start

  if (overlapping && overlapping.length > 0) {
    return NextResponse.json(
      { error: 'Ese horario ya está reservado en esa cancha' },
      { status: 409 },
    );
  }

  // --- Create booking ---
  const { data: booking, error: insertErr } = await supabase
    .from('bookings')
    .insert({
      court_id,
      user_id: user.id,
      date,
      start_time: start_time.length === 5 ? start_time + ':00' : start_time,
      end_time:   end_time   + ':00',
      duration_minutes,
      status: 'confirmed',
    })
    .select()
    .single();

  if (insertErr) {
    // Unique constraint violations surface here as a 409
    if (insertErr.code === '23505') {
      return NextResponse.json(
        { error: 'Ese horario ya está reservado (conflicto de concurrencia)' },
        { status: 409 },
      );
    }
    console.error(insertErr);
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
  }

  // Send email confirmation (non-blocking — never fails the request)
  if (user.email) {
    const { data: court } = await supabase.from('courts').select('name').eq('id', court_id).single();
    const courtName = court?.name ?? `Cancha ${court_id}`;
    notifyBookingConfirmed({
      name:            user.name,
      email:           user.email,
      date,
      courtName,
      startTime:       start_time.slice(0, 5),
      endTime:         end_time,
      durationMinutes: duration_minutes,
    });
  }

  return NextResponse.json({ booking }, { status: 201 });
}
