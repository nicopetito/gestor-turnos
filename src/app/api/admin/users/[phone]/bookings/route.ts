import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

/**
 * GET /api/admin/users/[phone]/bookings
 * Returns all bookings for a user identified by phone, ordered by date DESC.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const { phone } = await params;
  const decodedPhone = decodeURIComponent(phone);

  const supabase = await createServerSupabase();

  // Look up user by phone
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('phone', decodedPhone)
    .single();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'No se encontró ningún usuario con ese teléfono' },
      { status: 404 },
    );
  }

  // Fetch all bookings with court name
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, date, start_time, end_time, status, courts(name)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }

  return NextResponse.json({ bookings });
}
