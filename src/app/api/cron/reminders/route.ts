import { NextRequest, NextResponse } from 'next/server';
import { format, addDays, startOfDay } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import { notifyBookingReminder } from '@/lib/notifications';

/**
 * GET /api/cron/reminders
 *
 * Envía recordatorios por email a todos los usuarios con reservas confirmadas
 * para el día siguiente.
 *
 * Llamado por el cron de Vercel (ver vercel.json).
 * Protegido con header: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const tomorrow = format(addDays(startOfDay(new Date()), 1), 'yyyy-MM-dd');

  const supabase = await createServerSupabase();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, users(name, email), courts(name)')
    .eq('date', tomorrow)
    .eq('status', 'confirmed');

  if (error) {
    console.error('[cron/reminders] Error al consultar bookings:', error);
    return NextResponse.json({ error: 'Error al consultar reservas' }, { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const booking of bookings ?? []) {
    const user  = booking.users as { name: string; email: string | null } | null;
    const court = booking.courts as { name: string } | null;

    if (!user?.email) continue;

    try {
      await notifyBookingReminder({
        name:            user.name,
        email:           user.email,
        date:            booking.date,
        courtName:       court?.name ?? `Cancha ${booking.court_id}`,
        startTime:       booking.start_time.slice(0, 5),
        endTime:         booking.end_time.slice(0, 5),
        durationMinutes: booking.duration_minutes,
      });
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/reminders] Error enviando a ${user.email}:`, msg);
      errors.push(`${user.email}: ${msg}`);
    }
  }

  console.log(`[cron/reminders] Recordatorios enviados: ${sent} / ${(bookings ?? []).length}`);

  return NextResponse.json({ sent, errors, date: tomorrow });
}
