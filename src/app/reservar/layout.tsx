import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reservar Turno | Club Atlético Once Unidos',
  description:
    'Reservá tu cancha de tenis en Club Atlético Once Unidos. Disponibilidad en tiempo real para los próximos 7 días, turnos de 60 a 120 minutos, lunes a domingo de 08:00 a 23:00.',
  openGraph: {
    title: 'Reservar Turno · Once Unidos',
    description: 'Disponibilidad en tiempo real. Turnos de 60, 90 o 120 minutos.',
    images: ['/imagenes/canchas-panoramica.jpg'],
  },
};

export default function ReservarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
