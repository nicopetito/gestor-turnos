import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

/**
 * POST /api/admin/users/info
 * Body: { phone }
 * Returns user data by phone.
 */
export async function POST(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const { phone } = await request.json();

  if (!phone?.trim()) {
    return NextResponse.json({ error: 'El campo phone es requerido' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, phone, blocked_until, created_at')
    .eq('phone', phone.trim())
    .single();

  if (error || !user) {
    return NextResponse.json(
      { error: 'No se encontró ningún usuario con ese teléfono' },
      { status: 404 },
    );
  }

  return NextResponse.json({ user });
}
