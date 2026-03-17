import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? 'admin123';

function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

/**
 * GET /api/admin/prices?adminKey=…
 */
export async function GET(request: NextRequest) {
  const adminKey = new URL(request.url).searchParams.get('adminKey');
  if (adminKey !== ADMIN_KEY) return unauthorized();

  const supabase = await createServerSupabase();

  const [{ data: prices }, { data: settings }] = await Promise.all([
    supabase.from('prices').select('*').order('is_member', { ascending: false }).order('duration_minutes'),
    supabase.from('settings').select('*'),
  ]);

  const luzStartTime =
    settings?.find((s) => s.key === 'luz_start_time')?.value ?? '19:00';

  return NextResponse.json({ prices: prices ?? [], luzStartTime });
}

/**
 * PUT /api/admin/prices
 * Body: { adminKey, prices: [{ id, amount }], luzStartTime }
 */
export async function PUT(request: NextRequest) {
  let body: {
    adminKey: string;
    prices: { id: number; amount: number }[];
    luzStartTime: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (body.adminKey !== ADMIN_KEY) return unauthorized();

  const supabase = await createServerSupabase();

  // Update each price row individually
  for (const { id, amount } of body.prices) {
    if (typeof amount !== 'number' || amount < 0) continue;
    await supabase
      .from('prices')
      .update({ amount, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  // Update luz_start_time setting
  if (body.luzStartTime) {
    await supabase
      .from('settings')
      .upsert({ key: 'luz_start_time', value: body.luzStartTime });
  }

  return NextResponse.json({ ok: true });
}
