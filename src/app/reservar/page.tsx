'use client';

import { useState, useEffect, useCallback } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import Image from 'next/image';
import DayNav from '@/components/DayNav';
import CourtGrid from '@/components/CourtGrid';
import BookingModal from '@/components/BookingModal';
import { createClient } from '@/lib/supabase/client';
import type { CourtAvailability, Duration, SlotInfo } from '@/types';

const DAYS_AHEAD = 7;

export default function ReservarPage() {
  const today = startOfDay(new Date());
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  const [selectedDate, setSelectedDate]         = useState<Date>(today);
  const [availability, setAvailability]         = useState<CourtAvailability[]>([]);
  const [loading, setLoading]                   = useState(false);
  const [fetchError, setFetchError]             = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot]         = useState<SlotInfo | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<Duration | undefined>(undefined);

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

  // Real-time: re-fetch cuando alguien reserva o cancela en la fecha seleccionada
  useEffect(() => {
    const supabase = createClient();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const channel = supabase
      .channel(`bookings-${dateStr}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `date=eq.${dateStr}` },
        () => { fetchAvailability(selectedDate); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchAvailability]);

  const handleSlotClick = (slot: SlotInfo, duration?: Duration) => {
    if (slot.status !== 'available') return;
    setSelectedSlot(slot);
    setSelectedDuration(duration);
  };

  const handleBookingSuccess = () => {
    fetchAvailability(selectedDate);
  };

  const selectedCourtName =
    availability.find((a) => a.courtId === selectedSlot?.courtId)?.courtName ?? '';

  return (
    <main className="relative min-h-screen">
      <Image
        src="/imagenes/cancha-jugadora.jpg"
        alt="Canchas Once Unidos"
        fill
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white drop-shadow">Reservar Turno</h1>
          <p className="text-sm text-white/70 mt-1 hidden md:block">
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
          <CourtGrid
            availability={availability}
            selectedDate={selectedDate}
            onSlotClick={handleSlotClick}
          />
        )}
      </div>

      {selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          courtName={selectedCourtName}
          allAvailability={availability}
          initialDuration={selectedDuration}
          onClose={() => { setSelectedSlot(null); setSelectedDuration(undefined); }}
          onSuccess={handleBookingSuccess}
        />
      )}
    </main>
  );
}
