'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTimeSlots, timeToMinutes, minutesToTime } from '@/lib/slots';
import type { Booking, BookingStatus, CourtAvailability, Duration } from '@/types';

const DAYS_AHEAD = 7;

// ---- New Booking Modal ----

type Court = { id: number; name: string };

function NewBookingModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate: Date;
}) {
  const today      = startOfDay(new Date());
  const maxDate    = addDays(today, 7);
  const minDateStr = format(today,   'yyyy-MM-dd');
  const maxDateStr = format(maxDate, 'yyyy-MM-dd');

  const [date,      setDate]      = useState(format(initialDate, 'yyyy-MM-dd'));
  const [courtId,   setCourtId]   = useState('');
  const [duration,  setDuration]  = useState<Duration>(60);
  const [startTime, setStartTime] = useState('');
  const [name,      setName]      = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');

  const [courts,       setCourts]       = useState<Court[]>([]);
  const [slots,        setSlots]        = useState<CourtAvailability['slots']>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);

  // Load courts list once when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const dateStr = format(today, 'yyyy-MM-dd');
    fetch(`/api/availability?from=${dateStr}&to=${dateStr}`)
      .then((r) => r.json())
      .then((data) => {
        const seen = new Set<number>();
        const list: Court[] = [];
        for (const entry of data.availability ?? []) {
          if (!seen.has(entry.courtId)) {
            seen.add(entry.courtId);
            list.push({ id: entry.courtId, name: entry.courtName });
          }
        }
        setCourts(list);
        if (list.length > 0) setCourtId(String(list[0].id));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reload slots when date or court changes
  useEffect(() => {
    if (!date || !courtId) { setSlots([]); return; }
    setLoadingSlots(true);
    setStartTime('');
    fetch(`/api/availability?from=${date}&to=${date}`)
      .then((r) => r.json())
      .then((data) => {
        const entry = (data.availability ?? []).find(
          (a: CourtAvailability) => a.courtId === Number(courtId) && a.date === date,
        );
        setSlots(entry?.slots ?? []);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, courtId]);

  // Recompute available start times when slots or duration change
  const availableStartTimes = slots.length > 0
    ? generateTimeSlots().filter((time) => {
        const startMin = timeToMinutes(time);
        const endMin   = startMin + duration;
        if (endMin > 23 * 60) return false;
        for (let m = startMin; m < endMin; m += 30) {
          const slot = slots.find((s) => s.time === minutesToTime(m));
          if (!slot || slot.status !== 'available') return false;
        }
        return true;
      })
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !courtId || !startTime || !name.trim() || !phone.trim()) {
      setError('Completá todos los campos obligatorios.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          court_id:         Number(courtId),
          date,
          start_time:       startTime,
          duration_minutes: duration,
          name:             name.trim(),
          phone:            phone.trim(),
          email:            email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear la reserva');
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la reserva');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDate(format(initialDate, 'yyyy-MM-dd'));
    setCourtId('');
    setDuration(60);
    setStartTime('');
    setName('');
    setPhone('');
    setEmail('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-500 transition-colors';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden"
      >
        {/* Header con gradiente */}
        <div className="relative bg-gray-900 px-5 pt-5 pb-6">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Admin</p>
              <h2 className="text-white text-lg font-bold leading-tight">Nueva Reserva</h2>
            </div>
          </div>
        </div>

        {/* Success state */}
        {success ? (
          <div className="px-5 py-16 flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200"
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">¡Turno reservado!</p>
              <p className="text-sm text-gray-400 mt-1">La reserva fue creada exitosamente.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Date + Court */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha</label>
                <input
                  type="date"
                  value={date}
                  min={minDateStr}
                  max={maxDateStr}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Cancha</label>
                <select
                  value={courtId}
                  onChange={(e) => setCourtId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Elegir…</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duración — pills */}
            <div>
              <label className={labelCls}>Duración</label>
              <div className="flex gap-2">
                {([60, 90, 120] as Duration[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDuration(d); setStartTime(''); }}
                    className={[
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                      duration === d
                        ? 'bg-gray-900 border-transparent text-white shadow-md shadow-gray-400/30'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800',
                    ].join(' ')}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {/* Horario */}
            <div>
              <label className={labelCls}>
                Horario{loadingSlots && <span className="ml-1 text-gray-400 normal-case font-normal tracking-normal">cargando…</span>}
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={!courtId || loadingSlots}
                className={inputCls + ' disabled:opacity-50 disabled:cursor-not-allowed'}
              >
                <option value="">
                  {!courtId ? 'Elegí una cancha primero' : loadingSlots ? 'Cargando slots…' : availableStartTimes.length === 0 ? 'Sin horarios disponibles' : 'Elegir horario…'}
                </option>
                {availableStartTimes.map((t) => {
                  const end = minutesToTime(timeToMinutes(t) + duration);
                  return <option key={t} value={t}>{t} – {end}</option>;
                })}
              </select>
            </div>

            {/* Separador */}
            <div className="border-t border-dashed border-gray-200" />

            {/* Nombre */}
            <div>
              <label className={labelCls}>Nombre del jugador</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan García"
                className={inputCls}
              />
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Teléfono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="1112345678"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email <span className="normal-case font-normal text-gray-300">(opcional)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mail@ejemplo.com"
                  className={inputCls}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-3.5 py-3 text-xs"
              >
                <svg className="w-4 h-4 flex-shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </motion.div>
            )}

            <div className="pt-1 pb-2">
              <button
                type="submit"
                disabled={submitting || !date || !courtId || !startTime || !name.trim() || !phone.trim()}
                className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-gray-400/30 disabled:shadow-none text-sm tracking-wide"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creando…
                  </span>
                ) : 'Confirmar Reserva'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

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
  const today = startOfDay(new Date());
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  const [selectedDate, setSelectedDate]   = useState(today);
  const [bookings, setBookings]           = useState<BookingWithRelations[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [cancellingId, setCancellingId]   = useState<string | null>(null);
  const [cancelError, setCancelError]     = useState<string | null>(null);
  const [dayCounts, setDayCounts]         = useState<Record<string, number>>({});
  const [showCancelled, setShowCancelled] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [filterPerson, setFilterPerson]   = useState('');
  const [filterCourt, setFilterCourt]     = useState('');
  const [filterHour, setFilterHour]       = useState('');
  const [showExportRange, setShowExportRange] = useState(false);
  const [exportFrom, setExportFrom] = useState(format(today, 'yyyy-MM-dd'));
  const [exportTo, setExportTo]     = useState(format(today, 'yyyy-MM-dd'));
  const [exportingRange, setExportingRange] = useState(false);

  const fetchBookings = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const res     = await fetch(`/api/admin/bookings?date=${dateStr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBookings(data.bookings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings(selectedDate);
    setShowCancelled(false);
    setFilterPerson('');
    setFilterCourt('');
    setFilterHour('');
    setCancelError(null);
  }, [selectedDate, fetchBookings]);

  useEffect(() => {
    Promise.all(
      dates.map(async (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        try {
          const res  = await fetch(`/api/admin/bookings?date=${dateStr}`);
          const data = await res.json();
          const count = (data.bookings ?? []).filter((b: Booking) => b.status === 'confirmed').length;
          return [dateStr, count] as [string, number];
        } catch {
          return [dateStr, 0] as [string, number];
        }
      }),
    ).then((entries) => setDayCounts(Object.fromEntries(entries)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async (bookingId: string, clientName: string) => {
    if (!confirm(`¿Cancelar la reserva de ${clientName}?`)) return;
    setCancellingId(bookingId);
    setCancelError(null);
    try {
      const res = await fetch('/api/admin/bookings', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bookingId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCancelError(data.error ?? 'Error al cancelar');
      } else {
        fetchBookings(selectedDate);
      }
    } catch {
      setCancelError('Error de red al cancelar');
    } finally {
      setCancellingId(null);
    }
  };

  const downloadCSV = () => {
    const rows: string[][] = [
      ['Horario inicio', 'Horario fin', 'Cancha', 'Cliente', 'Teléfono', 'Duración (min)', 'Estado'],
      ...bookings.map((b) => [
        b.start_time.slice(0, 5),
        b.end_time.slice(0, 5),
        b.courts?.name ?? '',
        b.users?.name ?? '',
        b.users?.phone ?? '',
        String(b.duration_minutes),
        STATUS_CONFIG[b.status]?.label ?? b.status,
      ]),
    ];
    const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reservas-${format(selectedDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRangeCSV = async () => {
    if (!exportFrom || !exportTo || exportFrom > exportTo) return;
    setExportingRange(true);
    try {
      const res = await fetch(`/api/admin/bookings/export?from=${exportFrom}&to=${exportTo}`);
      if (!res.ok) { alert('Error al exportar'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `reservas-${exportFrom}-al-${exportTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportRange(false);
    } catch {
      alert('Error de red al exportar');
    } finally {
      setExportingRange(false);
    }
  };

  const allConfirmed = bookings.filter((b) => b.status === 'confirmed');
  const others       = bookings.filter((b) => b.status !== 'confirmed');

  const confirmed = allConfirmed.filter((b) => {
    if (filterPerson && !b.users?.name.toLowerCase().includes(filterPerson.toLowerCase()) && !b.users?.phone.includes(filterPerson)) return false;
    if (filterCourt && b.courts?.name !== filterCourt) return false;
    if (filterHour  && !b.start_time.startsWith(filterHour)) return false;
    return true;
  });

  const courtNames  = [...new Set(allConfirmed.map((b) => b.courts?.name).filter(Boolean))] as string[];
  const byCourtName = courtNames.reduce<Record<string, typeof confirmed>>((acc, name) => {
    acc[name] = confirmed.filter((b) => b.courts?.name === name);
    return acc;
  }, {});

  const hasFilters = filterPerson || filterCourt || filterHour;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reservas del día</h1>
          <span className="text-sm text-gray-400 capitalize">
            {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowNewBooking(true)}
            className="flex items-center gap-1.5 text-xs font-medium bg-gray-900 hover:bg-gray-700 text-white px-3 py-2 rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva Reserva
          </button>
          <button
            onClick={downloadCSV}
            disabled={bookings.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 px-3 py-2 rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar día
          </button>
          <button
            onClick={() => setShowExportRange((v) => !v)}
            className={[
              'flex items-center gap-1.5 text-xs font-medium border px-3 py-2 rounded-xl transition-colors shadow-sm',
              showExportRange
                ? 'border-gray-400 bg-gray-100 text-gray-700'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600',
            ].join(' ')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            Exportar rango…
          </button>
        </div>
      </div>

      {/* Export range panel */}
      <AnimatePresence>
        {showExportRange && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 shadow-sm flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Desde</label>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Hasta</label>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <button
                onClick={downloadRangeCSV}
                disabled={exportingRange || !exportFrom || !exportTo || exportFrom > exportTo}
                className="flex items-center gap-1.5 text-xs font-semibold bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                {exportingRange ? (
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
                    Descargar CSV
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 self-end pb-0.5">Incluye todas las reservas del rango con fecha, cancha, jugador y estado.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
      {cancelError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {cancelError}
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
            {/* Filtros */}
            {allConfirmed.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  placeholder="Persona o teléfono"
                  value={filterPerson}
                  onChange={(e) => setFilterPerson(e.target.value)}
                  className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                <select
                  value={filterCourt}
                  onChange={(e) => setFilterCourt(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                >
                  <option value="">Todas las canchas</option>
                  {courtNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={filterHour}
                  onChange={(e) => setFilterHour(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => { setFilterPerson(''); setFilterCourt(''); setFilterHour(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            {/* Empty */}
            {allConfirmed.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-xl py-14 flex flex-col items-center gap-2 shadow-sm">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                </svg>
                <p className="text-sm text-gray-400">Sin reservas confirmadas para este día</p>
              </div>
            )}

            {/* Sin resultados con filtros activos */}
            {allConfirmed.length > 0 && confirmed.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-xl py-10 flex flex-col items-center gap-2 shadow-sm">
                <p className="text-sm text-gray-400">No hay reservas que coincidan con los filtros.</p>
              </div>
            )}

            {/* Agrupado por cancha */}
            {confirmed.length > 0 && courtNames
              .filter((name) => !filterCourt || name === filterCourt)
              .map((courtName) => {
                const rows = byCourtName[courtName] ?? [];
                const filteredRows = rows.filter((b) => {
                  if (filterPerson && !b.users?.name.toLowerCase().includes(filterPerson.toLowerCase()) && !b.users?.phone.includes(filterPerson)) return false;
                  if (filterHour && !b.start_time.startsWith(filterHour)) return false;
                  return true;
                });
                if (filteredRows.length === 0) return null;
                return (
                  <div key={courtName} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    {/* Header cancha */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-semibold text-gray-700">{courtName}</span>
                      <span className="ml-auto text-xs text-gray-400 font-medium">{filteredRows.length} reserva{filteredRows.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Mobile: cards */}
                    <div className="md:hidden divide-y divide-gray-50">
                      {filteredRows.map((b) => (
                        <div key={b.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-mono text-base font-bold text-gray-900">
                                  {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                                </span>
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                                  {b.duration_minutes} min
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{b.users?.name}</p>
                              <p className="text-sm text-gray-400 tabular-nums">{b.users?.phone}</p>
                            </div>
                            <button
                              onClick={() => handleCancel(b.id, b.users?.name ?? b.users?.phone ?? 'este usuario')}
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
                    <table className="hidden md:table min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50">
                          {['Horario', 'Cliente', 'Teléfono', 'Duración', ''].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredRows.map((b) => (
                          <tr key={b.id} className="hover:bg-gray-50/70 transition-colors group">
                            <td className="px-4 py-3.5 font-mono text-sm font-medium text-gray-800">
                              {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                            </td>
                            <td className="px-4 py-3.5 font-medium text-gray-900">{b.users?.name}</td>
                            <td className="px-4 py-3.5 text-gray-500 tabular-nums">{b.users?.phone}</td>
                            <td className="px-4 py-3.5 text-gray-400">{b.duration_minutes} min</td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => handleCancel(b.id, b.users?.name ?? b.users?.phone ?? 'este usuario')}
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
                );
              })
            }

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

      <AnimatePresence>
        {showNewBooking && (
          <NewBookingModal
            isOpen={showNewBooking}
            onClose={() => setShowNewBooking(false)}
            onSuccess={() => fetchBookings(selectedDate)}
            initialDate={selectedDate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
