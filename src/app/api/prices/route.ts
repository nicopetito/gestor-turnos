import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/prices
 * Returns all price rows + the luz_start_time setting.
 * Public – no auth required.
 */
export async function GET() {
  const supabase = await createServerSupabase();

  const [{ data: prices }, { data: settings }] = await Promise.all([
    supabase.from('prices').select('*').order('is_member', { ascending: false }).order('duration_minutes'),
    supabase.from('settings').select('*'),
  ]);

  const luzStartTime =
    settings?.find((s) => s.key === 'luz_start_time')?.value ?? '19:00';

  return NextResponse.json({ prices: prices ?? [], luzStartTime });
}
