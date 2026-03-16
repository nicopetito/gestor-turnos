'use client';

import { useState, useEffect, useCallback } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import DayNav from '@/components/DayNav';
import CourtGrid from '@/components/CourtGrid';
import BookingModal from '@/components/BookingModal';
import type { CourtAvailability, SlotInfo } from '@/types';

const DAYS_AHEAD = 7;

export default function ReservarPage() {
  const today = startOfDay(new Date());
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  const [selectedDate, setSelectedDate]     = useState<Date>(today);
  const [availability, setAvailability]     = useState<CourtAvailability[]>([]);
  const [loading, setLoading]               = useState(false);
  const [fetchError, setFetchError]         = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot]     = useState<SlotInfo | null>(null);

  const fetchAvailability = useCallback(async (date: Date) => {
    setLoading(true);
    setFetchError(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const res     = await fetch(`/api/availability?from=${dateStr}&to=${dateStr}`);
      const data    = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar disponibilidad');
      setAvailability(data.availability ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability(selectedDate);
  }, [selectedDate, fetchAvailability]);

  const handleSlotClick = (slot: SlotInfo) => {
    if (slot.status !== 'available') return;
    setSelectedSlot(slot);
  };

  const handleBookingSuccess = () => {
    setSelectedSlot(null);
    fetchAvailability(selectedDate);
  };

  const selectedCourtName =
    availability.find((a) => a.courtId === selectedSlot?.courtId)?.courtName ?? '';

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reservar Turno</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hacé clic en un horario libre para reservar. Turnos de 60, 90 o 120 minutos.
          </p>
        </div>

        <DayNav
          dates={dates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin" />
          </div>
        )}

        {!loading && fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && (
          <CourtGrid availability={availability} onSlotClick={handleSlotClick} />
        )}
      </div>

      {selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          courtName={selectedCourtName}
          allAvailability={availability}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleBookingSuccess}
        />
      )}
    </main>
  );
}
