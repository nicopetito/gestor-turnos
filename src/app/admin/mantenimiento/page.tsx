'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { CourtClosure } from '@/types';

interface Court {
  id: number;
  name: string;
}

const TIME_SLOTS: string[] = [];
for (let h = 8; h < 23; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
TIME_SLOTS.push('23:00');

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export default function AdminMantenimientoPage() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [courts,    setCourts]    = useState<Court[]>([]);
  const [closures,  setClosures]  = useState<CourtClosure[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Form state
  const [courtId,    setCourtId]    = useState<number | ''>('');
  const [dateFrom,   setDateFrom]   = useState(today);
  const [dateTo,     setDateTo]     = useState(today);
  const [startTime,  setStartTime]  = useState('08:00');
  const [endTime,    setEndTime]    = useState('10:00');
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [formOk,     setFormOk]     = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setListError(null);

      const [closuresRes, courtsRes] = await Promise.all([
        fetch('/api/admin/court-closures'),
        fetch('/api/admin/courts'),
      ]);

      if (closuresRes.ok) {
        const data = await closuresRes.json();
        setClosures(data.closures ?? []);
      } else {
        setListError('Error al cargar los cierres');
      }

      if (courtsRes.ok) {
        const data = await courtsRes.json();
        setCourts(data.courts ?? []);
        if (data.courts?.length > 0) setCourtId(Number(data.courts[0].id));
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);

    if (!courtId || !dateFrom || !dateTo || !startTime || !endTime) {
      setFormError('Completá todos los campos requeridos.');
      return;
    }
    if (dateFrom > dateTo) {
      setFormError('La fecha de inicio debe ser anterior o igual a la fecha de fin.');
      return;
    }
    if (startTime >= endTime) {
      setFormError('La hora de inicio debe ser anterior a la hora de fin.');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/admin/court-closures', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        courtId,
        dateFrom,
        dateTo,
        startTime,
        endTime,
        reason: reason.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setFormError(data.error ?? 'Error al crear el cierre');
      return;
    }

    setFormOk('Cierre creado correctamente.');
    setReason('');

    const refreshed = await fetch('/api/admin/court-closures');
    if (refreshed.ok) {
      const d = await refreshed.json();
      setClosures(d.closures ?? []);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cierre?')) return;
    const res = await fetch(`/api/admin/court-closures/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Error al eliminar el cierre');
      return;
    }
    setClosures((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Mantenimiento de canchas</h1>

      {/* Formulario */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-5">
          Nuevo cierre por mantenimiento
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cancha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cancha</label>
            {courts.length === 0 ? (
              <p className="text-sm text-gray-400">
                {loading ? 'Cargando canchas…' : 'No se encontraron canchas'}
              </p>
            ) : (
              <select
                value={courtId === '' ? '' : String(courtId)}
                onChange={(e) => setCourtId(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
              <input
                type="date"
                value={dateFrom}
                min={today}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  if (e.target.value > dateTo) setDateTo(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          {/* Horario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {TIME_SLOTS.slice(0, -1).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {TIME_SLOTS.slice(1).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Reparación de piso"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {formError}
            </p>
          )}
          {formOk && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              {formOk}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || courts.length === 0}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {submitting ? 'Guardando…' : 'Crear cierre'}
          </button>
        </form>
      </div>

      {/* Lista de cierres */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Cierres programados
          </h2>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">Cargando…</p>
        ) : listError ? (
          <p className="px-6 py-8 text-sm text-red-500 text-center">{listError}</p>
        ) : closures.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No hay cierres programados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Período', 'Cancha', 'Horario', 'Motivo', ''].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {closures.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {c.date_from === c.date_to
                        ? fmtDate(c.date_from)
                        : <>{fmtDate(c.date_from)} <span className="text-gray-400">→</span> {fmtDate(c.date_to)}</>
                      }
                    </td>
                    <td className="px-6 py-3 text-gray-700">
                      {(c.courts as { name: string } | undefined)?.name ?? '—'}
                    </td>
                    <td className="px-6 py-3 font-mono text-gray-700">
                      {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)}
                    </td>
                    <td className="px-6 py-3 text-gray-500 max-w-[200px] truncate">
                      {c.reason ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
