'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { Booking, CourtAvailability, Duration, SlotInfo } from '@/types';
import { isDurationAvailable, minutesToTime, timeToMinutes } from '@/lib/slots';

interface BookingModalProps {
  slot: Pick<SlotInfo, 'date' | 'courtId' | 'time'>;
  courtName: string;
  allAvailability: CourtAvailability[];
  initialDuration?: Duration;
  onClose: () => void;
  onSuccess: () => void;
}

const DURATIONS: Duration[] = [60, 90, 120];

export default function BookingModal({
  slot,
  courtName,
  allAvailability,
  initialDuration,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const router = useRouter();

  const [step, setStep]           = useState<1 | 2 | 3>(initialDuration ? 2 : 1);
  const [duration, setDuration]   = useState<Duration>(initialDuration ?? 60);
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
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

  const validatePhone = (value: string): string | null => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return 'El teléfono es obligatorio.';
    if (digits.length < 8) return 'Ingresá al menos 8 dígitos.';
    if (digits.length > 15) return 'El número es demasiado largo.';
    return null;
  };

  const handlePhoneBlur = () => {
    if (phone.trim()) setPhoneError(validatePhone(phone));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const pErr = validatePhone(phone);
    if (pErr) {
      setPhoneError(pErr);
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
        setStep(3);
        onSuccess();
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          {/* Header verde */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 pt-8 pb-10 text-center relative">
            {/* Checkmark animado */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
              className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <motion.svg
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <motion.path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </motion.svg>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="text-2xl font-bold text-white"
            >
              ¡Listo, a jugar!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="text-white/75 text-sm mt-1"
            >
              Tu turno quedó confirmado
            </motion.p>

            {/* Onda decorativa */}
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-white" style={{ borderRadius: '100% 100% 0 0 / 100% 100% 0 0', transform: 'scaleX(1.1)' }} />
          </div>

          {/* Detalles */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="px-6 pt-5 pb-6 space-y-4"
          >
            {/* Chips de info */}
            <div className="grid grid-cols-2 gap-2">
              <InfoChip label="Fecha" value={dateLabel} capitalize />
              <InfoChip label="Cancha" value={courtName} />
              <InfoChip label="Horario" value={`${slot.time} – ${booking?.end_time?.slice(0, 5) ?? endTime}`} />
              <InfoChip label="Duración" value={`${duration} min`} />
            </div>

            <p className="text-xs text-center text-gray-400 pt-1">
              Guardá tu número <span className="font-semibold text-gray-500">{phone}</span> para gestionar el turno desde{' '}
              <span className="font-medium">Mis Reservas</span>.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => router.push(`/mis-reservas?phone=${encodeURIComponent(phone)}`)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-2xl text-sm transition-colors"
              >
                Ver mis reservas
              </button>
              <button
                onClick={onClose}
                className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 text-sm transition-colors"
              >
                Reservar otro turno
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Steps 1 & 2 ──────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
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
            <p className="flex items-center gap-1.5">
              {initialDuration && (
                <span className="text-[10px] font-semibold bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  Asignada
                </span>
              )}
              {courtName}
            </p>
            <p>
              {slot.time} – {endTime}
              <span className="ml-2 text-green-600 text-xs">({duration} min)</span>
            </p>
          </div>

          {/* Animated step content */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.18 }}
              >
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
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
              >
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
                      onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(null); }}
                      onBlur={handlePhoneBlur}
                      placeholder="11-1234-5678"
                      className={[
                        'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent',
                        phoneError
                          ? 'border-red-400 focus:ring-red-400'
                          : 'border-gray-300 focus:ring-green-600',
                      ].join(' ')}
                    />
                    {phoneError
                      ? <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                      : <p className="text-xs text-gray-400 mt-1">Usá este número para consultar o cancelar tu reserva.</p>
                    }
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
type IconName = 'calendar' | 'court' | 'clock' | 'timer' | 'user' | 'phone';

function Icon({ name, className }: { name: IconName; className?: string }) {
  const cls = className ?? 'w-4 h-4 text-gray-400';
  switch (name) {
    case 'calendar':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'court':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3v18M3 3h18v18H3z" />
        </svg>
      );
    case 'clock':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'timer':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
      );
    case 'user':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'phone':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
        </svg>
      );
  }
}

// ── InfoChip ──────────────────────────────────────────────────────────────────
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

// ── Helper ────────────────────────────────────────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
  capitalize = false,
  note,
}: {
  icon: IconName;
  label: string;
  value: string;
  capitalize?: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0">
        <Icon name={icon} className="w-4 h-4 text-gray-400" />
      </span>
      <div className="flex-1 flex justify-between gap-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className="text-right">
          <span className={`text-sm font-medium text-gray-800 ${capitalize ? 'capitalize' : ''}`}>
            {value}
          </span>
          {note && <p className="text-[10px] text-gray-400 mt-0.5">{note}</p>}
        </div>
      </div>
    </div>
  );
}
