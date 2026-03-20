import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';
import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns';

// 3 canchas × 30 slots de 30 min cada día
const COURTS_COUNT   = 3;
const SLOTS_PER_COURT_PER_DAY = 30;

export async function GET(req: NextRequest) {
  if (!validateAdminSession(req)) return unauthorizedResponse();

  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Parámetros from y to requeridos' }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('bookings')
    .select('id, date, status, duration_minutes, court_id, user_id, courts(id, name), users(id, name, phone)')
    .gte('date', from)
    .lte('date', to)
    .order('date');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // ── Días del período ──────────────────────────────────────────────────────
  const totalDays = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;

  // ── byDay ─────────────────────────────────────────────────────────────────
  const byDayMap: Record<string, { date: string; confirmed: number; cancelled: number }> = {};

  // Inicializar todos los días del rango (para que aparezcan en el gráfico)
  for (let i = 0; i < totalDays; i++) {
    const d = format(addDays(parseISO(from), i), 'yyyy-MM-dd');
    byDayMap[d] = { date: d, confirmed: 0, cancelled: 0 };
  }

  // ── byCourt ───────────────────────────────────────────────────────────────
  type CourtAcc = {
    courtId: string;
    courtName: string;
    confirmed: number;
    cancelled: number;
    lateCancelled: number;
    slotsUsed: number;
  };
  const byCourtMap: Record<string, CourtAcc> = {};

  // ── topUsers ──────────────────────────────────────────────────────────────
  type UserAcc = { name: string; phone: string; confirmed: number; lateCancelled: number };
  const topUsersMap: Record<string, UserAcc> = {};

  // ── Totales ────────────────────────────────────────────────────────────────
  let totalConfirmed  = 0;
  let totalCancelled  = 0;
  let totalLate       = 0;
  let totalSlotsUsed  = 0;

  for (const b of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courtRaw = b.courts as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRaw  = b.users as any;

    const courtId   = String(b.court_id);
    const courtName = courtRaw?.name ?? `Cancha ${b.court_id}`;
    const userId    = String(b.user_id);
    const userName  = userRaw?.name  ?? 'Desconocido';
    const userPhone = userRaw?.phone ?? '';

    // byDay
    if (byDayMap[b.date]) {
      if (b.status === 'confirmed')                         byDayMap[b.date].confirmed++;
      if (b.status === 'cancelled' || b.status === 'late_cancelled') byDayMap[b.date].cancelled++;
    }

    // byCourt
    if (!byCourtMap[courtId]) {
      byCourtMap[courtId] = { courtId, courtName, confirmed: 0, cancelled: 0, lateCancelled: 0, slotsUsed: 0 };
    }
    if (b.status === 'confirmed') {
      byCourtMap[courtId].confirmed++;
      const slots = Math.round(b.duration_minutes / 30);
      byCourtMap[courtId].slotsUsed += slots;
      totalSlotsUsed += slots;
      totalConfirmed++;
    }
    if (b.status === 'cancelled')      { byCourtMap[courtId].cancelled++;     totalCancelled++; }
    if (b.status === 'late_cancelled') { byCourtMap[courtId].lateCancelled++; totalLate++; }

    // topUsers (solo confirmed + lateCancelled son relevantes)
    if (b.status === 'confirmed' || b.status === 'late_cancelled') {
      if (!topUsersMap[userId]) topUsersMap[userId] = { name: userName, phone: userPhone, confirmed: 0, lateCancelled: 0 };
      if (b.status === 'confirmed')      topUsersMap[userId].confirmed++;
      if (b.status === 'late_cancelled') topUsersMap[userId].lateCancelled++;
    }
  }

  // ── Ocupación ─────────────────────────────────────────────────────────────
  const totalSlotsAvailable = COURTS_COUNT * SLOTS_PER_COURT_PER_DAY * totalDays;
  const occupancyRate = totalSlotsAvailable > 0
    ? Math.round((totalSlotsUsed / totalSlotsAvailable) * 100)
    : 0;

  const slotsPerCourtTotal = SLOTS_PER_COURT_PER_DAY * totalDays;
  const byCourt = Object.values(byCourtMap).map((c) => ({
    courtId:      c.courtId,
    courtName:    c.courtName,
    confirmed:    c.confirmed,
    cancelled:    c.cancelled,
    lateCancelled: c.lateCancelled,
    occupancyRate: slotsPerCourtTotal > 0
      ? Math.round((c.slotsUsed / slotsPerCourtTotal) * 100)
      : 0,
  })).sort((a, b) => b.confirmed - a.confirmed);

  // Cancha más usada
  const topCourt = byCourt[0] ?? null;

  const topUsers = Object.values(topUsersMap)
    .sort((a, b) => b.confirmed - a.confirmed)
    .slice(0, 10);

  // ── Métricas adicionales ──────────────────────────────────────────────────
  const totalHours  = Math.round(totalSlotsUsed * 30 / 60);
  const activeDays  = Object.values(byDayMap).filter((d) => d.confirmed > 0).length;
  const avgPerDay   = activeDays > 0 ? +(totalConfirmed / activeDays).toFixed(1) : 0;
  const totalAll    = totalConfirmed + totalCancelled + totalLate;
  const cancelRate  = totalAll > 0 ? Math.round(((totalCancelled + totalLate) / totalAll) * 100) : 0;

  return NextResponse.json({
    summary: {
      confirmed:     totalConfirmed,
      cancelled:     totalCancelled,
      lateCancelled: totalLate,
      occupancyRate,
      topCourt:      topCourt ? { name: topCourt.courtName, confirmed: topCourt.confirmed } : null,
      totalHours,
      avgPerDay,
      cancelRate,
    },
    byDay:     Object.values(byDayMap),
    byCourt,
    topUsers,
  });
}
