'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAdminKey } from '../layout';

type Period = 'week' | 'month' | 'last30' | 'last7';

type Summary = {
  totalConfirmed: number;
  totalCancelled: number;
  totalLate: number;
  totalHours: number;
  avgPerDay: number;
  cancelRate: number;
};

type DayData = { confirmed: number; cancelled: number; late_cancelled: number };
type CourtData = { name: string; confirmed: number };

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'last7',  label: 'Últimos 7 días'  },
  { value: 'last30', label: 'Últimos 30 días' },
  { value: 'week',   label: 'Esta semana'     },
  { value: 'month',  label: 'Este mes'        },
];

function getRange(period: Period): { from: string; to: string } {
  const today = new Date();
  const fmt   = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (period) {
    case 'last7':  return { from: fmt(subDays(today, 6)),              to: fmt(today) };
    case 'last30': return { from: fmt(subDays(today, 29)),             to: fmt(today) };
    case 'week':   return { from: fmt(startOfWeek(today, { weekStartsOn: 1 })), to: fmt(endOfWeek(today, { weekStartsOn: 1 })) };
    case 'month':  return { from: fmt(startOfMonth(today)),            to: fmt(endOfMonth(today)) };
  }
}

export default function EstadisticasPage() {
  const { adminKey } = useAdminKey();
  const [period, setPeriod]     = useState<Period>('last30');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [byDay, setByDay]       = useState<Record<string, DayData>>({});
  const [byCourt, setByCourt]   = useState<CourtData[]>([]);

  const fetchStats = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    const { from, to } = getRange(p);
    try {
      const res  = await fetch(`/api/admin/stats?adminKey=${encodeURIComponent(adminKey)}&from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data.summary);
      setByDay(data.byDay);
      setByCourt(data.byCourt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { fetchStats(period); }, [period, fetchStats]);

  // ── Build sorted day entries ───────────────────────────────────────────────
  const dayEntries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const maxConfirmed = Math.max(...dayEntries.map(([, d]) => d.confirmed), 1);

  const { from, to } = getRange(period);

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Estadísticas</h1>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={[
                'text-xs font-medium px-3 py-1.5 rounded-lg transition-all',
                period === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Range label */}
      <p className="text-xs text-gray-400 -mt-4">
        {format(parseISO(from), "d 'de' MMMM", { locale: es })} — {format(parseISO(to), "d 'de' MMMM yyyy", { locale: es })}
      </p>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-[3px] border-gray-200 border-t-gray-800 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Reservas confirmadas" value={summary.totalConfirmed} color="text-green-600" bar="bg-green-500" />
            <StatCard label="Horas de cancha"       value={`${summary.totalHours} h`} color="text-blue-600" bar="bg-blue-400" />
            <StatCard label="Promedio por día"      value={summary.avgPerDay}     color="text-indigo-600" bar="bg-indigo-400" />
            <StatCard label="Canceladas"            value={summary.totalCancelled} color="text-gray-500"  bar="bg-gray-300" />
            <StatCard label="Cancel. tardías"       value={summary.totalLate}      color="text-orange-500" bar="bg-orange-400" />
            <StatCard label="Tasa de cancelación"  value={`${summary.cancelRate}%`} color="text-red-500"  bar="bg-red-400" />
          </div>

          {/* Por cancha */}
          {byCourt.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Reservas por cancha</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {byCourt.map((c) => {
                  const pct = Math.round((c.confirmed / (summary.totalConfirmed || 1)) * 100);
                  return (
                    <div key={c.name} className="px-5 py-3.5 flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">{c.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-800 tabular-nums w-8 text-right">{c.confirmed}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gráfico por día */}
          {dayEntries.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Reservas por día</h2>
                <span className="text-xs text-gray-400">barras = confirmadas</span>
              </div>
              <div className="px-4 py-4 overflow-x-auto">
                <div className="flex items-end gap-1 min-w-max">
                  {dayEntries.map(([date, data]) => {
                    const height = Math.max(4, Math.round((data.confirmed / maxConfirmed) * 80));
                    const dayLabel = format(parseISO(date), 'd/M');
                    const dayName  = format(parseISO(date), 'EEE', { locale: es });
                    return (
                      <div key={date} className="flex flex-col items-center gap-1 group">
                        {/* Tooltip */}
                        <div className="hidden group-hover:flex flex-col items-center bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg mb-1 whitespace-nowrap shadow-lg">
                          <span className="font-semibold">{format(parseISO(date), "d 'de' MMM", { locale: es })}</span>
                          <span className="text-green-400">{data.confirmed} confirmada{data.confirmed !== 1 ? 's' : ''}</span>
                          {(data.cancelled + data.late_cancelled) > 0 && (
                            <span className="text-gray-400">{data.cancelled + data.late_cancelled} cancelada{data.cancelled + data.late_cancelled !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        {/* Bar */}
                        <div
                          className="w-6 bg-green-500 rounded-t-sm transition-all"
                          style={{ height: `${height}px` }}
                        />
                        {/* Label */}
                        <span className="text-[9px] text-gray-400 leading-none">{dayLabel}</span>
                        <span className="text-[9px] text-gray-300 leading-none capitalize">{dayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {summary.totalConfirmed === 0 && summary.totalCancelled === 0 && summary.totalLate === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl py-16 flex flex-col items-center gap-2 shadow-sm">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <p className="text-sm text-gray-400">Sin reservas en este período</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bar,
}: {
  label: string;
  value: number | string;
  color: string;
  bar: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm overflow-hidden relative">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar} rounded-l-xl`} />
      <p className={`text-2xl font-bold pl-2 ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1 pl-2 leading-tight">{label}</p>
    </div>
  );
}
