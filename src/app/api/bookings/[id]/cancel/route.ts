import { NextRequest, NextResponse } from 'next/server';
import { differenceInHours, parseISO } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import { notifyBookingCancelled } from '@/lib/notifications';
import { clearBookingFromSheet } from '@/lib/sheets';
import type { CancelBookingBody } from '@/types';

/**
 * POST /api/bookings/:id/cancel
 * Body: { phone: string }
 *
 * - Validates ownership via phone.
 * - If < 24 h before start → status = 'late_cancelled'
 * - If ≥ 24 h before start → status = 'cancelled'
 * - Does NOT auto-block users.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: CancelBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { phone } = body;
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'El campo phone es requerido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  // Fetch booking with joined user and court
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('*, users(name, phone, email), courts(name)')
    .eq('id', id)
    .single();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  // Ownership check
  if (booking.users?.phone !== phone.trim()) {
    return NextResponse.json(
      { error: 'No tenés permiso para cancelar esta reserva' },
      { status: 403 },
    );
  }

  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'La reserva ya fue cancelada' }, { status: 400 });
  }

  // 24-hour rule
  const bookingDateTime  = parseISO(`${booking.date}T${booking.start_time}`);
  const hoursUntil       = differenceInHours(bookingDateTime, new Date());
  const isLate           = hoursUntil < 24;
  const newStatus        = isLate ? 'late_cancelled' : 'cancelled';

  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ status: newStatus, cancelled_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: 'Error al cancelar la reserva' }, { status: 500 });
  }

  // Update Google Sheets (non-blocking)
  clearBookingFromSheet({
    date: booking.date,
    start_time: booking.start_time,
    duration_minutes: booking.duration_minutes,
    court_name: booking.courts?.name ?? '',
  }).catch((err) => console.error('[sheets] clearBookingFromSheet error:', err));

  // Send email notification (non-blocking)
  if (booking.users?.email) {
    notifyBookingCancelled({
      name:      booking.users.name,
      email:     booking.users.email,
      date:      booking.date,
      courtName: booking.courts?.name ?? `Cancha ${booking.court_id}`,
      startTime: booking.start_time.slice(0, 5),
      isLate,
    });
  }

  return NextResponse.json({
    status: newStatus,
    message: isLate
      ? 'Reserva cancelada. Nota: la cancelación fue con menos de 24 h de anticipación.'
      : 'Reserva cancelada exitosamente.',
  });
}
