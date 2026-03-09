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
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isSelected
                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50',
            ].join(' ')}
          >
            <span className="font-medium capitalize text-xs">
              {format(date, 'EEE', { locale: es })}
            </span>
            <span className="text-xl font-bold leading-tight">{format(date, 'd')}</span>
            <span className={`text-xs capitalize ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
              {format(date, 'MMM', { locale: es })}
            </span>
            {today && (
              <span className={`text-[10px] font-semibold mt-0.5 ${isSelected ? 'text-blue-200' : 'text-blue-600'}`}>
                Hoy
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
