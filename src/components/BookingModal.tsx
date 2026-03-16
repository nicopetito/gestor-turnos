'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import type { Booking, CourtAvailability, Duration, SlotInfo } from '@/types';
import { isDurationAvailable, minutesToTime, timeToMinutes } from '@/lib/slots';

interface BookingModalProps {
  slot: Pick<SlotInfo, 'date' | 'courtId' | 'time'>;
  courtName: string;
  allAvailability: CourtAvailability[];
  onClose: () => void;
  onSuccess: () => void;
}

const DURATIONS: Duration[] = [60, 90, 120];

export default function BookingModal({
  slot,
  courtName,
  allAvailability,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const router = useRouter();

  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [duration, setDuration]   = useState<Duration>(60);
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [booking, setBooking]     = useState<Booking | null>(null);

  const courtSlots =
    allAvailability.find((a) => a.courtId === slot.courtId)?.slots ?? [];

  const checkDuration = (d: Duration) =>
    isDurationAvailable(slot.time, d, courtSlots);

  const selectedDurationOk = checkDuration(duration);

  const handleNext = () => {
    if (!selectedDurationOk) {
      setError('La duración seleccionada no está disponible en este horario.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Nombre y teléfono son obligatorios.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          court_id:         slot.courtId,
          date:             slot.date,
          start_time:       slot.time,
          duration_minutes: duration,
          name:             name.trim(),
          phone:            phone.trim(),
          email:            email.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al realizar la reserva.');
      } else {
        setBooking(data.booking);
        setStep(3);          // Show success screen
        onSuccess();         // Refresh the grid in the background
      }
    } catch {
      setError('Error de conexión. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const endTime   = minutesToTime(timeToMinutes(slot.time) + duration);
  const dateLabel = format(parseISO(slot.date), "EEEE d 'de' MMMM", { locale: es });

  // ── Step 3: Success ───────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Green top bar */}
          <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-500" />

          <div className="px-6 py-8 text-center space-y-5">
            {/* Checkmark */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">¡Reserva confirmada!</h2>
              <p className="text-sm text-gray-500 mt-1">Tu turno quedó registrado correctamente.</p>
            </div>

            {/* Booking details card */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-left space-y-3">
              <DetailRow icon="📅" label="Fecha" value={dateLabel} capitalize />
              <DetailRow icon="🏟️" label="Cancha" value={courtName} />
              <DetailRow
                icon="⏰"
                label="Horario"
                value={`${slot.time} – ${booking?.end_time?.slice(0, 5) ?? endTime}`}
              />
              <DetailRow icon="⏱️" label="Duración" value={`${duration} minutos`} />
              <DetailRow icon="👤" label="Nombre"   value={name} />
              <DetailRow icon="📱" label="Teléfono" value={phone} />
            </div>

            <p className="text-xs text-gray-400">
              Guardá tu teléfono para poder ver o cancelar el turno desde{' '}
              <span className="font-medium text-gray-500">Mis Reservas</span>.
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => router.push(`/mis-reservas?phone=${encodeURIComponent(phone)}`)}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Ver mis reservas
              </button>
              <button
                onClick={onClose}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Reservar otro turno
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Steps 1 & 2 ──────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nueva Reserva</h2>
            {step === 2 && (
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                className="text-xs text-green-700 hover:underline mt-0.5"
              >
                ← Volver a duración
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={[
                  'h-1.5 rounded-full transition-all',
                  step >= s ? 'w-8 bg-green-600' : 'w-4 bg-gray-200',
                ].join(' ')}
              />
            ))}
          </div>

          {/* Slot summary */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-900 space-y-1">
            <p className="font-semibold capitalize">{dateLabel}</p>
            <p>{courtName}</p>
            <p>
              {slot.time} – {endTime}
              <span className="ml-2 text-green-600 text-xs">({duration} min)</span>
            </p>
          </div>

          {/* Step 1: Duration picker */}
          {step === 1 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Elegí la duración</p>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map((d) => {
                  const available  = checkDuration(d);
                  const isSelected = duration === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!available}
                      onClick={() => { setDuration(d); setError(null); }}
                      className={[
                        'flex flex-col items-center py-3 rounded-xl border text-sm font-medium transition-all',
                        !available
                          ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
                          : isSelected
                          ? 'bg-green-700 border-green-700 text-white shadow-md scale-105'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:bg-green-50',
                      ].join(' ')}
                    >
                      <span className="text-lg font-bold">{d} min</span>
                      <span className="text-xs opacity-75">
                        hasta {minutesToTime(timeToMinutes(slot.time) + d)}
                      </span>
                      {!available && <span className="text-[10px] mt-1">No disponible</span>}
                    </button>
                  );
                })}
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <button
                type="button"
                onClick={handleNext}
                disabled={!selectedDurationOk}
                className="mt-5 w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                Continuar
              </button>
            </div>
          )}

          {/* Step 2: Name + phone */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan Pérez"
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="11-1234-5678"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Usá este número para consultar o cancelar tu reserva.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400 font-normal">(opcional — para recibir confirmación)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@ejemplo.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Reservando…
                  </span>
                ) : (
                  'Confirmar Reserva'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
  capitalize = false,
}: {
  icon: string;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base mt-0.5">{icon}</span>
      <div className="flex-1 flex justify-between gap-2">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-sm font-medium text-gray-800 text-right ${capitalize ? 'capitalize' : ''}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
