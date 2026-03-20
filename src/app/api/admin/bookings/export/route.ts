import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { validateAdminSession, unauthorizedResponse } from '@/lib/admin-auth';

const STATUS_LABELS: Record<string, string> = {
  confirmed:      'Confirmada',
  cancelled:      'Cancelada',
  late_cancelled: 'Cancelación tardía',
};

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

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
    .select('date, start_time, end_time, duration_minutes, status, courts(name), users(name, phone, email)')
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('start_time');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  const header = ['Fecha', 'Cancha', 'Hora inicio', 'Hora fin', 'Duración (min)', 'Nombre jugador', 'Teléfono', 'Email', 'Estado'];

  const lines: string[] = [
    header.map(escapeCsv).join(','),
    ...rows.map((b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const court = b.courts as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user  = b.users  as any;
      return [
        b.date,
        court?.name ?? '',
        b.start_time.slice(0, 5),
        b.end_time.slice(0, 5),
        b.duration_minutes,
        user?.name  ?? '',
        user?.phone ?? '',
        user?.email ?? '',
        STATUS_LABELS[b.status] ?? b.status,
      ].map(escapeCsv).join(',');
    }),
  ];

  const csv = '\uFEFF' + lines.join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reservas-${from}-al-${to}.csv"`,
    },
  });
}
