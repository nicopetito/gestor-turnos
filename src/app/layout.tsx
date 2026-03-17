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
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
          <nav className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-16 h-14 flex items-center justify-between">
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

        <div className="flex-1">{children}</div>

        <footer className="bg-gray-900 text-gray-300">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-16 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Marca */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Image src="/imagenes/escudo.png" alt="CAOU" width={36} height={36} />
                <span className="font-bold text-white text-lg">Once Unidos</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Club Atlético Once Unidos — Mar del Plata, Buenos Aires.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-2">
              <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-1">Navegación</h3>
              <FooterLink href="/reservar">Reservar cancha</FooterLink>
              <FooterLink href="/mis-reservas">Mis reservas</FooterLink>
              <FooterLink href="/precios">Precios</FooterLink>
              <FooterLink href="https://www.onceunidos.com/" external>Sitio oficial del club</FooterLink>
            </div>

            {/* Contacto y redes */}
            <div className="flex flex-col gap-2">
              <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-1">Contacto</h3>
              <a href="tel:+5492235992495" className="text-sm text-gray-400 hover:text-white transition-colors">
                +54 9 2235 99-2495
              </a>
              <div className="flex items-center gap-4 mt-2">
                <a
                  href="https://www.instagram.com/clubonceunidos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-pink-400 transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a
                  href="https://youtube.com/@onceunidos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  aria-label="YouTube"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-16 py-4 text-center text-xs text-gray-500">
              © {new Date().getFullYear()} Club Atlético Once Unidos. Todos los derechos reservados.
            </div>
          </div>
        </footer>
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

function FooterLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="text-sm text-gray-400 hover:text-white transition-colors">
      {children}
    </Link>
  );
}
