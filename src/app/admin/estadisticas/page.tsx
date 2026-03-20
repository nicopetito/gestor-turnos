'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────────────
type Period = 'last7' | 'last30' | 'week' | 'month' | 'custom';

type Summary = {
  confirmed:     number;
  cancelled:     number;
  lateCancelled: number;
  occupancyRate: number;
  topCourt:      { name: string; confirmed: number } | null;
  totalHours:    number;
  avgPerDay:     number;
  cancelRate:    number;
};

type DayData    = { date: string; confirmed: number; cancelled: number };
type CourtData  = { courtId: string; courtName: string; confirmed: number; cancelled: number; lateCancelled: number; occupancyRate: number };
type UserData   = { name: string; phone: string; confirmed: number; lateCancelled: number };

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'last7',  label: 'Últimos 7 días'  },
  { value: 'last30', label: 'Últimos 30 días' },
  { value: 'week',   label: 'Esta semana'     },
  { value: 'month',  label: 'Este mes'        },
  { value: 'custom', label: 'Personalizado'   },
];

function getRange(period: Exclude<Period, 'custom'>): { from: string; to: string } {
  const today = new Date();
  switch (period) {
    case 'last7':  return { from: fmt(subDays(today, 6)),                              to: fmt(today) };
    case 'last30': return { from: fmt(subDays(today, 29)),                             to: fmt(today) };
    case 'week':   return { from: fmt(startOfWeek(today, { weekStartsOn: 1 })),        to: fmt(endOfWeek(today, { weekStartsOn: 1 })) };
    case 'month':  return { from: fmt(startOfMonth(today)),                            to: fmt(endOfMonth(today)) };
  }
}

function StatCard({
  label, value, color, bar, sub,
}: { label: string; value: string | number; color: string; bar: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm overflow-hidden relative">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar} rounded-l-xl`} />
      <p className={`text-2xl sm:text-3xl font-bold pl-2 ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1 pl-2 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-gray-300 pl-2 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EstadisticasPage() {
  const todayStr = fmt(new Date());

  const [period,   setPeriod]   = useState<Period>('last30');
  const [customFrom, setCustomFrom] = useState(fmt(subDays(new Date(), 29)));
  const [customTo,   setCustomTo]   = useState(todayStr);

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [summary,   setSummary]   = useState<Summary | null>(null);
  const [byDay,     setByDay]     = useState<DayData[]>([]);
  const [byCourt,   setByCourt]   = useState<CourtData[]>([]);
  const [topUsers,  setTopUsers]  = useState<UserData[]>([]);
  const [exporting, setExporting] = useState(false);

  // Rango activo (el último consultado)
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo,   setActiveTo]   = useState('');

  const fetchStats = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/reports?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar estadísticas');
      setSummary(data.summary);
      setByDay(data.byDay ?? []);
      setByCourt(data.byCourt ?? []);
      setTopUsers(data.topUsers ?? []);
      setActiveFrom(from);
      setActiveTo(to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch al cambiar período predefinido
  useEffect(() => {
    if (period === 'custom') return;
    const { from, to } = getRange(period);
    fetchStats(from, to);
  }, [period, fetchStats]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo || customFrom > customTo) { setError('Fechas inválidas'); return; }
    fetchStats(customFrom, customTo);
  };

  const downloadCSV = async () => {
    if (!activeFrom || !activeTo) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/bookings/export?from=${activeFrom}&to=${activeTo}`);
      if (!res.ok) { alert('Error al exportar'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `reservas-${activeFrom}-al-${activeTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error de red al exportar');
    } finally {
      setExporting(false);
    }
  };

  const maxConfirmed = Math.max(...byDay.map((d) => d.confirmed), 1);
  const inputCls = 'border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white';

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Estadísticas</h1>
          {activeFrom && activeTo && !loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {format(parseISO(activeFrom), "d 'de' MMMM", { locale: es })} — {format(parseISO(activeTo), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          )}
        </div>

        {/* Pills de período */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
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

      {/* Date pickers para "Personalizado" */}
      {period === 'custom' && (
        <form onSubmit={handleApplyCustom} className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Desde</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Hasta</label>
            <input type="date" value={customTo} max={todayStr} onChange={(e) => setCustomTo(e.target.value)} className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={loading || !customFrom || !customTo}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando…
              </>
            ) : 'Aplicar'}
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-[3px] border-gray-200 border-t-gray-800 rounded-full animate-spin" />
        </div>
      )}

      {/* Contenido */}
      {!loading && summary && (
        <>
          {/* Summary cards — 8 métricas en grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Reservas confirmadas" value={summary.confirmed}     color="text-green-600"  bar="bg-green-500"  />
            <StatCard label="Horas de cancha"       value={`${summary.totalHours} h`} color="text-blue-600"   bar="bg-blue-400"   />
            <StatCard label="Promedio por día"      value={summary.avgPerDay}    color="text-indigo-600" bar="bg-indigo-400" />
            <StatCard label="% Ocupación"           value={`${summary.occupancyRate}%`} color="text-violet-600" bar="bg-violet-400" sub="sobre slots disponibles" />
            <StatCard label="Canceladas"            value={summary.cancelled}    color="text-gray-500"   bar="bg-gray-300"   />
            <StatCard label="Cancel. tardías"       value={summary.lateCancelled} color="text-orange-500" bar="bg-orange-400" />
            <StatCard label="Tasa de cancelación"   value={`${summary.cancelRate}%`} color="text-red-500"    bar="bg-red-400"    />
            <StatCard
              label="Cancha más usada"
              value={summary.topCourt?.confirmed ?? 0}
              color="text-teal-600"
              bar="bg-teal-400"
              sub={summary.topCourt?.name ?? '—'}
            />
          </div>

          {/* Gráfico por día */}
          {byDay.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Reservas por día</h2>
                <span className="text-xs text-gray-400">barras = confirmadas</span>
              </div>
              <div className="px-4 py-4 overflow-x-auto">
                <div className="flex items-end gap-1 min-w-max">
                  {byDay.map((d) => {
                    const height   = Math.max(4, Math.round((d.confirmed / maxConfirmed) * 80));
                    const dayLabel = format(parseISO(d.date), 'd/M');
                    const dayName  = format(parseISO(d.date), 'EEE', { locale: es });
                    return (
                      <div key={d.date} className="flex flex-col items-center gap-1 group">
                        <div className="hidden group-hover:flex flex-col items-center bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg mb-1 whitespace-nowrap shadow-lg z-10 relative">
                          <span className="font-semibold">{format(parseISO(d.date), "d 'de' MMM", { locale: es })}</span>
                          <span className="text-green-400">{d.confirmed} confirmada{d.confirmed !== 1 ? 's' : ''}</span>
                          {d.cancelled > 0 && (
                            <span className="text-gray-400">{d.cancelled} cancelada{d.cancelled !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <div className="w-6 bg-green-500 rounded-t-sm transition-all" style={{ height: `${height}px` }} />
                        <span className="text-[9px] text-gray-400 leading-none">{dayLabel}</span>
                        <span className="text-[9px] text-gray-300 leading-none capitalize">{dayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tabla por cancha */}
          {byCourt.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Detalle por cancha</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      {['Cancha', 'Confirmadas', 'Canceladas', 'Cancel. tardías', '% Ocupación'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {byCourt.map((c) => (
                      <tr key={c.courtId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.courtName}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{c.confirmed}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{c.cancelled}</td>
                        <td className="px-4 py-3 text-orange-500">{c.lateCancelled}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${c.occupancyRate}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700 tabular-nums w-8 text-right">{c.occupancyRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top usuarios */}
          {topUsers.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Usuarios más frecuentes</h2>
                <span className="text-xs text-gray-400">top {topUsers.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      {['#', 'Nombre', 'Teléfono', 'Confirmadas', 'Cancel. tardías'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topUsers.map((u, i) => (
                      <tr key={u.phone} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums">{u.phone}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{u.confirmed}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.lateCancelled > 0
                            ? <span className="text-orange-500 font-medium">{u.lateCancelled}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exportar CSV */}
          {activeFrom && activeTo && (
            <div className="flex justify-end">
              <button
                onClick={downloadCSV}
                disabled={exporting}
                className="flex items-center gap-2 text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                {exporting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Exportando…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar CSV del período
                  </>
                )}
              </button>
            </div>
          )}

          {/* Empty */}
          {summary.confirmed === 0 && summary.cancelled === 0 && summary.lateCancelled === 0 && (
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
