import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';
import { clearClosureFromSheets } from '@/lib/sheets';

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

  // Fetch before deleting to get slot info for sheets
  const { data: closure } = await supabase
    .from('court_closures')
    .select('*, courts(name)')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('court_closures')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar el cierre' }, { status: 500 });
  }

  if (closure) {
    const courtName = (closure.courts as { name: string } | null)?.name ?? '';
    console.log('[sheets] clearing closure:', {
      date_from: closure.date_from,
      date_to: closure.date_to,
      court_name: courtName,
      start_time: closure.start_time,
      end_time: closure.end_time,
    });
    clearClosureFromSheets({
      date_from: closure.date_from,
      date_to: closure.date_to,
      court_name: courtName,
      start_time: closure.start_time,
      end_time: closure.end_time,
    }).then(() => {
      console.log('[sheets] clearClosureFromSheets OK');
    }).catch((err) => console.error('[sheets] clearClosureFromSheets error:', err));
  }

  return NextResponse.json({ message: 'Cierre eliminado' });
}
