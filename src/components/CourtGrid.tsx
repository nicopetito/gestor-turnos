'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { CourtAvailability, Duration, SlotInfo } from '@/types';
import { generateTimeSlots, isDurationAvailable, timeToMinutes } from '@/lib/slots';

interface CourtGridProps {
  availability: CourtAvailability[];
  selectedDate: Date;
  onSlotClick: (slot: SlotInfo, duration?: Duration) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMaxDuration(time: string, courtSlots: SlotInfo[]): Duration | 0 {
  if (isDurationAvailable(time, 120, courtSlots)) return 120;
  if (isDurationAvailable(time, 90, courtSlots)) return 90;
  if (isDurationAvailable(time, 60, courtSlots)) return 60;
  return 0;
}

function getBestDurationAcrossCourts(time: string, availability: CourtAvailability[]): Duration | 0 {
  let best: Duration | 0 = 0;
  for (const ca of availability) {
    const d = getMaxDuration(time, ca.slots);
    if (d > best) best = d as Duration | 0;
  }
  return best;
}

/** Asigna la cancha más restringida que encaje, preservando las más libres para reservas largas */
function autoAssignCourt(time: string, duration: Duration, availability: CourtAvailability[]): CourtAvailability | null {
  const candidates = availability
    .filter((ca) => isDurationAvailable(time, duration, ca.slots))
    .map((ca) => ({ ca, maxDur: getMaxDuration(time, ca.slots) }))
    .sort((a, b) => a.maxDur - b.maxDur); // más restringida primero
  return candidates[0]?.ca ?? null;
}

function isAllFixed(time: string, availability: CourtAvailability[]): boolean {
  if (availability.length === 0) return false;
  return availability.every((ca) => {
    const slot = ca.slots.find((s) => s.time === time);
    return slot?.status === 'fixed';
  });
}

// ── Desktop cell styles ───────────────────────────────────────────────────────

const CELL_STYLES: Record<string, string> = {
  available:   'bg-green-500/20 hover:bg-green-500/30 border-green-400/40 text-green-200 cursor-pointer hover:shadow-sm',
  booked:      'bg-indigo-500/20 border-indigo-400/40 text-indigo-200 cursor-not-allowed',
  fixed:       'bg-indigo-500/20 border-indigo-400/40 text-indigo-200 cursor-not-allowed',
  unavailable: 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200 cursor-not-allowed',
};

const STATUS_LABEL: Record<string, string> = {
  available:   'Libre',
  booked:      'Ocupado',
  unavailable: '—',
};

const DURATIONS: Duration[] = [60, 90, 120];

// ── Component ────────────────────────────────────────────────────────────────

export default function CourtGrid({ availability, selectedDate, onSlotClick }: CourtGridProps) {
  const times  = generateTimeSlots();
  const courts = [
    ...new Map(availability.map((a) => [a.courtId, { id: a.courtId, name: a.courtName }])).values(),
  ].sort((a, b) => a.id - b.id);

  const slotMap = new Map<string, SlotInfo>();
  for (const ca of availability) {
    for (const slot of ca.slots) {
      slotMap.set(`${ca.courtId}:${slot.time}`, slot);
    }
  }

  // Mobile state
  const [mobileDuration, setMobileDuration] = useState<Duration | null>(null);
  const [warningSlot, setWarningSlot]       = useState<{ time: string; maxDuration: Duration } | null>(null);

  // Filter past times when viewing today
  const todayStr        = format(new Date(), 'yyyy-MM-dd');
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedToday = selectedDateStr === todayStr;
  const nowMinutes      = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  function handleMobileSlotTap(time: string) {
    if (!mobileDuration) return;
    const best = getBestDurationAcrossCourts(time, availability);
    if (best === 0) return;

    if (best >= mobileDuration) {
      const assigned = autoAssignCourt(time, mobileDuration, availability);
      if (!assigned) return;
      const slot = assigned.slots.find((s) => s.time === time);
      if (!slot) return;
      onSlotClick(slot, mobileDuration);
    } else {
      setWarningSlot({ time, maxDuration: best as Duration });
    }
  }

  function handleWarningConfirm() {
    if (!warningSlot) return;
    const { time, maxDuration } = warningSlot;
    const assigned = autoAssignCourt(time, maxDuration, availability);
    if (!assigned) return;
    const slot = assigned.slots.find((s) => s.time === time);
    if (!slot) return;
    setWarningSlot(null);
    onSlotClick(slot, maxDuration);
  }

  if (courts.length === 0) {
    return <p className="text-center text-white/50 py-16">No hay datos de disponibilidad.</p>;
  }

  // ── Mobile view ─────────────────────────────────────────────────────────────
  const mobileView = (
    <div className="md:hidden">
      {mobileDuration === null ? (
        /* Step 1: elegir duración */
        <div className="px-4 pt-5 pb-4 space-y-4">
          <p className="text-sm font-semibold text-white/80 text-center">¿Cuánto tiempo necesitás?</p>
          <div className="grid grid-cols-3 gap-3">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setMobileDuration(d); setWarningSlot(null); }}
                className="flex flex-col items-center py-5 rounded-2xl border-2 border-white/25 bg-white/15 backdrop-blur-sm hover:border-green-400 hover:bg-white/25 active:scale-95 transition-all"
              >
                <span className="text-2xl font-bold text-white">{d}</span>
                <span className="text-xs text-white/50 mt-0.5">min</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Step 2: lista de horarios */
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/10">
            <button
              type="button"
              onClick={() => { setMobileDuration(null); setWarningSlot(null); }}
              className="text-green-400 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              ←
            </button>
            <span className="text-sm text-white/30">|</span>
            <span className="text-sm font-semibold text-white/80">{mobileDuration} min</span>
            <span className="text-sm text-white/40">· Elegí un horario</span>
          </div>

          {/* Slot rows */}
          <div className="divide-y divide-white/10">
            {times.map((time) => {
              // Ocultar slots del pasado cuando es hoy
              if (isSelectedToday && timeToMinutes(time) < nowMinutes) return null;

              const allFixed = isAllFixed(time, availability);
              const best     = getBestDurationAcrossCourts(time, availability);

              // Ocupado en todas las canchas
              if (allFixed) {
                return (
                  <div key={time} className="flex items-center justify-between px-4 py-3 bg-indigo-500/15">
                    <span className="font-mono text-sm text-indigo-300">{time}</span>
                    <span className="text-xs text-indigo-300 font-medium">Ocupado</span>
                  </div>
                );
              }

              // Ninguna cancha disponible
              if (best === 0) {
                return (
                  <div key={time} className="flex items-center justify-between px-4 py-3 bg-indigo-500/15">
                    <span className="font-mono text-sm text-indigo-300">{time}</span>
                    <span className="text-xs text-indigo-300 font-medium">Ocupado</span>
                  </div>
                );
              }

              const isWarningOpen = warningSlot?.time === time;

              // Disponible para la duración solicitada
              if (best >= mobileDuration) {
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleMobileSlotTap(time)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-green-500/20 active:bg-green-500/30 transition-colors"
                  >
                    <span className="font-mono text-base font-semibold text-white">{time}</span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-sm font-medium text-green-300">Disponible</span>
                    </span>
                  </button>
                );
              }

              // Disponible parcial (warning)
              return (
                <div key={time}>
                  <button
                    type="button"
                    onClick={() =>
                      isWarningOpen
                        ? setWarningSlot(null)
                        : setWarningSlot({ time, maxDuration: best as Duration })
                    }
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-amber-500/15 active:bg-amber-500/25 transition-colors"
                  >
                    <span className="font-mono text-base font-semibold text-white">{time}</span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-sm font-medium text-amber-300">Solo {best} min</span>
                    </span>
                  </button>

                  {isWarningOpen && (
                    <div className="mx-4 mb-3 bg-amber-500/15 border border-amber-400/30 rounded-xl p-4 space-y-3">
                      <p className="text-sm text-amber-200 leading-relaxed">
                        En este horario solo hay <strong>{best} min</strong> disponibles.{' '}
                        <span className="text-amber-300">(pediste {mobileDuration} min)</span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleWarningConfirm}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                        >
                          Tomar {best} min
                        </button>
                        <button
                          type="button"
                          onClick={() => setWarningSlot(null)}
                          className="flex-1 bg-white/15 border border-white/25 text-white/80 text-sm font-medium py-2.5 rounded-lg hover:bg-white/25 transition-colors"
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

          {/* Legend */}
          <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-white/10 bg-white/10 text-xs text-white/50">
            {[
              { dot: 'bg-green-500',  label: 'Disponible' },
              { dot: 'bg-amber-400',  label: 'Disponible parcial' },
              { dot: 'bg-indigo-400', label: 'Ocupado'    },
            ].map(({ dot, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Desktop view (sin cambios) ───────────────────────────────────────────────
  const desktopView = (
    <div className="hidden md:block">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-white/10 border-b border-white/15">
              <th className="sticky left-0 z-10 bg-white/10 backdrop-blur-sm px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider w-20 border-r border-white/15">
                Hora
              </th>
              {courts.map((court) => (
                <th
                  key={court.id}
                  className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider min-w-[150px]"
                >
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {times.map((time, idx) => (
              <tr key={time} className={idx % 2 === 0 ? 'bg-transparent' : 'bg-white/5'}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5 font-mono text-xs text-white/50 border-r border-white/15">
                  {time}
                </td>
                {courts.map((court) => {
                  const slot = slotMap.get(`${court.id}:${time}`);
                  if (!slot) return <td key={court.id} className="px-2 py-1" />;
                  return (
                    <td key={court.id} className="px-2 py-1">
                      <button
                        type="button"
                        disabled={slot.status !== 'available'}
                        onClick={() => onSlotClick(slot)}
                        className={[
                          'w-full rounded-md border px-2 py-1.5 text-xs transition-all',
                          CELL_STYLES[slot.status] ?? '',
                        ].join(' ')}
                        title={
                          slot.status === 'fixed'
                            ? slot.label
                            : slot.status === 'booked'
                            ? 'Horario ocupado'
                            : undefined
                        }
                      >
                        {slot.status === 'fixed'
                          ? 'Ocupado'
                          : STATUS_LABEL[slot.status] ?? slot.status}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-white/10 bg-white/10 text-xs text-white/50">
        {[
          { color: 'bg-green-500/25 border-green-400/40',   label: 'Disponible' },
          { color: 'bg-indigo-500/25 border-indigo-400/40', label: 'Ocupado'    },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded border ${color} inline-block`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-white/20 shadow-sm overflow-hidden bg-white/10 backdrop-blur-md">
      {mobileView}
      {desktopView}
    </div>
  );
}
