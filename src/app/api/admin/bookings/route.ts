import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/admin/bookings?adminKey=KEY&date=YYYY-MM-DD
 * Returns all bookings for a given date with user and court info.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminKey = searchParams.get('adminKey');
  const date     = searchParams.get('date');

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!date) {
    return NextResponse.json({ error: 'El parámetro date es requerido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, users(name, phone), courts(name)')
    .eq('date', date)
    .order('start_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 });
  }

  return NextResponse.json({ bookings });
}

/**
 * DELETE /api/admin/bookings/:id — cancel any booking as admin
 * Body: { adminKey, reason? }
 */
export async function DELETE(request: NextRequest) {
  const { adminKey, bookingId } = await request.json();

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) {
    return NextResponse.json({ error: 'Error al cancelar la reserva' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Reserva cancelada por admin' });
}
