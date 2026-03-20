import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

/**
 * DELETE /api/admin/court-closures/[id]
 * Deletes a court closure by id.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const { id } = await params;
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('court_closures')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar el cierre' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Cierre eliminado' });
}
