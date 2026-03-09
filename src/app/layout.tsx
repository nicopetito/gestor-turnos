import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gestor de Turnos',
  description: 'Reservá tu turno en las canchas de Once Unidos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
          <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-bold text-gray-900 text-lg tracking-tight hover:text-blue-600 transition-colors"
            >
              Canchas
            </Link>
            <div className="flex items-center gap-1">
              <NavLink href="/reservar">Reservar</NavLink>
              <NavLink href="/mis-reservas">Mis Reservas</NavLink>
            </div>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-gray-600 hover:text-blue-600 font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
    >
      {children}
    </Link>
  );
}
