'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminKey } from '../layout';
import type { Duration, FixedBookingSuspension } from '@/types';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DURATIONS: Duration[] = [60, 90, 120];
const COURTS = [
  { id: 1, name: 'Cancha 1' },
  { id: 2, name: 'Cancha 2' },
  { id: 3, name: 'Cancha 3' },
];

// Generate 30-min time slots from 08:00 to 22:30
function timeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h < 23; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

interface FixedBookingRow {
  id: number;
  court_id: number;
  weekday: number;
  start_time: string;
  duration_minutes: Duration;
  label: string;
  courts?: { name: string };
}

export default function AdminClasesPage() {
  const { adminKey } = useAdminKey();

  const [clases, setClases]       = useState<FixedBookingRow[]>([]);
  const [suspensions, setSuspensions] = useState<FixedBookingSuspension[]>([]);
  const [loading, setLoading]     = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  // Which row has the suspend panel open
  const [suspendingId, setSuspendingId] = useState<number | null>(null);
  const [suspendingWeeks, setSuspendingWeeks] = useState<1 | 2 | 3>(1);
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    court_id:         1,
    weekday:          1,
    start_time:       '08:00',
    duration_minutes: 60 as Duration,
    label:            'Clase',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const fetchClases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clasesRes, suspRes] = await Promise.all([
        fetch(`/api/admin/fixed-bookings?adminKey=${encodeURIComponent(adminKey)}`),
        fetch(`/api/admin/fixed-bookings/suspensions?adminKey=${encodeURIComponent(adminKey)}`),
      ]);
      const clasesData = await clasesRes.json();
      const suspData   = await suspRes.json();
      if (!clasesRes.ok) throw new Error(clasesData.error);
      setClases(clasesData.fixedBookings ?? []);
      setSuspensions(suspData.suspensions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { fetchClases(); }, [fetchClases]);

  const today = new Date().toISOString().slice(0, 10);

  function getActiveSuspension(fixedBookingId: number): FixedBookingSuspension | null {
    return suspensions.find(
      (s) => s.fixed_booking_id === fixedBookingId && s.suspended_until >= today,
    ) ?? null;
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    const res = await fetch(
      `/api/admin/fixed-bookings?adminKey=${encodeURIComponent(adminKey)}&id=${id}`,
      { method: 'DELETE' },
    );
    setDeletingId(null);
    if (res.ok) {
      setSuccess('Clase eliminada.');
      fetchClases();
    } else {
      const d = await res.json();
      setError(d.error ?? 'Error al eliminar');
    }
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSuspend = async (id: number) => {
    setSuspendLoading(true);
    const res = await fetch(`/api/admin/fixed-bookings/${id}/suspend`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminKey, weeks: suspendingWeeks }),
    });
    const data = await res.json();
    setSuspendLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Error al suspender');
    } else {
      setSuccess(`Clase suspendida por ${suspendingWeeks} semana${suspendingWeeks > 1 ? 's' : ''}.`);
      setSuspendingId(null);
      fetchClases();
    }
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleReactivate = async (id: number) => {
    const res = await fetch(
      `/api/admin/fixed-bookings/${id}/suspend?adminKey=${encodeURIComponent(adminKey)}`,
      { method: 'DELETE' },
    );
    if (res.ok) {
      setSuccess('Clase reactivada.');
      fetchClases();
    } else {
      const d = await res.json();
      setError(d.error ?? 'Error al reactivar');
    }
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const res = await fetch('/api/admin/fixed-bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminKey, ...form }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setFormError(data.error ?? 'Error al crear');
      return;
    }
    setSuccess('Clase creada exitosamente.');
    fetchClases();
    setTimeout(() => setSuccess(null), 3000);
  };

  // Group by weekday for display
  const byWeekday = WEEKDAYS.map((day, idx) => ({
    day,
    idx,
    clases: clases.filter((c) => c.weekday === idx),
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Clases Fijas</h1>

      {error   && <Alert variant="error"   message={error}   />}
      {success && <Alert variant="success" message={success} />}

      {/* Add form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
          Agregar clase
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cancha</label>
            <select
              value={form.court_id}
              onChange={(e) => setForm((f) => ({ ...f, court_id: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {COURTS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Día</label>
            <select
              value={form.weekday}
              onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {WEEKDAYS.map((day, idx) => (
                <option key={idx} value={idx}>{day}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Horario inicio</label>
            <select
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {timeSlots().map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duración</label>
            <select
              value={form.duration_minutes}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) as Duration }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} minutos</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre / etiqueta</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Clase de tenis"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {submitting ? 'Guardando…' : '+ Agregar'}
            </button>
          </div>

          {formError && (
            <div className="col-span-full">
              <Alert variant="error" message={formError} />
            </div>
          )}
        </form>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {byWeekday.map(({ day, idx, clases: dayClases }) => {
            if (dayClases.length === 0) return null;
            return (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Day header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">{day}</h3>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-100">
                  {dayClases.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((c) => {
                    const suspension  = getActiveSuspension(c.id);
                    const isSuspended = !!suspension;

                    return (
                      <div key={c.id} className={`px-4 py-3 ${isSuspended ? 'bg-amber-50' : ''}`}>
                        {/* Main row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex flex-col gap-0.5">
                            {/* Hora + duración */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-gray-800">
                                {c.start_time.slice(0, 5)}
                              </span>
                              <span className="text-xs text-gray-400">{c.duration_minutes} min</span>
                              <span className="text-xs font-medium text-indigo-600">{c.label}</span>
                            </div>
                            {/* Cancha */}
                            <span className="text-xs text-gray-500">
                              {c.courts?.name ?? `Cancha ${c.court_id}`}
                            </span>
                            {/* Badge suspensión */}
                            {isSuspended && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full w-fit mt-1">
                                Suspendida hasta {formatDate(suspension.suspended_until)}
                              </span>
                            )}
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isSuspended ? (
                              <button
                                onClick={() => handleReactivate(c.id)}
                                className="text-xs border border-green-300 text-green-700 hover:bg-green-50 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Reactivar
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSuspendingId(suspendingId === c.id ? null : c.id);
                                  setSuspendingWeeks(1);
                                }}
                                className="text-xs border border-amber-300 text-amber-700 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Suspender
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deletingId === c.id ? '…' : 'Eliminar'}
                            </button>
                          </div>
                        </div>

                        {/* Panel suspensión */}
                        {suspendingId === c.id && (
                          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-800 font-medium mb-2">Suspender por:</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {([1, 2, 3] as const).map((w) => (
                                <button
                                  key={w}
                                  onClick={() => setSuspendingWeeks(w)}
                                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                    suspendingWeeks === w
                                      ? 'bg-amber-600 border-amber-600 text-white'
                                      : 'border-amber-300 text-amber-700 hover:bg-amber-100'
                                  }`}
                                >
                                  {w} sem.
                                </button>
                              ))}
                              <button
                                onClick={() => handleSuspend(c.id)}
                                disabled={suspendLoading}
                                className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                              >
                                {suspendLoading ? 'Guardando…' : 'Confirmar'}
                              </button>
                              <button
                                onClick={() => setSuspendingId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {clases.length === 0 && !loading && (
            <p className="text-center text-gray-400 py-12">
              No hay clases fijas cargadas todavía.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Alert({ variant, message }: { variant: 'error' | 'success'; message: string }) {
  const styles = variant === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-green-50 border-green-200 text-green-700';
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm ${styles}`}>{message}</div>
  );
}
