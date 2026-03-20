import { NextRequest, NextResponse } from 'next/server';
import { addDays, format, startOfDay } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

const VALID_WEEKS = [1, 2, 3];

/**
 * POST /api/admin/fixed-bookings/[id]/suspend
 * Body: { weeks: 1 | 2 | 3 }
 *
 * Suspends a fixed booking starting today for N weeks.
 * During that period the slot is free for regular bookings.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const { id } = await params;
  let body: { weeks: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { weeks } = body;

  if (!VALID_WEEKS.includes(weeks)) {
    return NextResponse.json(
      { error: 'Semanas inválidas. Permitidas: 1, 2 o 3' },
      { status: 400 },
    );
  }

  const fixedBookingId = Number(id);
  if (!fixedBookingId) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  // Verify the fixed booking exists
  const { data: fb, error: fbErr } = await supabase
    .from('fixed_bookings')
    .select('id')
    .eq('id', fixedBookingId)
    .single();

  if (fbErr || !fb) {
    return NextResponse.json({ error: 'Clase fija no encontrada' }, { status: 404 });
  }

  const today          = startOfDay(new Date());
  const suspendedFrom  = format(today, 'yyyy-MM-dd');
  const suspendedUntil = format(addDays(today, weeks * 7 - 1), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('fixed_booking_suspensions')
    .insert({ fixed_booking_id: fixedBookingId, suspended_from: suspendedFrom, suspended_until: suspendedUntil })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Error al crear la suspensión' }, { status: 500 });
  }

  return NextResponse.json({ suspension: data }, { status: 201 });
}

/**
 * DELETE /api/admin/fixed-bookings/[id]/suspend
 *
 * Removes all active suspensions for a fixed booking (reactivates it).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const { id } = await params;

  const fixedBookingId = Number(id);
  if (!fixedBookingId) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const today    = format(startOfDay(new Date()), 'yyyy-MM-dd');

  // Delete suspensions that are still active (suspended_until >= today)
  const { error } = await supabase
    .from('fixed_booking_suspensions')
    .delete()
    .eq('fixed_booking_id', fixedBookingId)
    .gte('suspended_until', today);

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar la suspensión' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Suspensión eliminada' });
}
