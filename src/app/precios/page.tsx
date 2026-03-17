import Image from 'next/image';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Price } from '@/types';

const DURATION_LABELS: Record<number, string> = {
  60:  '1 hora',
  90:  '1½ hora',
  120: '2 horas',
};

function formatPrice(amount: number) {
  return `$${amount.toLocaleString('es-AR')}`;
}

async function getPrices(): Promise<Price[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('prices')
    .select('*')
    .order('is_member', { ascending: false })
    .order('duration_minutes');
  return data ?? [];
}

export default async function PreciosPage() {
  const prices = await getPrices();

  const socios   = prices.filter((p) => p.is_member);
  const noSocios = prices.filter((p) => !p.is_member);
  const durations = [60, 90, 120].filter((d) =>
    prices.some((p) => p.duration_minutes === d),
  );

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      {/* Full-page background */}
      <Image
        src="/imagenes/canchas-panoramica.jpg"
        alt="Canchas Once Unidos"
        fill
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-black/65" />

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <Image
            src="/imagenes/escudo.png"
            alt="CAOU"
            width={56}
            height={56}
            className="drop-shadow-lg"
          />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow">
              Lista de Precios
            </h1>
            <p className="text-sm text-white/60 mt-1">Canchas de tenis · Club Atlético Once Unidos</p>
          </div>
        </div>

        {/* Cards side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <PriceCard title="Socios" rows={socios} durations={durations} />
          <PriceCard title="No socios" rows={noSocios} durations={durations} />
        </div>

        {/* Disclaimer */}
        <div className="mt-6 bg-black/40 border border-white/20 backdrop-blur-sm rounded-2xl px-5 py-4 text-sm text-white/80">
          <p className="font-semibold text-white mb-1">⚡ Uso de luz</p>
          <p className="leading-relaxed">
            El uso de luz tiene un costo adicional, ya incluido en los precios indicados.
            Consultá con el club si tu horario requiere iluminación artificial.
          </p>
        </div>
      </div>
    </div>
  );
}

function PriceCard({
  title,
  rows,
  durations,
}: {
  title: string;
  rows: Price[];
  durations: number[];
}) {
  const isMember = rows[0]?.is_member ?? false;

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-3.5 ${isMember ? 'bg-green-600/80' : 'bg-white/15'}`}>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>

      <div className="divide-y divide-white/10">
        {durations.flatMap((d) => {
          const sinLuz = rows.find((r) => r.duration_minutes === d && !r.con_luz);
          const conLuz = rows.find((r) => r.duration_minutes === d &&  r.con_luz);
          const items = [];
          if (sinLuz) items.push(
            <PriceRow key={`${d}-sin`} label={DURATION_LABELS[d] ?? `${d} min`} price={sinLuz.amount} />,
          );
          if (conLuz) items.push(
            <PriceRow key={`${d}-con`} label={`${DURATION_LABELS[d] ?? `${d} min`} con luz`} price={conLuz.amount} withLight />,
          );
          return items;
        })}
      </div>
    </div>
  );
}

function PriceRow({
  label,
  price,
  withLight = false,
}: {
  label: string;
  price: number;
  withLight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className={`text-sm ${withLight ? 'text-white/55' : 'text-white/90 font-medium'}`}>
        {withLight && <span className="mr-1.5">💡</span>}
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${withLight ? 'text-white/60' : 'text-white'}`}>
        {formatPrice(price)}
      </span>
    </div>
  );
}
