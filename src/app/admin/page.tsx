'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminKey } from './layout';
import type { Booking, BookingStatus } from '@/types';

const DAYS_AHEAD = 7;

const STATUS_CONFIG: Record<BookingStatus, { label: string; dot: string }> = {
  confirmed:      { label: 'Confirmada',        dot: 'bg-green-500'  },
  cancelled:      { label: 'Cancelada',          dot: 'bg-gray-400'   },
  late_cancelled: { label: 'Cancelación tardía', dot: 'bg-orange-400' },
};

type BookingWithRelations = Booking & {
  users: { name: string; phone: string };
  courts: { name: string };
};

export default function AdminBookingsPage() {
  const { adminKey } = useAdminKey();
  const today = startOfDay(new Date());
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  const [selectedDate, setSelectedDate]   = useState(today);
  const [bookings, setBookings]           = useState<BookingWithRelations[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [cancellingId, setCancellingId]   = useState<string | null>(null);
  const [dayCounts, setDayCounts]         = useState<Record<string, number>>({});
  const [showCancelled, setShowCancelled] = useState(false);

  const fetchBookings = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const res     = await fetch(
        `/api/admin/bookings?adminKey=${encodeURIComponent(adminKey)}&date=${dateStr}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBookings(data.bookings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchBookings(selectedDate);
    setShowCancelled(false);
  }, [selectedDate, fetchBookings]);

  useEffect(() => {
    if (!adminKey) return;
    Promise.all(
      dates.map(async (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        try {
          const res  = await fetch(`/api/admin/bookings?adminKey=${encodeURIComponent(adminKey)}&date=${dateStr}`);
          const data = await res.json();
          const count = (data.bookings ?? []).filter((b: Booking) => b.status === 'confirmed').length;
          return [dateStr, count] as [string, number];
        } catch {
          return [dateStr, 0] as [string, number];
        }
      }),
    ).then((entries) => setDayCounts(Object.fromEntries(entries)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const handleCancel = async (bookingId: string, clientName: string) => {
    if (!confirm(`¿Cancelar la reserva de ${clientName}?`)) return;
    setCancellingId(bookingId);
    try {
      const res = await fetch('/api/admin/bookings', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ adminKey, bookingId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Error al cancelar');
      }
    } catch {
      setError('Error de red al cancelar');
    } finally {
      setCancellingId(null);
      fetchBookings(selectedDate);
    }
  };

  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const others    = bookings.filter((b) => b.status !== 'confirmed');

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <h1 className="text-xl font-bold text-gray-900">Reservas del día</h1>
        <span className="text-sm text-gray-400 capitalize">
          {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
        </span>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {dates.map((date) => {
          const dateStr    = format(date, 'yyyy-MM-dd');
          const isSelected = dateStr === format(selectedDate, 'yyyy-MM-dd');
          const count      = dayCounts[dateStr] ?? 0;
          const isToday    = dateStr === format(today, 'yyyy-MM-dd');

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(date)}
              className={[
                'flex-shrink-0 flex flex-col items-center gap-0.5 px-4 pt-2.5 pb-2 rounded-xl border text-sm font-medium transition-all',
                isSelected
                  ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm',
              ].join(' ')}
            >
              <span className={['text-[11px] uppercase tracking-wide font-semibold',
                isSelected ? 'text-gray-400' : isToday ? 'text-green-600' : 'text-gray-400',
              ].join(' ')}>
                {format(date, 'EEE', { locale: es })}
              </span>
              <span className="text-xl font-bold leading-none">{format(date, 'd')}</span>
              <span className={['text-[10px] font-semibold mt-0.5 min-h-[14px]',
                count > 0
                  ? isSelected ? 'text-green-400' : 'text-green-600'
                  : 'text-transparent',
              ].join(' ')}>
                {count > 0 ? `${count} turno${count !== 1 ? 's' : ''}` : '-'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Confirmadas',    value: bookings.filter((b) => b.status === 'confirmed').length,      color: 'text-green-600',  bar: 'bg-green-500'  },
          { label: 'Canceladas',     value: bookings.filter((b) => b.status === 'cancelled').length,      color: 'text-gray-500',   bar: 'bg-gray-300'   },
          { label: 'Cancel. tardía', value: bookings.filter((b) => b.status === 'late_cancelled').length, color: 'text-orange-500', bar: 'bg-orange-400' },
        ].map(({ label, value, color, bar }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden relative">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar} rounded-l-xl`} />
            <p className={`text-2xl sm:text-3xl font-bold pl-2 ${color}`}>{value}</p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 pl-2 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-[3px] border-gray-200 border-t-gray-800 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <AnimatePresence mode="wait">
          <motion.div
            key={format(selectedDate, 'yyyy-MM-dd')}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Empty */}
            {confirmed.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-xl py-14 flex flex-col items-center gap-2 shadow-sm">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                </svg>
                <p className="text-sm text-gray-400">Sin reservas confirmadas para este día</p>
              </div>
            )}

            {/* Confirmed — cards en mobile, tabla en desktop */}
            {confirmed.length > 0 && (
              <>
                {/* Mobile: cards */}
                <div className="md:hidden space-y-2">
                  {confirmed.map((b) => (
                    <div key={b.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {/* Hora + cancha */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-base font-bold text-gray-900">
                              {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                              {b.duration_minutes} min
                            </span>
                          </div>
                          {/* Cancha */}
                          <p className="text-xs text-green-600 font-semibold mb-2">{b.courts?.name}</p>
                          {/* Cliente */}
                          <p className="text-sm font-semibold text-gray-900">{b.users?.name}</p>
                          <p className="text-sm text-gray-400 tabular-nums">{b.users?.phone}</p>
                        </div>
                        {/* Cancelar */}
                        <button
                          onClick={() => handleCancel(b.id, b.users?.name)}
                          disabled={cancellingId === b.id}
                          className="flex-shrink-0 text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {cancellingId === b.id ? 'Cancelando…' : 'Cancelar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="hidden md:block bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Horario', 'Cancha', 'Cliente', 'Teléfono', 'Duración', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {confirmed.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50/70 transition-colors group">
                          <td className="px-4 py-3.5 font-mono text-sm font-medium text-gray-800">
                            {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                          </td>
                          <td className="px-4 py-3.5 text-gray-600">{b.courts?.name}</td>
                          <td className="px-4 py-3.5 font-medium text-gray-900">{b.users?.name}</td>
                          <td className="px-4 py-3.5 text-gray-500 tabular-nums">{b.users?.phone}</td>
                          <td className="px-4 py-3.5 text-gray-400">{b.duration_minutes} min</td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => handleCancel(b.id, b.users?.name)}
                              disabled={cancellingId === b.id}
                              className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors font-medium opacity-0 group-hover:opacity-100"
                            >
                              {cancellingId === b.id ? 'Cancelando…' : 'Cancelar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Cancelled — accordion animado */}
            {others.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCancelled((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium">Canceladas / tardías</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                      {others.length}
                    </span>
                    <svg
                      className={['w-4 h-4 text-gray-400 transition-transform', showCancelled ? 'rotate-180' : ''].join(' ')}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                <AnimatePresence>
                  {showCancelled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {others.map((b) => {
                          const cfg = STATUS_CONFIG[b.status];
                          return (
                            <div key={b.id} className="px-4 py-3 opacity-50">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="font-mono text-sm text-gray-700">
                                    {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                                  </span>
                                  <span className="ml-2 text-xs text-gray-500">{b.courts?.name}</span>
                                  <p className="text-sm text-gray-600 mt-0.5 truncate">{b.users?.name}</p>
                                </div>
                                <span className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  <span className="text-xs text-gray-500">{cfg.label}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
