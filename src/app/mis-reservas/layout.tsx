import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mis Reservas | Club Atlético Once Unidos',
  description:
    'Consultá y cancelá tus reservas de canchas de tenis en Club Atlético Once Unidos. Solo necesitás tu número de teléfono.',
  openGraph: {
    title: 'Mis Reservas · Once Unidos',
    description: 'Ingresá tu teléfono para ver y gestionar tus turnos.',
    images: ['/imagenes/canchas-panoramica.jpg'],
  },
};

export default function MisReservasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
