'use client';

import { useState } from 'react';
import { differenceInHours, format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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

  const handleCancel = async (bookingId: string) => {
    setCancellingId(bookingId);
    setCancelError(null);

    try {
      const res  = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: searchedPhone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCancelError(data.error ?? 'Error al cancelar');
      } else {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? { ...b, status: data.status, cancelled_at: new Date().toISOString() }
              : b,
          ),
        );
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

  const upcoming = bookings.filter(isUpcoming);
  const past     = bookings.filter((b) => !isUpcoming(b));

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mis Reservas</h1>
        <p className="text-sm text-gray-500 mb-8">
          Ingresá tu teléfono para ver y gestionar tus turnos.
        </p>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej: 11-1234-5678"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
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
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Próximas reservas
                </h2>
                <div className="space-y-3">
                  {upcoming.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      hoursUntil={hoursUntil(booking)}
                      cancelling={cancellingId === booking.id}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
              <p className="text-center text-gray-400 py-16">
                No se encontraron reservas para este teléfono.
              </p>
            )}
          </>
        )}
      </div>
    </main>
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
  onCancel: ((id: string) => void) | null;
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
          onClick={() => onCancel!(booking.id)}
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
