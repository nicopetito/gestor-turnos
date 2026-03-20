import { NextRequest, NextResponse } from 'next/server';
import { format, startOfDay } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

/**
 * GET /api/admin/fixed-bookings/suspensions
 * Returns all active suspensions (suspended_until >= today).
 */
export async function GET(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const supabase = await createServerSupabase();
  const today    = format(startOfDay(new Date()), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('fixed_booking_suspensions')
    .select('*')
    .gte('suspended_until', today)
    .order('suspended_from');

  if (error) {
    return NextResponse.json({ error: 'Error al obtener suspensiones' }, { status: 500 });
  }

  return NextResponse.json({ suspensions: data });
}
