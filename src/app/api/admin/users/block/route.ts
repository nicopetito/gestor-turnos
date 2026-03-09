import { NextRequest, NextResponse } from 'next/server';
import { parseISO, isValid } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import type { BlockUserBody } from '@/types';

/**
 * POST /api/admin/users/block
 * Body: { adminKey, phone, blocked_until }
 *
 * Sets blocked_until on a user. Pass null to unblock.
 * Protected by a static admin key stored in ADMIN_SECRET_KEY env var.
 */
export async function POST(request: NextRequest) {
  let body: BlockUserBody & { blocked_until: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { adminKey, phone, blocked_until } = body;

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!phone?.trim()) {
    return NextResponse.json({ error: 'El campo phone es requerido' }, { status: 400 });
  }

  // blocked_until can be null (unblock) or a valid date string
  if (blocked_until !== null) {
    if (typeof blocked_until !== 'string' || !isValid(parseISO(blocked_until))) {
      return NextResponse.json(
        { error: 'blocked_until debe ser una fecha válida en formato YYYY-MM-DD o null' },
        { status: 400 },
      );
    }
  }

  const supabase = await createServerSupabase();

  const { data: user, error } = await supabase
    .from('users')
    .update({ blocked_until })
    .eq('phone', phone.trim())
    .select()
    .single();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Usuario no encontrado con ese teléfono' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    user,
    message: blocked_until
      ? `Usuario bloqueado hasta ${blocked_until}`
      : 'Usuario desbloqueado',
  });
}
