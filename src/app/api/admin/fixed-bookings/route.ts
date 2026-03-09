import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { timeToMinutes } from '@/lib/slots';
import type { CreateFixedBookingBody, Duration } from '@/types';

const VALID_DURATIONS: Duration[] = [60, 90, 120];

/**
 * GET /api/admin/fixed-bookings?adminKey=KEY
 * Lists all fixed bookings.
 */
export async function GET(request: NextRequest) {
  const adminKey = new URL(request.url).searchParams.get('adminKey');
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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
 * Body: { adminKey, court_id, weekday, start_time, duration_minutes, label? }
 *
 * Creates a recurring fixed booking (class) for a court on a given weekday.
 */
export async function POST(request: NextRequest) {
  let body: CreateFixedBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { adminKey, court_id, weekday, start_time, duration_minutes, label } = body;

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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

  return NextResponse.json({ fixedBooking: data }, { status: 201 });
}

/**
 * DELETE /api/admin/fixed-bookings?adminKey=KEY&id=ID
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminKey = searchParams.get('adminKey');
  const id       = searchParams.get('id');

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: 'El parámetro id es requerido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('fixed_bookings').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar la clase fija' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Clase fija eliminada' });
}
