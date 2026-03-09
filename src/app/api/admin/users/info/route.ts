import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * POST /api/admin/users/info
 * Body: { adminKey, phone }
 * Returns user data by phone.
 */
export async function POST(request: NextRequest) {
  const { adminKey, phone } = await request.json();

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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
