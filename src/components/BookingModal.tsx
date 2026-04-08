'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
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
  const [phoneValid, setPhoneValid] = useState(false);
  const [email, setEmail]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [booking, setBooking]     = useState<Booking | null>(null);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

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
    if (!value.trim()) return 'El teléfono es obligatorio.';
    // Intentar parsear con código de país AR por defecto
    const parsed = parsePhoneNumberFromString(value, 'AR');
    if (!parsed || !parsed.isValid()) return 'Ingresá un número de teléfono válido.';
    return null;
  };

  const handlePhoneBlur = () => {
    if (phone.trim()) {
      const err = validatePhone(phone);
      setPhoneError(err);
      setPhoneValid(!err);
    }
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
      setPhoneValid(false);
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
                    <div className="relative">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setPhoneError(null); setPhoneValid(false); }}
                        onBlur={handlePhoneBlur}
                        placeholder="11-1234-5678"
                        className={[
                          'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent pr-10',
                          phoneError
                            ? 'border-red-400 focus:ring-red-400'
                            : phoneValid
                            ? 'border-green-500 focus:ring-green-500'
                            : 'border-gray-300 focus:ring-green-600',
                        ].join(' ')}
                      />
                      {phoneValid && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {phoneError
                      ? <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                      : phoneValid
                      ? <p className="text-xs text-green-600 mt-1">Número válido.</p>
                      : <p className="text-xs text-gray-400 mt-1">Usá este número para consultar o cancelar tu reserva.</p>
                    }
                    <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-2">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </span>
                      <p className="text-xs text-amber-800 leading-snug">
                        Asegurate de que el número sea correcto. Si el turno se cancela por lluvia u otro motivo, te avisamos por acá.
                      </p>
                    </div>
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

