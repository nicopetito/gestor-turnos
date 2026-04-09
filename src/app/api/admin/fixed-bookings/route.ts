import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';
import { timeToMinutes } from '@/lib/slots';
import { writeFixedBookingToSheets, clearFixedBookingFromSheets } from '@/lib/sheets';
import type { CreateFixedBookingBody, Duration } from '@/types';

const VALID_DURATIONS: Duration[] = [60, 90, 120];

/**
 * GET /api/admin/fixed-bookings
 * Lists all fixed bookings.
 */
export async function GET(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('fixed_bookings')
    .select('*, courts(name)')
    .order('court_id')
    .order('weekday')
    .order('start_time');

  if (error) {
    return NextResponse.json({ error: 'Error al obtener clases fijas' }, { status: 500 });
  }

  return NextResponse.json({ fixedBookings: data });
}

/**
 * POST /api/admin/fixed-bookings
 * Body: { court_id, weekday, start_time, duration_minutes, label? }
 *
 * Creates a recurring fixed booking (class) for a court on a given weekday.
 */
export async function POST(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  let body: CreateFixedBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { court_id, weekday, start_time, duration_minutes, label } = body;

  if (!court_id || weekday === undefined || !start_time || !duration_minutes) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  if (typeof weekday !== 'number' || weekday < 0 || weekday > 6) {
    return NextResponse.json(
      { error: 'weekday debe ser un número entre 0 (domingo) y 6 (sábado)' },
      { status: 400 },
    );
  }

  if (!VALID_DURATIONS.includes(duration_minutes)) {
    return NextResponse.json(
      { error: 'Duración inválida. Permitidas: 60, 90 o 120 minutos' },
      { status: 400 },
    );
  }

  const startMin = timeToMinutes(start_time);
  const endMin   = startMin + duration_minutes;

  if (startMin < 8 * 60 || endMin > 23 * 60 || startMin % 30 !== 0) {
    return NextResponse.json(
      { error: 'Horario fuera de rango o no alineado a bloques de 30 minutos' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('fixed_bookings')
    .insert({
      court_id,
      weekday,
      start_time: start_time.length === 5 ? start_time + ':00' : start_time,
      duration_minutes,
      label: label?.trim() || 'Clase',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe una clase fija en esa cancha, día y horario' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Error al crear la clase fija' }, { status: 500 });
  }

  // Fetch court name for sheets
  const { data: court } = await supabase.from('courts').select('name').eq('id', court_id).single();
  const courtName = court?.name ?? '';

  // Update Google Sheets (non-blocking)
  writeFixedBookingToSheets({
    weekday,
    court_name: courtName,
    start_time: data.start_time,
    duration_minutes,
    label: data.label,
  }).catch((err) => console.error('[sheets] writeFixedBookingToSheets error:', err));

  return NextResponse.json({ fixedBooking: data }, { status: 201 });
}

/**
 * DELETE /api/admin/fixed-bookings?id=ID
 */
export async function DELETE(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'El parámetro id es requerido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  // Fetch before deleting to get court name and slot info for sheets
  const { data: fb } = await supabase
    .from('fixed_bookings')
    .select('*, courts(name)')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('fixed_bookings').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar la clase fija' }, { status: 500 });
  }

  if (fb) {
    const courtName = (fb.courts as { name: string } | null)?.name ?? '';
    clearFixedBookingFromSheets({
      weekday: fb.weekday,
      court_name: courtName,
      start_time: fb.start_time,
      duration_minutes: fb.duration_minutes,
    }).catch((err) => console.error('[sheets] clearFixedBookingFromSheets error:', err));
  }

  return NextResponse.json({ message: 'Clase fija eliminada' });
}
