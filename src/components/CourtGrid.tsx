'use client';

import type { CourtAvailability, SlotInfo } from '@/types';
import { generateTimeSlots } from '@/lib/slots';

interface CourtGridProps {
  availability: CourtAvailability[];
  onSlotClick: (slot: SlotInfo) => void;
}

const CELL_STYLES: Record<string, string> = {
  available:
    'bg-green-50 hover:bg-green-100 border-green-200 text-green-800 cursor-pointer hover:shadow-sm',
  booked:
    'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed',
  fixed:
    'bg-indigo-50 border-indigo-200 text-indigo-700 cursor-not-allowed font-medium',
  unavailable:
    'bg-red-50 border-red-100 text-red-300 cursor-not-allowed',
};

const STATUS_LABEL: Record<string, string> = {
  available:   'Libre',
  booked:      'Ocupado',
  unavailable: '—',
};

export default function CourtGrid({ availability, onSlotClick }: CourtGridProps) {
  const times  = generateTimeSlots();
  const courts = [
    ...new Map(
      availability.map((a) => [a.courtId, { id: a.courtId, name: a.courtName }]),
    ).values(),
  ].sort((a, b) => a.id - b.id);

  const slotMap = new Map<string, SlotInfo>();
  for (const ca of availability) {
    for (const slot of ca.slots) {
      slotMap.set(`${ca.courtId}:${slot.time}`, slot);
    }
  }

  if (courts.length === 0) {
    return (
      <p className="text-center text-gray-400 py-16">No hay datos de disponibilidad.</p>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
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
                  if (!slot) {
                    return <td key={court.id} className="px-2 py-1" />;
                  }

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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
        {[
          { color: 'bg-green-100 border-green-200',  label: 'Disponible' },
          { color: 'bg-gray-100 border-gray-200',    label: 'Ocupado'    },
          { color: 'bg-indigo-100 border-indigo-200',label: 'Clase fija' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded border ${color} inline-block`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
