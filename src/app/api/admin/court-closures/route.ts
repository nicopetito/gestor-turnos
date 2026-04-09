import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';
import { format } from 'date-fns';
import { writeClosureToSheets } from '@/lib/sheets';

/**
 * GET /api/admin/court-closures
 * Returns all closures where date_to >= today, ordered by date_from ASC.
 */
export async function GET(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  const today = format(new Date(), 'yyyy-MM-dd');
  const supabase = await createServerSupabase();

  const { data: closures, error } = await supabase
    .from('court_closures')
    .select('*, courts(name)')
    .gte('date_to', today)
    .order('date_from', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Error al obtener cierres' }, { status: 500 });
  }

  return NextResponse.json({ closures });
}

/**
 * POST /api/admin/court-closures
 * Body: { courtId, dateFrom, dateTo, startTime, endTime, reason? }
 * Creates a new court closure for a date range.
 */
export async function POST(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();

  let body: {
    courtId: string | number;
    dateFrom: string;
    dateTo: string;
    startTime: string;
    endTime: string;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { courtId: courtIdRaw, dateFrom, dateTo, startTime, endTime, reason } = body;
  const courtId = Number(courtIdRaw);

  if (!courtId || !dateFrom || !dateTo || !startTime || !endTime) {
    return NextResponse.json(
      { error: 'Los campos courtId, dateFrom, dateTo, startTime y endTime son requeridos' },
      { status: 400 },
    );
  }

  if (dateFrom > dateTo) {
    return NextResponse.json(
      { error: 'La fecha de inicio debe ser anterior o igual a la fecha de fin' },
      { status: 400 },
    );
  }

  if (startTime >= endTime) {
    return NextResponse.json(
      { error: 'La hora de inicio debe ser anterior a la hora de fin' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();

  const { data: closure, error } = await supabase
    .from('court_closures')
    .insert({
      court_id:   courtId,
      date_from:  dateFrom,
      date_to:    dateTo,
      start_time: startTime,
      end_time:   endTime,
      reason:     reason ?? null,
    })
    .select('*, courts(name)')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Error al crear el cierre' }, { status: 500 });
  }

  // Update Google Sheets (non-blocking)
  writeClosureToSheets({
    date_from: dateFrom,
    date_to: dateTo,
    court_name: (closure.courts as { name: string } | null)?.name ?? '',
    start_time: startTime,
    end_time: endTime,
    reason: reason ?? 'Mantenimiento',
  }).catch((err) => console.error('[sheets] writeClosureToSheets error:', err));

  return NextResponse.json({ closure }, { status: 201 });
}
