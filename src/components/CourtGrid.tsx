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
  available:   'bg-green-50 hover:bg-green-100 border-green-200 text-green-800 cursor-pointer hover:shadow-sm',
  booked:      'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed',
  fixed:       'bg-indigo-50 border-indigo-200 text-indigo-700 cursor-not-allowed font-medium',
  unavailable: 'bg-red-50 border-red-100 text-red-300 cursor-not-allowed',
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
    return <p className="text-center text-gray-400 py-16">No hay datos de disponibilidad.</p>;
  }

  // ── Mobile view ─────────────────────────────────────────────────────────────
  const mobileView = (
    <div className="md:hidden">
      {mobileDuration === null ? (
        /* Step 1: elegir duración */
        <div className="px-4 pt-5 pb-4 space-y-4">
          <p className="text-sm font-semibold text-gray-700 text-center">¿Cuánto tiempo necesitás?</p>
          <div className="grid grid-cols-3 gap-3">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setMobileDuration(d); setWarningSlot(null); }}
                className="flex flex-col items-center py-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-green-500 hover:bg-green-50 active:scale-95 transition-all"
              >
                <span className="text-2xl font-bold text-gray-800">{d}</span>
                <span className="text-xs text-gray-400 mt-0.5">min</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Step 2: lista de horarios */
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={() => { setMobileDuration(null); setWarningSlot(null); }}
              className="text-green-700 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              ←
            </button>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-semibold text-gray-700">{mobileDuration} min</span>
            <span className="text-sm text-gray-400">· Elegí un horario</span>
          </div>

          {/* Slot rows */}
          <div className="divide-y divide-gray-100">
            {times.map((time) => {
              // Ocultar slots del pasado cuando es hoy
              if (isSelectedToday && timeToMinutes(time) < nowMinutes) return null;

              const allFixed = isAllFixed(time, availability);
              const best     = getBestDurationAcrossCourts(time, availability);

              // Clase fija en todas las canchas
              if (allFixed) {
                return (
                  <div key={time} className="flex items-center justify-between px-4 py-3 bg-indigo-50/40">
                    <span className="font-mono text-sm text-indigo-500">{time}</span>
                    <span className="text-xs text-indigo-400 font-medium">Clase fija</span>
                  </div>
                );
              }

              // Ninguna cancha disponible
              if (best === 0) {
                return (
                  <div key={time} className="flex items-center justify-between px-4 py-3">
                    <span className="font-mono text-sm text-gray-300">{time}</span>
                    <span className="text-xs text-gray-300">Ocupado</span>
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
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-green-50 active:bg-green-100 transition-colors"
                  >
                    <span className="font-mono text-base font-semibold text-gray-800">{time}</span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-700">Disponible</span>
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
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-amber-50 active:bg-amber-100 transition-colors"
                  >
                    <span className="font-mono text-base font-semibold text-gray-800">{time}</span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-sm font-medium text-amber-700">Solo {best} min</span>
                    </span>
                  </button>

                  {isWarningOpen && (
                    <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <p className="text-sm text-amber-800 leading-relaxed">
                        En este horario solo hay <strong>{best} min</strong> disponibles.{' '}
                        <span className="text-amber-600">(pediste {mobileDuration} min)</span>
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
                          className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
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
          <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            {[
              { dot: 'bg-green-500',  label: 'Disponible' },
              { dot: 'bg-amber-400',  label: 'Disponible parcial' },
              { dot: 'bg-indigo-400', label: 'Clase fija' },
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
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20 border-r border-gray-200">
                Hora
              </th>
              {courts.map((court) => (
                <th
                  key={court.id}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]"
                >
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {times.map((time, idx) => (
              <tr key={time} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5 font-mono text-xs text-gray-500 border-r border-gray-200">
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
                          ? slot.label ?? 'Clase'
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

      <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
        {[
          { color: 'bg-green-100 border-green-200',   label: 'Disponible'  },
          { color: 'bg-gray-100 border-gray-200',     label: 'Ocupado'     },
          { color: 'bg-indigo-100 border-indigo-200', label: 'Clase fija'  },
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
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
      {mobileView}
      {desktopView}
    </div>
  );
}
