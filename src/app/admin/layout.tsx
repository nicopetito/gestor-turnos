'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ---- Nav links ----
const NAV_LINKS = [
  { href: '/admin',               label: 'Reservas',      short: 'Reservas'  },
  { href: '/admin/clases',        label: 'Clases fijas',  short: 'Clases'    },
  { href: '/admin/usuarios',      label: 'Usuarios',      short: 'Usuarios'  },
  { href: '/admin/mantenimiento', label: 'Mantenimiento', short: 'Mantenim.' },
  { href: '/admin/precios',       label: 'Precios',       short: 'Precios'   },
  { href: '/admin/estadisticas',  label: 'Estadísticas',  short: 'Stats'     },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [input, setInput]       = useState('');
  const [error, setError]       = useState('');
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();

  // Verifica sesión en el servidor al montar (cookie httpOnly)
  useEffect(() => {
    fetch('/api/admin/auth')
      .then((res) => { if (res.ok) setLoggedIn(true); })
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key: input }),
    });
    if (!res.ok) {
      setError('Clave incorrecta.');
      return;
    }
    setLoggedIn(true);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setLoggedIn(false);
    setInput('');
  };

  if (checking) return null;

  // --- Login gate ---
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clave de acceso
              </label>
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={!input}
              className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Admin shell ---
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-gray-900 text-white sticky top-0 z-40">
        {/* Row 1: marca + acciones */}
        <div className="max-w-6xl mx-auto px-4 h-11 flex items-center justify-between border-b border-white/5">
          <span className="font-bold text-sm tracking-wide uppercase text-gray-300">Admin</span>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-gray-400 hover:text-white transition-colors">
              ← Sitio
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
        {/* Row 2: nav links */}
        <div className="max-w-6xl mx-auto px-2 flex gap-0.5 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.map(({ href, label, short }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex-shrink-0 text-sm px-2.5 sm:px-3 py-2.5 transition-colors border-b-2',
                  isActive
                    ? 'border-white text-white font-medium'
                    : 'border-transparent text-gray-400 hover:text-white',
                ].join(' ')}
              >
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
