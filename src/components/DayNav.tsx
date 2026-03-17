'use client';

import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface DayNavProps {
  dates: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export default function DayNav({ dates, selectedDate, onSelectDate }: DayNavProps) {
  const selectedStr = format(selectedDate, 'yyyy-MM-dd');

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
      {dates.map((date) => {
        const dateStr    = format(date, 'yyyy-MM-dd');
        const isSelected = dateStr === selectedStr;
        const today      = isToday(date);

        return (
          <button
            key={dateStr}
            onClick={() => onSelectDate(date)}
            className={[
              'flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl border text-sm',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600',
              isSelected
                ? 'bg-green-700 border-green-600 text-white shadow-md'
                : 'bg-white/15 backdrop-blur-sm border-white/30 text-white hover:border-green-400 hover:bg-white/25',
            ].join(' ')}
          >
            <span className="font-medium capitalize text-xs">
              {format(date, 'EEE', { locale: es })}
            </span>
            <span className="text-xl font-bold leading-tight">{format(date, 'd')}</span>
            <span className={`text-xs capitalize ${isSelected ? 'text-green-100' : 'text-white/60'}`}>
              {format(date, 'MMM', { locale: es })}
            </span>
            {today && (
              <span className={`text-[10px] font-semibold mt-0.5 ${isSelected ? 'text-green-200' : 'text-green-700'}`}>
                Hoy
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
