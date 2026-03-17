import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Club Atlético Once Unidos',
  description: 'Reservá tu turno en las canchas de Club Atlético Once Unidos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
          <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/imagenes/escudo.png"
                alt="CAOU"
                width={30}
                height={30}
              />
              <span className="font-bold text-gray-900 text-base tracking-tight hidden sm:block">
                Once Unidos
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <NavLink href="/reservar">Reservar</NavLink>
              <NavLink href="/mis-reservas">Mis Reservas</NavLink>
              <NavLink href="/precios">Precios</NavLink>
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
      className="text-sm text-gray-600 hover:text-green-700 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
    >
      {children}
    </Link>
  );
}
