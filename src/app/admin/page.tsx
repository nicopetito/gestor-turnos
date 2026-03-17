'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
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
  const today  = startOfDay(new Date());
  const dates  = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  const [selectedDate, setSelectedDate] = useState(today);
  const [bookings, setBookings]         = useState<BookingWithRelations[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
  }, [selectedDate, fetchBookings]);

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reservas del día</h1>
        <span className="text-sm text-gray-500 capitalize">
          {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
        </span>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {dates.map((date) => {
          const dateStr    = format(date, 'yyyy-MM-dd');
          const isSelected = dateStr === format(selectedDate, 'yyyy-MM-dd');
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(date)}
              className={[
                'flex-shrink-0 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400',
              ].join(' ')}
            >
              <span className="block text-xs capitalize">
                {format(date, 'EEE', { locale: es })}
              </span>
              <span className="text-lg font-bold">{format(date, 'd')}</span>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Confirmadas', value: bookings.filter((b) => b.status === 'confirmed').length,      color: 'text-green-600' },
          { label: 'Canceladas',  value: bookings.filter((b) => b.status === 'cancelled').length,      color: 'text-gray-500'  },
          { label: 'Cancel. tardía', value: bookings.filter((b) => b.status === 'late_cancelled').length, color: 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {confirmed.length === 0 && (
            <p className="text-center text-gray-400 py-12">
              No hay reservas confirmadas para este día.
            </p>
          )}

          {confirmed.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Horario', 'Cancha', 'Cliente', 'Teléfono', 'Duración', 'Estado', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {confirmed.map((b) => {
                    const cfg = STATUS_CONFIG[b.status];
                    return (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-800">
                          {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{b.courts?.name}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{b.users?.name}</td>
                        <td className="px-4 py-3 text-gray-500">{b.users?.phone}</td>
                        <td className="px-4 py-3 text-gray-500">{b.duration_minutes} min</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className="text-xs text-gray-600">{cfg.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCancel(b.id, b.users?.name)}
                            disabled={cancellingId === b.id}
                            className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
                          >
                            {cancellingId === b.id ? 'Cancelando…' : 'Cancelar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {others.length > 0 && (
            <details className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <summary className="px-4 py-3 text-sm font-medium text-gray-500 cursor-pointer select-none">
                Canceladas / tardías ({others.length})
              </summary>
              <div className="border-t border-gray-100">
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {others.map((b) => {
                      const cfg = STATUS_CONFIG[b.status];
                      return (
                        <tr key={b.id} className="opacity-60">
                          <td className="px-4 py-2 font-mono text-gray-600">
                            {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{b.courts?.name}</td>
                          <td className="px-4 py-2 text-gray-700">{b.users?.name}</td>
                          <td className="px-4 py-2 text-gray-500">{b.users?.phone}</td>
                          <td className="px-4 py-2">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className="text-xs text-gray-500">{cfg.label}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
