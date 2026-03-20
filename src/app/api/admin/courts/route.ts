import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

/**
 * GET /api/admin/courts
 * Returns all courts ordered by id.
 */
export async function GET(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const supabase = await createServerSupabase();
  const { data: courts, error } = await supabase
    .from('courts')
    .select('id, name')
    .order('id');

  if (error) {
    return NextResponse.json({ error: 'Error al obtener canchas' }, { status: 500 });
  }

  return NextResponse.json({ courts });
}
