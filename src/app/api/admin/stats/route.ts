import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  if (!validateAdminSession(req)) return unauthorizedResponse();

  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');  // yyyy-MM-dd
  const to   = searchParams.get('to');   // yyyy-MM-dd

  if (!from || !to) {
    return NextResponse.json({ error: 'Parámetros from y to requeridos' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('bookings')
    .select('date, status, duration_minutes, court_id, courts(name)')
    .gte('date', from)
    .lte('date', to)
    .order('date');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────

  // Por día
  const byDay: Record<string, { confirmed: number; cancelled: number; late_cancelled: number }> = {};
  // Por cancha
  const byCourt: Record<string, { name: string; confirmed: number }> = {};
  // Totales
  let totalConfirmed    = 0;
  let totalCancelled    = 0;
  let totalLate         = 0;
  let totalMinutes      = 0;

  for (const b of data ?? []) {
    // Por día
    if (!byDay[b.date]) byDay[b.date] = { confirmed: 0, cancelled: 0, late_cancelled: 0 };
    if (b.status === 'confirmed')      { byDay[b.date].confirmed++;      totalConfirmed++;  totalMinutes += b.duration_minutes; }
    if (b.status === 'cancelled')      { byDay[b.date].cancelled++;      totalCancelled++; }
    if (b.status === 'late_cancelled') { byDay[b.date].late_cancelled++; totalLate++; }

    // Por cancha
    if (b.status === 'confirmed') {
      const courtId   = String(b.court_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const courtName = (b.courts as any)?.name ?? `Cancha ${b.court_id}`;
      if (!byCourt[courtId]) byCourt[courtId] = { name: courtName, confirmed: 0 };
      byCourt[courtId].confirmed++;
    }
  }

  // Horas totales
  const totalHours = Math.round(totalMinutes / 60);

  // Días con al menos 1 reserva confirmada
  const activeDays = Object.values(byDay).filter((d) => d.confirmed > 0).length;

  // Promedio diario (sobre días activos)
  const avgPerDay = activeDays > 0 ? +(totalConfirmed / activeDays).toFixed(1) : 0;

  // Tasa de cancelación
  const totalAll = totalConfirmed + totalCancelled + totalLate;
  const cancelRate = totalAll > 0 ? Math.round(((totalCancelled + totalLate) / totalAll) * 100) : 0;

  return NextResponse.json({
    summary: { totalConfirmed, totalCancelled, totalLate, totalHours, avgPerDay, cancelRate },
    byDay,
    byCourt: Object.values(byCourt).sort((a, b) => b.confirmed - a.confirmed),
  });
}
