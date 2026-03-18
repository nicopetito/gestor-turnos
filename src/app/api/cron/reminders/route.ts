import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { notifyBookingReminder } from '@/lib/notifications';
import { format, addDays } from 'date-fns';

/**
 * GET /api/cron/reminders
 * Llamado por Vercel Cron todos los días a las 10:00 AM (ARG, UTC-3 → 13:00 UTC).
 * Envía un recordatorio por email a todos los turnos confirmados del día siguiente que tengan email.
 */
export async function GET(req: NextRequest) {
  // Verificar que la llamada viene de Vercel Cron o de un admin manual
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const tomorrow    = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const supabase    = await createServerSupabase();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, date, start_time, end_time, duration_minutes, users(name, email), courts(name)')
    .eq('date', tomorrow)
    .eq('status', 'confirmed');

  if (error) {
    console.error('[cron/reminders] Supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent    = 0;
  let skipped = 0;

  for (const b of bookings ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user  = (b.users as any) as { name: string; email: string | null } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const court = (b.courts as any) as { name: string } | null;

    if (!user?.email) { skipped++; continue; }

    await notifyBookingReminder({
      name:            user.name,
      email:           user.email,
      date:            b.date,
      courtName:       court?.name ?? 'Cancha',
      startTime:       b.start_time.slice(0, 5),
      endTime:         b.end_time.slice(0, 5),
      durationMinutes: b.duration_minutes,
    });

    sent++;
  }

  console.log(`[cron/reminders] ${tomorrow}: ${sent} enviados, ${skipped} sin email`);
  return NextResponse.json({ date: tomorrow, sent, skipped });
}
