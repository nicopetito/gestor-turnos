'use client';

import { useState } from 'react';
import Image from 'next/image';
import { differenceInHours, format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import type { Booking, BookingStatus } from '@/types';

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; className: string }
> = {
  confirmed:     { label: 'Confirmada',          className: 'bg-green-100 text-green-700'   },
  cancelled:     { label: 'Cancelada',            className: 'bg-gray-100 text-gray-500'    },
  late_cancelled:{ label: 'Cancelación tardía',   className: 'bg-orange-100 text-orange-700'},
};

export default function MisReservasPage() {
  const [phone, setPhone]           = useState('');
  const [searchedPhone, setSearchedPhone] = useState('');
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError]   = useState<string | null>(null);
  const [confirmBooking, setConfirmBooking] = useState<Booking | null>(null);
  const [cancelledBooking, setCancelledBooking] = useState<Booking | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;

    setLoading(true);
    setFetchError(null);
    setCancelError(null);
    setBookings([]);
    setSearchedPhone(trimmed);

    try {
      const res  = await fetch(`/api/bookings?phone=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al buscar reservas');
      setBookings(data.bookings ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (booking: Booking) => {
    setCancellingId(booking.id);
    setCancelError(null);
    setConfirmBooking(null);

    try {
      const res  = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: searchedPhone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCancelError(data.error ?? 'Error al cancelar');
      } else {
        const updatedBooking = { ...booking, status: data.status as BookingStatus, cancelled_at: new Date().toISOString() };
        setBookings((prev) =>
          prev.map((b) => b.id === booking.id ? updatedBooking : b),
        );
        setCancelledBooking(updatedBooking);
      }
    } catch {
      setCancelError('Error de conexión. Intentá nuevamente.');
    } finally {
      setCancellingId(null);
    }
  };

  const isUpcoming = (b: Booking) =>
    !isPast(parseISO(`${b.date}T${b.start_time}`));

  const hoursUntil = (b: Booking) =>
    differenceInHours(parseISO(`${b.date}T${b.start_time}`), new Date());

  const upcoming = bookings.filter((b) => b.status === 'confirmed' && isUpcoming(b));
  const past     = bookings.filter((b) => b.status !== 'confirmed' || !isUpcoming(b));

  return (
    <main className="relative min-h-screen">
      <Image
        src="/imagenes/cancha-saque.jpg"
        alt="Canchas Once Unidos"
        fill
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white drop-shadow mb-2">Mis Reservas</h1>
        <p className="text-sm text-white/70 mb-8">
          Ingresá tu teléfono para ver y gestionar tus turnos.
        </p>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej: 11-1234-5678"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {fetchError && (
          <Alert variant="error" message={fetchError} />
        )}
        {cancelError && (
          <Alert variant="error" message={cancelError} className="mb-4" />
        )}

        {searchedPhone && !loading && (
          <>
            {upcoming.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Próximas reservas
                </h2>
                <div className="space-y-3">
                  {upcoming.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      hoursUntil={hoursUntil(booking)}
                      cancelling={cancellingId === booking.id}
                      onCancel={() => setConfirmBooking(booking)}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Historial
                </h2>
                <div className="space-y-3">
                  {past.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      hoursUntil={-1}
                      cancelling={false}
                      onCancel={null}
                    />
                  ))}
                </div>
              </section>
            )}

            {bookings.length === 0 && (
              <p className="text-center text-white/50 py-16">
                No se encontraron reservas para este teléfono.
              </p>
            )}
          </>
        )}
      </div>

      {/* Modal confirmación de cancelación */}
      {confirmBooking && (
        <CancelConfirmModal
          booking={confirmBooking}
          onConfirm={() => handleCancel(confirmBooking)}
          onClose={() => setConfirmBooking(null)}
        />
      )}

      {/* Modal éxito cancelación */}
      {cancelledBooking && (
        <CancelSuccessModal
          booking={cancelledBooking}
          onClose={() => setCancelledBooking(null)}
        />
      )}
    </main>
  );
}

// ---- CancelConfirmModal ----

function CancelConfirmModal({
  booking,
  onConfirm,
  onClose,
}: {
  booking: Booking;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const confirmed = input.trim().toLowerCase() === 'cancelar';

  const dateLabel = format(parseISO(booking.date), "EEEE d 'de' MMMM", { locale: es });
  const courtName = (booking.courts as { name: string } | undefined)?.name ?? `Cancha ${booking.court_id}`;
  const startLabel = booking.start_time.slice(0, 5);
  const endLabel   = booking.end_time.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header rojo */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 px-6 pt-7 pb-8 text-center relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
            className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </motion.div>
          <h2 className="text-xl font-bold text-white">¿Cancelar turno?</h2>
          <p className="text-white/75 text-sm mt-1">Esta acción no se puede deshacer</p>
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-white" style={{ borderRadius: '100% 100% 0 0 / 100% 100% 0 0', transform: 'scaleX(1.1)' }} />
        </div>

        {/* Detalles + confirmación */}
        <div className="px-6 pt-5 pb-6 space-y-4">
          {/* Resumen del turno */}
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-900 space-y-0.5">
            <p className="font-semibold capitalize">{dateLabel}</p>
            <p>{courtName} · {startLabel} – {endLabel}</p>
          </div>

          {/* Input de confirmación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Escribí <span className="font-bold text-red-600">cancelar</span> para confirmar
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="cancelar"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-2xl text-sm transition-colors"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!confirmed}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-2xl text-sm transition-colors"
            >
              Confirmar cancelación
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ---- CancelSuccessModal ----

function CancelSuccessModal({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const isLate    = booking.status === 'late_cancelled';
  const dateLabel = format(parseISO(booking.date), "EEEE d 'de' MMMM", { locale: es });
  const courtName = (booking.courts as { name: string } | undefined)?.name ?? `Cancha ${booking.court_id}`;
  const startLabel = booking.start_time.slice(0, 5);
  const endLabel   = booking.end_time.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className={`px-6 pt-8 pb-10 text-center relative ${isLate ? 'bg-gradient-to-br from-orange-500 to-amber-600' : 'bg-gradient-to-br from-gray-600 to-gray-800'}`}>
          {/* Icono X animado */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <motion.svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.35, ease: 'easeOut' }}
            >
              <motion.path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </motion.svg>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="text-2xl font-bold text-white"
          >
            Turno cancelado
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.3 }}
            className="text-white/75 text-sm mt-1"
          >
            {isLate ? 'Cancelación marcada como tardía' : 'La reserva fue cancelada correctamente'}
          </motion.p>

          <div className="absolute bottom-0 left-0 right-0 h-4 bg-white" style={{ borderRadius: '100% 100% 0 0 / 100% 100% 0 0', transform: 'scaleX(1.1)' }} />
        </div>

        {/* Detalles */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="px-6 pt-5 pb-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-2">
            <InfoChip label="Fecha" value={dateLabel} capitalize />
            <InfoChip label="Cancha" value={courtName} />
            <InfoChip label="Horario" value={`${startLabel} – ${endLabel}`} />
            <InfoChip label="Duración" value={`${booking.duration_minutes} min`} />
          </div>

          {isLate && (
            <p className="text-xs text-center text-orange-500 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
              La cancelación fue dentro de las 24 h y quedó registrada como tardía.
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-2xl text-sm transition-colors"
          >
            Cerrar
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ---- Sub-components ----

function Alert({
  variant,
  message,
  className = '',
}: {
  variant: 'error';
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 ${className}`}
    >
      {message}
    </div>
  );
}

function BookingCard({
  booking,
  hoursUntil,
  cancelling,
  onCancel,
}: {
  booking: Booking;
  hoursUntil: number;
  cancelling: boolean;
  onCancel: (() => void) | null;
}) {
  const config     = STATUS_CONFIG[booking.status] ?? { label: booking.status, className: '' };
  const isActive   = booking.status === 'confirmed';
  const canCancel  = onCancel !== null && isActive;
  const isLate     = hoursUntil >= 0 && hoursUntil < 24;

  const dateLabel  = format(
    parseISO(booking.date),
    "EEEE d 'de' MMMM yyyy",
    { locale: es },
  );
  const startLabel = booking.start_time.slice(0, 5);
  const endLabel   = booking.end_time.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4 shadow-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">
            {(booking.courts as { name: string } | undefined)?.name ?? `Cancha ${booking.court_id}`}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.className}`}>
            {config.label}
          </span>
        </div>
        <p className="text-sm text-gray-600 capitalize">{dateLabel}</p>
        <p className="text-sm text-gray-500">
          {startLabel} – {endLabel}
          <span className="ml-2 text-xs text-gray-400">({booking.duration_minutes} min)</span>
        </p>
        {isLate && isActive && (
          <p className="text-xs text-orange-500 mt-1">
            Menos de 24 h: la cancelación se marcará como tardía.
          </p>
        )}
      </div>

      {canCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className={[
            'flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50',
            isLate
              ? 'border-orange-300 text-orange-600 hover:bg-orange-50'
              : 'border-red-300 text-red-600 hover:bg-red-50',
          ].join(' ')}
        >
          {cancelling ? 'Cancelando…' : 'Cancelar'}
        </button>
      )}
    </div>
  );
}

function InfoChip({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-gray-800 leading-tight ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
    </div>
  );
}
